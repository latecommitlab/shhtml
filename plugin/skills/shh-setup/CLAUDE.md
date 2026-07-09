# skills/shh-setup/

One-time instance provisioning. `scripts/provision` is idempotent: it reuses
any bucket, DNS record, Access app, or policy that already exists, so
re-running after a partial failure is the intended recovery path.

What it needs: `CLOUDFLARE_API_TOKEN` in the environment (never passed as a
flag, never echoed), plus zone, two hostnames, emails, and the worker dir.

What it does not do: deploy. Deploy stays an explicit wrangler step in the
skill so the user sees it happen and secrets are set interactively. Order
matters: `wrangler deploy` first, then `secret put SIGNING_SECRET` (the secret
needs an existing worker to attach to).

The two Access applications it creates:

- `shhtml publisher` on `<publish-host>/auth`: who can obtain upload tokens
- `shhtml viewer` on `<static-host>`: who can view published pages

Both start with the same email allow-list. Per-path exceptions (public pages)
are documented at the bottom of SKILL.md and are dashboard or API work, not
provisioner work.
