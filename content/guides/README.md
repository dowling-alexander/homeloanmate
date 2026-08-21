# Publishing a guide

Each Markdown file in this folder becomes a published guide page when you run the build. The filename becomes the URL, so `offset-account-basics.md` becomes `/guides/offset-account-basics.html`.

## Quick start

```powershell
npm run new:guide -- --slug your-guide-topic
```

Or duplicate `_template.md`, give it a lowercase kebab-case filename, then complete the front matter and article.

Run `npm run build` when you are ready. It creates the HTML page, adds the guide to the index, and adds it to `sitemap.xml`. Delete the Markdown file and build again to unpublish a generated guide.

Use one of these topics so the guide appears in the existing guide filters: `borrowing`, `repayments`, `lmi`, `firsthome`, `stampduty`, `equity`, or `neggearing`.

Use an image that exists under `/assets/`, with a helpful `image_alt`. The Markdown supports headings (`##` and `###`), paragraphs, bullet and numbered lists, blockquotes, bold text, italics, inline code, and links.
