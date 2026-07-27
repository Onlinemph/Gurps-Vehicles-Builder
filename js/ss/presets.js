// ---------------------------------------------------------------------------
// GURPS Spaceships — sample designs. The first two replicate the book's
// worked examples; the third is an Eclipse Phase-flavored hard-SF transport.
// ---------------------------------------------------------------------------

const slot = (sys, opts = {}) => ({ sys, opts });
const empty = () => ({ sys: null, opts: {} });

export const SS_PRESETS = [
  {
    name: 'Star Flower-class Tramp Freighter (TL11^)',
    design: {
      name: 'Star Flower-class Tramp Freighter',
      tl: 11, sm: 8, streamlined: true,
      features: { artificialGravity: true },
      sections: {
        front: [
          slot('armor_metallicLaminate'), slot('cargoHold'), slot('cargoHold'),
          slot('cargoHold'), slot('cargoHold'), slot('enhancedArray'),
        ],
        central: [
          slot('armor_metallicLaminate'), slot('habitat'), slot('habitat', { sickbay: 2 }),
          slot('cargoHold'), slot('cargoHold'),
          slot('battery_tertiary', { count: 1, weaponType: 'beam', mount: 'turret' }),
        ],
        rear: [
          slot('armor_metallicLaminate'), slot('standardReactionless'), slot('standardReactionless'),
          slot('stardrive'), slot('stardrive'), slot('engineRoom'),
        ],
      },
      cores: [
        { section: 'front', sys: 'controlRoom', opts: {} },
        { section: 'rear', sys: 'fusionReactor', opts: {} },
      ],
    },
  },
  {
    name: 'Midnight Sun-class Orbital Shuttle (TL9)',
    design: {
      name: 'Midnight Sun-class Orbital Shuttle',
      tl: 9, sm: 6, streamlined: true,
      features: { winged: true },
      sections: {
        front: [
          slot('armor_lightAlloy'), slot('controlRoom'), slot('passengerSeating'),
          slot('passengerSeating'), slot('cargoHold'), slot('cargoHold'),
        ],
        central: [
          slot('armor_lightAlloy'), slot('fuelTank'), slot('fuelTank'),
          slot('fuelTank'), slot('fuelTank'), slot('fuelTank'),
        ],
        rear: [
          slot('chemRocket'), slot('fuelTank'), slot('fuelTank'),
          slot('fuelTank'), slot('fuelTank'), slot('fuelTank'),
        ],
      },
      cores: [
        { section: 'central', sys: 'fuelTank', opts: {} },
        { section: 'rear', sys: 'fuelTank', opts: {} },
      ],
    },
  },
  {
    name: 'Elysian-class System Transport (TL10, hard SF)',
    design: {
      name: 'Elysian-class System Transport',
      tl: 10, sm: 8, streamlined: false,
      features: { spinGravity: true },
      sections: {
        front: [
          slot('armor_nanocomposite'), slot('enhancedArray'), slot('cargoHold'),
          slot('cargoHold'), slot('defensiveECM'), slot('solarPanel'),
        ],
        central: [
          slot('armor_nanocomposite'), slot('habitat'), slot('cargoHold'),
          slot('fuelTank'), slot('fuelTank'), slot('fuelTank'),
        ],
        rear: [
          slot('armor_nanocomposite'), slot('fusionPulse'), slot('fusionPulse'),
          slot('fuelTank'), slot('fuelTank'), slot('engineRoom'),
        ],
      },
      cores: [
        { section: 'front', sys: 'controlRoom', opts: {} },
        { section: 'central', sys: 'fissionReactor', opts: {} },
      ],
    },
  },
  {
    name: 'Empty hull (start from scratch)',
    design: {
      name: 'New Spacecraft',
      tl: 10, sm: 8, streamlined: false,
      features: {},
      sections: {
        front: [empty(), empty(), empty(), empty(), empty(), empty()],
        central: [empty(), empty(), empty(), empty(), empty(), empty()],
        rear: [empty(), empty(), empty(), empty(), empty(), empty()],
      },
      cores: [
        { section: 'front', sys: null, opts: {} },
        { section: 'rear', sys: null, opts: {} },
      ],
    },
  },
];
