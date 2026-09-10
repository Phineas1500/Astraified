import { access, mkdir, writeFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { homedir } from "node:os";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";

if (process.platform !== "darwin") throw new Error("This service helper is for macOS. Use hosted:api and hosted:tunnel on other systems.");
const root = fileURLToPath(new URL("../", import.meta.url));
const action = process.argv[2] || "status";
if (!["start", "stop", "status"].includes(action)) throw new Error("Use start, stop or status.");
const domain = `gui/${process.getuid()}`;
const directory = resolve(homedir(), "Library/LaunchAgents");
const services = [
  { name: "com.astraified.generator", args: [process.execPath, resolve(root, "scripts/start-hosted-api.mjs")] },
  { name: "com.astraified.tunnel", args: [resolve(root, "tools/cloudflared/cloudflared"), "tunnel", "--url", "http://127.0.0.1:8788", "--no-autoupdate"] },
];
const xml = (text) => text.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
if (action === "start") {
  await access(resolve(root, ".astraified/hosted.env"));
  await access(services[1].args[0]);
  await mkdir(directory, { recursive: true });
}
for (const service of services) {
  const target = `${domain}/${service.name}`;
  const path = resolve(directory, `${service.name}.plist`);
  const loaded = spawnSync("launchctl", ["print", target], { encoding: "utf8" });
  if (action === "status") {
    console.log(`${service.name}: ${loaded.status === 0 ? (loaded.stdout.match(/state = (.*)/)?.[1] || "loaded") : "stopped"}`);
    continue;
  }
  if (action === "stop") {
    if (loaded.status === 0) {
      const stopped = spawnSync("launchctl", ["bootout", target], { stdio: "inherit" });
      if (stopped.status !== 0) throw new Error(`Could not stop ${service.name}`);
    }
    console.log(`${service.name}: stopped`);
    continue;
  }
  if (loaded.status === 0) { console.log(`${service.name}: already loaded`); continue; }
  await writeFile(path, `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
<key>Label</key><string>${service.name}</string>
<key>ProgramArguments</key><array>${service.args.map((arg) => `<string>${xml(arg)}</string>`).join("")}</array>
<key>WorkingDirectory</key><string>${xml(root)}</string>
<key>EnvironmentVariables</key><dict><key>PATH</key><string>${xml(resolve(process.execPath, ".."))}:/usr/bin:/bin</string></dict>
<key>RunAtLoad</key><true/>
<key>KeepAlive</key><true/>
<key>ThrottleInterval</key><integer>15</integer>
<key>StandardOutPath</key><string>${xml(resolve(root, `.astraified/${service.name}.log`))}</string>
<key>StandardErrorPath</key><string>${xml(resolve(root, `.astraified/${service.name}.log`))}</string>
</dict></plist>\n`, { mode: 0o600 });
  const started = spawnSync("launchctl", ["bootstrap", domain, path], { stdio: "inherit" });
  if (started.status !== 0) throw new Error(`Could not start ${service.name}`);
  console.log(`${service.name}: started`);
}
if (action === "start") console.log("A temporary tunnel gets a new URL after restart. Read .astraified/com.astraified.tunnel.log and rebuild the Vercel API route when it changes.");
