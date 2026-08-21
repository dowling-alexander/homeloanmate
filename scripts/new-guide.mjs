import { access, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const args = process.argv.slice(2);
const slug = args[args.indexOf("--slug") + 1];
if (!slug || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
  throw new Error("Use a lowercase kebab-case slug: npm run new:guide -- --slug my-new-guide");
}

const root = process.cwd();
const output = path.join(root, "content", "guides", `${slug}.md`);
try {
  await access(output);
  throw new Error(`${path.relative(root, output)} already exists.`);
} catch (error) {
  if (error.code !== "ENOENT") throw error;
}

const template = await readFile(path.join(root, "content", "guides", "_template.md"), "utf8");
const today = new Date().toISOString().slice(0, 10);
await writeFile(output, template.replaceAll("{{DATE}}", today), "utf8");
console.log(`Created content/guides/${slug}.md`);
console.log("Edit the front matter and article, then run npm run build.");
