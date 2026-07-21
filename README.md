# GURPS Vehicles Builder

A fast, friendly, **zero-dependency** web app for designing GURPS vehicles.
No build step, no server, no accounts. Open it in a browser (or host the repo
on GitHub Pages) and start designing.

Two designers are included:

- **`index.html` — Streamlined designer.** An original, easy design system that
  produces GURPS 4e-style stat blocks instantly (ST/HP, Hnd/SR, HT, Move,
  LWt., Load, SM, Occ., DR, Range, Cost, Locations).
- **`ve2.html` — GURPS Vehicles 2e designer.** A faithful implementation of the
  *GURPS Vehicles, Second Edition* design sequence: component volumes → body
  and subassembly volumes → surface areas → structure → armor → hit points →
  weights → statistics (SM, HT, price) → ground / water / submerged / aerial
  performance, with the book's own formulas and rounding rules. The engine is
  validated against the book's worked example (the Kitty Hawk: structure
  972 lbs/$97,200, body 188 HP, ground 185 mph, water drag 79, crush depth
  170 yds, aMR 2.5, and so on — see `tests/ve2.test.mjs`).

  Covers: per-face armor with 30°/60° slope (DR multipliers, PD bonuses, and
  the body-volume cost of slope), multiple turrets, superstructures, open
  mounts and robot arms (arms get auto-sized arm motors with the book's ST
  table, options like striker/extendable, reach, and per-arm HP),
  wheels/tracks/halftracks/skids/legs, wings and rotors, masts and gasbags, hardpoints
  (performance with and without stores), fuel endurance (the sample jeep
  reports 5h 33m, matching GVB's own output), exposed-crew drag, space
  performance, sample designs (jeep, MBT, speedboat, helicopter, combat walker),
  a Markdown stat-block export, and a **GURPS 4e conversion** ("4e Stat Block"
  button): TL shift (3e TL8 → 4e TL9...), HP = 4 × ∛(empty lbs), PD dropped,
  Move in yards/second, MR/SR → Hnd/SR benchmark heuristics, HT 10-12 with
  f/x suffixes, SM from longest dimension, and a checklist of weapons to swap
  for High-Tech/Ultra-Tech equivalents.

Both designers can pull real components from the official **GURPS Vehicle
Builder** program's data files via the GVB Library (see below).

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
