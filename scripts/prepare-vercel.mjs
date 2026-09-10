import { access, cp, mkdir, rm, writeFile } from "node:fs/promises";

// Only the compiled public assets go to Vercel. Local jobs, server code and
// credentials never enter the deployment output.
const input = process.env.ASTRAIFIED_API_ORIGIN;
let origin;
try {
  const url = new URL(input);
  if (url.protocol !== "https:" || url.origin !== input || url.username || url.password)
    throw new Error();
  origin = url.origin;
} catch {
  throw new Error("Set ASTRAIFIED_API_ORIGIN to the HTTPS tunnel origin, without a trailing slash or path.");
}
await access("dist/index.html");
await rm(".vercel/output", { recursive: true, force: true });
await mkdir(".vercel/output", { recursive: true });
await cp("dist", ".vercel/output/static", { recursive: true });
await writeFile(".vercel/output/config.json", JSON.stringify({
  version: 3,
  routes: [
    {
      src: "/api(?:/(.*))?",
      dest: `${origin}/api/$1`,
      headers: { "Cache-Control": "private, no-store" },
    },
    { handle: "filesystem" },
    { src: "/.*", dest: "/index.html" },
  ],
}, null, 2) + "\n");
console.log(`Prepared static frontend with /api routed to ${origin}.`);
