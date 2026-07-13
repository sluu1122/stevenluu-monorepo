# Deploying to the Synology DS423+

6 of the 7 apps in this monorepo are built into Docker images on your dev machine
and pushed to GitHub Container Registry (ghcr.io). The NAS never compiles anything
— it only pulls pre-built images and runs them via Container Manager. This keeps
the DS423+'s low-power CPU out of the build path entirely.

**react-dashboard is not yet included** — its production build currently fails on
a pre-existing `recharts@2.15.4` / `@types/react@19.2.x` type incompatibility,
unrelated to Docker (confirmed reproducible with plain `npx tsc -b`, outside any
container). Its `Dockerfile` is written and ready; uncomment its service in
`docker-compose.yml` once that's fixed (pin older `@types/react` types for
react-dashboard + packages/ui, or migrate to recharts v3).

## 1. Build and push images (dev machine)

```powershell
$sha = (git rev-parse --short HEAD)
docker login ghcr.io -u <your-github-username>

foreach ($svc in "portfolio","angular-dashboard","ai-api","cpt-api","icd-api","patients-api") {
  docker buildx build --platform linux/amd64 `
    -f "apps/**/$svc/Dockerfile" `
    -t "ghcr.io/<your-github-username>/$svc:latest" -t "ghcr.io/<your-github-username>/$svc:$sha" `
    --push .
}
```

`--platform linux/amd64` is required on every build regardless of your dev
machine's default — the DS423+'s Celeron J4125 is amd64-only, and a silent
arch mismatch is the most common "works here, fails on the NAS" failure mode.

`portfolio` additionally needs its sandbox-link build args. Since react-dashboard
isn't deployed yet, leave `NEXT_PUBLIC_REACT_SANDBOX_URL` unset for now — it falls
back to `https://react.stevenluu.com` (the existing default) — and set it once
react-dashboard is live:

```powershell
docker buildx build --platform linux/amd64 -f apps/portfolio/Dockerfile `
  --build-arg NEXT_PUBLIC_ANGULAR_SANDBOX_URL=https://angular.yourdomain.com `
  -t ghcr.io/<your-github-username>/portfolio:latest --push .
```

If `docker buildx build` complains about a missing builder instance, run once:
`docker buildx create --use --name amd64builder`.

## 2. Prepare the NAS

1. Package Center → install **Container Manager** (DSM 7.2+).
2. Container Manager → Registry → Settings → add registry `ghcr.io`, log in with a
   GitHub personal access token (`read:packages` scope) — required since these are
   private images.
3. Container Manager → Project → Create → paste the repo's `docker-compose.yml`
   directly (no SSH needed). When prompted for environment variables, fill in the
   real values from `.env.example` (copy that file to `.env` first and edit it, or
   enter values directly in the GUI import step).
4. Start the project. First run pulls all images and starts 8 containers (6 apps +
   `ollama` + the one-shot `ollama-init`, which exits 0 once its model pull
   finishes — that's expected, not a failure).

## 3. Expose it publicly

**Reverse Proxy** (Control Panel → Login Portal → Advanced → Reverse Proxy),
one HTTPS rule per hostname, all pointing at `localhost:<published-port>`:

| Hostname | → | NAS port |
|---|---|---|
| `portfolio.yourdomain.com` | | `3000` |
| `angular.yourdomain.com` | | `8082` |
| `healthcare-api.yourdomain.com/ai` | | `3001` |
| `healthcare-api.yourdomain.com/cpt` | | `3002` |
| `healthcare-api.yourdomain.com/icd` | | `3003` |
| `healthcare-api.yourdomain.com/patients` | | `3004` |

If your DSM version's reverse-proxy UI doesn't support path-based routing for the
4 API rows, fall back to 4 separate subdomains (`ai-api.yourdomain.com`, etc.) —
just update `.env`'s `*_API_URL` values to match whichever scheme you use.

Once react-dashboard is fixed and uncommented in `docker-compose.yml`, add
`react.yourdomain.com` → `8081` here too, and re-build portfolio with
`NEXT_PUBLIC_REACT_SANDBOX_URL` pointed at it.

**DDNS + certificates**: Control Panel → External Access → DDNS (register your
hostname), then Control Panel → Security → Certificate → Add → Let's Encrypt (one
cert per hostname above; renews automatically every 90 days). Assign each cert to
its corresponding reverse-proxy rule.

**Router port-forward**: forward external `443` and `80` (the `80` is required for
the Let's Encrypt ACME HTTP-01 challenge) to the NAS's internal `443`/`80`. Easy to
miss — reverse-proxy rules alone don't work without this.

## 4. Verify

- Container Manager shows all 8 containers running (or exited-0 for `ollama-init`).
- `https://portfolio.yourdomain.com` and `https://angular.yourdomain.com` load
  over HTTPS with valid certs.
- On the live Angular site, open devtools → Network tab → confirm a request to
  `assets/config.json` returns real public API URLs (not `localhost`, not literal
  `${CPT_API_URL}` placeholder text — the latter means the nginx entrypoint script
  didn't run).
- Exercise the patients list, CPT/ICD lookup, and AI-assist field — confirm all 4
  cross-container calls succeed with no CORS errors in the console. The AI field
  will be noticeably slower than on a dev machine (CPU-only inference on the
  Celeron J4125) — that's expected, not a bug.
- Load everything from **outside** your home network (mobile data, not NAS-local
  wifi) — the most common last-mile failure is a setup that only works from
  inside the house due to a missed port-forward or DDNS misconfiguration.

## Notes on the `ollama` service

- Capped at `mem_limit: 6g` in `docker-compose.yml` — with the other 7 containers
  realistically using well under 2GB combined, that leaves roughly 10GB of the
  NAS's 18GB free for DSM itself and its other packages. Don't raise this cap
  without also checking what else is running on the NAS at the time.
- Model weights persist in the `ollama_data` named volume, so a NAS reboot doesn't
  require re-pulling the model (only `ollama-init`'s one-time first run does).
- The 4 Express APIs hold **in-memory seeded demo data** with no persistent
  volumes — a restart resets them to their initial seed state. This is expected
  behavior for a portfolio demo, not a defect.
