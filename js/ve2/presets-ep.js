// ---------------------------------------------------------------------------
// Eclipse Phase-flavored spacecraft (TL10, hard SF: no contragrav, reaction
// drives only, sealed hulls, computerized everything). Component numbers
// follow the same VE2 formulas as the built-in catalog.
// ---------------------------------------------------------------------------

const NO_GROUND = {
  wheels: { present: false, type: 'standard', count: 4, retractable: false },
  tracks: { present: false }, halftracks: { present: false }, skids: { present: false },
  legs: { present: false, count: 2 },
  wings: { present: false, type: 'standard', volumeFrac: 0.1 },
  rotors: { present: false, tl: 7 },
  turrets: [], superstructures: [], openMounts: [], arms: [],
  masts: { present: false, heightFt: 30 },
  gasbag: { present: false, cf: 0 },
};

const SPACER = {
  tl: 10, controls: 'computerized', streamlining: 'none',
  features: {
    flotationHull: false, submersibleHull: false, hydroLines: 'none',
    catamaran: false, trimaran: false, sealed: true, waterproofed: false,
    liftingBody: false, responsive: false,
  },
  computeSpace: true,
  hardpoints: { count: 0, loadLbs: 0 },
  exposedSeats: 0,
  options: { improvedSuspension: false, improvedBrakes: false, allWheelSteering: false, allWheelDrive: false, smartwheels: false, rollStabilizers: false },
};

export const EP_PRESETS = [
  {
    ...structuredClone(SPACER),
    name: 'EP: LOTV Surface Shuttle',
    streamlining: 'veryGood',
    features: { ...structuredClone(SPACER.features), liftingBody: true },
    structure: { frame: 'light', material: 'expensive', special: 'none' },
    armor: { type: 'laminateAdvanced', mode: 'overall', dr: 60, faces: null, otherDr: 0 },
    subassemblies: structuredClone(NO_GROUND),
    components: [
      { name: 'D-He3 fusion reactor, 4,000 kW', weight: 2800, cost: 340000, volume: 56, kwOut: 4000, location: 'body', note: 'unlimited fuel' },
      { name: 'metallic-hydrogen vectored thrusters, 30,000 lbs', weight: 450, cost: 11250, volume: 9, airThrust: 30000, staticLift: 30000, fuelGph: 1500, location: 'body' },
      { name: 'closed-loop life support (14 persons)', weight: 350, cost: 70000, volume: 70, kwIn: 3, location: 'body' },
      { name: '2 crew stations', weight: 60, cost: 200, volume: 60, location: 'body' },
      { name: '12 passenger couches (cramped)', weight: 240, cost: 1200, volume: 240, location: 'body' },
      { name: 'sensor suite (radar/lidar, 50 mi)', weight: 25, cost: 12500, volume: 0.5, kwIn: 12.5, location: 'body' },
      { name: 'comm laser + radio array', weight: 100, cost: 2600, volume: 2, kwIn: 0.5, location: 'body' },
      { name: 'remass tankage, 4,000 gal', weight: 2000, cost: 20000, volume: 600, location: 'body' },
    ],
    crew: 2, passengers: 12, cargoCf: 500, emptySpaceCf: 0,
    fuel: { type: 'hydrogen', gallons: 4000 },
    lengthYds: 15,
  },
  {
    ...structuredClone(SPACER),
    name: 'EP: Fusion Courier',
    structure: { frame: 'light', material: 'expensive', special: 'none' },
    armor: { type: 'laminateAdvanced', mode: 'overall', dr: 40, faces: null, otherDr: 0 },
    subassemblies: {
      ...structuredClone(NO_GROUND),
      turrets: [{ volumeCf: 30, rotation: 'full', slopeDegrees: 0, dr: 40 }],
    },
    components: [
      { name: 'D-He3 fusion reactor, 8,000 kW', weight: 3600, cost: 380000, volume: 72, kwOut: 8000, location: 'body', note: 'unlimited fuel' },
      { name: 'fusion torch drive, 40,000 lbs thrust', weight: 2000, cost: 100000, volume: 40, airThrust: 40000, fuelGph: 400, location: 'body' },
      { name: 'closed-loop life support (6 persons)', weight: 150, cost: 30000, volume: 30, kwIn: 1.5, location: 'body' },
      { name: '2 crew stations', weight: 60, cost: 200, volume: 60, location: 'body' },
      { name: '4 passenger couches', weight: 120, cost: 400, volume: 120, location: 'body' },
      { name: '6 bunks', weight: 1200, cost: 600, volume: 600, location: 'body' },
      { name: 'sensor suite (radar/lidar, 100 mi)', weight: 50, cost: 30000, volume: 1, kwIn: 25, location: 'body' },
      { name: 'comm laser + farcaster uplink', weight: 200, cost: 40000, volume: 4, kwIn: 2, location: 'body' },
      { name: 'PD railgun battery', weight: 600, cost: 120000, volume: 12, kwIn: 300, location: 'turret0', note: 'point defense' },
      { name: 'remass tankage, 10,000 gal', weight: 5000, cost: 50000, volume: 1500, location: 'body' },
    ],
    crew: 2, passengers: 4, cargoCf: 3000, emptySpaceCf: 200,
    fuel: { type: 'hydrogen', gallons: 10000 },
    lengthYds: 40,
  },
  {
    ...structuredClone(SPACER),
    name: 'EP: Scum Barge',
    structure: { frame: 'medium', material: 'cheap', special: 'none' },
    armor: { type: 'laminateStandard', mode: 'overall', dr: 15, faces: null, otherDr: 0 },
    subassemblies: structuredClone(NO_GROUND),
    components: [
      { name: 'aging fusion reactor, 30,000 kW', weight: 8000, cost: 1700000, volume: 160, kwOut: 30000, location: 'body', note: 'unlimited fuel' },
      { name: 'plasma drive, 120,000 lbs thrust', weight: 6000, cost: 300000, volume: 120, airThrust: 120000, fuelGph: 900, location: 'body' },
      { name: 'closed-loop life support (400 persons)', weight: 10000, cost: 2000000, volume: 2000, kwIn: 100, location: 'body' },
      { name: 'hydroponic farm & recycler decks', weight: 40000, cost: 800000, volume: 20000, kwIn: 200, location: 'body' },
      { name: '30 crew stations', weight: 900, cost: 3000, volume: 900, location: 'body' },
      { name: '120 family cabins', weight: 240000, cost: 360000, volume: 60000, location: 'body' },
      { name: '100 hotbunk racks', weight: 20000, cost: 10000, volume: 10000, location: 'body' },
      { name: 'bazaar & commons decks', weight: 30000, cost: 150000, volume: 30000, location: 'body' },
      { name: 'sensor & traffic array', weight: 200, cost: 50000, volume: 4, kwIn: 30, location: 'body' },
      { name: 'comm farm (system-wide)', weight: 1000, cost: 60000, volume: 20, kwIn: 40, location: 'body' },
      { name: 'workshop & fab bays', weight: 30000, cost: 190000, volume: 12000, kwIn: 50, location: 'body' },
      { name: 'remass tankage, 100,000 gal', weight: 50000, cost: 500000, volume: 15000, location: 'body' },
    ],
    crew: 30, passengers: 320, cargoCf: 25000, emptySpaceCf: 15000,
    fuel: { type: 'hydrogen', gallons: 100000 },
    lengthYds: 120,
  },
  {
    ...structuredClone(SPACER),
    name: 'EP: System Defense Interceptor',
    structure: { frame: 'heavy', material: 'expensive', special: 'none' },
    armor: { type: 'laminateAdvanced', mode: 'overall', dr: 120, faces: null, otherDr: 0 },
    subassemblies: {
      ...structuredClone(NO_GROUND),
      turrets: [
        { volumeCf: 15, rotation: 'full', slopeDegrees: 0, dr: 60 },
        { volumeCf: 15, rotation: 'full', slopeDegrees: 0, dr: 60 },
      ],
    },
    components: [
      { name: 'D-He3 fusion reactor, 12,000 kW', weight: 4400, cost: 420000, volume: 88, kwOut: 12000, location: 'body', note: 'unlimited fuel' },
      { name: 'fusion torch drive, 120,000 lbs thrust', weight: 6000, cost: 300000, volume: 120, airThrust: 120000, fuelGph: 1200, location: 'body' },
      { name: 'closed-loop life support (4 persons)', weight: 100, cost: 20000, volume: 20, kwIn: 1, location: 'body' },
      { name: '3 crew stations (acceleration couches)', weight: 120, cost: 1500, volume: 90, location: 'body' },
      { name: '2 bunks', weight: 400, cost: 200, volume: 200, location: 'body' },
      { name: 'spinal railgun (fires forward)', weight: 6000, cost: 800000, volume: 120, kwIn: 2000, location: 'body', note: 'swap for a 4e UT equivalent' },
      { name: 'PD railgun battery', weight: 400, cost: 100000, volume: 8, kwIn: 200, location: 'turret0', note: 'point defense' },
      { name: 'PD railgun battery', weight: 400, cost: 100000, volume: 8, kwIn: 200, location: 'turret1', note: 'point defense' },
      { name: 'seeker missile racks (24 buses)', weight: 3000, cost: 240000, volume: 60, location: 'body', note: 'ammo counts as cargo weight' },
      { name: 'military sensor suite (300 mi)', weight: 150, cost: 75000, volume: 3, kwIn: 75, location: 'body' },
      { name: 'comm laser + ECM fit', weight: 300, cost: 90000, volume: 6, kwIn: 20, location: 'body' },
      { name: 'remass tankage, 20,000 gal', weight: 10000, cost: 100000, volume: 3000, location: 'body' },
    ],
    crew: 3, passengers: 0, cargoCf: 300, emptySpaceCf: 100,
    fuel: { type: 'hydrogen', gallons: 20000 },
    lengthYds: 35,
  },
];
