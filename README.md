# shhtml

Publish HTML quietly.

shhtml turns a Cloudflare account you already have into a private static host,
and gives Claude Code a `/shh` command to publish to it. You build a page, say
"publish this as finance", and get back `https://static.yourdomain.com/finance`.
Nobody can view it except the people you put on the list.

There is no server to run and nothing to pay for. Files live in R2, a small
Worker handles reads and writes, and Cloudflare Access does the logins. All of
it fits in Cloudflare's free tiers.

## How it works

```
viewing                              publishing
-------                              ----------
browser                              shh CLI (bash + curl)
   |                                    |
   v                                    v
static.yourdomain.com              publish.yourdomain.com
   |                                    |
Cloudflare Access                  /auth behind Cloudflare Access,
(who can view)                     everything else needs the token
   |                               that /auth mints (HMAC, 30 days)
   v                                    |
Worker serves from R2  <----------- Worker writes to R2
```

The first time you publish, a browser tab opens, you sign in with an email on
the allow list, and the CLI caches a signed token. After that publishing is
just an upload. Viewers get a Cloudflare login wall and are in after a
one-time code to their email. No Cloudflare accounts needed on either side.

## Install the plugin

In Claude Code:

```
/plugin marketplace add MechanicMishap/shhtml
/plugin install shhtml@shhtml
```

If someone already runs an instance and put your email on the list, point your
machine at it and sign in:

```
shh init https://publish.example.com https://static.example.com
shh login
```

Then ask Claude to publish something, or drive the CLI yourself:

```
shh publish finance index.html
shh publish finance --dir ./build
shh publish finance --force index.html    # replace what is there
shh whoami
```

## Host your own instance

One-time, about ten minutes, on your own Cloudflare account. You need a domain
on Cloudflare, a free Zero Trust organization (two clicks at
one.dash.cloudflare.com), node 18+, and an API token with these permissions:
Workers Scripts, Workers R2 Storage, Access: Apps and Policies, DNS, Workers
Routes.

Run `/shh-setup` in Claude Code and it walks through everything. Under the
hood it runs the provisioner, which is idempotent and safe to re-run:

```
CLOUDFLARE_API_TOKEN=... plugin/skills/shh-setup/scripts/provision \
  --zone example.com \
  --publish-host publish.example.com \
  --static-host static.example.com \
  --emails you@example.com \
  --worker-dir ./worker

cd worker
npx -y wrangler@4 deploy
openssl rand -hex 32 | npx -y wrangler@4 secret put SIGNING_SECRET
```

That creates the R2 bucket, both DNS records, both Access applications, writes
`wrangler.toml`, and deploys. `wrangler.toml` is gitignored because it holds
your account and domain; the repo stays generic.

## Who can see what

Two Access applications control everything, both managed in the Zero Trust
dashboard:

- **publisher** guards `publish.example.com/auth`: who can publish
- **viewer** guards `static.example.com`: who can view

Both start with the emails you gave setup. Change either list any time in the
dashboard. To make one page public, add an Access application for
`static.example.com/that-page` with a Bypass policy for Everyone; more
specific paths win.

## Security model

- Writes require an HMAC-SHA256 token minted only after a Cloudflare Access
  login. The signing secret lives in Cloudflare's secret store, not in code.
- Every write endpoint is authenticated, including the collision check.
- Upload paths are validated. No traversal, no dotfiles. The publish marker is
  written server-side, so clients cannot forge it.
- The auth callback only redirects to loopback addresses.
- Served pages get nosniff, deny-framing, and strict referrer headers. HTML is
  never cached, so a republish shows up on the next view.
- Tokens expire after 30 days and carry the publisher's email; every upload is
  tagged with who did it.
- Viewing is enforced at Cloudflare's edge before the worker runs. Losing the
  worker cannot expose a page.

What this is not for: secrets, PII, or anything regulated. It is a private
shelf for pages, not a vault.

## Development

```
cd worker && npm test                      # unit tests: token, Access JWT, key rules
plugin/skills/shh/scripts/shh selftest     # CLI checks
```

The worker is plain modules with the logic kept pure so the tests run on
node's built-in runner, no framework. Each directory has a CLAUDE.md
explaining how it fits together, for humans and for Claude.

## License

MIT
