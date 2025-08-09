# HomeLoanMate

A sleek, mobile-first set of mortgage tools for Australian home buyers: borrowing power, repayments (P&I vs IO), and stamp duty hints — built for clarity and speed.

**Live demo:** https://6896f2cccf9fb30007e13c5b--tangerine-jalebi-dab304.netlify.app/

## Features
- Fast, mobile-friendly UI with sliders and tooltips
- Borrowing power estimator with income/expense sanity checks
- Repayment calculator: Principal & Interest vs Interest-Only
- Adjustable loan term (1–30 years) and interest rate (0.05% steps, 2 decimals)
- Clear, copyable results and simple explanations
- Built with CSS, HTML, JavaScript and deployable on Netlify

## Screenshots
_Coming soon_ (add screenshots from your Netlify build or local runs).

## Getting Started

### 1) Run locally
This project is a static site. The simplest way to preview is with any local web server.

**Option A — VS Code Live Server**
1. Open the folder in VS Code
2. Install the **Live Server** extension
3. Right-click `index.html` → **Open with Live Server**

**Option B — Python http.server**
```bash
cd homeloanmate
python3 -m http.server 8080
# open http://localhost:8080 in your browser
```

### 2) Build/Deploy
- **Netlify**: drag-and-drop the folder or connect the GitHub repo for automatic deploys on push.
- **GitHub Pages**: host from the `/` root; ensure relative paths in HTML/CSS/JS.

## Project Structure
```text
└── homeloanmate-main
    ├── README.md
    ├── about.html
    ├── faq.html
    ├── index.html
    ├── repayment-estimator.html
    ├── script.js
    └── styles.css
... (trimmed)
```

_Key files_
- `/mnt/data/homeloanmate/homeloanmate-main/index.html`
- `/mnt/data/homeloanmate/homeloanmate-main/script.js`
- `/mnt/data/homeloanmate/homeloanmate-main/styles.css`

## Configuration
- Default interest rate step: `0.05%`
- Input validation prevents expenses > income (annualised)
- State-specific logic for stamp duty can be expanded in `script.js`

## Development Notes
- Keep business logic in `script.js`; avoid DOM-specific code inside pure functions for easier testing.
- When adding calculators, prefer modular functions and a single source of truth for formatting (e.g., currency/percent helpers).
- Use semantic HTML and ARIA labels for accessible sliders and tooltips.

## Roadmap
- [ ] Add NSW/VIC/QLD stamp duty tables and FHB concessions
- [ ] Add monthly/fortnightly/weekly repayment options
- [ ] Export results to PDF/CSV
- [ ] Light/Dark theme toggle
- [ ] Basic unit tests (Jest + jsdom if adopting Node tooling)

## Contributing
1. Fork the repo
2. Create a feature branch: `git checkout -b feat/my-change`
3. Commit: `git commit -m "feat: explain change"`
4. Push and open a PR

## License
MIT — see `LICENSE` (or add one if missing).

---

If you use this in production, consider adding an analytics snippet and affiliate link tracking parameters.
