# skills/shh/

The publish skill. `scripts/shh` is a single-file CLI: bash for flow, inline
python3 for JSON and the login callback server, curl for HTTP. No other
dependencies, so it runs on a stock Mac.

How login works: `shh login` starts a loopback HTTP server on a random port,
opens the browser to `<publish_url>/auth?callback=http://127.0.0.1:<port>/`,
Cloudflare Access authenticates the user, the worker mints a 30 day token and
302s to the callback, the server captures it and writes
`~/.config/shhtml/token` (mode 600).

Publish flow: collision check (`/check/<path>`), upload each file with its
content type (`PUT /upload/<path>/<rel>`), then `POST /finalize/<path>` which
writes the server-side `.shh` marker the collision check reads.

If you change path or key rules, change them in three places together:
`normalize_path` here, `keys.js` in the worker, and the tests for both.
`shh selftest` must pass after any edit to this script.
