# GOAL: Build "Imposter," a pass-and-play party word game, as a static web app

## Objective
Build a mobile-first web app for the party game Imposter that runs entirely in the browser and deploys as static files (GitHub → Cloudflare Pages, no backend, no database). One phone is passed around a group: every player privately sees a secret word, except the imposter(s), who see a clue or, in Undercover mode, a similar decoy word. The app then runs the whole round: random first clue-giver, optional timer, open vote, imposter word-guess, and an endless running scoreboard. Built-in word data (23 categories, 1,150 words) is embedded in Appendix A of this file and must be used exactly as written. Out of scope: multiple devices or room codes, accounts, any server or database, sharing categories by link, a "Question Game" mode, offline/service-worker support, sound files, and deployment itself.

## Context
- **Repo:** the root of a new Git repository created for this project. Run every command from the repo root.
- **Branch:** work on the branch that is checked out when you start (normally `main`). Commit locally in logical steps. Never push.
- **Environment:** Node.js 20 or newer, npm. Commands below are npm scripts and behave the same in bash and PowerShell.
- **Background:** Existing Imposter apps lock most categories behind payment, use words kids don't know, and have no Undercover mode. This app is free, family-friendly, and every built-in word is one a 10-year-old knows. A player who doesn't know the word acts exactly like the imposter, so word quality matters more than word count.
- **Decisions already made (do not revisit):**
  - Pass-and-play on one phone only. Reason: a static site with no realtime backend.
  - Static output only, hosted from GitHub on Cloudflare Pages. Reason: owner's hosting setup; no database.
  - Stack: Vite + React + TypeScript, plain CSS (one global stylesheet plus CSS modules if wanted). No UI kit, no router. Reason: smallest dependency set that builds to static files; a router would let the browser Back button walk through past cards.
  - Imposter count formula, not a lookup table: max imposters = `floor((players − 1) / 3)`, minimum 1. Gives 1 at 3–6 players, 2 at 7–9, 3 at 10–12. Player count is 3–12.
  - Two modes: **Classic** (imposters know and get a clue) and **Undercover** (imposters get a decoy word and are not told they are the imposter).
  - Open voting: the group decides out loud, then taps the accused. No secret ballot.
  - Endless game with a running scoreboard. No point target, no round limit.
  - Troll Mode: when on, each Classic round has a 7% chance that every player is an imposter.
  - Reveal flow: hand-off screen that shows only the next player's name, tap to reveal, tap to hide. Details in S4.
  - Built-in categories ship in the app bundle as `src/data/categories.json`, extracted by script from Appendix A. User-made categories live only in the device's `localStorage`. Reason: static hosting, no database.
  - The built-in words were written and reviewed against the rules in Appendices B–D. Do not add, remove, reword, or reorder entries.
  - `package.json` scripts: `dev` (`vite`), `build` (`vite build`), `preview` (`vite preview`), `test` (`vitest run`). Tests run in Vitest's default Node environment; the logic under test has no DOM dependency.
- **Relevant files (present at start):**
  - `imposter.md`: this file. It contains the full product spec plus four appendices:
    - Appendix A: built-in word data as one JSON block, between the markers `<!-- BEGIN categories.json -->` and `<!-- END categories.json -->`.
    - Appendix B: word-writing rules.
    - Appendix C: which category owns which kinds of words.
    - Appendix D: content decisions.
- **Word data shape** (Appendix A and `src/data/categories.json`):
  ```json
  {
    "version": 1,
    "categories": [
      {
        "id": "food",
        "name": "Food",
        "icon": "🍕",
        "words": [ { "word": "Pizza", "hint": "Delivery", "decoy": "Calzone" } ]
      }
    ]
  }
  ```
  23 categories, 50 words each, 1,150 total. Category ids: `food, animals, sports, jobs, around-the-house, christmas, holidays, bible, places-around-town, vehicles, countries, landmarks, ocean, space, clothing, candy-snacks, music, toys, video-games, superheroes, movies, technology, famous-people`. Every `word`, `hint`, and `decoy` is a non-empty string. No `word` appears twice across the data (case-insensitive). Hints and decoys may repeat and may equal a word from another category.
- **Data setup (do this before any app code):** write `scripts/extract-categories.mjs`, a Node script with no dependencies that:
  1. reads `imposter.md` as UTF-8 and converts CRLF line endings to LF;
  2. finds the line `<!-- BEGIN categories.json -->`, then the next line that is exactly ```` ```json ````, and collects every following line up to the next line that is exactly ```` ``` ````;
  3. joins those lines with `\n` and adds one trailing `\n`;
  4. runs `JSON.parse` on the result and exits non-zero if it fails;
  5. writes that exact text (not re-serialized) to `src/data/categories.json`;
  6. prints `<N> categories, <M> words`.
  The app imports `src/data/categories.json`. Never retype or hand-edit word data; the SHA-256 check in the gates proves the extraction is exact.
- **Known pitfalls:**
  - A hidden card must be removed from the DOM, not just hidden with CSS.
  - A fast double-tap on Reveal can land on Hide and skip a player's card. Hide must stay disabled for 600 ms after the card appears.
  - `localStorage` can throw (private browsing, quota). All storage goes through one wrapper that falls back to memory and never crashes the app.
  - iOS Safari: use `100dvh` rather than `100vh`, keep input font size at 16px or more (prevents zoom on focus), respect `env(safe-area-inset-*)`.
  - `navigator.vibrate` and the Screen Wake Lock API are missing on some browsers. Feature-detect both; absence is not an error.
  - Importing JSON needs `resolveJsonModule` in `tsconfig`.
  - Git on Windows may check `imposter.md` out with CRLF line endings. The extraction script normalizes to LF so the SHA-256 matches on every OS.

## Product specification

### S1. Players and names (Setup screen)
- Player stepper, 3–12. First launch defaults to 4; afterwards it defaults to the last count used.
- One name field per player, in order. Placeholder `Player N`. A blank field plays as `Player N`.
- Names and count are saved to storage and prefilled next time. Lowering the count removes fields from the end; raising it restores previously saved names where they exist.
- Names are trimmed. Duplicate names (case-insensitive) show an inline error and disable Start.
- Card reveal order is the order names are entered, so players can enter them in seating order.

### S2. Game settings (Setup screen)
| Setting | Options | Default |
|---|---|---|
| Imposters | Stepper 1 to max from the formula, with a label "Max N for P players". Clamp when player count drops. | 1 |
| Mode | Classic / Undercover, each with a one-line description | Classic |
| Imposter clue (Classic only; hidden in Undercover) | Category only / Category + hint word / No clue | Category + hint word |
| Categories | Opens S3. Row shows "N selected". | All built-in selected |
| Timer | Off / 1 / 2 / 3 / 5 minutes | 2 minutes |
| Troll Mode (Classic only; hidden in Undercover) | Toggle, subtitle "7% chance everyone is the imposter" | Off |

- All settings persist to storage.
- Start is disabled, with the reason shown, when: no category is selected, names have duplicates, or Undercover is selected and the chosen categories contain no word with a decoy (only possible with custom categories).
- A "How to play" link opens a sheet with the rules and the scoring table from S6.
- If a saved active game exists (S8), the Setup screen shows a banner: "Resume game (Round N)" and "Discard."

### S3. Categories screen
- Built-in categories listed with icon, name, word count, and a checkbox. Multi-select. "Select all" and "Clear" buttons.
- A "My Categories" section lists custom categories (icon 📝) with an Edit button each, plus a "New category" button.
- The round's word is drawn from the combined pool of every selected category. The imposter's category clue always shows the category the word actually came from, which is what makes the category clue useful when several categories are selected.

### S4. Round flow
1. **Deal.** Pick the word (S5). Pick imposters: K distinct players chosen uniformly at random, where K is the Imposters setting. In Classic with Troll Mode on, roll once per round; with probability 0.07 every player is an imposter instead.
2. **Hand-off screen** (one per player, in entry order): only "Round N," "Pass the phone to," the player's name in large type, and one button: "I'm {name}, show my card." Nothing else about the round is on screen.
3. **Card screen.** Same layout and same background color for every role, so a glance from across the room reveals nothing.
   - Crew (both modes): "Your word," the word in large type, and "Category: X."
   - Undercover imposter: identical to a crew card, but showing the decoy. No imposter wording anywhere.
   - Classic imposter: "You're the imposter" in large type, then the clue per the setting: category only → "Category: X"; category + hint → "Category: X" and "Hint: H"; no clue → "No clue this round. Blend in." A custom word with an empty hint falls back to category only.
   - One button, "Hide card," disabled for the first 600 ms. Tapping it removes the card and goes to the next hand-off screen, or to step 4 after the last player.
4. **Clue screen.** Pick a first clue-giver uniformly at random from all players, imposters included. Show "{name} goes first," then the speaking order: continue in entry order from that player and wrap around. If the timer is on, show a large countdown with Pause/Resume and a "Vote now" button. At zero, show "Time's up," vibrate if supported, and make "Vote now" the primary button. Timer off: just the order and "Vote now." Request a screen wake lock while this screen is open, if supported.
5. **Vote screen.** "Who's the imposter?" (or "Pick K suspects" when K > 1). Every player is a tappable tile. Exactly K must be selected; a "Reveal" button enables when that is true. K is the Imposters setting, including in troll rounds, so the vote doesn't give the troll away.
6. **Reveal screen.** For each imposter: name and "Caught!" or "Got away!" The secret word is not shown yet.
   - Troll round instead: "Troll round! Everyone was the imposter," then the category and hint. No guessing, no points; continue to the scoreboard.
   - If any imposter was caught: "Caught imposters, say your guess for the word out loud now," then a "Show the word" button. After the word appears, each caught imposter gets "Got it" / "Missed" buttons. The group judges; there is no typed answer. "See scores" enables once every caught imposter is marked.
   - If none were caught: "Show the word," then "See scores."
   - When the word is shown: the word, its category, and in Undercover each imposter's decoy.
7. **Scoreboard.** Every player with this round's points (for example "+2") and their total, sorted by total, ties sharing a rank. Buttons: "Next round," "Change settings," "End game."
   - "Change settings" returns to Setup with scores kept. Changing the player list or any name there asks "This starts a new game and resets scores," then resets if confirmed. Other settings can change without a reset.
   - "End game" shows final standings with the winner(s), then "New game" returns to Setup with names kept.

### S5. Word selection
- The pool is every word in the selected categories, built-in and custom. In Undercover, words without a decoy are excluded.
- A word is identified by `categoryId + word`. Words played in this game are not repeated. When the unplayed pool is empty, mark the pool's words unplayed again and show a one-line notice: "You've played every word in these categories. Shuffling them back in."
- All randomness goes through one helper that uses `crypto.getRandomValues` and accepts an injected generator in tests.

### S6. Scoring (per imposter, per round; troll rounds score nothing)
| Outcome for an imposter | Points |
|---|---|
| Got away (not selected in the vote) | That imposter +2 |
| Caught, then guessed the word | That imposter +2 |
| Caught, then missed | Every non-imposter +1 |

With several imposters, apply the table once per imposter and add the results. Wrongly accused crew members lose nothing. Reason for the numbers: the imposter is outnumbered, so a win is worth more to them, while a catch rewards the whole crew.

### S7. Custom categories
- Editor fields: name (1–30 characters, unique across all category names, case-insensitive) and a words textarea with one entry per line in the format `word | hint | decoy`. Hint and decoy are optional (`Pizza`, `Pizza | Delivery`, and `Pizza | Delivery | Calzone` are all valid).
- Validation, shown per line: word required; each part at most 40 characters; no duplicate words within the category (case-insensitive); at least 5 words to save. Blank lines are ignored. Custom words may repeat built-in words.
- Save, and Delete behind a confirm dialog. Stored in `localStorage` with the same word shape as `categories.json`, ids like `custom-<timestamp>`.

### S8. Storage
- Keys: `imposter.v1.players`, `imposter.v1.settings`, `imposter.v1.customCategories`, `imposter.v1.activeGame`.
- `activeGame` holds players, settings, scores, played-word ids, and the round number. Save it when a scoreboard is shown; clear it on "End game" or "Discard." Mid-round state is not saved: reloading mid-round and choosing Resume returns to the last scoreboard, and the interrupted round doesn't count.
- Unparseable stored JSON is removed and treated as absent.

### S9. Look and feel
- Portrait phone first; works from 320 px wide; on wider screens the app is a centered column, max 480 px.
- Dark theme with an original palette. Suggested tokens: background `#0F172A`, surface `#1E293B`, text `#F8FAFC`, muted text `#94A3B8`, accent `#F97316`, danger `#EF4444`. System font stack only; no web fonts or CDNs.
- Tap targets at least 48 px tall, body text 18 px, the secret word at least 40 px and scaled down so long entries ("Cloudy with a Chance of Meatballs") fit without horizontal scrolling.
- Respect `prefers-reduced-motion`. The timer's "Time's up" is announced with `aria-live`.
- Page title and heading: "Imposter."

## Definition of Done
- [ ] `npm run build` writes a static site to `dist/` containing `index.html`, and the app loads from `npm run preview` with no console errors.
- [ ] `src/game/` holds the game logic as pure functions with no React imports: imposter max, role dealing (including troll rolls), word picking, first clue-giver and speaking order, and scoring.
- [ ] Tests prove: max imposters is 1 for 3–6 players, 2 for 7–9, 3 for 10–12; dealing gives exactly K distinct imposters; with an injected generator, troll triggers below 0.07 and not at or above it, and never in Undercover or with Troll Mode off.
- [ ] Tests prove the word picker never repeats a word until the pool is exhausted, then reshuffles, and excludes decoy-less words in Undercover.
- [ ] Tests prove every row of the S6 scoring table, a two-imposter round with one escape and one caught-and-missed, and a troll round scoring zero.
- [ ] `src/data/categories.json` was written by `scripts/extract-categories.mjs` and its SHA-256 matches Gate 2. A data test asserts: unique category ids; non-empty `name` and `icon`; at least 10 words per category; non-empty `word`, `hint`, and `decoy` on every entry; no duplicate words across categories (case-insensitive); no hint or decoy that contains its own word (case-insensitive). The test must not hard-code 23 or 50, so words can be added later.
- [ ] Tests prove the custom-category line parser accepts the three line formats in S7 and rejects empty words, parts over 40 characters, duplicates, and fewer than 5 words.
- [ ] Tests prove the storage wrapper returns saved values, removes unparseable values, and falls back to memory without throwing when the storage object throws on every call.
- [ ] Every screen and rule in S1–S9 is implemented, and each item in the manual check list is reported in the completion report as "needs manual verification."
- [ ] `docs/word-rules.md` contains Appendices B, C, and D copied word for word. `README.md` covers local development, Cloudflare Pages settings (build command `npm run build`, output directory `dist`, Node 20+), and how to add or edit built-in words: edit `src/data/categories.json` directly following `docs/word-rules.md`, then run `npm test`.
- [ ] All verification gates pass.
- [ ] No files changed outside May modify / May create.

## Repo constraints
**May modify:**
- `README.md`, `.gitignore`: if they already exist.

**May create:**
- `package.json`, `package-lock.json`
- `tsconfig.json`, `tsconfig.node.json`, `vite.config.ts`, `vitest.config.ts` (optional)
- `index.html`
- `src/**` (including `src/data/categories.json`, written only by the extraction script)
- `scripts/extract-categories.mjs`
- `docs/word-rules.md`
- `public/favicon.svg`
- `README.md`, `.gitignore`: if they don't exist.

**Must NOT touch:**
- `imposter.md`: this spec and the word-data source for extraction.
- `src/data/categories.json` content: never edit by hand in this goal. If it looks wrong, stop.
- `.github/**`: no CI workflows; Cloudflare Pages builds from the repo directly.

**Other constraints:**
- Dependencies: only `react` and `react-dom`; dev dependencies only `vite`, `@vitejs/plugin-react`, `typescript`, `@types/react`, `@types/react-dom`, and `vitest`. Anything else requires stopping to ask.
- Git: commit locally with short imperative messages. Never push, force-push, or change remotes.
- External systems: no deploys, no Cloudflare or GitHub configuration, no network calls from the app at runtime.

## Verification gates
Run from the repo root, in order. Do not report completion unless every gate matches its expected result.

0. Baseline, before any change:
   - `node --version` → v20 or higher. If lower, stop.
   - `git status --porcelain` → empty output.
   - List the repo root → only `.git`, `imposter.md`, and optionally `README.md`, `LICENSE`, `.gitignore`. Anything else: stop.
   - `git rev-parse HEAD` → record as BASE. If the repo has no commits yet, commit the files present as "Add spec," then record BASE.
1. `node scripts/extract-categories.mjs` → exits 0 and prints `23 categories, 1150 words`.
2. `node -e "const c=require('crypto'),f=require('fs');console.log(c.createHash('sha256').update(f.readFileSync('src/data/categories.json')).digest('hex'))"` → prints exactly `53b61c3f4bbc29e02fd8109ee9cf8550f22fa81ce63286b4b80aed5b22fefca1`.
3. `npm install` → exits 0.
4. `npx tsc --noEmit` → exits 0 with no errors.
5. `npm test` → runs the test files for game logic, word data, custom-category parser, and storage; 0 failed.
6. `npm run build` → exits 0; `dist/index.html` exists.
7. `git diff --stat BASE -- imposter.md` → empty output.
8. `git diff --name-only BASE` plus `git status --porcelain` → only paths listed under May modify / May create (`node_modules/` and `dist/` must be git-ignored and not appear).

Do not skip, delete, or weaken tests or assertions, and do not add lint-disable, type-ignore, or similar suppressions to pass a gate.

**Manual check list** (report each as "needs manual verification," never as passed):
- On a phone-sized viewport (375 × 667), play a 5-player Classic round from Setup to Scoreboard. The hand-off screen shows only the name and button; the card disappears after "Hide card"; a fast double-tap on Reveal does not skip a player.
- Classic imposter card and crew card have the same background and layout.
- Undercover round: the imposter's card is indistinguishable from a crew card; the reveal shows the decoy.
- 7 players allows 2 imposters; 6 players caps the stepper at 1.
- Timer counts down, pauses, resumes, and shows "Time's up" at zero.
- Reload after a scoreboard: "Resume game" returns to that scoreboard with scores intact.
- A custom category with 5 words can be created, played, edited, and deleted, and survives reload.
- Names and settings are prefilled after reload.

## Stop conditions
Stop and ask instead of improvising if:
- The Appendix A block can't be found or parsed, the SHA-256 in Gate 2 doesn't match, the counts in Gate 1 differ, or the data test fails. Do not fix the data.
- Any rule in the Product specification contradicts another, or cannot be built as written.
- A dependency outside the allowed list seems necessary.
- Meeting the Definition of Done requires changing `imposter.md`, hand-editing `src/data/categories.json`, touching `.github/**`, or any path outside May modify / May create.
- A Gate 0 baseline check fails.
- The same gate still fails after 3 distinct fix attempts.
- A verification command is missing or cannot run in this environment.
- The next step would push, deploy, or configure GitHub or Cloudflare.

When you stop, report: what you completed, what you found (with file paths and command output), the exact decision you need, and the options you see. Do not revert completed work unless told to.

## Completion report
When all gates pass, reply with:
1. Each Definition of Done item with its evidence (command output or `file:line`).
2. Each gate: the command and its actual result.
3. `git diff --stat BASE` output.
4. The manual check list, each marked "needs manual verification."
5. Anything you noticed but did not act on because it was out of scope.

---

## Appendix A: Built-in word data

Extract this block with `scripts/extract-categories.mjs` (see Data setup in Context). Do not retype it.

<!-- BEGIN categories.json -->
```json
{
  "version": 1,
  "categories": [
    {
      "id": "food", "name": "Food", "icon": "🍕",
      "words": [
        {"word": "Pizza", "hint": "Delivery", "decoy": "Calzone"},
        {"word": "Hamburger", "hint": "Cookout", "decoy": "Hot Dog"},
        {"word": "Hot Dog", "hint": "Ballpark", "decoy": "Corn Dog"},
        {"word": "Spaghetti", "hint": "Italian", "decoy": "Ramen"},
        {"word": "Taco", "hint": "Crunchy", "decoy": "Burrito"},
        {"word": "Pancakes", "hint": "Flip", "decoy": "French Toast"},
        {"word": "Waffles", "hint": "Syrup", "decoy": "Pancakes"},
        {"word": "Cereal", "hint": "Bowl", "decoy": "Oatmeal"},
        {"word": "Eggs", "hint": "Shell", "decoy": "Bacon"},
        {"word": "Bacon", "hint": "Crispy", "decoy": "Sausage"},
        {"word": "Toast", "hint": "Butter", "decoy": "Bagel"},
        {"word": "Grilled Cheese", "hint": "Melted", "decoy": "Quesadilla"},
        {"word": "Soup", "hint": "Spoon", "decoy": "Chili"},
        {"word": "Salad", "hint": "Green", "decoy": "Coleslaw"},
        {"word": "Chicken Nuggets", "hint": "Dip", "decoy": "Fish Sticks"},
        {"word": "French Fries", "hint": "Salty", "decoy": "Tater Tots"},
        {"word": "Mac and Cheese", "hint": "Cheesy", "decoy": "Spaghetti"},
        {"word": "Mashed Potatoes", "hint": "Gravy", "decoy": "Stuffing"},
        {"word": "Rice", "hint": "Chopsticks", "decoy": "Noodles"},
        {"word": "Sushi", "hint": "Roll", "decoy": "Egg Roll"},
        {"word": "Nachos", "hint": "Salsa", "decoy": "Quesadilla"},
        {"word": "Chicken Wings", "hint": "Messy", "decoy": "Ribs"},
        {"word": "Apple", "hint": "Red", "decoy": "Pear"},
        {"word": "Banana", "hint": "Peel", "decoy": "Mango"},
        {"word": "Orange", "hint": "Juice", "decoy": "Lemon"},
        {"word": "Strawberry", "hint": "Jam", "decoy": "Cherry"},
        {"word": "Watermelon", "hint": "Seeds", "decoy": "Cantaloupe"},
        {"word": "Grapes", "hint": "Bunch", "decoy": "Blueberries"},
        {"word": "Pineapple", "hint": "Tropical", "decoy": "Coconut"},
        {"word": "Lemon", "hint": "Sour", "decoy": "Lime"},
        {"word": "Carrot", "hint": "Garden", "decoy": "Celery"},
        {"word": "Broccoli", "hint": "Steamed", "decoy": "Cauliflower"},
        {"word": "Corn", "hint": "Yellow", "decoy": "Peas"},
        {"word": "Potato", "hint": "Baked", "decoy": "Onion"},
        {"word": "Tomato", "hint": "Sauce", "decoy": "Bell Pepper"},
        {"word": "Pickle", "hint": "Jar", "decoy": "Cucumber"},
        {"word": "Cheese", "hint": "Slice", "decoy": "Butter"},
        {"word": "Yogurt", "hint": "Cup", "decoy": "Pudding"},
        {"word": "Milk", "hint": "Glass", "decoy": "Orange Juice"},
        {"word": "Lemonade", "hint": "Summer", "decoy": "Iced Tea"},
        {"word": "Bread", "hint": "Bakery", "decoy": "Biscuit"},
        {"word": "Peanut Butter", "hint": "Sticky", "decoy": "Honey"},
        {"word": "Fried Chicken", "hint": "Bucket", "decoy": "Onion Rings"},
        {"word": "Dumplings", "hint": "Stuffed", "decoy": "Ravioli"},
        {"word": "Ramen", "hint": "Slurp", "decoy": "Chicken Noodle Soup"},
        {"word": "Ketchup", "hint": "Bottle", "decoy": "Mustard"},
        {"word": "Coffee", "hint": "Mug", "decoy": "Tea"},
        {"word": "Smoothie", "hint": "Blender", "decoy": "Milkshake"},
        {"word": "Avocado", "hint": "Pit", "decoy": "Kiwi"},
        {"word": "Lettuce", "hint": "Leafy", "decoy": "Spinach"}
      ]
    },
    {
      "id": "animals", "name": "Animals", "icon": "🐾",
      "words": [
        {"word": "Dog", "hint": "Pet", "decoy": "Cat"},
        {"word": "Cat", "hint": "Whiskers", "decoy": "Dog"},
        {"word": "Horse", "hint": "Farm", "decoy": "Donkey"},
        {"word": "Cow", "hint": "Spots", "decoy": "Goat"},
        {"word": "Pig", "hint": "Mud", "decoy": "Hippo"},
        {"word": "Chicken", "hint": "Feathers", "decoy": "Turkey"},
        {"word": "Duck", "hint": "Pond", "decoy": "Goose"},
        {"word": "Sheep", "hint": "Wool", "decoy": "Llama"},
        {"word": "Rabbit", "hint": "Hop", "decoy": "Squirrel"},
        {"word": "Hamster", "hint": "Cage", "decoy": "Guinea Pig"},
        {"word": "Mouse", "hint": "Tiny", "decoy": "Rat"},
        {"word": "Squirrel", "hint": "Tree", "decoy": "Chipmunk"},
        {"word": "Lion", "hint": "Roar", "decoy": "Tiger"},
        {"word": "Tiger", "hint": "Stripes", "decoy": "Lion"},
        {"word": "Cheetah", "hint": "Fast", "decoy": "Leopard"},
        {"word": "Zebra", "hint": "Black and White", "decoy": "Horse"},
        {"word": "Elephant", "hint": "Huge", "decoy": "Rhino"},
        {"word": "Giraffe", "hint": "Tall", "decoy": "Camel"},
        {"word": "Camel", "hint": "Desert", "decoy": "Giraffe"},
        {"word": "Monkey", "hint": "Swing", "decoy": "Gorilla"},
        {"word": "Bear", "hint": "Cave", "decoy": "Wolf"},
        {"word": "Panda", "hint": "Cuddly", "decoy": "Polar Bear"},
        {"word": "Kangaroo", "hint": "Pouch", "decoy": "Rabbit"},
        {"word": "Wolf", "hint": "Howl", "decoy": "Fox"},
        {"word": "Fox", "hint": "Clever", "decoy": "Coyote"},
        {"word": "Deer", "hint": "Antlers", "decoy": "Moose"},
        {"word": "Owl", "hint": "Night", "decoy": "Hawk"},
        {"word": "Eagle", "hint": "Soar", "decoy": "Falcon"},
        {"word": "Parrot", "hint": "Colorful", "decoy": "Toucan"},
        {"word": "Peacock", "hint": "Fancy", "decoy": "Flamingo"},
        {"word": "Flamingo", "hint": "Pink", "decoy": "Swan"},
        {"word": "Penguin", "hint": "Ice", "decoy": "Seal"},
        {"word": "Frog", "hint": "Slimy", "decoy": "Lizard"},
        {"word": "Turtle", "hint": "Slow", "decoy": "Snail"},
        {"word": "Snake", "hint": "Hiss", "decoy": "Worm"},
        {"word": "Bat", "hint": "Upside Down", "decoy": "Owl"},
        {"word": "Skunk", "hint": "Smelly", "decoy": "Raccoon"},
        {"word": "Raccoon", "hint": "Trash", "decoy": "Possum"},
        {"word": "Bee", "hint": "Buzz", "decoy": "Wasp"},
        {"word": "Butterfly", "hint": "Wings", "decoy": "Moth"},
        {"word": "Ladybug", "hint": "Garden", "decoy": "Firefly"},
        {"word": "Spider", "hint": "Creepy", "decoy": "Scorpion"},
        {"word": "Ant", "hint": "Picnic", "decoy": "Termite"},
        {"word": "Worm", "hint": "Dirt", "decoy": "Caterpillar"},
        {"word": "Hippo", "hint": "River", "decoy": "Walrus"},
        {"word": "Rhino", "hint": "Horn", "decoy": "Triceratops"},
        {"word": "Sloth", "hint": "Lazy", "decoy": "Koala"},
        {"word": "Beaver", "hint": "Teeth", "decoy": "Otter"},
        {"word": "Hedgehog", "hint": "Prickly", "decoy": "Porcupine"},
        {"word": "Polar Bear", "hint": "Arctic", "decoy": "Penguin"}
      ]
    },
    {
      "id": "sports", "name": "Sports", "icon": "⚽",
      "words": [
        {"word": "Soccer", "hint": "Goal", "decoy": "Kickball"},
        {"word": "Basketball", "hint": "Court", "decoy": "Volleyball"},
        {"word": "Baseball", "hint": "Glove", "decoy": "Softball"},
        {"word": "Football", "hint": "Helmet", "decoy": "Rugby"},
        {"word": "Hockey", "hint": "Ice", "decoy": "Lacrosse"},
        {"word": "Tennis", "hint": "Racket", "decoy": "Badminton"},
        {"word": "Golf", "hint": "Swing", "decoy": "Bowling"},
        {"word": "Bowling", "hint": "Strike", "decoy": "Skee-Ball"},
        {"word": "Swimming", "hint": "Pool", "decoy": "Diving"},
        {"word": "Volleyball", "hint": "Net", "decoy": "Dodgeball"},
        {"word": "Skateboarding", "hint": "Ramp", "decoy": "Scooter"},
        {"word": "Surfing", "hint": "Waves", "decoy": "Skateboarding"},
        {"word": "Skiing", "hint": "Mountain", "decoy": "Snowboarding"},
        {"word": "Snowboarding", "hint": "Snow", "decoy": "Sledding"},
        {"word": "Boxing", "hint": "Gloves", "decoy": "Karate"},
        {"word": "Wrestling", "hint": "Mat", "decoy": "Boxing"},
        {"word": "Karate", "hint": "Belt", "decoy": "Kung Fu"},
        {"word": "Gymnastics", "hint": "Flip", "decoy": "Cheerleading"},
        {"word": "Running", "hint": "Sneakers", "decoy": "Relay Race"},
        {"word": "Cycling", "hint": "Pedal", "decoy": "Rollerblading"},
        {"word": "Ice Skating", "hint": "Rink", "decoy": "Ballet"},
        {"word": "Dodgeball", "hint": "Gym", "decoy": "Tag"},
        {"word": "Kickball", "hint": "Recess", "decoy": "Baseball"},
        {"word": "Ping Pong", "hint": "Table", "decoy": "Air Hockey"},
        {"word": "Pickleball", "hint": "Paddle", "decoy": "Tennis"},
        {"word": "Archery", "hint": "Target", "decoy": "Darts"},
        {"word": "Fishing", "hint": "Lake", "decoy": "Hunting"},
        {"word": "Rock Climbing", "hint": "Rope", "decoy": "Hiking"},
        {"word": "Horseback Riding", "hint": "Saddle", "decoy": "Rodeo"},
        {"word": "Cheerleading", "hint": "Sidelines", "decoy": "Dance"},
        {"word": "Diving", "hint": "Board", "decoy": "Gymnastics"},
        {"word": "Sailing", "hint": "Wind", "decoy": "Rowing"},
        {"word": "Kayaking", "hint": "River", "decoy": "Rafting"},
        {"word": "Tug of War", "hint": "Pull", "decoy": "Rowing"},
        {"word": "Jump Rope", "hint": "Playground", "decoy": "Hopscotch"},
        {"word": "Weightlifting", "hint": "Muscles", "decoy": "Arm Wrestling"},
        {"word": "Car Racing", "hint": "Track", "decoy": "Go-Karts"},
        {"word": "Trampoline", "hint": "Bounce", "decoy": "Bounce House"},
        {"word": "Frisbee", "hint": "Throw", "decoy": "Boomerang"},
        {"word": "Sledding", "hint": "Hill", "decoy": "Water Slide"},
        {"word": "Roller Skating", "hint": "Wheels", "decoy": "Skateboarding"},
        {"word": "Hurdles", "hint": "Jump", "decoy": "Long Jump"},
        {"word": "Laser Tag", "hint": "Dark", "decoy": "Paintball"},
        {"word": "Mini Golf", "hint": "Obstacles", "decoy": "Skee-Ball"},
        {"word": "Snorkeling", "hint": "Goggles", "decoy": "Scuba Diving"},
        {"word": "Water Skiing", "hint": "Boat", "decoy": "Surfing"},
        {"word": "Dirt Biking", "hint": "Mud", "decoy": "BMX"},
        {"word": "Tetherball", "hint": "Pole", "decoy": "Four Square"},
        {"word": "Paddleboarding", "hint": "Balance", "decoy": "Kayaking"},
        {"word": "Parkour", "hint": "Wall", "decoy": "Obstacle Course"}
      ]
    },
    {
      "id": "jobs", "name": "Jobs", "icon": "💼",
      "words": [
        {"word": "Firefighter", "hint": "Truck", "decoy": "Paramedic"},
        {"word": "Police Officer", "hint": "Badge", "decoy": "Security Guard"},
        {"word": "Doctor", "hint": "Hospital", "decoy": "Dentist"},
        {"word": "Nurse", "hint": "Scrubs", "decoy": "Doctor"},
        {"word": "Teacher", "hint": "Classroom", "decoy": "Principal"},
        {"word": "Dentist", "hint": "Checkup", "decoy": "Eye Doctor"},
        {"word": "Chef", "hint": "Kitchen", "decoy": "Baker"},
        {"word": "Baker", "hint": "Dough", "decoy": "Chef"},
        {"word": "Farmer", "hint": "Tractor", "decoy": "Gardener"},
        {"word": "Pilot", "hint": "Airport", "decoy": "Astronaut"},
        {"word": "Vet", "hint": "Pets", "decoy": "Zookeeper"},
        {"word": "Zookeeper", "hint": "Feeding", "decoy": "Farmer"},
        {"word": "Mail Carrier", "hint": "Letters", "decoy": "Delivery Driver"},
        {"word": "Construction Worker", "hint": "Hard Hat", "decoy": "Carpenter"},
        {"word": "Plumber", "hint": "Wrench", "decoy": "Mechanic"},
        {"word": "Mechanic", "hint": "Garage", "decoy": "Plumber"},
        {"word": "Electrician", "hint": "Wires", "decoy": "Handyman"},
        {"word": "Janitor", "hint": "Mop", "decoy": "House Cleaner"},
        {"word": "Lifeguard", "hint": "Whistle", "decoy": "Coast Guard"},
        {"word": "Coach", "hint": "Clipboard", "decoy": "Referee"},
        {"word": "Referee", "hint": "Stripes", "decoy": "Umpire"},
        {"word": "Scientist", "hint": "Lab", "decoy": "Inventor"},
        {"word": "Artist", "hint": "Paint", "decoy": "Photographer"},
        {"word": "Photographer", "hint": "Pictures", "decoy": "Movie Director"},
        {"word": "Singer", "hint": "Microphone", "decoy": "DJ"},
        {"word": "Actor", "hint": "Stage", "decoy": "Magician"},
        {"word": "Magician", "hint": "Tricks", "decoy": "Clown"},
        {"word": "Clown", "hint": "Circus", "decoy": "Mascot"},
        {"word": "Author", "hint": "Books", "decoy": "Illustrator"},
        {"word": "Librarian", "hint": "Quiet", "decoy": "Teacher"},
        {"word": "Pastor", "hint": "Church", "decoy": "Teacher"},
        {"word": "Barber", "hint": "Scissors", "decoy": "Dog Groomer"},
        {"word": "Waiter", "hint": "Restaurant", "decoy": "Flight Attendant"},
        {"word": "Cashier", "hint": "Register", "decoy": "Bank Teller"},
        {"word": "Soldier", "hint": "Uniform", "decoy": "Knight"},
        {"word": "Judge", "hint": "Robe", "decoy": "Lawyer"},
        {"word": "Bus Driver", "hint": "Stops", "decoy": "Train Conductor"},
        {"word": "Truck Driver", "hint": "Highway", "decoy": "Delivery Driver"},
        {"word": "Garbage Collector", "hint": "Trash", "decoy": "Street Sweeper"},
        {"word": "Fisherman", "hint": "Boat", "decoy": "Sailor"},
        {"word": "Lumberjack", "hint": "Flannel", "decoy": "Carpenter"},
        {"word": "Park Ranger", "hint": "Forest", "decoy": "Camp Counselor"},
        {"word": "Crossing Guard", "hint": "Stop Sign", "decoy": "Lifeguard"},
        {"word": "Babysitter", "hint": "Kids", "decoy": "Daycare Teacher"},
        {"word": "Miner", "hint": "Underground", "decoy": "Archaeologist"},
        {"word": "Detective", "hint": "Clues", "decoy": "Spy"},
        {"word": "Mayor", "hint": "Speech", "decoy": "President"},
        {"word": "Reporter", "hint": "News", "decoy": "Weatherman"},
        {"word": "Dog Walker", "hint": "Leash", "decoy": "Babysitter"},
        {"word": "Cowboy", "hint": "Hat", "decoy": "Farmer"}
      ]
    },
    {
      "id": "around-the-house", "name": "Around the House", "icon": "🏠",
      "words": [
        {"word": "Couch", "hint": "Living Room", "decoy": "Recliner"},
        {"word": "Bed", "hint": "Sleep", "decoy": "Hammock"},
        {"word": "Pillow", "hint": "Soft", "decoy": "Cushion"},
        {"word": "Blanket", "hint": "Cozy", "decoy": "Sleeping Bag"},
        {"word": "Fridge", "hint": "Cold", "decoy": "Cooler"},
        {"word": "Microwave", "hint": "Beep", "decoy": "Toaster Oven"},
        {"word": "Toaster", "hint": "Pop", "decoy": "Waffle Maker"},
        {"word": "Oven", "hint": "Hot", "decoy": "Grill"},
        {"word": "Dishwasher", "hint": "Rinse", "decoy": "Washing Machine"},
        {"word": "Washing Machine", "hint": "Laundry", "decoy": "Dryer"},
        {"word": "Vacuum", "hint": "Loud", "decoy": "Leaf Blower"},
        {"word": "Broom", "hint": "Floor", "decoy": "Mop"},
        {"word": "Toilet", "hint": "Bathroom", "decoy": "Sink"},
        {"word": "Bathtub", "hint": "Bubbles", "decoy": "Hot Tub"},
        {"word": "Shower", "hint": "Steam", "decoy": "Sprinkler"},
        {"word": "Toothbrush", "hint": "Bristles", "decoy": "Hairbrush"},
        {"word": "Toothpaste", "hint": "Minty", "decoy": "Mouthwash"},
        {"word": "Soap", "hint": "Slippery", "decoy": "Shampoo"},
        {"word": "Towel", "hint": "Dry", "decoy": "Bathrobe"},
        {"word": "Mirror", "hint": "Reflection", "decoy": "Window"},
        {"word": "Window", "hint": "Glass", "decoy": "Door"},
        {"word": "Door", "hint": "Knock", "decoy": "Gate"},
        {"word": "Lamp", "hint": "Light", "decoy": "Flashlight"},
        {"word": "Alarm Clock", "hint": "Morning", "decoy": "Rooster"},
        {"word": "TV", "hint": "Screen", "decoy": "Projector"},
        {"word": "Remote", "hint": "Buttons", "decoy": "Game Controller"},
        {"word": "Chair", "hint": "Sit", "decoy": "Stool"},
        {"word": "Table", "hint": "Dinner", "decoy": "Desk"},
        {"word": "Bookshelf", "hint": "Dusty", "decoy": "Dresser"},
        {"word": "Dresser", "hint": "Drawers", "decoy": "Closet"},
        {"word": "Closet", "hint": "Hangers", "decoy": "Pantry"},
        {"word": "Fan", "hint": "Spin", "decoy": "Air Conditioner"},
        {"word": "Fireplace", "hint": "Warm", "decoy": "Campfire"},
        {"word": "Stairs", "hint": "Climb", "decoy": "Ladder"},
        {"word": "Trash Can", "hint": "Lid", "decoy": "Recycling Bin"},
        {"word": "Mailbox", "hint": "Flag", "decoy": "Birdhouse"},
        {"word": "Doorbell", "hint": "Ring", "decoy": "Wind Chimes"},
        {"word": "Garage", "hint": "Tools", "decoy": "Shed"},
        {"word": "Attic", "hint": "Boxes", "decoy": "Basement"},
        {"word": "Rug", "hint": "Feet", "decoy": "Doormat"},
        {"word": "Curtains", "hint": "Sunlight", "decoy": "Blinds"},
        {"word": "Sink", "hint": "Drain", "decoy": "Water Fountain"},
        {"word": "Plate", "hint": "Round", "decoy": "Bowl"},
        {"word": "Fork", "hint": "Silverware", "decoy": "Chopsticks"},
        {"word": "Cup", "hint": "Drink", "decoy": "Water Bottle"},
        {"word": "Pot", "hint": "Boil", "decoy": "Frying Pan"},
        {"word": "Candle", "hint": "Flame", "decoy": "Lantern"},
        {"word": "Nightlight", "hint": "Dark", "decoy": "Glow Stick"},
        {"word": "Smoke Detector", "hint": "Ceiling", "decoy": "Fire Extinguisher"},
        {"word": "House Plant", "hint": "Leaves", "decoy": "Flower Vase"}
      ]
    },
    {
      "id": "christmas", "name": "Christmas", "icon": "🎄",
      "words": [
        {"word": "Santa Claus", "hint": "Cookies", "decoy": "Easter Bunny"},
        {"word": "Reindeer", "hint": "Snow", "decoy": "Moose"},
        {"word": "Rudolph", "hint": "Red", "decoy": "Frosty the Snowman"},
        {"word": "Christmas Tree", "hint": "Decorate", "decoy": "Wreath"},
        {"word": "Ornament", "hint": "Hang", "decoy": "Snow Globe"},
        {"word": "Stocking", "hint": "Fireplace", "decoy": "Gift Bag"},
        {"word": "Candy Cane", "hint": "Striped", "decoy": "Lollipop"},
        {"word": "Snowman", "hint": "Build", "decoy": "Sandcastle"},
        {"word": "Elf", "hint": "Pointy Ears", "decoy": "Leprechaun"},
        {"word": "Sleigh", "hint": "Flying", "decoy": "Carriage"},
        {"word": "Presents", "hint": "Wrapped", "decoy": "Treasure Chest"},
        {"word": "Wrapping Paper", "hint": "Tape", "decoy": "Tissue Paper"},
        {"word": "Gingerbread House", "hint": "Icing", "decoy": "Dollhouse"},
        {"word": "Gingerbread Man", "hint": "Oven", "decoy": "Snowman"},
        {"word": "Christmas Cookies", "hint": "Sprinkles", "decoy": "Cupcakes"},
        {"word": "Wreath", "hint": "Door", "decoy": "Garland"},
        {"word": "Chimney", "hint": "Roof", "decoy": "Fireplace"},
        {"word": "North Pole", "hint": "Cold", "decoy": "South Pole"},
        {"word": "Nativity Scene", "hint": "Figurines", "decoy": "Christmas Village"},
        {"word": "Hot Chocolate", "hint": "Marshmallows", "decoy": "Apple Cider"},
        {"word": "Snowflake", "hint": "Falling", "decoy": "Raindrop"},
        {"word": "Christmas Lights", "hint": "Twinkle", "decoy": "Fireworks"},
        {"word": "Advent Calendar", "hint": "Countdown", "decoy": "Chocolate Box"},
        {"word": "Christmas Eve", "hint": "Waiting", "decoy": "New Year's Eve"},
        {"word": "Christmas Morning", "hint": "Pajamas", "decoy": "Easter Morning"},
        {"word": "Nutcracker", "hint": "Ballet", "decoy": "Toy Soldier"},
        {"word": "Jingle Bells", "hint": "Song", "decoy": "Happy Birthday"},
        {"word": "Caroling", "hint": "Singing", "decoy": "Trick-or-Treating"},
        {"word": "Mistletoe", "hint": "Doorway", "decoy": "Holly"},
        {"word": "Snow Globe", "hint": "Shake", "decoy": "Music Box"},
        {"word": "Grinch", "hint": "Green", "decoy": "Scrooge"},
        {"word": "Christmas Dinner", "hint": "Feast", "decoy": "Thanksgiving Dinner"},
        {"word": "Snowball Fight", "hint": "Duck", "decoy": "Water Balloon Fight"},
        {"word": "Snow Angel", "hint": "Lying Down", "decoy": "Leaf Pile"},
        {"word": "Christmas Card", "hint": "Mail", "decoy": "Valentine"},
        {"word": "Wish List", "hint": "Writing", "decoy": "Grocery List"},
        {"word": "Tinsel", "hint": "Shiny", "decoy": "Glitter"},
        {"word": "Christmas Play", "hint": "Costumes", "decoy": "Talent Show"},
        {"word": "Naughty List", "hint": "Checking", "decoy": "Report Card"},
        {"word": "Elf on the Shelf", "hint": "Watching", "decoy": "Security Camera"},
        {"word": "Christmas Break", "hint": "Vacation", "decoy": "Summer Vacation"},
        {"word": "Mrs. Claus", "hint": "Apron", "decoy": "Grandma"},
        {"word": "Ribbon", "hint": "Curly", "decoy": "Streamers"},
        {"word": "Icicle", "hint": "Drip", "decoy": "Popsicle"},
        {"word": "Santa's Sack", "hint": "Heavy", "decoy": "Backpack"},
        {"word": "Lump of Coal", "hint": "Dirty", "decoy": "Rock"},
        {"word": "Christmas Parade", "hint": "Floats", "decoy": "Marching Band"},
        {"word": "Santa's Workshop", "hint": "Busy", "decoy": "Toy Store"},
        {"word": "Snow Fort", "hint": "Hiding", "decoy": "Blanket Fort"},
        {"word": "Secret Santa", "hint": "Mystery", "decoy": "Surprise Party"}
      ]
    },
    {
      "id": "holidays", "name": "Holidays", "icon": "🎉",
      "words": [
        {"word": "Easter", "hint": "Spring", "decoy": "Thanksgiving"},
        {"word": "Easter Egg", "hint": "Hidden", "decoy": "Painted Rock"},
        {"word": "Egg Hunt", "hint": "Search", "decoy": "Scavenger Hunt"},
        {"word": "Easter Basket", "hint": "Grass", "decoy": "Picnic Basket"},
        {"word": "Easter Bunny", "hint": "Hop", "decoy": "Santa Claus"},
        {"word": "Dyeing Eggs", "hint": "Dye", "decoy": "Tie-Dye"},
        {"word": "Halloween", "hint": "October", "decoy": "Fall Festival"},
        {"word": "Pumpkin", "hint": "Patch", "decoy": "Watermelon"},
        {"word": "Jack-o'-Lantern", "hint": "Carve", "decoy": "Snowman"},
        {"word": "Costume", "hint": "Dress Up", "decoy": "Uniform"},
        {"word": "Trick-or-Treating", "hint": "Neighbors", "decoy": "Caroling"},
        {"word": "Haunted House", "hint": "Scary", "decoy": "Fun House"},
        {"word": "Ghost", "hint": "Sheet", "decoy": "Mummy"},
        {"word": "Thanksgiving", "hint": "Grateful", "decoy": "Family Reunion"},
        {"word": "Turkey", "hint": "Roasted", "decoy": "Ham"},
        {"word": "Pilgrims", "hint": "Hats", "decoy": "Pioneers"},
        {"word": "Mayflower", "hint": "Voyage", "decoy": "Pirate Ship"},
        {"word": "Pumpkin Pie", "hint": "Whipped Cream", "decoy": "Apple Pie"},
        {"word": "Cranberry Sauce", "hint": "Side Dish", "decoy": "Applesauce"},
        {"word": "Wishbone", "hint": "Pull", "decoy": "Birthday Candles"},
        {"word": "Fourth of July", "hint": "Summer", "decoy": "New Year's Eve"},
        {"word": "Fireworks", "hint": "Boom", "decoy": "Thunderstorm"},
        {"word": "Sparklers", "hint": "Sparks", "decoy": "Glow Stick"},
        {"word": "American Flag", "hint": "Stars", "decoy": "Banner"},
        {"word": "Uncle Sam", "hint": "Top Hat", "decoy": "Abraham Lincoln"},
        {"word": "Valentine's Day", "hint": "February", "decoy": "Mother's Day"},
        {"word": "Heart", "hint": "Love", "decoy": "Star"},
        {"word": "Roses", "hint": "Thorns", "decoy": "Tulips"},
        {"word": "Cupid", "hint": "Arrow", "decoy": "Fairy"},
        {"word": "Love Letter", "hint": "Envelope", "decoy": "Thank-You Note"},
        {"word": "St. Patrick's Day", "hint": "March", "decoy": "Earth Day"},
        {"word": "Leprechaun", "hint": "Tricky", "decoy": "Elf"},
        {"word": "Four-Leaf Clover", "hint": "Lucky", "decoy": "Horseshoe"},
        {"word": "Pot of Gold", "hint": "Treasure", "decoy": "Piggy Bank"},
        {"word": "Rainbow", "hint": "Colors", "decoy": "Sunset"},
        {"word": "New Year's Eve", "hint": "Midnight", "decoy": "Christmas Eve"},
        {"word": "Confetti", "hint": "Paper", "decoy": "Streamers"},
        {"word": "Birthday Party", "hint": "Invitation", "decoy": "Sleepover"},
        {"word": "Birthday Cake", "hint": "Candles", "decoy": "Cupcake"},
        {"word": "Balloons", "hint": "Pop", "decoy": "Bubbles"},
        {"word": "Piñata", "hint": "Blindfold", "decoy": "Water Balloon"},
        {"word": "Mother's Day", "hint": "Card", "decoy": "Father's Day"},
        {"word": "Father's Day", "hint": "Grill", "decoy": "Mother's Day"},
        {"word": "Hanukkah", "hint": "Winter", "decoy": "Christmas"},
        {"word": "Dreidel", "hint": "Spin", "decoy": "Spinning Top"},
        {"word": "Groundhog Day", "hint": "Shadow", "decoy": "Weather Forecast"},
        {"word": "April Fools' Day", "hint": "Prank", "decoy": "Magic Trick"},
        {"word": "Veterans Day", "hint": "Salute", "decoy": "Memorial Day"},
        {"word": "MLK Day", "hint": "January", "decoy": "Presidents' Day"},
        {"word": "Surprise Party", "hint": "Shh", "decoy": "Hide and Seek"}
      ]
    },
    {
      "id": "bible", "name": "Bible", "icon": "📖",
      "words": [
        {"word": "Noah", "hint": "Boat", "decoy": "Jonah"},
        {"word": "Moses", "hint": "Mountain", "decoy": "Elijah"},
        {"word": "David", "hint": "King", "decoy": "Samson"},
        {"word": "Goliath", "hint": "Armor", "decoy": "Pharaoh"},
        {"word": "Adam", "hint": "Garden", "decoy": "Abraham"},
        {"word": "Eve", "hint": "First", "decoy": "Sarah"},
        {"word": "Garden of Eden", "hint": "Trees", "decoy": "Promised Land"},
        {"word": "Jonah", "hint": "Storm", "decoy": "Noah"},
        {"word": "Daniel", "hint": "Brave", "decoy": "Esther"},
        {"word": "Fiery Furnace", "hint": "Fire", "decoy": "Burning Bush"},
        {"word": "Burning Bush", "hint": "Voice", "decoy": "Pillar of Fire"},
        {"word": "Joseph", "hint": "Dreams", "decoy": "Daniel"},
        {"word": "Mary", "hint": "Mother", "decoy": "Elizabeth"},
        {"word": "Peter", "hint": "Fisherman", "decoy": "Paul"},
        {"word": "Paul", "hint": "Letters", "decoy": "Peter"},
        {"word": "John the Baptist", "hint": "River", "decoy": "Elijah"},
        {"word": "Zacchaeus", "hint": "Tree", "decoy": "Matthew"},
        {"word": "Good Samaritan", "hint": "Helper", "decoy": "Prodigal Son"},
        {"word": "Prodigal Son", "hint": "Home", "decoy": "Lost Sheep"},
        {"word": "Samson", "hint": "Strong", "decoy": "Goliath"},
        {"word": "Abraham", "hint": "Promise", "decoy": "Jacob"},
        {"word": "Sarah", "hint": "Old", "decoy": "Elizabeth"},
        {"word": "Esther", "hint": "Queen", "decoy": "Ruth"},
        {"word": "Ruth", "hint": "Loyal", "decoy": "Esther"},
        {"word": "Joshua", "hint": "Walls", "decoy": "Gideon"},
        {"word": "Tower of Babel", "hint": "Tall", "decoy": "Pyramids"},
        {"word": "Red Sea", "hint": "Crossing", "decoy": "Jordan River"},
        {"word": "Ten Commandments", "hint": "Rules", "decoy": "Golden Rule"},
        {"word": "Manna", "hint": "Desert", "decoy": "Loaves and Fishes"},
        {"word": "Loaves and Fishes", "hint": "Lunch", "decoy": "Manna"},
        {"word": "Last Supper", "hint": "Bread", "decoy": "Passover"},
        {"word": "Manger", "hint": "Hay", "decoy": "Cradle"},
        {"word": "Wise Men", "hint": "Gifts", "decoy": "Shepherds"},
        {"word": "Shepherds", "hint": "Fields", "decoy": "Wise Men"},
        {"word": "Star of Bethlehem", "hint": "Bright", "decoy": "Pillar of Fire"},
        {"word": "Bethlehem", "hint": "Town", "decoy": "Nazareth"},
        {"word": "Jerusalem", "hint": "Temple", "decoy": "Rome"},
        {"word": "Dove", "hint": "Peace", "decoy": "Raven"},
        {"word": "Ten Plagues", "hint": "Egypt", "decoy": "The Flood"},
        {"word": "Pharaoh", "hint": "Stubborn", "decoy": "King Herod"},
        {"word": "Solomon", "hint": "Wise", "decoy": "King Saul"},
        {"word": "Elijah", "hint": "Chariot", "decoy": "Moses"},
        {"word": "Martha", "hint": "Busy", "decoy": "Mary"},
        {"word": "Wedding at Cana", "hint": "Party", "decoy": "Loaves and Fishes"},
        {"word": "Walking on Water", "hint": "Waves", "decoy": "Calming the Storm"},
        {"word": "Armor of God", "hint": "Shield", "decoy": "Fruit of the Spirit"},
        {"word": "Fruit of the Spirit", "hint": "List", "decoy": "Armor of God"},
        {"word": "Genesis", "hint": "Beginning", "decoy": "Revelation"},
        {"word": "Palm Sunday", "hint": "Waving", "decoy": "Parade"},
        {"word": "Mustard Seed", "hint": "Tiny", "decoy": "Acorn"}
      ]
    },
    {
      "id": "places-around-town", "name": "Places Around Town", "icon": "🏙️",
      "words": [
        {"word": "School", "hint": "Lockers", "decoy": "Summer Camp"},
        {"word": "Library", "hint": "Quiet", "decoy": "Bookstore"},
        {"word": "Hospital", "hint": "Emergency", "decoy": "Doctor's Office"},
        {"word": "Fire Station", "hint": "Sirens", "decoy": "Police Station"},
        {"word": "Police Station", "hint": "Safety", "decoy": "Courthouse"},
        {"word": "Post Office", "hint": "Stamps", "decoy": "Bank"},
        {"word": "Bank", "hint": "Money", "decoy": "Post Office"},
        {"word": "Grocery Store", "hint": "Carts", "decoy": "Farmers Market"},
        {"word": "Farmers Market", "hint": "Tents", "decoy": "Yard Sale"},
        {"word": "Gas Station", "hint": "Pump", "decoy": "Car Wash"},
        {"word": "Car Wash", "hint": "Soapy", "decoy": "Laundromat"},
        {"word": "Restaurant", "hint": "Menu", "decoy": "Cafeteria"},
        {"word": "Park", "hint": "Swings", "decoy": "Backyard"},
        {"word": "Playground", "hint": "Slide", "decoy": "Trampoline Park"},
        {"word": "Movie Theater", "hint": "Popcorn", "decoy": "Planetarium"},
        {"word": "Mall", "hint": "Escalator", "decoy": "Airport"},
        {"word": "Church", "hint": "Sunday", "decoy": "School"},
        {"word": "Zoo", "hint": "Animals", "decoy": "Farm"},
        {"word": "Museum", "hint": "Exhibits", "decoy": "Art Gallery"},
        {"word": "Aquarium", "hint": "Tanks", "decoy": "Pet Store"},
        {"word": "Bowling Alley", "hint": "Lanes", "decoy": "Arcade"},
        {"word": "Arcade", "hint": "Tokens", "decoy": "Carnival"},
        {"word": "Swimming Pool", "hint": "Lifeguard", "decoy": "Water Park"},
        {"word": "Water Park", "hint": "Splash", "decoy": "Splash Pad"},
        {"word": "Gym", "hint": "Workout", "decoy": "Dance Studio"},
        {"word": "Ice Cream Shop", "hint": "Cones", "decoy": "Snow Cone Stand"},
        {"word": "Bakery", "hint": "Fresh", "decoy": "Donut Shop"},
        {"word": "Coffee Shop", "hint": "Morning", "decoy": "Donut Shop"},
        {"word": "Barbershop", "hint": "Chair", "decoy": "Nail Salon"},
        {"word": "Pet Store", "hint": "Aisles", "decoy": "Animal Shelter"},
        {"word": "Toy Store", "hint": "Shelves", "decoy": "Candy Store"},
        {"word": "Airport", "hint": "Suitcases", "decoy": "Train Station"},
        {"word": "Train Station", "hint": "Tickets", "decoy": "Airport"},
        {"word": "Bus Stop", "hint": "Waiting", "decoy": "Carpool Line"},
        {"word": "Hotel", "hint": "Check-In", "decoy": "Cruise Ship"},
        {"word": "Farm", "hint": "Barn", "decoy": "Ranch"},
        {"word": "Hardware Store", "hint": "Nails", "decoy": "Garden Center"},
        {"word": "Parking Lot", "hint": "Cars", "decoy": "Drive-Thru"},
        {"word": "Drive-Thru", "hint": "Window", "decoy": "Food Truck"},
        {"word": "Skate Park", "hint": "Tricks", "decoy": "BMX Track"},
        {"word": "Amusement Park", "hint": "Rides", "decoy": "County Fair"},
        {"word": "Stadium", "hint": "Crowd", "decoy": "Race Track"},
        {"word": "Campground", "hint": "Outdoors", "decoy": "Summer Camp"},
        {"word": "City Hall", "hint": "Mayor", "decoy": "Courthouse"},
        {"word": "Dollar Store", "hint": "Cheap", "decoy": "Thrift Store"},
        {"word": "Pharmacy", "hint": "Medicine", "decoy": "Doctor's Office"},
        {"word": "Construction Site", "hint": "Cranes", "decoy": "Junkyard"},
        {"word": "Nursing Home", "hint": "Grandparents", "decoy": "Hospital"},
        {"word": "Sidewalk", "hint": "Chalk", "decoy": "Driveway"},
        {"word": "Food Court", "hint": "Choices", "decoy": "Buffet"}
      ]
    },
    {
      "id": "vehicles", "name": "Vehicles", "icon": "🚗",
      "words": [
        {"word": "Car", "hint": "Seatbelt", "decoy": "Van"},
        {"word": "Pickup Truck", "hint": "Bed", "decoy": "Jeep"},
        {"word": "School Bus", "hint": "Yellow", "decoy": "Minivan"},
        {"word": "Taxi", "hint": "Meter", "decoy": "Limo"},
        {"word": "Limo", "hint": "Long", "decoy": "Party Bus"},
        {"word": "Ambulance", "hint": "Siren", "decoy": "Fire Truck"},
        {"word": "Fire Truck", "hint": "Ladder", "decoy": "Tow Truck"},
        {"word": "Police Car", "hint": "Lights", "decoy": "Ambulance"},
        {"word": "Tow Truck", "hint": "Hook", "decoy": "Crane"},
        {"word": "Garbage Truck", "hint": "Bins", "decoy": "Street Sweeper"},
        {"word": "Cement Mixer", "hint": "Turning", "decoy": "Dump Truck"},
        {"word": "Dump Truck", "hint": "Unload", "decoy": "Bulldozer"},
        {"word": "Bulldozer", "hint": "Push", "decoy": "Excavator"},
        {"word": "Excavator", "hint": "Dig", "decoy": "Crane"},
        {"word": "Tractor", "hint": "Fields", "decoy": "Lawn Mower"},
        {"word": "Motorcycle", "hint": "Two Wheels", "decoy": "Dirt Bike"},
        {"word": "Bicycle", "hint": "Bell", "decoy": "Scooter"},
        {"word": "Scooter", "hint": "Kick", "decoy": "Skateboard"},
        {"word": "Airplane", "hint": "Wings", "decoy": "Helicopter"},
        {"word": "Helicopter", "hint": "Hover", "decoy": "Drone"},
        {"word": "Hot Air Balloon", "hint": "Basket", "decoy": "Blimp"},
        {"word": "Fighter Jet", "hint": "Loud", "decoy": "Rocket"},
        {"word": "Speedboat", "hint": "Fast", "decoy": "Jet Ski"},
        {"word": "Canoe", "hint": "Paddle", "decoy": "Kayak"},
        {"word": "Cruise Ship", "hint": "Vacation", "decoy": "Ferry"},
        {"word": "Submarine", "hint": "Underwater", "decoy": "Whale"},
        {"word": "Pirate Ship", "hint": "Cannons", "decoy": "Viking Ship"},
        {"word": "Tugboat", "hint": "Harbor", "decoy": "Tow Truck"},
        {"word": "Train", "hint": "Tracks", "decoy": "Subway"},
        {"word": "Subway", "hint": "Tunnel", "decoy": "Monorail"},
        {"word": "Monster Truck", "hint": "Crush", "decoy": "Tractor"},
        {"word": "Race Car", "hint": "Speed", "decoy": "Go-Kart"},
        {"word": "Jeep", "hint": "Off-Road", "decoy": "Four-Wheeler"},
        {"word": "Minivan", "hint": "Sliding Door", "decoy": "SUV"},
        {"word": "RV", "hint": "Road Trip", "decoy": "Tiny House"},
        {"word": "Golf Cart", "hint": "Course", "decoy": "Bumper Car"},
        {"word": "Bumper Cars", "hint": "Crash", "decoy": "Go-Karts"},
        {"word": "Snowplow", "hint": "Winter", "decoy": "Street Sweeper"},
        {"word": "Snowmobile", "hint": "Snow", "decoy": "Jet Ski"},
        {"word": "Jet Ski", "hint": "Waves", "decoy": "Snowmobile"},
        {"word": "Carriage", "hint": "Horses", "decoy": "Wagon"},
        {"word": "Wagon", "hint": "Handle", "decoy": "Wheelbarrow"},
        {"word": "Stroller", "hint": "Baby", "decoy": "Shopping Cart"},
        {"word": "Cable Car", "hint": "Hanging", "decoy": "Ski Lift"},
        {"word": "Tank", "hint": "Army", "decoy": "Bulldozer"},
        {"word": "Ice Cream Truck", "hint": "Music", "decoy": "Food Truck"},
        {"word": "Semi Truck", "hint": "Highway", "decoy": "Train"},
        {"word": "Moving Truck", "hint": "Boxes", "decoy": "Delivery Truck"},
        {"word": "Rowboat", "hint": "Oars", "decoy": "Canoe"},
        {"word": "Forklift", "hint": "Lift", "decoy": "Elevator"}
      ]
    },
    {
      "id": "countries", "name": "Countries", "icon": "🌍",
      "words": [
        {"word": "Italy", "hint": "Pasta", "decoy": "Greece"},
        {"word": "France", "hint": "Art", "decoy": "Italy"},
        {"word": "Spain", "hint": "Sunny", "decoy": "Portugal"},
        {"word": "Mexico", "hint": "Spicy", "decoy": "Spain"},
        {"word": "Canada", "hint": "Cold", "decoy": "Norway"},
        {"word": "United States", "hint": "Big", "decoy": "Canada"},
        {"word": "China", "hint": "Chopsticks", "decoy": "Japan"},
        {"word": "Japan", "hint": "Trains", "decoy": "South Korea"},
        {"word": "South Korea", "hint": "Pop Music", "decoy": "Japan"},
        {"word": "India", "hint": "Crowded", "decoy": "Thailand"},
        {"word": "Thailand", "hint": "Elephants", "decoy": "Vietnam"},
        {"word": "Vietnam", "hint": "Jungle", "decoy": "Thailand"},
        {"word": "Egypt", "hint": "Desert", "decoy": "Greece"},
        {"word": "Greece", "hint": "Ancient", "decoy": "Italy"},
        {"word": "England", "hint": "Tea", "decoy": "Ireland"},
        {"word": "Ireland", "hint": "Green", "decoy": "Scotland"},
        {"word": "Scotland", "hint": "Castles", "decoy": "Ireland"},
        {"word": "Germany", "hint": "Sausages", "decoy": "Switzerland"},
        {"word": "Switzerland", "hint": "Chocolate", "decoy": "Austria"},
        {"word": "Austria", "hint": "Music", "decoy": "Switzerland"},
        {"word": "Netherlands", "hint": "Tulips", "decoy": "Denmark"},
        {"word": "Belgium", "hint": "Waffles", "decoy": "Netherlands"},
        {"word": "Denmark", "hint": "Toys", "decoy": "Norway"},
        {"word": "Norway", "hint": "Vikings", "decoy": "Sweden"},
        {"word": "Sweden", "hint": "Furniture", "decoy": "Norway"},
        {"word": "Finland", "hint": "Reindeer", "decoy": "Sweden"},
        {"word": "Iceland", "hint": "Northern Lights", "decoy": "Greenland"},
        {"word": "Russia", "hint": "Huge", "decoy": "Canada"},
        {"word": "Poland", "hint": "Europe", "decoy": "Germany"},
        {"word": "Portugal", "hint": "Explorers", "decoy": "Spain"},
        {"word": "Brazil", "hint": "Soccer", "decoy": "Argentina"},
        {"word": "Argentina", "hint": "South", "decoy": "Brazil"},
        {"word": "Chile", "hint": "Long", "decoy": "Argentina"},
        {"word": "Peru", "hint": "Llamas", "decoy": "Chile"},
        {"word": "Colombia", "hint": "Coffee", "decoy": "Mexico"},
        {"word": "Costa Rica", "hint": "Rainforest", "decoy": "Brazil"},
        {"word": "Cuba", "hint": "Caribbean", "decoy": "Puerto Rico"},
        {"word": "Jamaica", "hint": "Tropical", "decoy": "Hawaii"},
        {"word": "Bahamas", "hint": "Beaches", "decoy": "Jamaica"},
        {"word": "Dominican Republic", "hint": "Baseball", "decoy": "Puerto Rico"},
        {"word": "Australia", "hint": "Continent", "decoy": "New Zealand"},
        {"word": "New Zealand", "hint": "Sheep", "decoy": "Australia"},
        {"word": "Philippines", "hint": "Islands", "decoy": "Indonesia"},
        {"word": "Indonesia", "hint": "Volcanoes", "decoy": "Philippines"},
        {"word": "Israel", "hint": "Middle East", "decoy": "Egypt"},
        {"word": "Saudi Arabia", "hint": "Camels", "decoy": "Egypt"},
        {"word": "Kenya", "hint": "Safari", "decoy": "South Africa"},
        {"word": "South Africa", "hint": "Diamonds", "decoy": "Kenya"},
        {"word": "Madagascar", "hint": "Africa", "decoy": "Jamaica"},
        {"word": "Nepal", "hint": "Mountains", "decoy": "India"}
      ]
    },
    {
      "id": "landmarks", "name": "Landmarks", "icon": "🗽",
      "words": [
        {"word": "Eiffel Tower", "hint": "Metal", "decoy": "Space Needle"},
        {"word": "Statue of Liberty", "hint": "Torch", "decoy": "Lincoln Memorial"},
        {"word": "Great Wall of China", "hint": "Long", "decoy": "Pyramids"},
        {"word": "Pyramids", "hint": "Desert", "decoy": "Stonehenge"},
        {"word": "Sphinx", "hint": "Face", "decoy": "Easter Island Heads"},
        {"word": "Easter Island Heads", "hint": "Stone", "decoy": "Mount Rushmore"},
        {"word": "Mount Rushmore", "hint": "Presidents", "decoy": "Easter Island Heads"},
        {"word": "Grand Canyon", "hint": "Deep", "decoy": "Yellowstone"},
        {"word": "Niagara Falls", "hint": "Mist", "decoy": "Hoover Dam"},
        {"word": "Yellowstone", "hint": "Park", "decoy": "Yosemite"},
        {"word": "Old Faithful", "hint": "Erupts", "decoy": "Water Fountain"},
        {"word": "Big Ben", "hint": "Chimes", "decoy": "Leaning Tower of Pisa"},
        {"word": "Leaning Tower of Pisa", "hint": "Crooked", "decoy": "Eiffel Tower"},
        {"word": "Golden Gate Bridge", "hint": "Foggy", "decoy": "Brooklyn Bridge"},
        {"word": "Stonehenge", "hint": "Circle", "decoy": "Pyramids"},
        {"word": "Colosseum", "hint": "Ruins", "decoy": "Stadium"},
        {"word": "Taj Mahal", "hint": "White", "decoy": "White House"},
        {"word": "White House", "hint": "Oval", "decoy": "Buckingham Palace"},
        {"word": "Buckingham Palace", "hint": "Guards", "decoy": "Cinderella Castle"},
        {"word": "Disney World", "hint": "Rides", "decoy": "Legoland"},
        {"word": "Mount Everest", "hint": "Climbers", "decoy": "Mount Fuji"},
        {"word": "Mount Fuji", "hint": "Volcano", "decoy": "Mount Everest"},
        {"word": "Hollywood Sign", "hint": "Hills", "decoy": "Times Square"},
        {"word": "Times Square", "hint": "Lights", "decoy": "Hollywood Sign"},
        {"word": "Empire State Building", "hint": "Elevator", "decoy": "Space Needle"},
        {"word": "Sydney Opera House", "hint": "Shells", "decoy": "Taj Mahal"},
        {"word": "Gateway Arch", "hint": "Silver", "decoy": "Washington Monument"},
        {"word": "Lincoln Memorial", "hint": "Marble", "decoy": "Statue of Liberty"},
        {"word": "Liberty Bell", "hint": "Crack", "decoy": "Big Ben"},
        {"word": "Great Barrier Reef", "hint": "Coral", "decoy": "Amazon Rainforest"},
        {"word": "Amazon Rainforest", "hint": "Jungle", "decoy": "Great Barrier Reef"},
        {"word": "Sahara Desert", "hint": "Sand", "decoy": "Grand Canyon"},
        {"word": "Nile River", "hint": "Longest", "decoy": "Mississippi River"},
        {"word": "Loch Ness", "hint": "Lake", "decoy": "Bermuda Triangle"},
        {"word": "Bermuda Triangle", "hint": "Mystery", "decoy": "Loch Ness"},
        {"word": "Central Park", "hint": "City", "decoy": "Times Square"},
        {"word": "London Eye", "hint": "Wheel", "decoy": "Ferris Wheel"},
        {"word": "Antarctica", "hint": "Penguins", "decoy": "North Pole"},
        {"word": "Plymouth Rock", "hint": "Pilgrims", "decoy": "Liberty Bell"},
        {"word": "Notre Dame", "hint": "Bells", "decoy": "Big Ben"},
        {"word": "Northern Lights", "hint": "Colors", "decoy": "Fireworks"},
        {"word": "Space Needle", "hint": "View", "decoy": "Eiffel Tower"},
        {"word": "Hoover Dam", "hint": "Concrete", "decoy": "Beaver Dam"},
        {"word": "Mississippi River", "hint": "Steamboats", "decoy": "Nile River"},
        {"word": "Route 66", "hint": "Road Trip", "decoy": "Oregon Trail"},
        {"word": "Washington Monument", "hint": "Pointy", "decoy": "Gateway Arch"},
        {"word": "Parthenon", "hint": "Columns", "decoy": "Colosseum"},
        {"word": "Rocky Mountains", "hint": "Hiking", "decoy": "Alps"},
        {"word": "Louvre", "hint": "Paintings", "decoy": "Smithsonian"},
        {"word": "Alps", "hint": "Skiing", "decoy": "Rocky Mountains"}
      ]
    },
    {
      "id": "ocean", "name": "Ocean", "icon": "🌊",
      "words": [
        {"word": "Shark", "hint": "Fin", "decoy": "Orca"},
        {"word": "Whale", "hint": "Giant", "decoy": "Manatee"},
        {"word": "Dolphin", "hint": "Smart", "decoy": "Seal"},
        {"word": "Octopus", "hint": "Ink", "decoy": "Squid"},
        {"word": "Jellyfish", "hint": "Sting", "decoy": "Octopus"},
        {"word": "Starfish", "hint": "Tide Pool", "decoy": "Sand Dollar"},
        {"word": "Seahorse", "hint": "Tiny", "decoy": "Eel"},
        {"word": "Crab", "hint": "Claws", "decoy": "Lobster"},
        {"word": "Lobster", "hint": "Red", "decoy": "Crab"},
        {"word": "Sea Turtle", "hint": "Shell", "decoy": "Tortoise"},
        {"word": "Seal", "hint": "Flippers", "decoy": "Walrus"},
        {"word": "Walrus", "hint": "Tusks", "decoy": "Sea Lion"},
        {"word": "Narwhal", "hint": "Horn", "decoy": "Swordfish"},
        {"word": "Stingray", "hint": "Flat", "decoy": "Manta Ray"},
        {"word": "Clownfish", "hint": "Orange", "decoy": "Goldfish"},
        {"word": "Pufferfish", "hint": "Spiky", "decoy": "Porcupine"},
        {"word": "Eel", "hint": "Slippery", "decoy": "Snake"},
        {"word": "Orca", "hint": "Black and White", "decoy": "Dolphin"},
        {"word": "Shrimp", "hint": "Pink", "decoy": "Lobster"},
        {"word": "Oyster", "hint": "Pearl", "decoy": "Clam"},
        {"word": "Coral Reef", "hint": "Colorful", "decoy": "Kelp Forest"},
        {"word": "Seaweed", "hint": "Slimy", "decoy": "Lily Pad"},
        {"word": "Waves", "hint": "Crash", "decoy": "Ripples"},
        {"word": "Beach", "hint": "Sand", "decoy": "Sandbox"},
        {"word": "Sandcastle", "hint": "Bucket", "decoy": "Snowman"},
        {"word": "Seashell", "hint": "Collect", "decoy": "Sea Glass"},
        {"word": "Lighthouse", "hint": "Warning", "decoy": "Traffic Light"},
        {"word": "Anchor", "hint": "Heavy", "decoy": "Weights"},
        {"word": "Treasure Chest", "hint": "Buried", "decoy": "Time Capsule"},
        {"word": "Shipwreck", "hint": "Sunken", "decoy": "Haunted House"},
        {"word": "Scuba Diver", "hint": "Mask", "decoy": "Astronaut"},
        {"word": "Island", "hint": "Stranded", "decoy": "Oasis"},
        {"word": "Iceberg", "hint": "Floating", "decoy": "Glacier"},
        {"word": "Whirlpool", "hint": "Spin", "decoy": "Tornado"},
        {"word": "Message in a Bottle", "hint": "Note", "decoy": "Paper Airplane"},
        {"word": "Mermaid", "hint": "Tail", "decoy": "Fairy"},
        {"word": "Pelican", "hint": "Beak", "decoy": "Seagull"},
        {"word": "Seagull", "hint": "Screech", "decoy": "Pigeon"},
        {"word": "Manatee", "hint": "Gentle", "decoy": "Hippo"},
        {"word": "Hermit Crab", "hint": "Pet", "decoy": "Snail"},
        {"word": "Anglerfish", "hint": "Glowing", "decoy": "Firefly"},
        {"word": "Fishing Net", "hint": "Catch", "decoy": "Spider Web"},
        {"word": "Sea Otter", "hint": "Cute", "decoy": "Beaver"},
        {"word": "Swordfish", "hint": "Pointy", "decoy": "Narwhal"},
        {"word": "Squid", "hint": "Tentacles", "decoy": "Octopus"},
        {"word": "Sea Lion", "hint": "Barking", "decoy": "Seal"},
        {"word": "Sand Dollar", "hint": "Round", "decoy": "Coin"},
        {"word": "Sea Urchin", "hint": "Prickly", "decoy": "Pufferfish"},
        {"word": "Clam", "hint": "Shut", "decoy": "Oyster"},
        {"word": "Deep Sea", "hint": "Dark", "decoy": "Outer Space"}
      ]
    },
    {
      "id": "space", "name": "Space", "icon": "🚀",
      "words": [
        {"word": "Sun", "hint": "Hot", "decoy": "Moon"},
        {"word": "Moon", "hint": "Night", "decoy": "Sun"},
        {"word": "Earth", "hint": "Home", "decoy": "Mars"},
        {"word": "Mars", "hint": "Red", "decoy": "Venus"},
        {"word": "Jupiter", "hint": "Biggest", "decoy": "Saturn"},
        {"word": "Saturn", "hint": "Rings", "decoy": "Neptune"},
        {"word": "Venus", "hint": "Brightest", "decoy": "Mercury"},
        {"word": "Mercury", "hint": "Closest", "decoy": "Moon"},
        {"word": "Neptune", "hint": "Blue", "decoy": "Earth"},
        {"word": "Pluto", "hint": "Cold", "decoy": "Asteroid"},
        {"word": "Star", "hint": "Twinkle", "decoy": "Planet"},
        {"word": "Comet", "hint": "Tail", "decoy": "Meteor"},
        {"word": "Meteor", "hint": "Falling", "decoy": "Comet"},
        {"word": "Asteroid", "hint": "Rocky", "decoy": "Meteor"},
        {"word": "Black Hole", "hint": "Pull", "decoy": "Whirlpool"},
        {"word": "Galaxy", "hint": "Billions", "decoy": "Solar System"},
        {"word": "Milky Way", "hint": "Spiral", "decoy": "Galaxy"},
        {"word": "Solar System", "hint": "Neighbors", "decoy": "Galaxy"},
        {"word": "Astronaut", "hint": "Helmet", "decoy": "Scuba Diver"},
        {"word": "Rocket", "hint": "Launch", "decoy": "Firework"},
        {"word": "Space Shuttle", "hint": "Wings", "decoy": "Airplane"},
        {"word": "Space Station", "hint": "Floating", "decoy": "Submarine"},
        {"word": "Satellite", "hint": "Signal", "decoy": "Cell Tower"},
        {"word": "Telescope", "hint": "Lens", "decoy": "Binoculars"},
        {"word": "Alien", "hint": "Green", "decoy": "Robot"},
        {"word": "UFO", "hint": "Saucer", "decoy": "Frisbee"},
        {"word": "Constellation", "hint": "Pattern", "decoy": "Connect-the-Dots"},
        {"word": "Big Dipper", "hint": "Scoop", "decoy": "Orion's Belt"},
        {"word": "Shooting Star", "hint": "Wish", "decoy": "Birthday Candles"},
        {"word": "Eclipse", "hint": "Shadow", "decoy": "Sunset"},
        {"word": "Crater", "hint": "Hole", "decoy": "Pothole"},
        {"word": "Moon Landing", "hint": "Footprints", "decoy": "First Airplane Flight"},
        {"word": "Space Suit", "hint": "Puffy", "decoy": "Snowsuit"},
        {"word": "Gravity", "hint": "Down", "decoy": "Magnet"},
        {"word": "Orbit", "hint": "Circle", "decoy": "Merry-Go-Round"},
        {"word": "Mars Rover", "hint": "Wheels", "decoy": "Remote Control Car"},
        {"word": "Planet", "hint": "Round", "decoy": "Star"},
        {"word": "Launch Pad", "hint": "Smoke", "decoy": "Diving Board"},
        {"word": "Mission Control", "hint": "Screens", "decoy": "Air Traffic Control"},
        {"word": "Zero Gravity", "hint": "Weightless", "decoy": "Trampoline"},
        {"word": "Space Food", "hint": "Pouch", "decoy": "Camping Food"},
        {"word": "Moon Rock", "hint": "Souvenir", "decoy": "Fossil"},
        {"word": "Stargazing", "hint": "Blanket", "decoy": "Cloud Watching"},
        {"word": "Planetarium", "hint": "Dome", "decoy": "Movie Theater"},
        {"word": "Jetpack", "hint": "Fly", "decoy": "Hoverboard"},
        {"word": "Meteor Shower", "hint": "Show", "decoy": "Fireworks"},
        {"word": "North Star", "hint": "Guide", "decoy": "Compass"},
        {"word": "Space Camp", "hint": "Training", "decoy": "Summer Camp"},
        {"word": "Countdown", "hint": "Numbers", "decoy": "Timer"},
        {"word": "Supernova", "hint": "Explosion", "decoy": "Volcano"}
      ]
    },
    {
      "id": "clothing", "name": "Clothing", "icon": "👕",
      "words": [
        {"word": "T-Shirt", "hint": "Cotton", "decoy": "Tank Top"},
        {"word": "Jeans", "hint": "Pockets", "decoy": "Overalls"},
        {"word": "Shorts", "hint": "Summer", "decoy": "Swim Trunks"},
        {"word": "Dress", "hint": "Twirl", "decoy": "Skirt"},
        {"word": "Skirt", "hint": "Waist", "decoy": "Kilt"},
        {"word": "Sweater", "hint": "Knitted", "decoy": "Hoodie"},
        {"word": "Hoodie", "hint": "Comfy", "decoy": "Sweater"},
        {"word": "Jacket", "hint": "Zipper", "decoy": "Vest"},
        {"word": "Raincoat", "hint": "Puddles", "decoy": "Umbrella"},
        {"word": "Winter Coat", "hint": "Warm", "decoy": "Snowsuit"},
        {"word": "Pajamas", "hint": "Bedtime", "decoy": "Sweatpants"},
        {"word": "Socks", "hint": "Pairs", "decoy": "Slippers"},
        {"word": "Sneakers", "hint": "Laces", "decoy": "Cleats"},
        {"word": "Boots", "hint": "Stomp", "decoy": "Sneakers"},
        {"word": "Sandals", "hint": "Toes", "decoy": "Flip-Flops"},
        {"word": "Flip-Flops", "hint": "Beach", "decoy": "Water Shoes"},
        {"word": "Slippers", "hint": "Fuzzy", "decoy": "Socks"},
        {"word": "Baseball Cap", "hint": "Brim", "decoy": "Visor"},
        {"word": "Beanie", "hint": "Head", "decoy": "Earmuffs"},
        {"word": "Top Hat", "hint": "Magician", "decoy": "Cowboy Hat"},
        {"word": "Scarf", "hint": "Neck", "decoy": "Bandana"},
        {"word": "Mittens", "hint": "Thumbs", "decoy": "Gloves"},
        {"word": "Gloves", "hint": "Fingers", "decoy": "Mittens"},
        {"word": "Tie", "hint": "Knot", "decoy": "Scarf"},
        {"word": "Bow Tie", "hint": "Formal", "decoy": "Suspenders"},
        {"word": "Suit", "hint": "Office", "decoy": "Tuxedo"},
        {"word": "Swimsuit", "hint": "Pool", "decoy": "Wetsuit"},
        {"word": "Overalls", "hint": "Farmer", "decoy": "Jumpsuit"},
        {"word": "Uniform", "hint": "Matching", "decoy": "Costume"},
        {"word": "Apron", "hint": "Messy", "decoy": "Bib"},
        {"word": "Backpack", "hint": "School", "decoy": "Suitcase"},
        {"word": "Purse", "hint": "Strap", "decoy": "Wallet"},
        {"word": "Wallet", "hint": "Money", "decoy": "Purse"},
        {"word": "Sunglasses", "hint": "Sunny", "decoy": "Goggles"},
        {"word": "Glasses", "hint": "Blurry", "decoy": "Magnifying Glass"},
        {"word": "Watch", "hint": "Wrist", "decoy": "Bracelet"},
        {"word": "Bracelet", "hint": "Charms", "decoy": "Hair Tie"},
        {"word": "Necklace", "hint": "Chain", "decoy": "Lanyard"},
        {"word": "Ring", "hint": "Sparkle", "decoy": "Bracelet"},
        {"word": "Earrings", "hint": "Dangly", "decoy": "Hair Clip"},
        {"word": "Crown", "hint": "King", "decoy": "Tiara"},
        {"word": "Tutu", "hint": "Ballet", "decoy": "Skirt"},
        {"word": "Headband", "hint": "Hair", "decoy": "Sweatband"},
        {"word": "Belt", "hint": "Buckle", "decoy": "Fanny Pack"},
        {"word": "Onesie", "hint": "Baby", "decoy": "Footie Pajamas"},
        {"word": "Life Jacket", "hint": "Safety", "decoy": "Floaties"},
        {"word": "Graduation Cap", "hint": "Throw", "decoy": "Party Hat"},
        {"word": "Leggings", "hint": "Stretchy", "decoy": "Tights"},
        {"word": "Cape", "hint": "Flowing", "decoy": "Blanket"},
        {"word": "Crocs", "hint": "Holes", "decoy": "Clogs"}
      ]
    },
    {
      "id": "candy-snacks", "name": "Candy & Snacks", "icon": "🍭",
      "words": [
        {"word": "Chocolate Bar", "hint": "Wrapper", "decoy": "Granola Bar"},
        {"word": "Gummy Bears", "hint": "Chewy", "decoy": "Fruit Snacks"},
        {"word": "Lollipop", "hint": "Stick", "decoy": "Popsicle"},
        {"word": "Cotton Candy", "hint": "Fluffy", "decoy": "Marshmallows"},
        {"word": "Marshmallows", "hint": "Campfire", "decoy": "Cotton Candy"},
        {"word": "S'mores", "hint": "Sticky", "decoy": "Hot Chocolate"},
        {"word": "Popcorn", "hint": "Movies", "decoy": "Cheese Puffs"},
        {"word": "Chips", "hint": "Crunchy", "decoy": "Pretzels"},
        {"word": "Pretzels", "hint": "Twisted", "decoy": "Crackers"},
        {"word": "Crackers", "hint": "Cheese", "decoy": "Cookies"},
        {"word": "Cookies", "hint": "Milk", "decoy": "Brownies"},
        {"word": "Brownies", "hint": "Pan", "decoy": "Fudge"},
        {"word": "Cupcakes", "hint": "Frosting", "decoy": "Muffins"},
        {"word": "Donuts", "hint": "Hole", "decoy": "Bagel"},
        {"word": "Ice Cream", "hint": "Scoop", "decoy": "Frozen Yogurt"},
        {"word": "Popsicle", "hint": "Frozen", "decoy": "Snow Cone"},
        {"word": "Milkshake", "hint": "Straw", "decoy": "Smoothie"},
        {"word": "Soda", "hint": "Fizzy", "decoy": "Sparkling Water"},
        {"word": "Root Beer Float", "hint": "Foamy", "decoy": "Milkshake"},
        {"word": "Candy Corn", "hint": "Halloween", "decoy": "Jelly Beans"},
        {"word": "Jelly Beans", "hint": "Easter", "decoy": "Skittles"},
        {"word": "Skittles", "hint": "Rainbow", "decoy": "M&M's"},
        {"word": "M&M's", "hint": "Melts", "decoy": "Skittles"},
        {"word": "Oreos", "hint": "Dunk", "decoy": "Ice Cream Sandwich"},
        {"word": "Goldfish Crackers", "hint": "Orange", "decoy": "Cheez-Its"},
        {"word": "Doritos", "hint": "Triangle", "decoy": "Tortilla Chips"},
        {"word": "Cheetos", "hint": "Dust", "decoy": "Doritos"},
        {"word": "Pop-Tarts", "hint": "Toaster", "decoy": "Waffles"},
        {"word": "Granola Bar", "hint": "Lunchbox", "decoy": "Trail Mix"},
        {"word": "Trail Mix", "hint": "Hiking", "decoy": "Granola Bar"},
        {"word": "Fruit Snacks", "hint": "Pouch", "decoy": "Gummy Bears"},
        {"word": "Bubble Gum", "hint": "Chew", "decoy": "Taffy"},
        {"word": "Caramel", "hint": "Gooey", "decoy": "Fudge"},
        {"word": "Licorice", "hint": "Rope", "decoy": "Shoelaces"},
        {"word": "Sour Patch Kids", "hint": "Sour", "decoy": "Gummy Bears"},
        {"word": "Candy Apple", "hint": "Fair", "decoy": "Corn Dog"},
        {"word": "Funnel Cake", "hint": "Powdered Sugar", "decoy": "Churros"},
        {"word": "Churros", "hint": "Cinnamon", "decoy": "Pretzel Sticks"},
        {"word": "Cinnamon Roll", "hint": "Swirl", "decoy": "Honey Buns"},
        {"word": "Jell-O", "hint": "Jiggly", "decoy": "Pudding"},
        {"word": "Ice Cream Sandwich", "hint": "Layers", "decoy": "Oreos"},
        {"word": "Pringles", "hint": "Can", "decoy": "Chips"},
        {"word": "Nerds", "hint": "Tiny", "decoy": "Pop Rocks"},
        {"word": "Pop Rocks", "hint": "Crackle", "decoy": "Nerds"},
        {"word": "Kit Kat", "hint": "Break", "decoy": "Twix"},
        {"word": "Reese's", "hint": "Peanut Butter", "decoy": "Snickers"},
        {"word": "Gumballs", "hint": "Machine", "decoy": "Jawbreakers"},
        {"word": "Beef Jerky", "hint": "Road Trip", "decoy": "Bacon"},
        {"word": "Peanuts", "hint": "Ballpark", "decoy": "Sunflower Seeds"},
        {"word": "Slushie", "hint": "Brain Freeze", "decoy": "Snow Cone"}
      ]
    },
    {
      "id": "music", "name": "Music", "icon": "🎵",
      "words": [
        {"word": "Guitar", "hint": "Strings", "decoy": "Ukulele"},
        {"word": "Piano", "hint": "Keys", "decoy": "Organ"},
        {"word": "Drums", "hint": "Loud", "decoy": "Bongos"},
        {"word": "Violin", "hint": "Bow", "decoy": "Cello"},
        {"word": "Cello", "hint": "Sit", "decoy": "Violin"},
        {"word": "Trumpet", "hint": "Brass", "decoy": "Trombone"},
        {"word": "Trombone", "hint": "Slide", "decoy": "Tuba"},
        {"word": "Tuba", "hint": "Heavy", "decoy": "Trombone"},
        {"word": "Flute", "hint": "Holes", "decoy": "Recorder"},
        {"word": "Recorder", "hint": "School", "decoy": "Kazoo"},
        {"word": "Saxophone", "hint": "Jazz", "decoy": "Clarinet"},
        {"word": "Clarinet", "hint": "Black", "decoy": "Saxophone"},
        {"word": "Harmonica", "hint": "Pockets", "decoy": "Kazoo"},
        {"word": "Kazoo", "hint": "Buzz", "decoy": "Whistle"},
        {"word": "Ukulele", "hint": "Hawaii", "decoy": "Banjo"},
        {"word": "Banjo", "hint": "Twangy", "decoy": "Guitar"},
        {"word": "Harp", "hint": "Pluck", "decoy": "Guitar"},
        {"word": "Xylophone", "hint": "Mallets", "decoy": "Wind Chimes"},
        {"word": "Tambourine", "hint": "Shake", "decoy": "Maracas"},
        {"word": "Maracas", "hint": "Rattle", "decoy": "Egg Shaker"},
        {"word": "Triangle", "hint": "Ding", "decoy": "Cowbell"},
        {"word": "Cymbals", "hint": "Crash", "decoy": "Gong"},
        {"word": "Bagpipes", "hint": "Scotland", "decoy": "Accordion"},
        {"word": "Accordion", "hint": "Squeeze", "decoy": "Harmonica"},
        {"word": "Organ", "hint": "Pipes", "decoy": "Piano"},
        {"word": "Microphone", "hint": "Stage", "decoy": "Megaphone"},
        {"word": "Karaoke", "hint": "Singing", "decoy": "Talent Show"},
        {"word": "Choir", "hint": "Robes", "decoy": "Band"},
        {"word": "Orchestra", "hint": "Conductor", "decoy": "Marching Band"},
        {"word": "Marching Band", "hint": "Parade", "decoy": "Orchestra"},
        {"word": "Concert", "hint": "Tickets", "decoy": "Recital"},
        {"word": "Rock Star", "hint": "Famous", "decoy": "DJ"},
        {"word": "Lullaby", "hint": "Bedtime", "decoy": "Nursery Rhyme"},
        {"word": "Sheet Music", "hint": "Paper", "decoy": "Recipe"},
        {"word": "Record Player", "hint": "Spin", "decoy": "Jukebox"},
        {"word": "Jukebox", "hint": "Diner", "decoy": "Record Player"},
        {"word": "Radio", "hint": "Station", "decoy": "Walkie-Talkie"},
        {"word": "Music Box", "hint": "Wind Up", "decoy": "Jack-in-the-Box"},
        {"word": "Opera", "hint": "High Notes", "decoy": "Musical"},
        {"word": "Dance Party", "hint": "Moves", "decoy": "Sleepover"},
        {"word": "Drumsticks", "hint": "Chicken", "decoy": "Chopsticks"},
        {"word": "Whistle", "hint": "Blow", "decoy": "Kazoo"},
        {"word": "Clapping", "hint": "Hands", "decoy": "Snapping"},
        {"word": "Humming", "hint": "Tune", "decoy": "Whistling"},
        {"word": "National Anthem", "hint": "Ballpark", "decoy": "Pledge of Allegiance"},
        {"word": "Hymn", "hint": "Sunday", "decoy": "Christmas Carol"},
        {"word": "Band", "hint": "Garage", "decoy": "Choir"},
        {"word": "Country Music", "hint": "Cowboy", "decoy": "Rock and Roll"},
        {"word": "Rock and Roll", "hint": "Electric", "decoy": "Country Music"},
        {"word": "Beatbox", "hint": "Mouth", "decoy": "Rapping"}
      ]
    },
    {
      "id": "toys", "name": "Toys", "icon": "🧸",
      "words": [
        {"word": "Teddy Bear", "hint": "Cuddly", "decoy": "Stuffed Bunny"},
        {"word": "Doll", "hint": "Dress Up", "decoy": "Action Figure"},
        {"word": "Action Figure", "hint": "Plastic", "decoy": "Army Men"},
        {"word": "LEGO", "hint": "Bricks", "decoy": "Building Blocks"},
        {"word": "Building Blocks", "hint": "Stack", "decoy": "Jenga"},
        {"word": "Jenga", "hint": "Tower", "decoy": "Dominoes"},
        {"word": "Dominoes", "hint": "Dots", "decoy": "Dice"},
        {"word": "Yo-Yo", "hint": "String", "decoy": "Fidget Spinner"},
        {"word": "Kite", "hint": "Windy", "decoy": "Paper Airplane"},
        {"word": "Hula Hoop", "hint": "Hips", "decoy": "Jump Rope"},
        {"word": "Rubik's Cube", "hint": "Twist", "decoy": "Puzzle"},
        {"word": "Puzzle", "hint": "Pieces", "decoy": "Rubik's Cube"},
        {"word": "Play-Doh", "hint": "Squish", "decoy": "Slime"},
        {"word": "Slime", "hint": "Gooey", "decoy": "Silly Putty"},
        {"word": "Water Gun", "hint": "Squirt", "decoy": "Water Balloon"},
        {"word": "Nerf Gun", "hint": "Foam", "decoy": "Water Gun"},
        {"word": "Hot Wheels", "hint": "Track", "decoy": "Remote Control Car"},
        {"word": "Train Set", "hint": "Loop", "decoy": "Race Track"},
        {"word": "Barbie", "hint": "Pink", "decoy": "Ken"},
        {"word": "Rocking Horse", "hint": "Rock", "decoy": "Rocking Chair"},
        {"word": "Jack-in-the-Box", "hint": "Pop", "decoy": "Music Box"},
        {"word": "Spinning Top", "hint": "Wobble", "decoy": "Dreidel"},
        {"word": "Marbles", "hint": "Glass", "decoy": "Bouncy Ball"},
        {"word": "Bouncy Ball", "hint": "Bounce", "decoy": "Ping Pong Ball"},
        {"word": "Beach Ball", "hint": "Inflate", "decoy": "Balloon"},
        {"word": "Etch A Sketch", "hint": "Knobs", "decoy": "Whiteboard"},
        {"word": "Magic 8 Ball", "hint": "Answers", "decoy": "Fortune Cookie"},
        {"word": "Fidget Spinner", "hint": "Twirl", "decoy": "Pop It"},
        {"word": "Pop It", "hint": "Poke", "decoy": "Bubble Wrap"},
        {"word": "Crayons", "hint": "Wax", "decoy": "Colored Pencils"},
        {"word": "Coloring Book", "hint": "Lines", "decoy": "Sticker Book"},
        {"word": "Stickers", "hint": "Peel", "decoy": "Temporary Tattoos"},
        {"word": "Tea Set", "hint": "Pretend", "decoy": "Toy Kitchen"},
        {"word": "Puppet", "hint": "Hand", "decoy": "Stuffed Animal"},
        {"word": "Pinwheel", "hint": "Blow", "decoy": "Windmill"},
        {"word": "Kaleidoscope", "hint": "Patterns", "decoy": "Telescope"},
        {"word": "Tricycle", "hint": "Three", "decoy": "Bicycle"},
        {"word": "Monopoly", "hint": "Money", "decoy": "The Game of Life"},
        {"word": "Candy Land", "hint": "Colors", "decoy": "Chutes and Ladders"},
        {"word": "Chess", "hint": "Knight", "decoy": "Checkers"},
        {"word": "Checkers", "hint": "Jump", "decoy": "Chess"},
        {"word": "Uno", "hint": "Shout", "decoy": "Go Fish"},
        {"word": "Twister", "hint": "Tangled", "decoy": "Limbo"},
        {"word": "Connect Four", "hint": "Drop", "decoy": "Tic-Tac-Toe"},
        {"word": "Battleship", "hint": "Guess", "decoy": "Guess Who"},
        {"word": "Operation", "hint": "Tweezers", "decoy": "Doctor Kit"},
        {"word": "Scrabble", "hint": "Spelling", "decoy": "Crossword"},
        {"word": "Playing Cards", "hint": "Deck", "decoy": "Trading Cards"},
        {"word": "Dice", "hint": "Roll", "decoy": "Sugar Cubes"},
        {"word": "Walkie-Talkie", "hint": "Antenna", "decoy": "Tin Can Phone"}
      ]
    },
    {
      "id": "video-games", "name": "Video Games", "icon": "🎮",
      "words": [
        {"word": "Minecraft", "hint": "Blocks", "decoy": "Roblox"},
        {"word": "Roblox", "hint": "Online", "decoy": "Minecraft"},
        {"word": "Mario Kart", "hint": "Racing", "decoy": "Rocket League"},
        {"word": "Super Mario Bros.", "hint": "Jump", "decoy": "Sonic the Hedgehog"},
        {"word": "Sonic the Hedgehog", "hint": "Fast", "decoy": "Super Mario Bros."},
        {"word": "Pokémon", "hint": "Collect", "decoy": "Trading Cards"},
        {"word": "Tetris", "hint": "Falling", "decoy": "Candy Crush"},
        {"word": "Pac-Man", "hint": "Ghosts", "decoy": "Space Invaders"},
        {"word": "Zelda", "hint": "Sword", "decoy": "Super Mario Bros."},
        {"word": "Kirby", "hint": "Pink", "decoy": "Jigglypuff"},
        {"word": "Yoshi", "hint": "Dinosaur", "decoy": "Kirby"},
        {"word": "Donkey Kong", "hint": "Barrels", "decoy": "King Kong"},
        {"word": "Luigi", "hint": "Brother", "decoy": "Mario"},
        {"word": "Animal Crossing", "hint": "Island", "decoy": "Stardew Valley"},
        {"word": "Splatoon", "hint": "Ink", "decoy": "Paintball"},
        {"word": "Just Dance", "hint": "Moves", "decoy": "Dance Dance Revolution"},
        {"word": "Wii Sports", "hint": "Bowling", "decoy": "Mario Party"},
        {"word": "Mario Party", "hint": "Dice", "decoy": "Wii Sports"},
        {"word": "Among Us", "hint": "Spaceship", "decoy": "Clue"},
        {"word": "Angry Birds", "hint": "Slingshot", "decoy": "Fruit Ninja"},
        {"word": "Fruit Ninja", "hint": "Swipe", "decoy": "Candy Crush"},
        {"word": "Candy Crush", "hint": "Match", "decoy": "Tetris"},
        {"word": "Subway Surfers", "hint": "Running", "decoy": "Temple Run"},
        {"word": "Crossy Road", "hint": "Chicken", "decoy": "Frogger"},
        {"word": "Pong", "hint": "Paddles", "decoy": "Air Hockey"},
        {"word": "Plants vs. Zombies", "hint": "Garden", "decoy": "Angry Birds"},
        {"word": "Geometry Dash", "hint": "Shapes", "decoy": "Flappy Bird"},
        {"word": "Rocket League", "hint": "Soccer", "decoy": "Mario Kart"},
        {"word": "Super Smash Bros.", "hint": "Knockout", "decoy": "Mario Party"},
        {"word": "Game Controller", "hint": "Buttons", "decoy": "Joystick"},
        {"word": "Nintendo Switch", "hint": "Portable", "decoy": "Game Boy"},
        {"word": "Xbox", "hint": "Green", "decoy": "PlayStation"},
        {"word": "PlayStation", "hint": "Console", "decoy": "Xbox"},
        {"word": "High Score", "hint": "Record", "decoy": "Trophy"},
        {"word": "Level Up", "hint": "Stronger", "decoy": "Growth Spurt"},
        {"word": "Power-Up", "hint": "Glowing", "decoy": "Vitamins"},
        {"word": "Game Over", "hint": "Ending", "decoy": "The End"},
        {"word": "Boss Battle", "hint": "Final", "decoy": "Championship Game"},
        {"word": "Extra Life", "hint": "Heart", "decoy": "Do-Over"},
        {"word": "Checkpoint", "hint": "Save", "decoy": "Bookmark"},
        {"word": "Cheat Code", "hint": "Secret", "decoy": "Password"},
        {"word": "Glitch", "hint": "Broken", "decoy": "Typo"},
        {"word": "Pixel", "hint": "Square", "decoy": "Mosaic Tile"},
        {"word": "Respawn", "hint": "Again", "decoy": "Extra Life"},
        {"word": "Loading Screen", "hint": "Waiting", "decoy": "Waiting Room"},
        {"word": "Multiplayer", "hint": "Friends", "decoy": "Split Screen"},
        {"word": "Achievement", "hint": "Unlock", "decoy": "Gold Star"},
        {"word": "Tutorial", "hint": "Learn", "decoy": "Instructions"},
        {"word": "Avatar", "hint": "Character", "decoy": "Profile Picture"},
        {"word": "Pause Button", "hint": "Freeze", "decoy": "Freeze Tag"}
      ]
    },
    {
      "id": "superheroes", "name": "Superheroes", "icon": "🦸",
      "words": [
        {"word": "Superman", "hint": "Cape", "decoy": "Captain Marvel"},
        {"word": "Batman", "hint": "Night", "decoy": "Iron Man"},
        {"word": "Spider-Man", "hint": "Climbing", "decoy": "Ant-Man"},
        {"word": "Wonder Woman", "hint": "Lasso", "decoy": "Supergirl"},
        {"word": "Iron Man", "hint": "Armor", "decoy": "Batman"},
        {"word": "Captain America", "hint": "Shield", "decoy": "Wonder Woman"},
        {"word": "Hulk", "hint": "Angry", "decoy": "The Thing"},
        {"word": "Thor", "hint": "Hammer", "decoy": "Aquaman"},
        {"word": "Black Panther", "hint": "King", "decoy": "Catwoman"},
        {"word": "The Flash", "hint": "Fast", "decoy": "Dash"},
        {"word": "Aquaman", "hint": "Ocean", "decoy": "Mermaid"},
        {"word": "Green Lantern", "hint": "Ring", "decoy": "Doctor Strange"},
        {"word": "Wolverine", "hint": "Claws", "decoy": "Black Panther"},
        {"word": "Captain Marvel", "hint": "Glowing", "decoy": "Superman"},
        {"word": "Ant-Man", "hint": "Shrinking", "decoy": "The Wasp"},
        {"word": "Black Widow", "hint": "Spy", "decoy": "Hawkeye"},
        {"word": "Hawkeye", "hint": "Arrows", "decoy": "Robin Hood"},
        {"word": "Doctor Strange", "hint": "Magic", "decoy": "Wizard"},
        {"word": "Groot", "hint": "Tree", "decoy": "Hulk"},
        {"word": "Rocket Raccoon", "hint": "Furry", "decoy": "Groot"},
        {"word": "Robin", "hint": "Young", "decoy": "Batgirl"},
        {"word": "Cyborg", "hint": "Robot", "decoy": "Iron Man"},
        {"word": "Storm", "hint": "Weather", "decoy": "Thor"},
        {"word": "Mr. Incredible", "hint": "Dad", "decoy": "Superman"},
        {"word": "Elastigirl", "hint": "Stretchy", "decoy": "Mr. Fantastic"},
        {"word": "Frozone", "hint": "Ice", "decoy": "Elsa"},
        {"word": "Dash", "hint": "Running", "decoy": "The Flash"},
        {"word": "Violet", "hint": "Invisible", "decoy": "Invisible Woman"},
        {"word": "Power Rangers", "hint": "Team", "decoy": "Teen Titans"},
        {"word": "Avengers", "hint": "Tower", "decoy": "Justice League"},
        {"word": "Justice League", "hint": "Headquarters", "decoy": "Avengers"},
        {"word": "Joker", "hint": "Laugh", "decoy": "Clown"},
        {"word": "Thanos", "hint": "Purple", "decoy": "Loki"},
        {"word": "Loki", "hint": "Tricky", "decoy": "Joker"},
        {"word": "Green Goblin", "hint": "Glider", "decoy": "Doctor Octopus"},
        {"word": "Batmobile", "hint": "Car", "decoy": "Race Car"},
        {"word": "Batcave", "hint": "Hideout", "decoy": "Treehouse"},
        {"word": "Utility Belt", "hint": "Gadgets", "decoy": "Tool Belt"},
        {"word": "Bat-Signal", "hint": "Sky", "decoy": "Spotlight"},
        {"word": "Kryptonite", "hint": "Weakness", "decoy": "Garlic"},
        {"word": "Secret Identity", "hint": "Disguise", "decoy": "Undercover Agent"},
        {"word": "Sidekick", "hint": "Helper", "decoy": "Best Friend"},
        {"word": "Superpower", "hint": "Ability", "decoy": "Talent"},
        {"word": "Super Strength", "hint": "Lifting", "decoy": "Bodybuilder"},
        {"word": "X-Ray Vision", "hint": "See-Through", "decoy": "Night Vision Goggles"},
        {"word": "Invisibility", "hint": "Disappear", "decoy": "Camouflage"},
        {"word": "Captain Underpants", "hint": "Silly", "decoy": "Dog Man"},
        {"word": "Supergirl", "hint": "Flying", "decoy": "Wonder Woman"},
        {"word": "Human Torch", "hint": "Fire", "decoy": "Dragon"},
        {"word": "Doctor Octopus", "hint": "Tentacles", "decoy": "Green Goblin"}
      ]
    },
    {
      "id": "movies", "name": "Movies", "icon": "🎬",
      "words": [
        {"word": "Frozen", "hint": "Sisters", "decoy": "Encanto"},
        {"word": "Encanto", "hint": "Family", "decoy": "Frozen"},
        {"word": "Toy Story", "hint": "Cowboy", "decoy": "The Lego Movie"},
        {"word": "Finding Nemo", "hint": "Ocean", "decoy": "The Little Mermaid"},
        {"word": "The Lion King", "hint": "Africa", "decoy": "The Jungle Book"},
        {"word": "Moana", "hint": "Boat", "decoy": "Lilo & Stitch"},
        {"word": "Cars", "hint": "Highway", "decoy": "Planes"},
        {"word": "Shrek", "hint": "Swamp", "decoy": "The Grinch"},
        {"word": "Up", "hint": "Balloons", "decoy": "The Wizard of Oz"},
        {"word": "Inside Out", "hint": "Feelings", "decoy": "Trolls"},
        {"word": "Zootopia", "hint": "City", "decoy": "Sing"},
        {"word": "Monsters, Inc.", "hint": "Closet", "decoy": "Despicable Me"},
        {"word": "The Incredibles", "hint": "Suits", "decoy": "Big Hero 6"},
        {"word": "Ratatouille", "hint": "Cooking", "decoy": "Cloudy with a Chance of Meatballs"},
        {"word": "WALL-E", "hint": "Robot", "decoy": "The Wild Robot"},
        {"word": "Despicable Me", "hint": "Villain", "decoy": "Megamind"},
        {"word": "Minions", "hint": "Yellow", "decoy": "Smurfs"},
        {"word": "Kung Fu Panda", "hint": "Noodles", "decoy": "Karate Kid"},
        {"word": "How to Train Your Dragon", "hint": "Vikings", "decoy": "Brave"},
        {"word": "Brave", "hint": "Bear", "decoy": "Brother Bear"},
        {"word": "The Little Mermaid", "hint": "Voice", "decoy": "Finding Nemo"},
        {"word": "Beauty and the Beast", "hint": "Castle", "decoy": "Shrek"},
        {"word": "Aladdin", "hint": "Carpet", "decoy": "The Prince of Egypt"},
        {"word": "Cinderella", "hint": "Midnight", "decoy": "Snow White"},
        {"word": "Snow White", "hint": "Apple", "decoy": "Sleeping Beauty"},
        {"word": "Tangled", "hint": "Hair", "decoy": "Frozen"},
        {"word": "Mulan", "hint": "Soldier", "decoy": "Brave"},
        {"word": "The Jungle Book", "hint": "Jungle", "decoy": "Tarzan"},
        {"word": "Peter Pan", "hint": "Pirates", "decoy": "Pinocchio"},
        {"word": "Pinocchio", "hint": "Wooden", "decoy": "Nutcracker"},
        {"word": "101 Dalmatians", "hint": "Spots", "decoy": "Lady and the Tramp"},
        {"word": "Lilo & Stitch", "hint": "Hawaii", "decoy": "E.T."},
        {"word": "E.T.", "hint": "Bicycle", "decoy": "Lilo & Stitch"},
        {"word": "Star Wars", "hint": "Galaxy", "decoy": "Star Trek"},
        {"word": "The Wizard of Oz", "hint": "Tornado", "decoy": "Up"},
        {"word": "Mary Poppins", "hint": "Umbrella", "decoy": "The Sound of Music"},
        {"word": "The Sound of Music", "hint": "Mountains", "decoy": "Mary Poppins"},
        {"word": "Home Alone", "hint": "Traps", "decoy": "The Polar Express"},
        {"word": "The Polar Express", "hint": "Train", "decoy": "Home Alone"},
        {"word": "Ice Age", "hint": "Mammoth", "decoy": "The Land Before Time"},
        {"word": "Paddington", "hint": "Marmalade", "decoy": "Winnie the Pooh"},
        {"word": "Winnie the Pooh", "hint": "Friends", "decoy": "Paddington"},
        {"word": "Trolls", "hint": "Glitter", "decoy": "Smurfs"},
        {"word": "Night at the Museum", "hint": "Statues", "decoy": "Toy Story"},
        {"word": "Charlotte's Web", "hint": "Spider", "decoy": "Babe"},
        {"word": "The Prince of Egypt", "hint": "Egypt", "decoy": "Aladdin"},
        {"word": "Big Hero 6", "hint": "Squishy", "decoy": "The Incredibles"},
        {"word": "Luca", "hint": "Italy", "decoy": "The Little Mermaid"},
        {"word": "Bambi", "hint": "Deer", "decoy": "The Lion King"},
        {"word": "Dumbo", "hint": "Ears", "decoy": "Horton Hears a Who"}
      ]
    },
    {
      "id": "technology", "name": "Technology", "icon": "💻",
      "words": [
        {"word": "Cell Phone", "hint": "Pocket", "decoy": "Tablet"},
        {"word": "Tablet", "hint": "Apps", "decoy": "Laptop"},
        {"word": "Laptop", "hint": "Fold", "decoy": "Desktop Computer"},
        {"word": "Computer", "hint": "Desk", "decoy": "Typewriter"},
        {"word": "Keyboard", "hint": "Typing", "decoy": "Piano"},
        {"word": "Computer Mouse", "hint": "Click", "decoy": "Trackpad"},
        {"word": "Printer", "hint": "Paper", "decoy": "Copy Machine"},
        {"word": "Headphones", "hint": "Ears", "decoy": "Earmuffs"},
        {"word": "Earbuds", "hint": "Case", "decoy": "Earplugs"},
        {"word": "Smartwatch", "hint": "Steps", "decoy": "Fitness Tracker"},
        {"word": "Camera", "hint": "Flash", "decoy": "Camcorder"},
        {"word": "Drone", "hint": "Propellers", "decoy": "Helicopter"},
        {"word": "Robot", "hint": "Beep", "decoy": "Cyborg"},
        {"word": "Wi-Fi", "hint": "Signal", "decoy": "Bluetooth"},
        {"word": "Bluetooth", "hint": "Pairing", "decoy": "Wi-Fi"},
        {"word": "Internet", "hint": "World", "decoy": "Library"},
        {"word": "Email", "hint": "Inbox", "decoy": "Letter"},
        {"word": "Text Message", "hint": "Thumbs", "decoy": "Passing Notes"},
        {"word": "Emoji", "hint": "Smiley", "decoy": "Sticker"},
        {"word": "Selfie", "hint": "Pose", "decoy": "Mirror"},
        {"word": "Charger", "hint": "Plug", "decoy": "Extension Cord"},
        {"word": "Battery", "hint": "Power", "decoy": "Solar Panel"},
        {"word": "App", "hint": "Download", "decoy": "Website"},
        {"word": "Website", "hint": "Link", "decoy": "App"},
        {"word": "Password", "hint": "Lock", "decoy": "Secret Handshake"},
        {"word": "Video Call", "hint": "Faraway", "decoy": "Phone Call"},
        {"word": "Smart Speaker", "hint": "Voice", "decoy": "Radio"},
        {"word": "GPS", "hint": "Directions", "decoy": "Map"},
        {"word": "Calculator", "hint": "Numbers", "decoy": "Cash Register"},
        {"word": "Computer Virus", "hint": "Spreads", "decoy": "Cold"},
        {"word": "YouTube", "hint": "Videos", "decoy": "Netflix"},
        {"word": "Netflix", "hint": "Shows", "decoy": "YouTube"},
        {"word": "Google", "hint": "Search", "decoy": "Encyclopedia"},
        {"word": "Alexa", "hint": "Hey", "decoy": "Siri"},
        {"word": "AI Chatbot", "hint": "Answers", "decoy": "Magic 8 Ball"},
        {"word": "Screenshot", "hint": "Capture", "decoy": "Photocopy"},
        {"word": "Touchscreen", "hint": "Tap", "decoy": "Button"},
        {"word": "QR Code", "hint": "Scan", "decoy": "Barcode"},
        {"word": "Self-Driving Car", "hint": "Future", "decoy": "Remote Control Car"},
        {"word": "3D Printer", "hint": "Build", "decoy": "Hot Glue Gun"},
        {"word": "VR Headset", "hint": "Goggles", "decoy": "3D Glasses"},
        {"word": "Doorbell Camera", "hint": "Porch", "decoy": "Peephole"},
        {"word": "Solar Panel", "hint": "Roof", "decoy": "Windmill"},
        {"word": "Electric Car", "hint": "Charging", "decoy": "Golf Cart"},
        {"word": "Ringtone", "hint": "Tune", "decoy": "Alarm Clock"},
        {"word": "Autocorrect", "hint": "Fixes", "decoy": "Eraser"},
        {"word": "Coding", "hint": "Language", "decoy": "Morse Code"},
        {"word": "Screen Time", "hint": "Limit", "decoy": "Bedtime"},
        {"word": "Notification", "hint": "Alert", "decoy": "Doorbell"},
        {"word": "Group Chat", "hint": "Everyone", "decoy": "Walkie-Talkie"}
      ]
    },
    {
      "id": "famous-people", "name": "Famous People", "icon": "⭐",
      "words": [
        {"word": "George Washington", "hint": "First", "decoy": "Abraham Lincoln"},
        {"word": "Abraham Lincoln", "hint": "Top Hat", "decoy": "George Washington"},
        {"word": "Benjamin Franklin", "hint": "Kite", "decoy": "Thomas Edison"},
        {"word": "Thomas Edison", "hint": "Invention", "decoy": "Alexander Graham Bell"},
        {"word": "Alexander Graham Bell", "hint": "Calling", "decoy": "Thomas Edison"},
        {"word": "Wright Brothers", "hint": "Flight", "decoy": "Amelia Earhart"},
        {"word": "Amelia Earhart", "hint": "Pilot", "decoy": "Wright Brothers"},
        {"word": "Neil Armstrong", "hint": "Moon", "decoy": "Buzz Aldrin"},
        {"word": "Albert Einstein", "hint": "Genius", "decoy": "Isaac Newton"},
        {"word": "Isaac Newton", "hint": "Gravity", "decoy": "Galileo"},
        {"word": "Leonardo da Vinci", "hint": "Painter", "decoy": "Michelangelo"},
        {"word": "Michelangelo", "hint": "Ceiling", "decoy": "Leonardo da Vinci"},
        {"word": "Vincent van Gogh", "hint": "Starry", "decoy": "Pablo Picasso"},
        {"word": "Mozart", "hint": "Piano", "decoy": "Beethoven"},
        {"word": "Beethoven", "hint": "Symphony", "decoy": "Mozart"},
        {"word": "William Shakespeare", "hint": "Plays", "decoy": "Dr. Seuss"},
        {"word": "Dr. Seuss", "hint": "Rhymes", "decoy": "William Shakespeare"},
        {"word": "Florence Nightingale", "hint": "Nurse", "decoy": "Clara Barton"},
        {"word": "Martin Luther King Jr.", "hint": "Speech", "decoy": "Rosa Parks"},
        {"word": "Rosa Parks", "hint": "Brave", "decoy": "Harriet Tubman"},
        {"word": "Harriet Tubman", "hint": "Railroad", "decoy": "Frederick Douglass"},
        {"word": "Paul Revere", "hint": "Lanterns", "decoy": "Betsy Ross"},
        {"word": "Betsy Ross", "hint": "Flag", "decoy": "Paul Revere"},
        {"word": "Johnny Appleseed", "hint": "Planting", "decoy": "Paul Bunyan"},
        {"word": "Sacagawea", "hint": "Guide", "decoy": "Pocahontas"},
        {"word": "Christopher Columbus", "hint": "Ships", "decoy": "Pilgrims"},
        {"word": "Cleopatra", "hint": "Egypt", "decoy": "Queen Elizabeth"},
        {"word": "King Tut", "hint": "Mummy", "decoy": "Cleopatra"},
        {"word": "Julius Caesar", "hint": "Rome", "decoy": "Napoleon"},
        {"word": "Queen Elizabeth", "hint": "Crown", "decoy": "Cleopatra"},
        {"word": "Walt Disney", "hint": "Mouse", "decoy": "Jim Henson"},
        {"word": "Mister Rogers", "hint": "Sweater", "decoy": "Bob Ross"},
        {"word": "Bob Ross", "hint": "Painting", "decoy": "Mister Rogers"},
        {"word": "Steve Irwin", "hint": "Australia", "decoy": "Jane Goodall"},
        {"word": "Jane Goodall", "hint": "Animals", "decoy": "Steve Irwin"},
        {"word": "Babe Ruth", "hint": "Baseball", "decoy": "Jackie Robinson"},
        {"word": "Jackie Robinson", "hint": "Barrier", "decoy": "Babe Ruth"},
        {"word": "Michael Jordan", "hint": "Basketball", "decoy": "LeBron James"},
        {"word": "Serena Williams", "hint": "Tennis", "decoy": "Venus Williams"},
        {"word": "Simone Biles", "hint": "Gymnastics", "decoy": "Serena Williams"},
        {"word": "Muhammad Ali", "hint": "Boxing", "decoy": "Rocky Balboa"},
        {"word": "Pelé", "hint": "Soccer", "decoy": "Lionel Messi"},
        {"word": "Lionel Messi", "hint": "Goal", "decoy": "Cristiano Ronaldo"},
        {"word": "Usain Bolt", "hint": "Lightning", "decoy": "The Flash"},
        {"word": "Michael Phelps", "hint": "Swimming", "decoy": "Aquaman"},
        {"word": "Tony Hawk", "hint": "Skateboard", "decoy": "Shaun White"},
        {"word": "Elvis Presley", "hint": "Rock and Roll", "decoy": "The Beatles"},
        {"word": "Theodore Roosevelt", "hint": "Teddy Bear", "decoy": "Abraham Lincoln"},
        {"word": "George Washington Carver", "hint": "Peanuts", "decoy": "Johnny Appleseed"},
        {"word": "Mother Teresa", "hint": "Helping", "decoy": "Florence Nightingale"}
      ]
    }
  ]
}
```
<!-- END categories.json -->

## Appendix B: Word-writing rules

**Word**
- A 10-year-old knows it. Prefer concrete things over abstract ideas.
- Family-friendly.
- Appears in only one category (see Appendix C).

**Hint** (Classic mode, when the imposter clue is "Category + hint word")
- One or two words.
- Points at several words in the category, never just one.
- Never contains the word or a direct synonym of it.

**Decoy** (Undercover mode)
- The same kind of thing as the word, so most clues overlap.
- Has one or two differences a sharp group can catch.
- A 10-year-old knows it.
- Never contains the crew's word.
- Decoys may repeat across entries, and a decoy may be a word from another category.

## Appendix C: Which category owns what

- **Ocean** owns sea creatures (shark, dolphin, seal, octopus). **Animals** owns land animals, birds, and bugs.
- **Candy & Snacks** owns candy, desserts, chips, and soda. **Food** owns meals, fruits, vegetables, and everyday drinks.
- **Christmas** owns anything Christmas. **Holidays** owns every other holiday (turkey, pumpkin, fireworks).
- **Space** owns astronauts and rockets. **Jobs** skips them.
- **Music** owns instruments.
- **Technology** owns phones, computers, apps, and gadgets. **Around the House** keeps the TV and remote. **Video Games** owns consoles and games.
- **Toys** owns toys and board games.
- **Clothing** owns anything worn.
- **Countries** owns countries. **Landmarks** owns famous named places. **Places Around Town** owns everyday places (library, park, bank).
- **Bible** owns Bible people, places, and things. **Famous People** owns other real people.
- **Superheroes** owns superhero characters. **Movies** owns movie titles ("Frozen," not "Elsa").
- **Holidays** also owns birthdays, parties, and holiday-specific foods (pumpkin pie, birthday cake, balloons). **Candy & Snacks** skips them.
- **Bible** owns the Christmas story (manger, wise men, shepherds). **Christmas** keeps the Nativity Scene as a decoration.
- **Vehicles** owns anything you ride or drive, including boats, trains, submarines, and pirate ships. **Ocean** skips them.
- **Video Games** owns game characters (Mario, Kirby). **Space** owns space suits.

## Appendix D: Content decisions

- Jesus, God, the cross, and the empty tomb are not used as words. The game has people bluff about the word and swaps in decoys, and those shouldn't be set up as interchangeable with anything.
- Halloween entries stay mild: pumpkins, costumes, trick-or-treating, one ghost. No witches or gore.
- Movies are G and PG titles only. Harry Potter and Coco are left out for their witchcraft and land-of-the-dead themes.
- Video Games are E and E10+ titles only (no Fortnite).
- Famous People are historical figures and long-established names. No living politicians or current-news figures.
- Countries stretches the 10-year-old test toward the bottom of the list; 50 kid-known countries is a tight fit.
