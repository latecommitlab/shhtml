# plugin/

The Claude Code plugin. `plugin.json` is the manifest (no version field on
purpose; see root CLAUDE.md). Skills live in `skills/<name>/SKILL.md`; the
directory name is the slash command.

- `skills/shh/` day-to-day publishing (model may auto-invoke)
- `skills/shh-setup/` one-time provisioning (explicit `/shh-setup` only,
  `disable-model-invocation: true`)

Rules for editing skills here:

- Reference scripts as `${CLAUDE_PLUGIN_ROOT}/skills/<name>/scripts/<file>`
- Keep SKILL.md short; move anything long into the scripts or the README
- The description frontmatter decides auto-triggering; write it as "what this
  does" plus "use when", and keep it honest about what it must not trigger for
