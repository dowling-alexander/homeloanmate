# BorrowPower

Static website for [borrowpower.com.au](https://borrowpower.com.au), an Australian home-loan calculator and guide site.

## What Is In This Repo

- `index.html` - borrowing power calculator.
- `repayment-estimator.html` - repayment estimator for P&I, interest-only, payment frequency, and extra repayments.
- `refinance-break-even-calculator.html` - refinance comparison for repayments, fees, upfront switching costs and break-even time.
- `negative-gearing-calculator.html` - simplified investment property cashflow and tax-effect calculator.
- `guides/` - SEO guide articles and the guide index page.
- `content/guides/` - Markdown source files for new guides. The build creates the page, guide card, and sitemap entry.
- `assets/*.json` - calculator data for tax bands, dependant expense floors, LMI estimates, and stamp duty estimates.
- `assets/include.js` and `partials/important-information.html` - shared informational block loaded into pages.
- `partials/header.html` and `partials/footer.html` - build-time shared page chrome.
- `styles.css` - main stylesheet.
- `script_not_minified.js` - readable calculator/menu source.
- `script.js` - production script loaded by the pages.
- `_redirects`, `robots.txt`, `sitemap.xml`, `ads.txt` - static hosting and crawler files.

## Run Locally

This is a plain static site. Serve the folder from a local web server so root-relative URLs like `/assets/...` and fetch calls work correctly.

```powershell
cd C:\Users\dowli\homeloanmate
python -m http.server 8080
```

Then open `http://localhost:8080/`.

Opening `index.html` directly from the file system is not recommended because the calculators fetch JSON files with root-relative paths.

## Deployment Notes

The repo appears set up for static hosting with a Netlify-style `_redirects` file. The redirect file forces HTTPS and preserves older extensionless guide URLs.

Before publishing:

1. Update `script_not_minified.js` first when changing calculator logic.
2. Regenerate, minify, or copy `script_not_minified.js` to `script.js` so production pages receive the same logic.
3. Update `partials/header.html` or `partials/footer.html` for shared nav/footer changes, then run `npm run build`.
4. Run `npm test`, `npm run check:js`, and `npm run check:links`.
5. Check that `sitemap.xml` includes every public page you want indexed.
6. Serve locally and test the three calculator pages.

## Publishing Guides

New guides do not need a hand-built HTML page. Create one Markdown source file, write the article, and build the site:

```powershell
npm run new:guide -- --slug offset-account-basics
npm run build
```

The source file appears at `content/guides/offset-account-basics.md`. The build creates `/guides/offset-account-basics.html`, adds a card to the guide index, and updates the sitemap. See `content/guides/README.md` for the supported fields and Markdown.

Existing guides remain as their current HTML pages. They can be migrated into this system gradually without changing their URLs.
The older `guides/blog-template.html` is retained for reference but is marked `noindex`; use `content/guides/_template.md` for new work.

## Analytics And Ads

- Google Analytics and the AdSense loader now come from `partials/header.html`, so they are applied once to every page during the build.
- GA4 records only high-level activity. Calculator pages record `calculator_started`, `calculator_result_viewed`, and `calculator_recalculated`; the negative gearing calculator also records `calculator_link_copied`. Key in-page routes between a calculator, hub, and guide index record `content_navigation`. No income, debt, property-price, tax-rate, rate quote, or other calculator inputs are sent.
- In GA4, mark `calculator_result_viewed` as a key event. Create custom dimensions for the low-cardinality event parameters `calculator_name`, `destination_name`, `destination_type`, and `source_type` when you are ready to report on them.
- `ads.txt` contains publisher `pub-6595597891926669` with Google's standard direct-seller record.
- The previous manual ad placeholders were removed because they had no numeric AdSense unit ID and therefore could not reliably serve ads. Use Auto ads in AdSense for site-wide placement, or create a real display unit in AdSense and add its numeric `data-ad-slot` only where you want a fixed ad position.

## Calculator Assumptions

The calculators are indicative only and are not financial, legal, or tax advice.

- Borrowing power uses 2026-2027 resident tax bands from `assets/au_tax_bands_2025_2026.json` (legacy filename), excludes Medicare levy, applies a dependant expense floor, and uses a 3% serviceability buffer.
- Borrowing power supports partner income, optional 2% Medicare levy estimate, credit card limits assessed at 3% per month, HELP/HECS monthly repayments, and other monthly debts.
- Stamp-duty concessions require an eligibility confirmation. The calculator shows general duty for conditional first-home or owner-occupier concessions until that is confirmed, and does not model vacant-land or house-and-land first-home concessions.
- LMI uses approximate bands from `assets/lmi_table.json`.
- Stamp duty uses general/non-concession state/territory bands from `assets/stampDuty.json`. Buyer-type selections model the main current state/territory rules that fit the available inputs: first-home concessions or exemptions, owner-occupier/home rates where available, and foreign purchaser surcharges where applicable. Conditional schemes, such as SA new-home relief and NT house-and-land exemptions, are labelled in the calculator note rather than treated as universal.
- Negative gearing uses a simplified interest-only expense model and a user-selected marginal tax rate.
- Refinance break-even compares principal-and-interest repayments at stable entered rates. Its position figures include paid repayments, annual fees and the balance still owing; they do not model offset accounts, redraw, lender policy, tax, loan approval or all loan features.

## Data Sources Checked

- Australian resident income tax rates: Income Tax Rates Act 1986 / 2026-27 Budget tax cuts.
- NSW transfer duty thresholds and premium duty: Revenue NSW 2026-2027 transfer duty rates.
- NSW first-home buyer assistance and foreign purchaser surcharge duty: Revenue NSW current guidance.
- VIC general land transfer duty: State Revenue Office Victoria current non-principal place of residence rates.
- VIC first home buyer duty, principal-place-of-residence concession, and foreign purchaser additional duty: State Revenue Office Victoria current guidance.
- QLD transfer duty: Queensland Revenue Office current transfer duty rates.
- QLD home concession, first-home concession, and additional foreign acquirer duty: Queensland Revenue Office current guidance.
- SA conveyance duty: RevenueSA current stamp duty rates.
- SA first-home buyer relief and foreign ownership surcharge: RevenueSA current guidance.
- WA transfer duty: RevenueWA current general transfer duty rates.
- WA first-home owner rate and foreign transfer duty: RevenueWA current guidance.
- TAS property transfer duty: State Revenue Office Tasmania current property transfer duty rates.
- TAS first-home duty relief expiry and foreign investor duty surcharge: State Revenue Office Tasmania current guidance.
- ACT owner-occupier conveyance duty and Home Buyer Concession Scheme: ACT Revenue Office current guidance.
- NT conveyance duty, HomeGrown grants, and house-and-land exemption context: Northern Territory Revenue Office current guidance.

## Review Status

Last local review: 2026-08-21.

Checks performed:

- JSON data files parse successfully.
- JavaScript syntax checks pass for `script_not_minified.js`, `script.js`, and `assets/include.js`.
- Calculator regression tests cover tax, repayment, LMI, serviceability, and stamp duty examples across all states/territories.
- Link checker validates local HTML links, image/script/style references, and same-domain canonical URLs.
- Header and footer are now generated from shared partials during `npm run build`.
- Internal static links were audited and corrected where they pointed to missing extensionless guide URLs.
- Sitemap was corrected for the `$600k repayments` guide URL.
- GitHub Actions runs the build and checks on pushes and pull requests to `main` or `master`.

Known follow-ups:

- Rename `assets/au_tax_bands_2025_2026.json` to match its current 2026-2027 data.
- Add a visible "last reviewed" stamp to calculator assumptions on the live pages.
- Add automated browser smoke tests for calculator form flows.
- Add more inputs for property type, contract date, citizenship/residency, foreign ownership share, and eligible-new-home status so conditional concessions can be modelled more precisely.
