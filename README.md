# The Mushling Oracle

A 49-card oracle deck app: spreads, stories, gallery, journal, the Mushling Match mini-game, and the Sage chat.

Static site with no build step. Open `index.html` in a browser, or serve the folder (for example `python3 -m http.server`).

- `index.html`: all screens
- `css/style.css`: styling
- `js/data.js`: card, spread and story data
- `js/app.js`: app logic
- `js/games.js`: Mushling Match
- `assets/`: card art, backgrounds, card back

Sage chat calls `window.claude.use('sample')`, which only exists inside the Claude artifact runtime; elsewhere it needs its own backend.
