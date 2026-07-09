# worker/

The whole backend: one Cloudflare Worker bound to one R2 bucket, routed on two
hostnames of the same zone.

- `src/index.js` router. publish host: `/auth`, `/whoami`, `/upload/*`,
  `/check/*`, `/finalize/*`. static host: GET/HEAD file serving with
  `/path` to `/path/index.html` rewriting and security headers.
- `src/token.js` HS256 mint/verify for upload tokens. Pure, tested.
- `src/access.js` Cloudflare Access JWT validation (RS256 against the team
  JWKS, audience and issuer required). `verifyAccessJwt` takes the JWKS as an
  argument so tests never touch the network.
- `src/keys.js` the single source of truth for key validity, hidden-file
  rules, and request-path to R2-key resolution. Pure, tested.
- `src/pages.js` the only two HTML pages the worker renders.

Security posture, in order of enforcement:

1. Cloudflare Access at the edge (login walls) runs before this code
2. `/auth` re-validates the Access JWT anyway and is the only token mint
3. everything else on the publish host requires the HMAC token
4. upload keys and served paths both go through `keys.js`; dotfiles are
   server-only territory
5. `/auth` callbacks may only target loopback addresses

Testing: `npm test` (node's built-in runner, `test/*.test.js`). The tests
self-generate an RSA keypair to fake the Access JWKS. Keep new logic in pure
modules so it stays testable this way. Deploys use the gitignored
`wrangler.toml`; the committed reference is `wrangler.toml.example`.
