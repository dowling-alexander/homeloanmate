import assert from "node:assert/strict";
import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const files = new Map();
const htmlFiles = [];

async function walk(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      await walk(full);
    } else {
      const rel = "/" + path.relative(root, full).replaceAll(path.sep, "/");
      files.set(rel.toLowerCase(), full);
      if (entry.name.endsWith(".html") && entry.name !== "blog-template.html") {
        htmlFiles.push(full);
      }
    }
  }
}

function localPathFromUrl(currentFile, rawUrl) {
  if (!rawUrl || /^(#|mailto:|tel:|javascript:|data:)/i.test(rawUrl)) return null;
  if (/^https?:\/\//i.test(rawUrl)) {
    const parsed = new URL(rawUrl);
    return parsed.hostname === "borrowpower.com.au" ? parsed.pathname : null;
  }
  if (rawUrl.startsWith("/")) return new URL(rawUrl, "https://borrowpower.com.au/").pathname;

  const relativePath = rawUrl.split("#")[0].split("?")[0];
  const rel = path.relative(root, path.resolve(path.dirname(currentFile), relativePath));
  return "/" + rel.replaceAll(path.sep, "/");
}

await walk(root);
files.set("/", path.join(root, "index.html"));

const failures = [];
for (const file of htmlFiles) {
  const html = await readFile(file, "utf8");
  const attrs = [...html.matchAll(/\s(?:href|src|data-include)=["']([^"']+)["']/gi)];
  for (const [, rawUrl] of attrs) {
    const pathname = localPathFromUrl(file, rawUrl);
    if (!pathname) continue;
    const key = pathname.endsWith("/") ? `${pathname.toLowerCase()}index.html` : pathname.toLowerCase();
    const exists = pathname === "/" ? true : files.has(key);
    if (!exists) failures.push(`${path.relative(root, file)} -> ${rawUrl}`);
  }
}

assert.equal(failures.length, 0, `Broken local links:\n${failures.join("\n")}`);
console.log(`Checked ${htmlFiles.length} HTML files`);
