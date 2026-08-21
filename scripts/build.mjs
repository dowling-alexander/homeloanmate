import { readFile, writeFile } from "node:fs/promises";
await import("./sync-partials.mjs");
await import("./generate-guides.mjs");

const source = await readFile("script_not_minified.js", "utf8");
const normalised = source
  .trimEnd()
  .split(/\r?\n/)
  .map((line) => line.replace(/[ \t]+$/u, ""))
  .join("\n");

await writeFile("script.js", `${normalised}\n`, "utf8");
console.log("Synced script_not_minified.js to script.js");
