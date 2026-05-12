# Deploy to Railway

The browser game is configured to deploy to Railway as a tiny Node static-file server. Zero npm dependencies — the entire server is one file (`web-game/server.js`) using Node's built-in `http` module.

## Two paths

### Path A — GitHub auto-deploy (recommended, ~2 minutes)

1. Sign up at **https://railway.app** (free hobby plan, no credit card needed for first project).
2. Click **+ New Project → Deploy from GitHub repo**.
3. Authorize Railway to read your GitHub.
4. Select **`ZENSEE1314/petme`**.
5. Railway auto-detects `railway.json` and `nixpacks.toml` and starts building.
6. Wait ~60 seconds. The deploy log will end with `serving … on port XXXX`.
7. Click the new service → **Settings → Networking → Generate Domain**.
8. You'll get a public URL like `petme-production.up.railway.app`.

That's it. Every push to `main` from now on auto-redeploys.

### Path B — Railway CLI (more control)

```powershell
# Already installed locally: railway 4.58.0
railway login                  # opens browser, ~10s
cd C:\Users\Zen See\smooth-giraffe
railway init                   # creates a new project, links this folder
railway up                     # uploads + builds + deploys

# Once live, get a public domain
railway domain                 # generates *.up.railway.app
railway open                   # opens the Railway dashboard
```

After `railway up`, the URL prints in the terminal. Subsequent pushes still need `railway up` (no auto-deploy via CLI path unless you connect a GitHub remote too).

---

## What's already configured

| File | Purpose |
|---|---|
| `web-game/server.js` | Tiny static file server. Reads `process.env.PORT` (Railway sets this), defaults to 5173 locally. Zero npm deps. |
| `web-game/package.json` | Declares `node>=18`. `npm start` runs `node server.js`. |
| `railway.json` | Tells Railway: build with Nixpacks, start with `node web-game/server.js`, healthcheck on `/`, restart on failure. |
| `nixpacks.toml` | Tells Nixpacks: use Node 20, no install step needed, no build step. |

The build is **instant** (no `npm install`, no transpilation) and the runtime image is tiny (~30 MB Node + this folder).

## Costs

Railway's **hobby plan** is free for new accounts up to $5 of usage credits per month. This game uses:
- ~30 MB RAM
- A few CPU seconds per day
- Negligible network egress

Realistic usage: **a few cents per month**. Well under the free credits.

## Local testing of the production server

```powershell
# Match the production setup
$env:PORT = 5174
node web-game/server.js

# In another shell, smoke test
Invoke-WebRequest http://localhost:5174/
```

Should return 200 with `text/html`.

## Troubleshooting

| Symptom | Fix |
|---|---|
| Railway build fails with "no detected runtime" | Make sure `railway.json` and `nixpacks.toml` are at repo root (they are). Force redeploy. |
| Returns 502 after deploy | The app didn't bind to `process.env.PORT`. Check Railway logs — should print `serving … on port XXXX` where XXXX is whatever Railway picked. |
| Returns 404 on `/` | The start command path is wrong. Make sure `railway.json` startCommand is `node web-game/server.js` from the repo root, not from `web-game/`. |
| Auto-deploy not triggering | In Railway dashboard → Settings → Source, ensure GitHub repo is connected and the branch is `main`. |

## Custom domain (optional)

Railway → Service → Settings → Networking → **Custom Domain**. Add e.g. `petme.yoursite.com` and update DNS. Free TLS via Let's Encrypt.
