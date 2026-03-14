# PokéDex 🎮

A feature-rich, retro-styled Pokédex web app built with vanilla HTML, CSS and JavaScript. Fetches live data from the [PokéAPI](https://pokeapi.co) with no frameworks or dependencies.

**[Live Demo →](https://YOUR_USERNAME.github.io/YOUR_REPO_NAME)**

---

## Features

### Pokémon Search
- Search any Pokémon by name with **typeahead autocomplete** — suggestions appear after 2 characters, sorted by Pokédex number
- **Random Pokémon button** — instantly loads a random Pokémon from the full 1010 roster
- **Skeleton loading screen** — shimmer placeholders mirror the card layout while data loads
- Regional variant detection with coloured badges (Alolan, Galarian, Hisuian, Paldean, Mega, Gigantamax)

### Pokémon Card
- Official sprite with **shiny toggle** — swap between normal and shiny sprite with an animated transition
- Type badges, Pokédex ID, Height, Weight and Base Experience
- **Abilities** — displayed as clickable pills; clicking opens a modal with the full effect description and in-game flavour text. Hidden abilities are visually distinguished
- **Base stats** — HP, Attack, Defence and Speed shown as animated bars
- **Type weaknesses** — calculated by multiplying damage relations across both types; 4× weaknesses glow to stand out

### Evolution Chain
- Full evolution chain fetched and displayed with sprites, Pokémon names and evolution conditions (level, item, trade, friendship, time of day, and more)
- **Branching evolutions** (e.g. Eevee) shown with a thumbnail carousel — click any thumbnail to swap the displayed evolution and update the condition
- Clicking any Pokémon in the chain searches for it instantly
- Regional variant chains (Alolan, Galarian, Hisuian) handled via a hardcoded lookup table since the PokéAPI does not provide separate chains for regional forms
- Mega Evolutions and Gigantamax forms detected by suffix and shown as a badge rather than a broken chain

### Move Learnset
- Full move list grouped by **generation tabs** — only generations the Pokémon appears in are shown; defaults to the latest
- Each move shows its **type badge** (fetched on demand per tab, cached after first load) and learn method
- Learn methods shown as SVG icons: disc for TM/HM, egg for egg moves, book for tutor moves; level-up moves show the level number
- **Move tooltip** — clicking any move name opens an anchored popover showing Power, Accuracy, PP, damage class and effect description

### Encounter Locations
- All wild encounter data fetched from the API, grouped by **game version tabs**
- Each location shows encounter method, level range and encounter rate
- Pokémon not found in the wild (starters, trade-only etc.) show a clear message

### Item Search
- Switch to Item mode via the tab bar at the top
- Search any item with **typeahead autocomplete** — suggestions include item sprites as thumbnails
- Item card shows the sprite, category, attribute badges, fling power, effect and flavour text

### Type Chart
- A **floating button** in the bottom-right corner opens a full type effectiveness reference modal
- Lists all 18 types with their weaknesses and strengths in a clean scrollable layout

### Item Links
- Item names throughout the app are **clickable** — clicking opens an item detail modal without leaving the current view
- Wired in evolution conditions (e.g. Fire Stone, Metal Coat), move tooltips and location data

---

## Technical Highlights

| Topic | What was used |
|---|---|
| Data fetching | `fetch` API with `async/await` |
| Parallel requests | `Promise.all()` for move types, type relations |
| Loading UX | Skeleton screens with CSS shimmer animation |
| Caching | In-memory JS objects for types, moves, abilities, items |
| Autocomplete | Prefix-matching against a preloaded list of 1010 Pokémon / 2000 items |
| Type effectiveness | Multiplier calculation across dual types using the `/type` endpoint |
| Regional variants | Three-tier system: hardcoded chains, suffix detection, base chain fallback |
| No build tools | Plain HTML, CSS and JS — open `index.html` and go |

---

## Getting Started

### Run locally
1. Clone the repository
   ```bash
   git clone https://github.com/YOUR_USERNAME/YOUR_REPO_NAME.git
   ```
2. Open the project folder in VS Code
3. Install the [Live Server](https://marketplace.visualstudio.com/items?itemName=ritwickdey.LiveServer) extension
4. Right-click `index.html` → **Open with Live Server**
5. The app opens at `http://127.0.0.1:5500`

No npm, no build step, no config needed.

---

## Project Structure

```
├── index.html   — markup and all UI panels
├── style.css    — all styles, animations and theming
├── script.js    — all logic, API calls, caching and rendering
└── README.md    — this file
```

---

## Data Source

All Pokémon data is sourced from [PokéAPI](https://pokeapi.co) — a free, open RESTful API. Item sprites are served from the [PokeAPI Sprites](https://github.com/PokeAPI/sprites) GitHub repository.

---

## Known Limitations

- Regional variant evolution chains (e.g. Alolan Meowth → Alolan Persian) are hardcoded as the PokéAPI does not provide separate chains for regional forms — this is a [known open issue](https://github.com/PokeAPI/pokeapi/issues) in the API
- Mega Evolutions and Gigantamax forms do not have evolution chains in the API; they are shown as a variant badge only
- Item in-game purchase or pickup locations are not available in the PokéAPI

---

## Built With

- [PokéAPI](https://pokeapi.co)
- [Press Start 2P](https://fonts.google.com/specimen/Press+Start+2P) — pixel display font
- [Nunito](https://fonts.google.com/specimen/Nunito) — body font
- Pure vanilla JS — no frameworks or libraries