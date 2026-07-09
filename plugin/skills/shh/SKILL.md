---
name: shh
description: Publish an HTML page or static site to the user's shhtml instance and return the live URL. Use when the user wants to publish, share, host, or ship a static page, site, dashboard, or report they have built. Do not use for deploying applications with servers or databases.
allowed-tools:
  - Bash
  - Read
  - Glob
  - Grep
---

# shh: publish a static page

The CLI does the work:

```
${CLAUDE_PLUGIN_ROOT}/skills/shh/scripts/shh
```

## Before publishing

1. **Configured?** If `~/.config/shhtml/config.json` is missing, this machine has no instance yet. Ask whether they want to set one up (`/shh-setup`) or point at an existing one (`shh init <publish_url> <static_url>`).
2. **Confirm the two inputs.** Never guess:
   - the path name, which becomes the URL segment (`finance` publishes at `<static host>/finance`)
   - which files to publish, when more than one candidate exists
3. **Review the HTML and JS you are about to publish.** Flag to the user and get confirmation if you find:
   - calls sending data to unknown external origins (`fetch`, `XMLHttpRequest`, `sendBeacon`)
   - `eval()`, `Function()` constructors, or `javascript:` URLs
   - embedded iframes or objects pointing at external sites
   - anything that looks like a credential or API key baked into the page
   Loading libraries and fonts from well-known CDNs is fine; do not flag that.

## Publishing

```bash
# single page
${CLAUDE_PLUGIN_ROOT}/skills/shh/scripts/shh publish finance index.html

# page with assets
${CLAUDE_PLUGIN_ROOT}/skills/shh/scripts/shh publish finance index.html app.css chart.js

# whole directory
${CLAUDE_PLUGIN_ROOT}/skills/shh/scripts/shh publish finance --dir ./build
```

Behavior worth knowing:

- First run opens the browser to sign in through Cloudflare Access; a 30 day token is cached at `~/.config/shhtml/token`. Expired tokens re-trigger sign-in automatically.
- Publishing to a path that already has content fails unless `--force` is passed. Ask the user before forcing; it replaces what is there.
- Directory URLs work. The worker rewrites `/finance` and `/finance/` to `/finance/index.html`, so share the short URL the CLI prints.
- Path names are lowercased and spaces become hyphens. Valid: letters, digits, hyphens, underscores, slashes.

## After publishing

Give the user the URL the CLI printed. Remind them who can see it: viewing is controlled by the Cloudflare Access policy on the static hostname, which the instance owner manages in the Zero Trust dashboard (default from setup: the same emails that can publish).
