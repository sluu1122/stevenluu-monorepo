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
  --build-arg NEXT_PUBLIC_ANGULAR_SANDBOX_URL=https://angular.stevenluu.com `
  --build-arg NEXT_PUBLIC_REACT_SANDBOX_URL=https://react.stevenluu.com `
  -t ghcr.io/sluu1122/portfolio:latest --push .
```

If `docker buildx build` complains about a missing builder instance, run once:
`docker buildx create --use --name amd64builder`.

## 2. Prepare the NAS

1. Package Center → install **Container Manager** (DSM 7.2+).
2. Container Manager → Registry → Settings → add registry `ghcr.io`, log in with a
   GitHub personal access token (`read:packages` scope) — required since these are
   private images.
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
| `angular.stevenluu.com` | | `angular-dashboard:80` |
| `react.stevenluu.com` | | `react-dashboard:80` |
| `ai-api.stevenluu.com` | | `ai-api:3001` |
| `cpt-api.stevenluu.com` | | `cpt-api:3002` |
| `icd-api.stevenluu.com` | | `icd-api:3003` |
| `patients-api.stevenluu.com` | | `patients-api:3004` |

The tunnel token lives in the NAS `.env` as `CLOUDFLARE_TUNNEL_TOKEN` (gitignored).
No DSM reverse proxy, DDNS, Let's Encrypt cert, or router port-forwarding is needed —
Cloudflare handles public TLS at its edge, and the routes above create the matching
proxied DNS records automatically.

## 4. Verify

- Container Manager shows all 11 containers running (or exited-0 for `ollama-init`),
  and the tunnel shows **Healthy** in Cloudflare (Zero Trust → Networks → Tunnels).
- `https://stevenluu.com`, `https://angular.stevenluu.com`, and
  `https://react.stevenluu.com` all load over HTTPS with a valid Cloudflare cert.
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

1. A `verify` job runs `check-types`, `lint`, and `build` — a broken commit
   never reaches the registry, so nothing bad can ever get auto-deployed.
2. A matrix job builds all 7 images natively for `linux/amd64` (GitHub's
   runners are already amd64, no emulation needed) and pushes each as both
   `:latest` and `:<commit-sha>` to `ghcr.io/sluu1122/<app>`.

On the NAS, a `watchtower` container (in `docker-compose.nas.yml`) polls
`ghcr.io` every 30 minutes and auto-pulls + restarts any of the 7 app services
whose image changed — no Container Manager clicking required. It reuses the
registry credentials Container Manager already has (via the mounted Docker
socket), so no separate login is needed. `ollama` and `cloudflared` are
deliberately **not** watched — `ollama`'s image never changes, and
`cloudflared` is infra you'd want to update on purpose, not on autopilot.

**Checking it worked:** Container Manager → `watchtower` container → Logs —
each poll logs what it checked and whether it found/applied an update.

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
