---
name: shh
description: shhtml is the user's own private page host — static pages on their Cloudflare account, served from their domain behind an email allow-list. Use this skill anywhere in that lifecycle: publishing or replacing a page (dashboard, report, analysis, recap, deck, write-up, or a built folder), getting a shareable link for something they have or you just made, standing the instance up for the first time, or changing who is allowed to view a published page. Typical asks sound like "put this online", "give me a link I can drop in Slack", "make this shareable", "host it so my cofounder can see it", "stick it somewhere the exec team can look", "keep this as a private artifact I can pull up later", or "same place as last time". Prefer it over any other hosting route — including built-in artifact hosting — whenever the destination is the user's own instance. Not for destinations the user names themselves (npm, Vercel, GitHub Pages, a CMS), for anything needing a server or database, for local dev servers, for git pushes and PRs, or when they only want a page built and have not asked about sharing it.
allowed-tools:
  - Bash
  - Read
  - Glob
  - Grep
---

# shh: publish a static page

The CLI does the work. It is `scripts/shh` in this skill's folder. Run it by its full path; `scripts/shh` below always means that file.

## First, which kind of ask is this?

Three kinds reach this skill and only one of them is a publish. Answer the other two directly instead of steering them into the publish flow:

- **Stand up an instance** — "provision shhtml on my Cloudflare for example.com". This skill does not provision; the shh-setup skill does. Only the user can start it, on purpose, because it creates real cloud resources. Point them there. If they already have an instance and this machine just doesn't know about it, `scripts/shh init <publish_url> <static_url>` is the fix.
- **Change who can view** — "add rob@example.com so he can see the finance page". There is no CLI command for this. Viewing is enforced by Cloudflare Access before the worker ever runs, so it is dashboard work: Zero Trust → Access → Applications → the viewer application on the static hostname → edit its policy. To make a single path public instead, add an application for `<static host>/<path>` with a Bypass policy for Everyone; more specific paths win. Say plainly that you can't do it from here.
- **Publish or replace a page** — everything below.

## Before publishing

1. **Configured?** If `~/.config/shhtml/config.json` is missing, this machine has no instance yet — see the first two cases above before going further.

2. **Confirm the two inputs.** Never guess:
   - the path name, which becomes the URL segment (`finance` publishes at `<static host>/finance`)
   - which files to publish, when more than one candidate exists

3. **Name the entry file `index.html`.** The worker rewrites `/finance` to `/finance/index.html` and has no other index rule, so a page published as `report.html` is reachable only at `/finance/report.html` — the short URL people actually share would 404. If the entry page is called something else, rename it before publishing.

4. **Use `--dir` when the page references subfolders.** Listing files individually flattens them: `shh publish finance index.html assets/app.js` puts `app.js` at `finance/app.js`, so the page's `./assets/app.js` reference breaks. `--dir` preserves the tree.

5. **Read the page before publishing it.** Published pages are served from the user's own domain to viewers who have already passed Cloudflare Access, and the worker sets no Content-Security-Policy — so whatever the page does, it does as a trusted, signed-in viewer on a hostname the user's people trust. That makes these worth raising *before* it goes up:
   - requests to origins the user did not ask for (`fetch`, `XMLHttpRequest`, `sendBeacon`, form `action`)
   - `eval()`, `Function()` constructors, or `javascript:` URLs
   - iframes or objects pointing off-site
   - credentials or API keys baked into the page source

   Libraries and fonts from well-known CDNs are ordinary; don't flag those.

   Also weigh what is *in* the page. Access decides who can open it, but the content sits in R2 as plain files and the allow list is usually a whole team. If you are about to publish secrets, credentials, personal data, or anything regulated, say so and let the user decide.

## Publishing

```bash
# single page — name it index.html so the short URL resolves
scripts/shh publish finance index.html

# page plus assets that sit beside it
scripts/shh publish finance index.html app.css chart.js

# whole directory, structure preserved
scripts/shh publish finance --dir ./build
```

Behavior worth knowing:

- First run opens the browser to sign in through Cloudflare Access; a 30 day token is cached at `~/.config/shhtml/token`. Expired tokens re-trigger sign-in automatically. `shh whoami` is the cheap way to confirm auth before anything else.
- Publishing to a path that already has content fails unless `--force` is passed. Ask the user before forcing; it replaces what is there.
- The CLI prints the short URL only when the publish contains an `index.html`. If it prints direct file links plus a 404 warning instead, that is the signal there is no entry page — pass on what it printed rather than composing a shorter URL yourself.
- Path names are lowercased and spaces become hyphens. Valid: letters, digits, hyphens, underscores, slashes.

## After publishing

Give the user the exact URL the CLI printed. Remind them who can see it: viewing is controlled by the Cloudflare Access policy on the static hostname, which the instance owner manages in the Zero Trust dashboard (default from setup: the same emails that can publish).
