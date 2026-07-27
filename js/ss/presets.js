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
    name: 'Anthem-class Light Star Freighter (TL11^, SS2)',
    design: {
      name: 'Anthem-class Light Star Freighter',
      tl: 11, sm: 8, streamlined: true,
      features: { artificialGravity: true },
      sections: {
        front: [
          slot('armor_steel'), slot('cargoHold'), slot('cargoHold'), slot('cargoHold'),
          slot('habitat', { automed: 2 }), slot('habitat'),
        ],
        central: [
          slot('armor_steel'), slot('cargoHold'), slot('cargoHold'), slot('cargoHold'), slot('cargoHold'),
          slot('battery_tertiary', { count: 1, weaponType: 'beam', mount: 'turret' }),
        ],
        rear: [
          slot('armor_steel'), slot('cargoHold'), slot('cargoHold'),
          slot('hotReactionless'), slot('stardrive'), slot('engineRoom'),
        ],
      },
      cores: [
        { section: 'front', sys: 'controlRoom', opts: {} },
        { section: 'rear', sys: 'fusionReactor', opts: { deRate: 1 } },
      ],
    },
  },
  {
    name: 'Typhoon Space Fighter (TL11^, SM+4, SS4)',
    design: {
      name: 'Typhoon Space Fighter',
      tl: 11, sm: 4, streamlined: false,
      features: { hardenedArmor: true, emergencyEjection: true, gravticCompensators: true },
      sections: {
        front: [
          slot('armor_nanocomposite'), slot('armor_nanocomposite'), slot('armor_nanocomposite'),
          slot('battery_major', { count: 1, weaponType: 'beam', mount: 'fixed' }),
          slot('battery_major', { count: 1, weaponType: 'beam', mount: 'fixed' }),
          slot('tacticalArray'),
        ],
        central: [
          slot('armor_nanocomposite'), slot('armor_nanocomposite'),
          slot('defensiveECM'), slot('defensiveECM'),
          slot('superFusionReactor'), slot('superFusionReactor'),
        ],
        rear: [
          slot('armor_nanocomposite'), slot('armor_nanocomposite'),
          slot('superFusionTorch'), slot('superFusionTorch'),
          slot('superFusionTorch'), slot('superFusionTorch'),
        ],
      },
      cores: [
        { section: 'front', sys: 'controlRoom', opts: {} },
        { section: 'central', sys: 'fuelTank', opts: {} },
      ],
    },
  },
  {
    name: 'Spartan Space-Assault Mecha (TL9, SS4)',
    design: {
      name: 'Spartan Space-Assault Mecha',
      tl: 9, sm: 5, streamlined: false,
      features: {},
      sections: {
        front: [
          slot('armor_advMetallicLaminate'), slot('armor_advMetallicLaminate'),
          slot('armor_advMetallicLaminate'), slot('armor_advMetallicLaminate'),
          slot('defensiveECM'),
          slot('battery_major', { count: 1, weaponType: 'gun', mount: 'fixed' }),
        ],
        central: [
          slot('armor_advMetallicLaminate'), slot('armor_advMetallicLaminate'),
          slot('robotArm'), slot('robotArm'),
          slot('battery_major', { count: 1, weaponType: 'beam', mount: 'turret' }),
          slot('fuelTank'),
        ],
        rear: [
          slot('armor_advMetallicLaminate'), slot('armor_advMetallicLaminate'),
          slot('chemRocket'), slot('robotLeg'), slot('robotLeg'),
          slot('fuelTank'),
        ],
      },
      cores: [
        { section: 'central', sys: 'controlRoom', opts: {} },
        { section: 'rear', sys: 'mhdTurbine', opts: {} },
      ],
    },
  },
  {
    name: 'Ether Ironclad (TL5+2^, SS7)',
    design: {
      name: 'Ether Ironclad',
      tl: 7, sm: 10, streamlined: false,
      features: { artificialGravity: true, lacksAutomation: true },
      sections: {
        front: [
          slot('armor_iron'), slot('armor_iron'), slot('armor_etherwood'),
          slot('habitat', { bunkrooms: 25, steerage: 30 }),
          slot('battery_medium', { count: 3, weaponType: 'gun', mount: 'turret' }),
          slot('solarMirror'),
        ],
        central: [
          slot('armor_iron'), slot('armor_iron'),
          slot('battery_medium', { count: 3, weaponType: 'beam', mount: 'turret' }),
          slot('solarBoiler'), slot('solarMirror'),
          slot('battery_tertiary', { count: 10, weaponType: 'gun', mount: 'turret' }),
        ],
        rear: [
          slot('armor_iron'), slot('armor_etherwood'),
          slot('battery_medium', { count: 2, weaponType: 'gun', mount: 'turret' }),
          slot('solarBoiler'),
          slot('etherScrew'), slot('etherScrew'),
        ],
      },
      cores: [
        { section: 'front', sys: 'controlRoom', opts: {} },
        { section: 'central', sys: 'habitat', opts: { bunkrooms: 25, briefing: 1, offices: 2, labs: 1, sickbay: 5 } },
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
