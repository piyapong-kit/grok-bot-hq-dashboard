# Grok Bot HQ dashboard

Private live status board for the owner’s AI bots. GitHub Pages serves only static files. The ntfy topic is never stored in this repository.

## Open the board

After GitHub Pages is enabled:

`https://piyapong-kit.github.io/grok-bot-hq-dashboard/#<your-topic>`

The page reads the topic from the URL fragment only. It is not written to `localStorage`, not logged, and not sent anywhere except `https://ntfy.sh`.

If the fragment is missing, the page shows how to add it after `#`.

## Privacy

- No third-party scripts, fonts, CDNs, analytics, or images
- Strict Content-Security-Policy in `index.html`
- `referrer` is `no-referrer`
- Bot names and other message text are rendered with DOM text nodes, never `innerHTML`

## Local preview

Serve the repo root (for example `python3 -m http.server 4173`) and open:

- `/` — empty-fragment welcome screen
- `/#demo-hq-preview-not-a-real-topic` — live board against a fake topic
- `/test/preview.html` — same UI fed from local sample messages (no network), including the 3D office
- `/test/feed.html` — publishes those samples to a fake ntfy topic, then open the board with that fragment

The board defaults to the 3D office when WebGL is available and the browser does not prefer reduced motion. A 3D/2D toggle keeps the original card floors. Three.js r185.1 is vendored under `vendor/` and served from `self`.

`node test/parse-checks.js` covers merge rules, stale/health-check logic, and HTML-escaping cases (including Thai names and names with quotes).

## Deploy

Pushes to `main` deploy the static site with GitHub Actions (`actions/configure-pages`, `actions/upload-pages-artifact`, `actions/deploy-pages`).

If Pages is not on yet: **Settings → Pages → Source: GitHub Actions**.
