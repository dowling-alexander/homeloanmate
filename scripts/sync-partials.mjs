import { readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const header = await readFile(path.join(root, "partials", "header.html"), "utf8");
const footer = await readFile(path.join(root, "partials", "footer.html"), "utf8");

const managedHeader = `<!-- shared-header:start -->\n${header.trim()}\n<!-- shared-header:end -->`;
const managedFooter = `<!-- shared-footer:start -->\n${footer.trim()}\n<!-- shared-footer:end -->`;

// These legacy snippets appeared on only some pages. The shared header now owns
// both loaders, so each page receives exactly one copy.
const legacyGoogleTag = /\s*<!-- Google tag \(gtag\.js\) -->\s*<script\b[^>]*googletagmanager\.com\/gtag\/js\?id=G-GKLL8W3BP2[^>]*><\/script>\s*<script>\s*window\.dataLayer[\s\S]*?gtag\('config',\s*'G-GKLL8W3BP2'\);\s*<\/script>/gi;
const legacyAdsenseLoader = /\s*<script\b[^>]*src=["']https:\/\/pagead2\.googlesyndication\.com\/[^"']*client=ca-pub-6595597891926669[^>]*><\/script>/gi;
const invalidAdPlaceholder = /\s*<div\s+class=["']ad-slot["'][^>]*>\s*<ins\s+class=["']adsbygoogle["'][^>]*data-ad-client=["']["'][^>]*><\/ins>\s*<\/div>\s*(?:<script>\s*if\s*\(window\.ADSENSE_CLIENT[\s\S]*?<\/script>)?/gi;

async function walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...await walk(full));
    if (entry.isFile() && entry.name.endsWith(".html") && !full.includes(`${path.sep}partials${path.sep}`)) files.push(full);
  }
  return files;
}

function replaceBlock(html, startMarker, endMarker, replacement) {
  const managed = new RegExp(`<!-- ${startMarker} -->[\\s\\S]*?<!-- ${endMarker} -->`, "m");
  if (managed.test(html)) return html.replace(managed, replacement);
  return null;
}

function replaceFirstTagBlock(html, tagName, classNeedle, replacement) {
  const start = classNeedle
    ? html.indexOf(`<${tagName} ${classNeedle}`)
    : html.indexOf(`<${tagName}`);
  if (start === -1) return html;
  const close = html.indexOf(`</${tagName}>`, start);
  if (close === -1) return html;
  return `${html.slice(0, start)}${replacement}${html.slice(close + tagName.length + 3)}`;
}

let changed = 0;
for (const file of await walk(root)) {
  let html = await readFile(file, "utf8");
  const before = html;

  html = html
    .replace(legacyGoogleTag, "\n")
    .replace(legacyAdsenseLoader, "\n")
    .replace(invalidAdPlaceholder, "\n");
  html = replaceBlock(html, "shared-header:start", "shared-header:end", managedHeader)
    ?? replaceFirstTagBlock(html, "header", 'class="header"', managedHeader);
  html = replaceBlock(html, "shared-footer:start", "shared-footer:end", managedFooter)
    ?? replaceFirstTagBlock(html, "footer", "", managedFooter);

  if (html !== before) {
    await writeFile(file, html, "utf8");
    changed += 1;
  }
}

console.log(`Synced shared header/footer in ${changed} HTML files`);
