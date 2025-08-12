# HomeLoanMate – Repo‑style Build

Generated: 2025-08-12

This package keeps **your repo's structure and theme linkage**:
- `styles.css` and `script.js` are at the **repo root** (same filenames).
- Pages at root: `index.html`, `repayment-estimator.html`, `faq.html`, `about.html`, `privacy.html`, `terms.html`.
- Data and helpers live in `assets/` and are referenced relatively.
- `partials/important-information.html` is included on calculator pages via `/assets/include.js`.

**Inline SVG logo**: replace the `[INLINE-SVG-LOGO-HERE]` comment in headers with your existing inline SVG (unchanged).

**Stamp duty**: Calls `window.calculateStampDuty(price, state)` if present; otherwise tries `window.STAMP_DUTY_TABLES[state]`.

**AdSense**: Container reserved to avoid CLS; loads only if `window.ADSENSE_CLIENT` is set.
