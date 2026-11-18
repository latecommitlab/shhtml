# plugin/

The Claude Code plugin. `plugin.json` is the manifest (no version field on
purpose; see root CLAUDE.md). Skills live in `skills/<name>/SKILL.md`; the
directory name is the slash command.

- `skills/shh/` day-to-day publishing (model may auto-invoke)
- `skills/shh-setup/` one-time provisioning (explicit `/shh-setup` only,
  `disable-model-invocation: true`)

Rules for editing skills here:

- Reference scripts by paths relative to the skill's own folder
  (`scripts/shh`, `../shh/scripts/shh`). Codex sets no plugin-root variable,
  so `${CLAUDE_PLUGIN_ROOT}` would break there
- Codex installs this same folder: it reads `.claude-plugin/marketplace.json`
  and `plugin.json`. It ignores `disable-model-invocation`, so
  `skills/shh-setup/agents/openai.yaml` sets `allow_implicit_invocation: false`
- Keep SKILL.md short; move anything long into the scripts or the README
- The description frontmatter decides auto-triggering; write it as "what this
  does" plus "use when", and keep it honest about what it must not trigger for
