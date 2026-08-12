# Deploying to the Synology DS423+

All 7 apps in this monorepo are built into Docker images and pushed to GitHub
Container Registry (ghcr.io). The NAS never compiles anything — it only pulls
pre-built images and runs them via Container Manager. This keeps the DS423+'s
low-power CPU out of the build path entirely.

**This is now automated end to end** — see [§5, Continuous deployment](#5-continuous-deployment)
below. Pushing to `main` is the only manual step; GitHub Actions builds and
pushes the images, and Watchtower on the NAS auto-updates the running
containers. The manual commands below (§1) still work and are useful for a
one-off rebuild of a single image, but you shouldn't need them for routine
changes anymore.

## 1. Build and push images (dev machine, manual/one-off)

```powershell
$sha = (git rev-parse --short HEAD)
docker login ghcr.io -u sluu1122

foreach ($svc in "portfolio","react-dashboard","angular-dashboard","ai-api","cpt-api","icd-api","patients-api") {
  docker buildx build --platform linux/amd64 `
    -f "apps/**/$svc/Dockerfile" `
    -t "ghcr.io/sluu1122/$svc:latest" -t "ghcr.io/sluu1122/$svc:$sha" `
    --push .
}
```

`--platform linux/amd64` is required on every build regardless of your dev
machine's default — the DS423+'s Celeron J4125 is amd64-only, and a silent
arch mismatch is the most common "works here, fails on the NAS" failure mode.

`portfolio` additionally needs its sandbox-link build args:

```powershell
docker buildx build --platform linux/amd64 -f apps/portfolio/Dockerfile `
  --build-arg NEXT_PUBLIC_HEALTHCARE_SANDBOX_URL=https://healthcare.stevenluu.com `
  --build-arg NEXT_PUBLIC_FINANCE_SANDBOX_URL=https://finance.stevenluu.com `
  -t ghcr.io/sluu1122/portfolio:latest --push .
```

If `docker buildx build` complains about a missing builder instance, run once:
`docker buildx create --use --name amd64builder`.

## 2. Prepare the NAS

1. Package Center → install **Container Manager** (DSM 7.2+).
2. No registry login is needed. All 7 packages are **public** on `ghcr.io` and
   pull anonymously (verified 2026-08-12) — an earlier version of this document
   said they were private and required a personal access token. If you ever make
   them private, add the registry under Container Manager → Registry → Settings
   with a PAT (`read:packages`), and note that Watchtower needs its own auth
   separately — it does not inherit Container Manager's login (see §5).
3. Container Manager → Project → Create → paste the repo's pull-only
   `deploy/synology/docker-compose.nas.yml` (it references the `ghcr.io` images and
   the `cloudflared` tunnel service; it has no `build:` sections, so the NAS never
   compiles). No SSH needed. Put the real values in a `.env` file next to the
   compose (copy `.env.example` and edit it) — including `CLOUDFLARE_TUNNEL_TOKEN`
   from the tunnel setup in step 3 below.
4. Start the project. First run pulls all images and starts 11 containers (7 apps +
   `cloudflared` + `ollama` + `watchtower` + the one-shot `ollama-init`, which
   exits 0 once its model pull finishes — that's expected, not a failure).

## 3. Expose it publicly (Cloudflare Tunnel)

The stack is published through a **Cloudflare Tunnel** — an outbound-only connection
from the `cloudflared` container to Cloudflare's edge. This hides the home IP, needs
**no inbound router ports**, and lets Cloudflare terminate public HTTPS for free.
See **[cloudflare-tunnel.md](cloudflare-tunnel.md)** for the full step-by-step:
Cloudflare account + DNS migration (keeping the email MX records intact), the tunnel
token, public-hostname routing, and the teardown of the old port-forward path.

In short: DNS for `stevenluu.com` is hosted at Cloudflare, and the tunnel maps each
public hostname to a Docker service on the internal `appnet` network:

| Public hostname | → | Service |
|---|---|---|
| `stevenluu.com`, `www.stevenluu.com` | | `portfolio:3000` |
| `healthcare.stevenluu.com` | | `angular-dashboard:80` |
| `finance.stevenluu.com` | | `react-dashboard:80` |
| `ai-api.stevenluu.com` | | `ai-api:3001` |
| `cpt-api.stevenluu.com` | | `cpt-api:3002` |
| `icd-api.stevenluu.com` | | `icd-api:3003` |
| `patients-api.stevenluu.com` | | `patients-api:3004` |

`angular.stevenluu.com` and `react.stevenluu.com` are the old addresses these
were renamed from — they still resolve, but as a 301 to the hostnames above
rather than a direct route. See [cloudflare-tunnel.md](cloudflare-tunnel.md#renaming-a-public-hostname-with-a-permanent-redirect)
for how that's set up.

The tunnel token lives in the NAS `.env` as `CLOUDFLARE_TUNNEL_TOKEN` (gitignored).
No DSM reverse proxy, DDNS, Let's Encrypt cert, or router port-forwarding is needed —
Cloudflare handles public TLS at its edge, and the routes above create the matching
proxied DNS records automatically.

## 4. Verify

- Container Manager shows all 11 containers running (or exited-0 for `ollama-init`),
  and the tunnel shows **Connected** in Cloudflare (Zero Trust → Networks →
  Tunnels & Mesh → your tunnel → Overview → Connectors).
- `https://stevenluu.com`, `https://healthcare.stevenluu.com`, and
  `https://finance.stevenluu.com` all load over HTTPS with a valid Cloudflare cert.
- On the live Angular site, open devtools → Network tab → confirm a request to
  `assets/config.json` returns real public API URLs (not `localhost`, not literal
  `${CPT_API_URL}` placeholder text — the latter means the nginx entrypoint script
  didn't run).
- Exercise the patients list, CPT/ICD lookup, and AI-assist field — confirm all 4
  cross-container calls succeed with no CORS errors in the console. The AI field
  will be noticeably slower than on a dev machine (CPU-only inference on the
  Celeron J4125) — that's expected, not a bug.
- Load everything from **outside** your home network (mobile data) to confirm the
  public path. With the tunnel, home-wifi access works too — there's no NAT
  hairpinning, since DNS now resolves to Cloudflare rather than your home IP.

## 5. Continuous deployment

Pushing to `main` triggers [`.github/workflows/deploy.yml`](../../.github/workflows/deploy.yml):

1. A `verify` job runs `check-types`, `lint`, `test`, and `build`.
2. An `e2e` job runs the Playwright production-build suite in parallel.
3. Only if **both** pass does the matrix job build all 7 images natively for
   `linux/amd64` (GitHub's runners are already amd64, no emulation needed) and
   push each as both `:latest` and `:<commit-sha>` to `ghcr.io/sluu1122/<app>`.

A broken commit therefore never reaches the registry, so nothing bad can get
auto-deployed. CI also runs on **every branch push**, but publishing is gated to
`main` (`if: github.ref == 'refs/heads/main'`), so you can push a branch and see
it go green without ever overwriting `:latest`.

On the NAS, a `watchtower` container (in `docker-compose.nas.yml`) polls
`ghcr.io` every 30 minutes and auto-pulls + restarts any of the 7 app services
whose image changed — no Container Manager clicking required. `ollama` and
`cloudflared` are deliberately **not** watched — `ollama`'s image never changes,
and `cloudflared` is infra you'd want to update on purpose, not on autopilot.

**No registry credentials are configured, and none are needed:** all 7 packages
are public on `ghcr.io` and pull anonymously. Watchtower does **not** inherit
Container Manager's registry login through the mounted Docker socket — an
earlier version of this document claimed it did. If these packages are ever made
private, Watchtower will silently stop finding updates until it is given its own
auth (a mounted `/config.json`, or `REPO_USER`/`REPO_PASS`).

> ✅ **Verified end to end on 2026-08-12.** A real `react-dashboard` change was
> merged, CI published at ~04:40 UTC, and nothing on the NAS was touched.
> Watchtower's scheduled scan ran at 05:04:26 UTC and the NAS was serving the new
> bundle by **05:05:14 UTC**, live through Cloudflare. Continuous deployment
> works; [§6](#6-deploying-manually-fallback-and-troubleshooting) is a fallback,
> not the normal path.

**Checking it worked:** Container Manager → `watchtower` container → Logs —
each poll logs what it checked and whether it found/applied an update, ending in
a `Session done: N scanned, N updated` line.

> ⚠️ **An empty Log tab does not mean the container is silent.** Container
> Manager reads that tab from DSM's own log store. Setting an explicit
> `logging:` driver in the compose file sends output somewhere the GUI never
> reads, and every Log tab then shows "No logs available" even for containers
> that are working perfectly. That is exactly what happened on 2026-08-11 and it
> caused Watchtower to be misdiagnosed as broken for a full session. Do not add a
> `logging:` block to `docker-compose.nas.yml`. If a log looks empty, confirm the
> channel works — check a container you know is busy — before concluding the
> container is doing nothing.

**Manually triggering an update** (instead of waiting out the 30-minute poll —
handy right after a push, or while testing the pipeline itself): either
restart the `watchtower` container in Container Manager (it always checks
immediately on startup), or hit its HTTP API from a machine on the LAN:

```powershell
curl -H "Authorization: Bearer $env:WATCHTOWER_HTTP_API_TOKEN" http://<nas-ip>:8080/v1/update
```

using the same value you put in the NAS's `.env` as `WATCHTOWER_HTTP_API_TOKEN`
(generate one with `openssl rand -hex 32` — see `.env.example`). This endpoint
is **not** routed through the Cloudflare Tunnel and nothing forwards it on the
router, so it's only reachable from inside the home network — never public.

**Rollback:** since deploys are now unattended, reverting means pushing a
revert commit (or `git revert` + push) to `main` — CI rebuilds `:latest` from
that commit, and Watchtower pulls the reverted image on its next poll, same as
any other update. There's no separate "pause" needed; the fix ships the same
way the bug did.

**One-time repo setup** (before the workflow can push packages): GitHub repo
→ Settings → Actions → General → Workflow permissions → **"Read and write
permissions"**. Without this, `GITHUB_TOKEN` can't push to `ghcr.io` and the
`build-and-push` job fails on the login/push step.

## 6. Deploying manually (fallback and troubleshooting)

> **The one rule that matters: always finish with Build, never Start.**
> They sit next to each other and both sound like "turn it back on," but
> **Start only starts containers that already exist**. It never creates one,
> never re-reads `.env`, and never pulls an image. Every deployment failure in
> this section traces back to reaching for Start.

Watchtower handles ordinary deploys (§5), so you shouldn't normally need this
section. It matters when you're changing something Watchtower doesn't manage —
`.env` values, the compose file itself, or `cloudflared` and `ollama`, which are
deliberately unwatched — or when you need a change live without waiting out the
30-minute poll.

Container Manager will silently reuse a stale container or a stale cached
image, with no error anywhere. All three failure modes below look identical
from the outside: your change simply doesn't appear on the live site.

- **`.env` changes need a container *recreate*, not a restart.** Environment
  variables are baked in when a container is **created**. Stop → Start reuses
  the existing containers and keeps the old values, so an edited `.env` has no
  effect whatsoever.
- **A new `:latest` image needs the old image *and* its container deleted.**
  Build runs the equivalent of `docker compose up -d`, which will **not**
  re-pull a `:latest` tag it already holds locally. Deleting only the image
  isn't enough either — Docker refuses to remove an image that a running
  container is using, so the delete quietly fails.
- **After deleting a container, Start leaves the service down entirely.**
  There is nothing for it to start, so the container never comes back and the
  tunnel returns a **502** for that hostname. Only Build recreates it.

**The sequence that actually works:**

1. Project → **Stop**
2. **Container** → delete the affected container(s)
3. **Image** → delete the matching `ghcr.io/sluu1122/<app>:latest`, and confirm
   the row actually disappears from the list
4. Project → **Build** — *not Start*. With no local image, this pulls fresh and
   recreates the container.

**Check it took before debugging anything else:** Container → the container →
**General** → **Time Created**. If that timestamp predates your change, the
container was never recreated and nothing else you investigate will matter.
This one field short-circuits nearly every "my change didn't deploy" hunt.

For an `.env`-only change (no new image), steps 1 and 4 alone are enough —
Build recreates containers and re-reads `.env`.

**Security note:** `watchtower` has the Docker socket mounted, which gives it
root-equivalent control over everything on the NAS's Docker host. This is the
standard, accepted way this well-established tool works — worth knowing
explicitly rather than discovering it later.

## Notes on the `ollama` service

- Capped at `mem_limit: 6g` — with the other 10 containers' `mem_limit`s summing
  to roughly 2.5GB, that leaves comfortable headroom out of the NAS's 18GB for
  DSM itself and its other packages. Don't raise this cap without also checking
  what else is running on the NAS at the time.
- Model weights persist in the `ollama_data` named volume, so a NAS reboot doesn't
  require re-pulling the model (only `ollama-init`'s one-time first run does).
- The 4 Express APIs hold **in-memory seeded demo data** with no persistent
  volumes — a restart resets them to their initial seed state. This is expected
  behavior for a portfolio demo, not a defect.
