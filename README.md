# ZUBA: The Motherland Has Entered the Game

The official website for $ZUBA, the gaming and animation token telling the world that Africa belongs on the global stage of anime and games.

Built with Next.js (App Router). Design language: violet spirit-glow UI with greatness-symbol (Δ) lettering, rune subtitles, notched frames and ornamental dividers.

## Pages

| Route | What it is |
| --- | --- |
| `/` | Home: hero, legend, theatre shelves, quest line, token + CA, listings, partners, latest dev notes, community |
| `/about` | Origin story, mission, values |
| `/theatre` | Movies & Games, Netflix-style shelves |
| `/theatre/movies/[slug]`, `/theatre/games/[slug]` | Full title page: storyline chapters, characters, gallery with lightbox |
| `/roadmap` | Skill-tree roadmap, five phases |
| `/dev-notes` | Builders' Notebook as a journey map; each entry opens as a notebook spread |
| `/blog` | Blog ("The Griot's Scroll") |
| `/token` | Contract address, how to buy, listings, partners |
| `/community` | X, Telegram, WhatsApp |
| `/admin` | Workbench: write and publish dev notes and blog posts |

Press **Q** / **E** on any page to switch tabs, like the in-game menu.

## Editing things

- **Links, contract, listings, partners:** `src/lib/site.ts`. Set a listing's `status` to `"live"` and add its `url`. Put partner logos in `public/partners/` and set `logo: "/partners/name.png"`.
- **Telegram / WhatsApp links:** `site.socials` in `src/lib/site.ts`. Empty links show as "coming soon".
- **Roadmap progress:** `status` in `src/content/roadmap.ts` (`cleared`, `active`, `locked`).
- **Films & games:** `src/content/theatre.ts`.
- **Dev notes & blog:** use `/admin`, or edit `content/devnotes.json` and `content/blog.json`.

## Admin setup (Vercel)

Add these environment variables in Vercel → Project → Settings → Environment Variables (see `.env.example`):

- `ADMIN_PASSWORD`: the Workbench password.
- `GITHUB_TOKEN`: fine-grained token with **Contents: read & write** on this repo only.
- `GITHUB_REPO`: `Chinexvick/ZUBAnew`
- `GITHUB_BRANCH`: the branch Vercel deploys to production (usually `main`).

When you save in the Workbench, the change is committed to the repo and Vercel redeploys automatically (about a minute). Without the GitHub variables (local development), saves go straight to the `content/` folder.

## Artwork

All art was generated with Higgsfield. `scripts/media-sources.txt` lists every image key and its URL, and `src/content/media.ts` is generated from it.

- `npm run media:sync`: regenerate `media.ts` from the sources list.
- `npm run media:download`: download every image into `public/media/` and point the site at the local copies. Recommended before launch, so the site doesn't depend on Higgsfield's CDN.

## Develop

```bash
npm install
cp .env.example .env.local   # set ADMIN_PASSWORD
npm run dev
```
