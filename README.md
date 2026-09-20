# Imposter.

A free, family-friendly pass-and-play party word game. One phone goes around the group: everyone privately sees a secret word, except the imposter, who gets a clue (Classic) or a similar decoy word (Undercover). Give clues, vote, and keep a running score for as many rounds as you like.

Runs entirely in the browser. No accounts, no server, no database. Built with Vite, React, and TypeScript.

## Local development

Requires Node.js 20 or newer.

```bash
npm install
npm run dev       # start the dev server
npm test          # run the test suite (Vitest)
npm run build     # write the static site to dist/
npm run preview   # serve dist/ locally
```

## Deploying to Cloudflare Pages

Connect the GitHub repository to Cloudflare Pages and use these settings:

| Setting | Value |
|---|---|
| Build command | `npm run build` |
| Build output directory | `dist` |
| Node version | 20 or newer (set `NODE_VERSION=20` in the environment variables) |

Every push to the production branch rebuilds and deploys the site.

## Adding or editing built-in words

The built-in word list lives in `src/data/categories.json`. To add or edit words:

1. Read `docs/word-rules.md` first. It holds the writing rules, which category owns which kinds of words, and the content decisions already made.
2. Edit `src/data/categories.json` directly, keeping the shape `{ "word": "...", "hint": "...", "decoy": "..." }`. Every field must be non-empty, no word may repeat across categories, and a hint or decoy must not contain its own word.
3. Run `npm test`. The data test enforces the rules above and fails on any violation.

The original word list was extracted from Appendix A of `imposter.md` by `scripts/extract-categories.mjs`. That script is only for the initial extraction; after that, `categories.json` is the source of truth.

## Fonts and textures

Display type is Playfair Display and text is IM Fell English (plus its small-caps companion), both under the SIL Open Font License. The latin subsets live in `public/fonts/` and are self-hosted, so the app makes no third-party requests. The leather and paper textures in `public/textures/` are generated tiles, not photographs.

## Install and offline play

The app ships a web manifest and a small service worker (`public/sw.js`). On a phone, use "Add to Home Screen" to get an icon and a full-screen launch. After the first online visit the app keeps working without a connection; a new deploy is picked up on the next online load.

## Custom categories

Players can create their own categories in the app. They are stored in the browser's `localStorage` on that device only.

## Project layout

```
src/game/        Pure game logic (no React): imposter count, dealing, word picking, speaking order, scoring
src/custom/      Custom-category line parser
src/storage/     localStorage wrapper with in-memory fallback
src/data/        Built-in word data and its test
src/app/         App model, persistence, hooks
src/components/  Shared UI pieces
src/screens/     Setup, categories, editor, and round screens
```
