# Vercel frontend with a laptop generator

The frontend is a static Vite build on Vercel. Both game modes run in the visitor's browser. Requests to `/api` are proxied through an external Vercel rewrite to Cloudflare Tunnel, which connects to the Express server at `127.0.0.1:8788` on the host laptop. The laptop orchestrates generation and calls OpenAI; model inference runs at OpenAI.

The current frontend project is **astraified** in **phineas-projects**, at <https://astraified.vercel.app>. The tunnel is temporary by choice. No custom domain or paid hosting plan is required by this configuration.

## Private access and storage

The shared catalog includes the explicitly published **Special Delivery, Weighted Carefully** and **A Word in the Right Place.** generated lessons alongside the authored demos. Only their finished game packages are bundled, using the same identities and revisions as the original saves. They are available in a fresh browser without signing in, do not consume private library slots, and appear once if that browser already saved them. Other generated games remain in their original browser library unless deliberately published.

The game library is public. Creating games requires the host's shared creation access code. Session discovery is public; all other API endpoints, including job reads, cancellation and resumption, require a signed session cookie. Cookies are Secure, HttpOnly, SameSite=Strict, host-only, scoped to `/api`, and expire after 12 hours. Mutations also require an exact configured website Origin. API responses must remain uncached through both proxies.

This is a private shared demo, not a multiuser account system. People with the code share the generator; there is one active hosted job at a time. Do not use it to promise per-user access isolation. Logout clears the browser cookie. Rotating either the creation code or signing secret and restarting the backend invalidates all existing sessions.

Private configuration is in ignored, owner-only `.astraified/hosted.env`:

```dotenv
PORT=8788
OPENAI_API_KEY=your_server_side_key
ASTRAIFIED_PUBLIC_ORIGINS=https://astraified.vercel.app
ASTRAIFIED_ACCESS_CODE=a_random_code_at_least_24_characters_long
ASTRAIFIED_SESSION_SECRET=a_different_random_secret_at_least_32_characters_long
ASTRAIFIED_JOB_DIRECTORY=.astraified/hosted-jobs
```

Use cryptographically random values, such as `crypto.randomBytes(32).toString("base64url")`, for both secrets. Never put them in a `VITE_` variable or in Vercel's public assets. Supplying incomplete hosted settings stops the API instead of opening it. The dedicated launcher also refuses to start without hosted settings and an API key.

The host's creation code is separately available in `.astraified/creation-access-code.txt`. Share only that code with intended testers, never the full environment file. Hosted checkpoints live in `.astraified/hosted-jobs`; development keeps its separate `.astraified/jobs`. Vercel receives neither store. Browser libraries and progress are origin-specific, so games saved at localhost are not automatically copied to the hosted website.

## Laptop services

On this Mac, the official `cloudflared` binary is installed at `tools/cloudflared/cloudflared`. The macOS helper installs two user LaunchAgents and keeps them running independently of the terminal or Codex:

```sh
npm run hosted:start
npm run hosted:status
npm run hosted:stop
```

These services start again on login while their plists remain in `~/Library/LaunchAgents`. To remove automatic startup, stop the services and remove only `com.astraified.generator.plist` and `com.astraified.tunnel.plist` from that directory. The services use this checkout and its Node installation; reinstall them after moving the project or changing the Node path. Logs are in `.astraified/com.astraified.generator.log` and `.astraified/com.astraified.tunnel.log`.

For foreground operation instead, run `npm run hosted:api` and `npm run hosted:tunnel` in separate terminals. Do not run these alongside the LaunchAgents on the same port.

The laptop must remain awake and connected for generation. Sleeping, shutting down, or stopping the services makes new generation unavailable; the studio reports that the workshop is offline. Existing games can still be played on the hosted frontend. Accepted jobs survive closing the browser, but a backend process restart interrupts unfinished model calls; use **Resume from saved work** to continue from completed stages.

## Deploy or update the temporary tunnel route

The current temporary tunnel URL is printed in `.astraified/com.astraified.tunnel.log`; the URL used by the last deployment is also saved in `.astraified/tunnel-origin.txt`. **Restarting cloudflared creates a new URL.** The Vercel website URL stays the same, but its API route needs a new deployment when that happens.

After starting the tunnel, use its current HTTPS origin:

```sh
ASTRAIFIED_API_ORIGIN=https://your-current-tunnel.trycloudflare.com npm run build:hosted
npm exec --yes --package=vercel -- vercel deploy --prebuilt --prod --yes --scope phineas-projects --global-config .astraified/vercel-cli
```

The deployment is built locally with Node 26+. `scripts/prepare-vercel.mjs` copies only `dist/` into `.vercel/output/static` and generates a Build Output API route for `/api` before the frontend fallback. The tunnel origin is routing configuration, not a secret. The API key and session secrets never enter the deployment. This project is deployed from the local build; Git pushes alone do not deploy it.

On a new machine, first sign in with the Vercel CLI and link the existing project. `.astraified/vercel-cli` and `.vercel` are private/ignored CLI configuration. Vercel preview deployment origins are deliberately not trusted by the API; use the configured production URL, or explicitly add an intended HTTPS origin on the laptop.

The external rewrite avoids putting the generator in a Vercel Function. Source submission has a 120-second client timeout to allow file upload and bounded extraction; accepted jobs return promptly and use separate progress requests. Neither model generation nor the complete lesson must finish within a proxy request. If a submission times out after the server accepts it, check the host's job records before manually creating it again; POST requests are never retried automatically.

References: [Vercel Build Output API](https://vercel.com/docs/build-output-api/configuration), [Vercel rewrites](https://vercel.com/docs/routing/rewrites), [proxy limits](https://vercel.com/docs/limits), [Cloudflare temporary tunnels](https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/do-more-with-tunnels/trycloudflare/).
