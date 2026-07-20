# GURPS Vehicles Builder

A fast, friendly, **zero-dependency** web app for designing vehicles and getting
a GURPS 4e-style stat block instantly — ST/HP, Hnd/SR, HT, Move, LWt., Load,
SM, Occ., DR, Range, Cost, and Locations, live as you tweak the design.

No build step, no server, no accounts. Open `index.html` in a browser (or host
the repo on GitHub Pages) and start designing.

## Features

- **Live stat block** in the Basic Set vehicle-table format, updated on every change.
- **11 chassis types**: wheeled, motorcycle, tracked, half-track, hovercraft,
  displacement boat, planing speedboat, submarine, airplane, helicopter, airship.
- **8 powerplants**: gasoline, diesel, gas turbine, steam, electric (with
  batteries), fusion, sails, and pedal power — availability and performance
  scale with TL 5–12.
- **Armor designer**: pick a material (wood through nanocomposite) and set DR
  per facing; weight and cost are computed from hull area.
- **Weight-budget design**: pick a frame capacity and spend pounds on
  components; a live bar shows how much budget remains, with clear errors when
  you overload.
- **Crew, passengers, cargo, 19 accessories, and weapons** (presets or custom)
  with fixed, pintle, or turret mounts.
- **Validation** — TL gating, minimum power-to-weight for aircraft, hull-speed
  caps for displacement hulls, overload detection, and more.
- **Sample designs**: sedan, motorcycle, pickup, main battle tank, patrol boat,
  light airplane, helicopter, steam launch, electric runabout.
- **Save/load** designs in your browser, **import/export JSON**, **export a
  Markdown stat block**, and a print-friendly sheet.
- **GVB Library**: if you own SJ Games' discontinued *GURPS Vehicle Builder*
  program, load its `.rep` repository files (≈1,900 components covering GURPS
  Vehicles 2e plus the WWII, Ogre, Mecha, Robots, Ultra-Tech, Space, and
  Traveller data sets) directly in the browser. Components are computed with
  the exact formulas from the data files and added to your design as
  equipment. No game data ships with this repo — you load your own files, and
  parsing happens entirely client-side.
- **"How it works" panel** documenting every formula, so nothing is a black box
  and everything is house-ruleable.

## Running it

```sh
# just open it
open index.html            # macOS
xdg-open index.html        # Linux

# or serve it (needed by some browsers for ES modules from file://)
python3 -m http.server 8000
# then browse to http://localhost:8000
```

To publish on GitHub Pages: repository **Settings → Pages → Deploy from a
branch**, pick your branch and `/ (root)`.

## Running the tests

The design engine is pure JavaScript with unit tests using Node's built-in
test runner (Node 18+):

```sh
node --test tests/
```

## How the design system works

This is an original, streamlined design system that produces stat blocks in the
style of the *GURPS Basic Set* vehicle table. The core idea is a **weight
budget**: choose a frame capacity (maximum loaded weight), then every
component — structure, powerplant, armor, fuel, seats, accessories, weapons,
occupants, and cargo — spends pounds against it.

Key formulas (all tunable in `js/data.js`, fully documented in the in-app
"How it works" panel):

| Stat | Formula |
|------|---------|
| HP | 4 × ∛(empty weight in lbs) |
| Top speed | k × √(hp per loaded ton) × streamlining (k per chassis; displacement hulls capped at hull speed) |
| Acceleration | (hp/ton) ÷ chassis divisor, in yds/sec² |
| SM | Basic Set size table by length, −1 for long-box shapes |
| Armor weight | hull area × facing share × DR × material lbs/DR/sq ft |
| Range | cruise speed × endurance from fuel or battery |
| Cost | components + 20% assembly, rounded to 3 significant figures |

## Project layout

```
index.html          — the app shell
css/style.css       — styles (screen + print)
js/data.js          — every tunable number: chassis, engines, armor, gear
js/engine.js        — pure design→stats computation
js/ui.js            — form binding and rendering
js/presets.js       — sample designs
js/export.js        — Markdown/JSON export
js/storage.js       — localStorage design library
js/gvb/parser.js    — parser for GVB .rep/.gvv files (Delphi TPF0 streams)
js/gvb/formula.js   — evaluator for GVB's component formula language
js/gvb/library.js   — template normalization + evaluation
js/gvb/ui-library.js— the GVB Library import/browse modal
tools/parse-rep.mjs — CLI: dump a .rep/.gvv file as JSON
tests/              — engine + GVB parser/formula tests (node --test)
```

### The GVB formula language

GVB component templates carry their math as formula strings, e.g.

```
vQuantity * IIF(Checkbox(1) {AWD}, 1.5, 1) *
DECODE(RANGE(vTL,6,8), 6, 10, 7, 7.5, 8, 5, 0)
```

`js/gvb/formula.js` implements it: arithmetic with `^`, comparisons,
`|`/`&`/`!` logic, `{comments}`, `IIF`, `DECODE` (key/value pairs with an
optional trailing default), `RANGE` (clamp), `Radio(n)`/`Checkbox(n)` for the
template's option state, and the math functions found in the data (`SQRT`,
`SQR`, `CUBE`, `CRT`, `ROUND`, `ROUNDN`, `MIN`, `MAX`, `SELECT`, …).
Across all 48 stock repositories, 1,873 of 1,874 templates evaluate without
errors (the one failure is a missing comma in the original data). Formulas
that reference vehicle-level values (`vVehicle_Weight`, `vBODY_HP`, …) prompt
for those numbers in the UI.

## Legal

This tool is an original, unofficial fan creation. **GURPS** is a registered
trademark of Steve Jackson Games. The material presented here is intended for
use with the GURPS system from Steve Jackson Games and is released in
accordance with the [SJ Games Online Policy](http://www.sjgames.com/general/online_policy/).
This tool is not published, endorsed, or approved by Steve Jackson Games. It
does not reproduce any published rules text or tables; the design system is an
independent approximation.

Code is released under the MIT License (see `LICENSE`).
