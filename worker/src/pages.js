// The two HTML responses the worker ever renders itself.

export function authPage(token, email) {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>shhtml: signed in</title>
<style>
  body { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; max-width: 560px;
         margin: 80px auto; padding: 0 20px; color: #1a1a1a; }
  h1 { font-size: 20px; }
  .box { background: #f4f4f4; border: 1px solid #ddd; border-radius: 6px; padding: 14px;
         word-break: break-all; font-size: 12px; margin: 16px 0; }
  button { border: 1px solid #1a1a1a; background: #fff; padding: 8px 16px; border-radius: 6px;
           font: inherit; cursor: pointer; }
  p.quiet { color: #666; }
</style>
</head>
<body>
  <h1>shh, you're in.</h1>
  <p>Signed in as <strong>${email}</strong>.</p>
  <p class="quiet">If the shh CLI opened this tab it has already captured the token and you can close this.</p>
  <p class="quiet">To set it manually instead:</p>
  <div class="box" id="t">${token}</div>
  <button onclick="navigator.clipboard.writeText(document.getElementById('t').textContent).then(()=>{this.textContent='copied'})">copy token</button>
  <p class="quiet">then run: <code>shh token &lt;paste&gt;</code></p>
</body>
</html>`;
}

export function notFoundPage() {
  return `<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><title>404</title>
<style>body{font-family:ui-monospace,Menlo,monospace;margin:120px auto;max-width:420px;text-align:center;color:#1a1a1a}</style>
</head>
<body><h1>404</h1><p>nothing published here.</p></body>
</html>`;
}
