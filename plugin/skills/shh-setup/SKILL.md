---
name: shh-setup
description: Provision a new shhtml instance on the user's own Cloudflare account — R2 bucket, DNS records, and Cloudflare Access applications — then walk the user through deploying the worker and point the CLI at it. One-time setup. Use when the user wants to set up, provision, or host their own shhtml, or connect shhtml to their domain. Publishing to an instance that already exists is the shh skill's job, not this one.
disable-model-invocation: true
allowed-tools:
  - Bash
  - Read
  - Write
  - Glob
---

# shh-setup: provision an instance

Run this once per Cloudflare account. Everything it creates fits in Cloudflare's free tiers.

## Inputs to collect from the user

1. **Domain** already on their Cloudflare account (`example.com`)
2. **Two hostnames** on it, default `publish.<domain>` and `static.<domain>`
3. **Allow-list emails**: who can publish, and (by default) who can view
4. **A Cloudflare API token** in `CLOUDFLARE_API_TOKEN`. Ask the user how they store secrets rather than reading token values into the conversation. The token needs: Account: Workers Scripts, Workers R2 Storage, Access: Apps and Policies (edit); Zone: DNS (edit), Workers Routes (edit).

## Prerequisites to verify

- `node` 18+ available (`node --version`); wrangler runs via `npx`
- A Zero Trust organization exists on the account (one-time, free, at one.dash.cloudflare.com; the provision script tells you if it is missing)
- The shhtml worker source. When this plugin was installed from the git marketplace, it is at `${CLAUDE_PLUGIN_ROOT}/../worker`. Otherwise clone the repo and use its `worker/` directory.

## Steps

1. Run the provisioner (idempotent; re-running is safe):

```bash
${CLAUDE_PLUGIN_ROOT}/skills/shh-setup/scripts/provision \
  --zone example.com \
  --publish-host publish.example.com \
  --static-host static.example.com \
  --emails you@example.com \
  --worker-dir <path to worker/>
```

It verifies the token, resolves the zone and account, finds the Zero Trust team, creates both DNS records and both Access applications (publisher on `/auth`, viewer on the whole static hostname, both allowing the listed emails), creates the R2 bucket, then writes `wrangler.toml`.

Two stops are expected on a fresh account rather than failures, and both are recoverable by fixing the thing it names and re-running the identical command — the script reuses everything it already created:

- **No Zero Trust organization.** One-time and free at one.dash.cloudflare.com.
- **R2 not enabled.** A one-time click-through under R2 at dash.cloudflare.com. It is the free tier, though Cloudflare may ask for a payment method it will not charge. The script deliberately creates the bucket last so everything else is already in place when this happens.

2. Deploy the worker, then set the signing secret:

```bash
cd <worker dir>
npx -y wrangler@4 deploy
openssl rand -hex 32 | npx -y wrangler@4 secret put SIGNING_SECRET
```

3. Point the CLI at the new instance and sign in:

```bash
${CLAUDE_PLUGIN_ROOT}/skills/shh/scripts/shh init https://publish.example.com https://static.example.com
${CLAUDE_PLUGIN_ROOT}/skills/shh/scripts/shh login
```

4. Verify before declaring success:

- `curl -s -o /dev/null -w '%{http_code}' https://static.example.com/x` returns 302 (Access login wall)
- `curl -s -o /dev/null -w '%{http_code}' -X PUT https://publish.example.com/upload/x` returns 401 (writes need a token)
- `shh whoami` prints the signed-in email
- publish a test page and open it in the browser

## Changing who can see what

Access policies live in the Zero Trust dashboard under Access, Applications. Edit the viewer application's policy to change the default audience. To make one path public, add an Access application for `static.example.com/<path>` with a Bypass policy including Everyone; more specific paths win.
