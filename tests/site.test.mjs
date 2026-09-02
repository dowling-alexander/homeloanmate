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
assert.ok(!pages.some((page) => page.endsWith(path.join("guides", "blog-template.html"))), "A public placeholder article template must not be deployed");
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

const firstHomeSchemesCalculator = await readFile(path.join(root, "first-home-schemes-calculator.html"), "utf8");
assert.ok(firstHomeSchemesCalculator.includes("FirstHomeSchemes.assess"), "First home schemes calculator must use the shared scheme model");
assert.ok(firstHomeSchemesCalculator.includes('calculator_name: "first_home_schemes"'), "First home schemes calculator must track result views");
assert.ok(firstHomeSchemesCalculator.includes("government-home-buyer-schemes.html"), "First home schemes calculator must link to its guide");
assert.ok(firstHomeSchemesCalculator.includes("deposit-upfront-costs.html"), "First home schemes calculator must link to the deposit planner");

const firstHomeHub = await readFile(path.join(root, "guides", "first-home-buyer.html"), "utf8");
assert.ok(firstHomeHub.includes("first-home-schemes-calculator.html"), "First home buyer hub must link to the scheme checker");
assert.ok(firstHomeHub.includes("deposit-upfront-costs.html"), "First home buyer hub must link to the deposit planner");

const depositPlanner = await readFile(path.join(root, "deposit-upfront-costs.html"), "utf8");
assert.ok(depositPlanner.includes("DepositUpfrontCosts.calculate"), "Deposit planner must use the shared purchase-cost model");
assert.ok(depositPlanner.includes('calculator_name: "deposit_upfront_costs"'), "Deposit planner must track result views");
assert.ok(depositPlanner.includes("first-home-buyer.html"), "Deposit planner must link to the first-home buyer hub");
assert.ok(depositPlanner.includes("repayment-estimator.html"), "Deposit planner must link onward to repayments");

const purchaseCostsData = JSON.parse(await readFile(path.join(root, "assets", "property_purchase_costs_2026.json"), "utf8"));
assert.equal(purchaseCostsData.lastReviewed, "2026-08-27", "Purchase-cost data must state its review date");
for (const state of ["NSW", "VIC", "QLD", "SA", "WA", "TAS", "ACT", "NT"]) {
  assert.ok(purchaseCostsData.jurisdictions[state], `Purchase-cost data must cover ${state}`);
}

const styles = await readFile(path.join(root, "styles.css"), "utf8");
assert.match(styles, /img\{display:block;max-width:100%;height:auto\}/, "Images must not overflow narrow screens");
assert.match(styles, /\.prose table\{display:block;overflow-x:auto;white-space:nowrap\}/, "Wide guide tables must scroll on narrow screens");
assert.match(styles, /\.deposit-form \.eligibility-field\[hidden\]\{display:none\}/, "Deposit planner must hide first-home confirmation until it is relevant");

const borrowingPowerPage = await readFile(path.join(root, "index.html"), "utf8");
assert.match(borrowingPowerPage, /<details class="advanced-options">/, "Borrowing power calculator must group optional inputs");
assert.ok(borrowingPowerPage.indexOf('id="expensesSlider"') < borrowingPowerPage.indexOf('<details class="advanced-options">'), "Core affordability inputs must remain visible before advanced options");
assert.ok(borrowingPowerPage.includes('id="assessmentRate"'), "Borrowing power calculator must explain its assessment rate");
assert.ok(borrowingPowerPage.includes('id="bufferImpact"'), "Borrowing power calculator must show the rate-buffer impact");
assert.ok(borrowingPowerPage.includes('id="assumptionsReview"'), "Borrowing power calculator must show the assumptions review date");
assert.ok(borrowingPowerPage.includes("deposit-upfront-costs.html"), "Borrowing power calculator must link to the deposit planner");
assert.ok(borrowingPowerPage.includes("lender-borrowing-power-benchmark.html"), "Borrowing power calculator must link to the lender benchmark");
assert.match(styles, /\.result-item\{display:grid;grid-template-columns:minmax\(0,1fr\) auto/, "Result rows must preserve room for labels and values");
assert.match(styles, /\.advanced-fields select\{width:100%;max-width:100%\}/, "Advanced dropdown labels and selected values must not be clipped");

const faqPage = await readFile(path.join(root, "faq.html"), "utf8");
assert.match(faqPage, /<h1>BorrowPower FAQ<\/h1>/, "FAQ page must have a single page-level heading");
assert.ok(faqPage.includes("Deposit &amp; Upfront Cost Calculator"), "FAQ must cover the purchase-cost planner");
assert.ok(faqPage.includes("First Home Buyer Scheme Checker"), "FAQ must cover the scheme checker");

const aboutPage = await readFile(path.join(root, "about.html"), "utf8");
assert.ok(aboutPage.includes("Deposit &amp; Upfront Cost Calculator"), "About page must reflect the purchase-cost planner");
assert.ok(aboutPage.includes("Refinance Break-Even Calculator"), "About page must reflect the refinance calculator");
assert.ok(aboutPage.includes('href="/methodology.html"'), "About page must link to the published methodology");
assert.ok(faqPage.includes('href="/methodology.html"'), "FAQ must link to the published methodology");

const header = await readFile(path.join(root, "partials", "header.html"), "utf8");
assert.ok(header.includes('href="/deposit-upfront-costs.html">Deposit &amp; Costs'), "Primary navigation must feature the deposit planner");
assert.ok(header.indexOf("Borrowing Power") < header.indexOf("Deposit &amp; Costs") && header.indexOf("Deposit &amp; Costs") < header.indexOf("Repayments"), "Primary navigation must follow the core buyer journey");

const lenderBenchmark = await readFile(path.join(root, "lender-borrowing-power-benchmark.html"), "utf8");
assert.ok(lenderBenchmark.includes("2 September 2026"), "Lender benchmark must state its snapshot date");
for (const lender of ["ANZ", "CommBank"]) {
  assert.ok(lenderBenchmark.includes(lender), `Lender benchmark must name ${lender}`);
}
for (const retiredLender of ["NAB", "Westpac"]) {
  assert.ok(!lenderBenchmark.includes(retiredLender), `Lender benchmark must not present ${retiredLender} as a current comparison`);
}
assert.ok(lenderBenchmark.includes("Five repeatable core scenarios"), "Lender benchmark must state its scenario methodology");
assert.ok(lenderBenchmark.includes("80% LVR"), "Lender benchmark must state its controlled LVR context");
assert.ok(lenderBenchmark.includes("$364,358"), "Lender benchmark must publish its dated ANZ result");
assert.ok(lenderBenchmark.includes("$397,500"), "Lender benchmark must publish its dated CommBank result");
assert.ok(lenderBenchmark.includes("owner-occupied, principal-and-interest repayments over 30 years"), "Lender benchmark must disclose its comparison controls");

const methodology = await readFile(path.join(root, "methodology.html"), "utf8");
for (const sourceLabel of ["APRA Prudential Standard APS 220", "Helia: lenders mortgage insurance", "Australian Government 5% Deposit Scheme"]) {
  assert.ok(methodology.includes(sourceLabel), `Methodology must publish the ${sourceLabel} source`);
}
assert.ok(methodology.includes("transparent household expense floor"), "Methodology must distinguish BorrowPower's expense model from lender HEM");

const guidesIndex = await readFile(path.join(root, "guides", "guides-index.html"), "utf8");
assert.ok(guidesIndex.includes("Deposit &amp; Upfront Cost Calculator"), "Guides index must feature the deposit planner");

console.log(`Site configuration checks passed for ${pages.length} pages`);
