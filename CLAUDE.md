# shhtml

Private-by-default static publishing on the user's own Cloudflare account,
packaged as a Claude Code plugin. Read README.md first; this file is for
working on the repo.

## Map

- `.claude-plugin/marketplace.json` marketplace manifest; `/plugin marketplace add <owner>/shhtml` reads this
- `plugin/` the Claude Code plugin (skills + CLI + provisioner)
- `worker/` the Cloudflare Worker that is the entire backend

## Invariants (do not break these)

1. **No instance facts in the repo.** No account IDs, domains, team names,
   AUD tags, or emails of any real deployment. Instance config lives in the
   user's `wrangler.toml` (gitignored) and `~/.config/shhtml/`.
2. **No secrets in the repo, ever.** The signing secret exists only in
   Cloudflare's secret store. Tokens exist only in `~/.config/shhtml/token`.
3. **Every write endpoint requires the HMAC token.** Including `/check`.
   Anonymous requests learn nothing except that the service exists.
4. **Clients cannot write dotfiles.** The `.shh` marker is written server-side
   by `/finalize` only. Viewers can never fetch dotfiles.
5. **The worker never decides who can view.** Viewing authorization belongs to
   Cloudflare Access on the static hostname. The worker only serves.

## Versioning

`plugin.json` deliberately has no `version` field: Claude Code then uses the
git commit SHA, so `/plugin update` picks up every push. If this ever moves to
a stable release cycle, add semver plus a CHANGELOG and bump on each release.

## Testing

- `cd worker && npm test` runs the unit suite (token, Access JWT, key rules)
- `plugin/skills/shh/scripts/shh selftest` checks the CLI's pure functions
- Both must pass before any push. For protocol changes, also run the live
  checks listed in `plugin/skills/shh-setup/SKILL.md` step 4 against a real
  instance.

## Future work that has come up

- `shh unpublish <path>` (delete a prefix; needs a worker DELETE route)
- `shh access <path> public|emails` to manage per-path Access apps from the CLI
- `shh list` (list published paths; worker route over R2 list)
- optional Google Sheets-style shared state for published pages, as a separate
  skill, never wired into this one by default
