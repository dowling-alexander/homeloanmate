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

const refinanceCalculator = await readFile(path.join(root, "refinance-break-even-calculator.html"), "utf8");
assert.ok(refinanceCalculator.includes("RefinanceBreakEven.compare"), "Refinance calculator must use the shared comparison model");
assert.ok(refinanceCalculator.includes('calculator_name: "refinance_break_even"'), "Refinance calculator must track result views");

const styles = await readFile(path.join(root, "styles.css"), "utf8");
assert.match(styles, /img\{display:block;max-width:100%;height:auto\}/, "Images must not overflow narrow screens");
assert.match(styles, /\.prose table\{display:block;overflow-x:auto;white-space:nowrap\}/, "Wide guide tables must scroll on narrow screens");

const borrowingPowerPage = await readFile(path.join(root, "index.html"), "utf8");
assert.match(borrowingPowerPage, /<details class="advanced-options">/, "Borrowing power calculator must group optional inputs");
assert.ok(borrowingPowerPage.indexOf('id="expensesSlider"') < borrowingPowerPage.indexOf('<details class="advanced-options">'), "Core affordability inputs must remain visible before advanced options");
assert.match(styles, /\.result-item\{display:grid;grid-template-columns:minmax\(0,1fr\) auto/, "Result rows must preserve room for labels and values");

console.log(`Site configuration checks passed for ${pages.length} pages`);
