import { readFile, readdir, writeFile, access, unlink } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const contentDir = path.join(root, "content", "guides");
const guidesDir = path.join(root, "guides");
const checkOnly = process.argv.includes("--check");
const allowedTopics = new Set(["borrowing", "repayments", "lmi", "firsthome", "stampduty", "equity", "neggearing"]);

const escapeHtml = (value) => String(value)
  .replaceAll("&", "&amp;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;")
  .replaceAll("'", "&#39;");

function parseGuide(source, filename) {
  const match = source.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
  if (!match) throw new Error(`${filename} must begin with front matter between --- lines.`);

  const metadata = {};
  for (const line of match[1].split(/\r?\n/)) {
    const entry = line.match(/^([a-z_]+):\s*(.+)$/i);
    if (!entry) throw new Error(`${filename} has invalid front matter: ${line}`);
    metadata[entry[1]] = entry[2].trim();
  }

  const slug = path.basename(filename, ".md");
  for (const key of ["title", "description", "topic", "date", "image", "image_alt"]) {
    if (!metadata[key]) throw new Error(`${filename} is missing required '${key}' front matter.`);
  }
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) throw new Error(`${filename} must use a lowercase kebab-case filename.`);
  if (!allowedTopics.has(metadata.topic)) throw new Error(`${filename} has an unsupported topic '${metadata.topic}'.`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(metadata.date)) throw new Error(`${filename} must use YYYY-MM-DD for date.`);
  if (metadata.updated && !/^\d{4}-\d{2}-\d{2}$/.test(metadata.updated)) throw new Error(`${filename} must use YYYY-MM-DD for updated.`);
  if (!metadata.image.startsWith("/")) throw new Error(`${filename} image must be a root-relative path.`);

  return { ...metadata, slug, body: match[2].trim() };
}

function renderInline(value) {
  return escapeHtml(value)
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/\*([^*]+)\*/g, "<em>$1</em>")
    .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+|\/[^\s)]*)\)/g, '<a href="$2">$1</a>');
}

function renderMarkdown(markdown) {
  const lines = markdown.split(/\r?\n/);
  const blocks = [];
  let paragraph = [];
  let list = null;

  const flushParagraph = () => {
    if (paragraph.length) blocks.push(`<p>${renderInline(paragraph.join(" "))}</p>`);
    paragraph = [];
  };
  const flushList = () => {
    if (!list) return;
    blocks.push(`<${list.type}>${list.items.map((item) => `<li>${renderInline(item)}</li>`).join("")}</${list.type}>`);
    list = null;
  };

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) {
      flushParagraph();
      flushList();
      continue;
    }
    const heading = line.match(/^(#{2,3})\s+(.+)$/);
    const bullet = line.match(/^[-*]\s+(.+)$/);
    const ordered = line.match(/^\d+\.\s+(.+)$/);
    if (heading) {
      flushParagraph();
      flushList();
      const level = heading[1].length;
      blocks.push(`<h${level}>${renderInline(heading[2])}</h${level}>`);
    } else if (line === "---") {
      flushParagraph();
      flushList();
      blocks.push("<hr>");
    } else if (line.startsWith("> ")) {
      flushParagraph();
      flushList();
      blocks.push(`<blockquote><p>${renderInline(line.slice(2))}</p></blockquote>`);
    } else if (bullet || ordered) {
      flushParagraph();
      const type = bullet ? "ul" : "ol";
      const item = (bullet || ordered)[1];
      if (!list || list.type !== type) {
        flushList();
        list = { type, items: [] };
      }
      list.items.push(item);
    } else {
      flushList();
      paragraph.push(line);
    }
  }
  flushParagraph();
  flushList();
  return blocks.join("\n      ");
}

function displayDate(date) {
  return new Intl.DateTimeFormat("en-AU", { day: "numeric", month: "long", year: "numeric", timeZone: "Australia/Hobart" }).format(new Date(`${date}T00:00:00+10:00`));
}

function readingTime(body) {
  const words = body.replace(/[`#*\[\]()>/_-]/g, " ").trim().split(/\s+/).filter(Boolean).length;
  return `${Math.max(1, Math.ceil(words / 200))} min read`;
}

function guideHtml(guide, header, footer) {
  const canonical = `https://borrowpower.com.au/guides/${guide.slug}.html`;
  const updated = guide.updated || guide.date;
  const schema = JSON.stringify({
    "@context": "https://schema.org",
    "@type": "Article",
    headline: guide.title,
    description: guide.description,
    datePublished: guide.date,
    dateModified: updated,
    image: `https://borrowpower.com.au${guide.image}`,
    mainEntityOfPage: canonical,
    author: { "@type": "Organization", name: "BorrowPower" },
    publisher: { "@type": "Organization", name: "BorrowPower" }
  }).replaceAll("<", "\\u003c");

  return `<!doctype html>
<html lang="en-AU">
<head>
  <meta charset="utf-8">
  <title>${escapeHtml(guide.title)} | BorrowPower</title>
  <meta name="description" content="${escapeHtml(guide.description)}">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <link rel="canonical" href="${canonical}">
  <meta name="robots" content="index,follow">
  <link rel="stylesheet" href="/styles.css">
  <link rel="icon" type="image/png" href="/borrowpower-favicon.png">
  <meta property="og:title" content="${escapeHtml(guide.title)} | BorrowPower">
  <meta property="og:description" content="${escapeHtml(guide.description)}">
  <meta property="og:type" content="article">
  <meta property="og:url" content="${canonical}">
  <meta property="og:image" content="https://borrowpower.com.au${escapeHtml(guide.image)}">
  <meta property="og:site_name" content="BorrowPower">
  <script type="application/ld+json">${schema}</script>
</head>
<body>
  <!-- generated-guide: ${guide.slug} -->
  <!-- shared-header:start -->
${header.trim()}
  <!-- shared-header:end -->
  <main class="container" id="main">
    <article class="card prose" itemscope itemtype="https://schema.org/Article">
      <p class="eyebrow-static">${escapeHtml(guide.topic)}</p>
      <h1 itemprop="headline">${escapeHtml(guide.title)}</h1>
      <p class="helper">Published <time datetime="${guide.date}" itemprop="datePublished">${displayDate(guide.date)}</time> · Updated <time datetime="${updated}" itemprop="dateModified">${displayDate(updated)}</time> · ${readingTime(guide.body)}</p>
      <img class="guide-feature-image" src="${escapeHtml(guide.image)}" alt="${escapeHtml(guide.image_alt)}" width="1200" height="675" loading="eager">
      <div itemprop="articleBody">
      ${renderMarkdown(guide.body)}
      </div>
      <section class="disclaimer">
        <p>General information only and not financial advice. Consider independent advice for your circumstances.</p>
      </section>
    </article>
    <div data-include="/partials/important-information.html"></div>
    <!-- shared-footer:start -->
${footer.trim()}
    <!-- shared-footer:end -->
  </main>
  <script defer src="/assets/include.js"></script>
  <script defer src="/script.js"></script>
</body>
</html>
`;
}

function guideCard(guide) {
  return `      <article class="card card-post" data-topic="${escapeHtml(guide.topic)}">
        <a class="thumb" href="/guides/${guide.slug}.html" aria-label="Open ${escapeHtml(guide.title)}">
          <img src="${escapeHtml(guide.image)}" alt="${escapeHtml(guide.image_alt)}" loading="lazy" width="480" height="270">
          <span class="eyebrow">${escapeHtml(guide.topic)}</span>
        </a>
        <div class="body">
          <h2><a href="/guides/${guide.slug}.html">${escapeHtml(guide.title)}</a></h2>
          <p class="excerpt">${escapeHtml(guide.description)}</p>
          <p class="meta">Updated <time datetime="${guide.updated || guide.date}">${displayDate(guide.updated || guide.date)}</time> · ${readingTime(guide.body)}</p>
        </div>
      </article>`;
}

function replaceGeneratedBlock(source, start, end, content, label) {
  const startMarker = `<!-- ${start} -->`;
  const endMarker = `<!-- ${end} -->`;
  const startIndex = source.indexOf(startMarker);
  const endIndex = source.indexOf(endMarker, startIndex + startMarker.length);
  if (startIndex === -1 || endIndex === -1) throw new Error(`${label} is missing its generated-guide markers.`);

  const lineStart = source.lastIndexOf("\n", startIndex) + 1;
  const lineEnd = source.indexOf("\n", endIndex);
  const indent = source.slice(lineStart, startIndex);
  const generated = content ? `${content}\n` : "";
  return `${source.slice(0, lineStart)}${indent}${startMarker}\n${generated}${indent}${endMarker}${source.slice(lineEnd === -1 ? source.length : lineEnd)}`;
}

async function writeIfNeeded(file, content) {
  content = content.replaceAll("\r\n", "\n");
  let current = "";
  try { current = await readFile(file, "utf8"); } catch { /* New generated guide. */ }
  if (current === content) return false;
  if (checkOnly) throw new Error(`${path.relative(root, file)} is out of date. Run npm run build.`);
  await writeFile(file, content, "utf8");
  return true;
}

try {
  await access(contentDir);
} catch {
  if (checkOnly) throw new Error("content/guides is missing.");
  console.log("Generated 0 guides");
  process.exit(0);
}

const [header, footer] = await Promise.all([
  readFile(path.join(root, "partials", "header.html"), "utf8"),
  readFile(path.join(root, "partials", "footer.html"), "utf8")
]);
const guideFiles = (await readdir(contentDir)).filter((file) => file.endsWith(".md") && !file.startsWith("_") && file !== "README.md");
const guides = [];
for (const file of guideFiles) guides.push(parseGuide(await readFile(path.join(contentDir, file), "utf8"), file));
guides.sort((a, b) => (b.updated || b.date).localeCompare(a.updated || a.date));

let changed = 0;
for (const guide of guides) {
  const output = path.join(guidesDir, `${guide.slug}.html`);
  let existing = "";
  try { existing = await readFile(output, "utf8"); } catch { /* A new guide is expected. */ }
  if (existing && !existing.includes(`<!-- generated-guide: ${guide.slug} -->`)) {
    throw new Error(`Refusing to overwrite existing guide ${path.relative(root, output)}. Choose a new slug or migrate it deliberately.`);
  }
  if (await writeIfNeeded(output, guideHtml(guide, header, footer))) changed += 1;
}

const activeSlugs = new Set(guides.map((guide) => guide.slug));
for (const file of await readdir(guidesDir)) {
  if (!file.endsWith(".html") || file === "guides-index.html" || file === "blog-template.html") continue;
  const output = path.join(guidesDir, file);
  const existing = await readFile(output, "utf8");
  const marker = existing.match(/<!-- generated-guide: ([a-z0-9-]+) -->/);
  if (!marker || activeSlugs.has(marker[1])) continue;
  if (checkOnly) throw new Error(`${path.relative(root, output)} no longer has a Markdown source file. Run npm run build.`);
  await unlink(output);
  changed += 1;
}

const indexPath = path.join(guidesDir, "guides-index.html");
const sitemapPath = path.join(root, "sitemap.xml");
const index = await readFile(indexPath, "utf8");
const sitemap = await readFile(sitemapPath, "utf8");
const cards = guides.map(guideCard).join("\n\n");
const urls = guides.map((guide) => `  <url><loc>https://borrowpower.com.au/guides/${guide.slug}.html</loc><lastmod>${guide.updated || guide.date}</lastmod></url>`).join("\n");
if (await writeIfNeeded(indexPath, replaceGeneratedBlock(index, "generated-guides:start", "generated-guides:end", cards, "guides-index.html"))) changed += 1;
if (await writeIfNeeded(sitemapPath, replaceGeneratedBlock(sitemap, "generated-guides:start", "generated-guides:end", urls, "sitemap.xml"))) changed += 1;

console.log(`Generated ${guides.length} guides (${changed} files changed)`);
