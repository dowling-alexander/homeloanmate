import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const pages = [];

async function walk(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory() && entry.name !== "partials" && entry.name !== "content") await walk(full);
    if (entry.isFile() && entry.name.endsWith(".html")) pages.push(full);
  }
}

await walk(root);
for (const page of pages) {
  const html = await readFile(page, "utf8");
  const label = path.relative(root, page);
  assert.equal((html.match(/pagead2\.googlesyndication\.com\/pagead\/js\/adsbygoogle\.js\?client=ca-pub-6595597891926669/g) || []).length, 1, `${label} must include one AdSense loader`);
  assert.equal((html.match(/googletagmanager\.com\/gtag\/js\?id=G-GKLL8W3BP2/g) || []).length, 1, `${label} must include one Analytics loader`);
  assert.ok(!html.includes('data-ad-client=""'), `${label} contains an incomplete manual ad unit`);
  assert.ok(!html.includes('data-ad-slot="auto"'), `${label} contains a placeholder ad slot`);
}

const analyticsScript = await readFile(path.join(root, "script_not_minified.js"), "utf8");
for (const eventName of ["calculator_started", "calculator_result_viewed", "content_navigation"]) {
  assert.ok(analyticsScript.includes(eventName), `Analytics source must track ${eventName}`);
}

const negativeGearingCalculator = await readFile(path.join(root, "negative-gearing-calculator.html"), "utf8");
assert.ok(negativeGearingCalculator.includes("calculator_result_viewed"), "Negative gearing calculator must track a viewed result");

console.log(`Site configuration checks passed for ${pages.length} pages`);
