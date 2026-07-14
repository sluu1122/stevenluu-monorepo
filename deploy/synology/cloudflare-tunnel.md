# Cloudflare Tunnel — hiding the home IP and closing the router ports

This replaces the original inbound path (Synology DDNS → double router port-forward
→ DSM reverse proxy → Let's Encrypt cert). A `cloudflared` container on the NAS
makes an **outbound** connection to Cloudflare's edge; all public traffic flows
back through that tunnel. The result:

- Public DNS points at Cloudflare, so the home IP is no longer exposed in DNS.
- **No inbound ports** need to be open — ports 80/443 forwards on both routers can
  be deleted, and the "NAT filtering Open / DoS protection off" tradeoffs reverted.
- No Synology DDNS, no Let's Encrypt cert, no DSM reverse proxy rules needed —
  Cloudflare terminates public TLS at its edge for free.

The `cloudflared` service is already defined in `docker-compose.nas.yml`. It shares
the `appnet` Docker network, so it routes to each app by its Docker **service name**
(no published host ports involved).

## Prerequisite decision: DNS moves to Cloudflare

The domain **registration** stays where it is (Squarespace). Only **DNS hosting**
moves: you change nameservers at the registrar to Cloudflare's. On the free plan,
full nameserver delegation is the only option. This is reversible — point the
nameservers back to Squarespace to undo everything.

> **EMAIL LANDMINE.** `stevenluu.com` has live email. Its `MX` records
> (`smtp.secureserver.net`, `mailstore1.secureserver.net`) and the mail-related
> CNAMEs (`mail`, `imap`, `pop`, `smtp` → `*.secureserver.net`) **must** be
> recreated in Cloudflare as **DNS only** (grey cloud, never proxied). If they
> don't survive the move, email stops working. Screenshot the full Squarespace
> record list before starting so you can diff against Cloudflare's import.

---

## Step 1 — Create the Cloudflare account and add the site

1. Sign up at <https://dash.cloudflare.com/sign-up> (free).
2. **Add a site** → enter `stevenluu.com` → choose the **Free** plan.
3. Cloudflare scans existing DNS and shows the records it imported. **Review every
   row against the Squarespace screenshot:**
   - `MX` records present and pointing at `*.secureserver.net`? → keep, **DNS only**.
   - `mail`/`imap`/`pop`/`smtp` CNAMEs present? → keep, **DNS only**.
   - Any `TXT` records (SPF `v=spf1...`, DKIM, domain verification)? → keep exactly.
   - The old apex `A`/`ALIAS` and `www`/subdomain records pointing at the DDNS host
     or home IP → these get **replaced** by the tunnel in Step 4, so they can be
     deleted now or left to be overwritten. (Deleting avoids confusion.)
4. Cloudflare shows **two assigned nameservers** (e.g. `xxx.ns.cloudflare.com`).
   Note them — used in Step 5. **Don't change nameservers yet;** set up the tunnel
   first so there's no downtime window.

## Step 2 — Create the tunnel and get its token

1. In the dashboard left nav: **Zero Trust** (may prompt to pick a free plan / team
   name the first time — no credit card needed for the free tier).
2. **Networks → Tunnels → Create a tunnel** → connector type **Cloudflared**.
3. Name it (e.g. `synology-nas`) → **Save**.
4. On the "Install connector" screen, choose **Docker**. Cloudflare shows a
   `docker run ... --token eyJh...` command. **Copy only the token** (the long
   `eyJ...` string) — the compose file already supplies the rest of the command.
5. Leave this tunnel page open; you'll add public hostnames in Step 4.

## Step 3 — Add the token to the NAS and redeploy

1. Edit the NAS env file at `/volume1/docker/stevenluu-monorepo/.env` (File Station
   → download, edit, re-upload, or edit in place). Add:
   ```
   CLOUDFLARE_TUNNEL_TOKEN=eyJ...paste the full token...
   ```
2. Update the project's compose in Container Manager to the new
   `docker-compose.nas.yml` (which now includes the `cloudflared` service):
   Container Manager → **Project** → the project → **paste the updated YAML** into
   the compose editor (or re-upload) → **Build**.
3. When it comes up, the tunnel page in the dashboard should flip the connector
   status to **Healthy / Connected** within ~30s. In Container Manager the
   `cloudflared` container logs should show `Registered tunnel connection`.
   - If it stays down: the token is wrong/truncated, or the NAS can't reach
     Cloudflare outbound on 443 (it can — that's normal outbound web traffic).

## Step 4 — Map public hostnames to internal services

Still in the tunnel's **Public Hostname** tab, add one route per site. Because
`cloudflared` is on `appnet`, the **Service** URL uses the Docker service name and
its **internal** container port (not the published host port):

| Subdomain (Public hostname)     | Type | Service URL (internal)         |
| ------------------------------- | ---- | ------------------------------ |
| `stevenluu.com` (apex, blank)   | HTTP | `http://portfolio:3000`        |
| `www.stevenluu.com`             | HTTP | `http://portfolio:3000`        |
| `angular.stevenluu.com`         | HTTP | `http://angular-dashboard:80`  |
| `react.stevenluu.com`           | HTTP | `http://react-dashboard:80`    |
| `ai-api.stevenluu.com`          | HTTP | `http://ai-api:3001`           |
| `cpt-api.stevenluu.com`         | HTTP | `http://cpt-api:3002`          |
| `icd-api.stevenluu.com`         | HTTP | `http://icd-api:3003`          |
| `patients-api.stevenluu.com`    | HTTP | `http://patients-api:3004`     |

Notes:
- For the apex, set the hostname's **Domain** to `stevenluu.com` and leave the
  **Subdomain** blank.
- Service is **HTTP** (not HTTPS) — the containers serve plain HTTP internally;
  Cloudflare provides the public HTTPS at its edge.
- Adding a public hostname **auto-creates a proxied CNAME** for it in the DNS tab
  (orange cloud, target `<tunnel-id>.cfargotunnel.com`). You don't create these by
  hand. If Step 1's import left an old apex/www/subdomain record, delete it so the
  tunnel's record is the only one.
- `ai-api`'s AI-assist streams responses. If it ever buffers oddly behind the
  proxy, add an **Additional application setting → HTTP2 origin** off / or a longer
  timeout, but the defaults are fine to start.

## Step 5 — Cut over the nameservers

1. At the **registrar** (Squarespace domain settings — *not* the DNS records page):
   find **Nameservers** and switch from "Squarespace/managed" to **Custom**, then
   enter the two Cloudflare nameservers from Step 1.
   - The domain's **DNSSEC must stay OFF** during the switch (it already is — you
     disabled it earlier for the ALIAS). You can re-enable DNSSEC *from Cloudflare's
     side* later (DNS → Settings → Enable DNSSEC), which is much easier than
     Squarespace's was.
2. Back in Cloudflare, the site status goes from "Pending Nameserver Update" to
   **Active** once propagation completes — anywhere from minutes to a few hours.
   Cloudflare emails you when it's active.

## Step 6 — Verify

Once Cloudflare shows the site **Active**:

1. From your **phone on cellular** (off home wifi), load:
   - `https://stevenluu.com` and `https://www.stevenluu.com` → portfolio
   - `https://angular.stevenluu.com` → dashboard, exercise the worklist + AI summary
   - `https://react.stevenluu.com` → finance dashboard
2. Confirm the padlock shows a **Cloudflare-issued** certificate (Universal SSL),
   not the old Let's Encrypt one.
3. Confirm your IP is hidden: run `nslookup stevenluu.com` — it should now return
   **Cloudflare** IPs (104.x / 172.67.x ranges), not `207.219.67.194`.
4. **Send yourself a test email** to the `stevenluu.com` address and confirm it
   still arrives — proves the MX move was clean.

## Step 7 — Tear down the old inbound path (only after Step 6 passes)

Now that nothing inbound is needed, close the exposure that the port-forward setup
required:

1. **Both routers:** delete the 80/443 port-forward rules
   (Telus gateway → Nighthawk, and Nighthawk → 192.168.0.54).
2. **Nighthawk:** revert WAN **NAT Filtering** back to **Secured**, and re-enable
   port-scan/DoS protection if you turned it off — none of it is needed anymore.
3. **DSM:** the reverse-proxy rules (Control Panel → Login Portal → Advanced →
   Reverse Proxy) are now unused — delete the 8 rules.
4. **DSM:** the Let's Encrypt 8-SAN cert and the Synology DDNS
   (`stevenluu.synology.me`) are no longer used — safe to remove once you're
   confident the tunnel is stable (leave them a week if you want a fallback).
5. Optional: remove the `ports:` published mappings from the app services in
   `docker-compose.nas.yml` (they're no longer reached from the host — the tunnel
   uses the internal network). Keeping them is harmless; removing them is tidier
   and closes even LAN-side access to the raw app ports.

## Rollback

If anything goes wrong at any stage, point the registrar nameservers back to
Squarespace's originals and re-enable the port-forwards + DSM reverse proxy. DNS
reverts within the TTL window and you're back to the pre-tunnel setup.
