// ---------------------------------------------------------------------------
// Psi-Wars — fan-made space-opera content from Mailanka's "Psi-Wars"
// (Iteration 5), used with the GURPS Spaceships engine. Registers the
// setting's house-ruled drive and the starship catalog as presets.
// Psi-Wars is a fan creation by Mailanka (mailanka.blogspot.com); ships
// here are his TL11^ rebuilds of published GURPS Spaceships designs.
// ---------------------------------------------------------------------------

import { SYSTEMS, makeEngine } from './systems.js';
import './systems-books.js';

// Psi-Wars nerfs the super reactionless engine to 25G so that fighters
// (fusion torches) stay the fast ones and freighters cruise economically.
SYSTEMS.superReactionlessPW = makeEngine('superReactionlessPW', {
  name: 'Super reactionless engine (Psi-Wars)', tl: 11, ss: true, he: 1,
  reactionless: true, accel: () => 25, costBase: 200e3,
  note: 'Psi-Wars house rule: 25G per engine',
}, 'PW');

const slot = (sys, opts = {}) => ({ sys, opts });

export const PSIWARS_PRESETS = [
  {
    name: 'PW: Typhoon Alpha "Interceptor" (TL11^, SM+4)',
    design: {
      name: 'Typhoon Alpha Interceptor',
      tl: 11, sm: 4, streamlined: false,
      features: { hardenedArmor: true, gravticCompensators: true },
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
          slot('fuelCell'), slot('fuelCell'),
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
    name: 'PW: Typhoon Delta "Storm" (TL11^, SM+4, ace fighter)',
    design: {
      name: 'Typhoon Delta Storm',
      tl: 11, sm: 4, streamlined: true,
      features: { hardenedArmor: true, gravticCompensators: true },
      sections: {
        front: [
          slot('armor_diamondoid'), slot('armor_diamondoid'),
          slot('battery_major', { count: 1, weaponType: 'beam', mount: 'fixed' }),
          slot('battery_major', { count: 1, weaponType: 'beam', mount: 'fixed' }),
          slot('battery_major', { count: 1, weaponType: 'beam', mount: 'fixed' }),
          slot('battery_major', { count: 1, weaponType: 'beam', mount: 'fixed' }),
        ],
        central: [
          slot('armor_diamondoid'), slot('tacticalArray'),
          slot('defensiveECM'), slot('defensiveECM'), slot('defensiveECM'),
          slot('superFusionReactor'),
        ],
        rear: [
          slot('armor_diamondoid'),
          slot('superFusionTorch'), slot('superFusionTorch'), slot('superFusionTorch'),
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
    name: 'PW: Starhawk Nova (TL11^, SM+5, six-gun ace fighter)',
    design: {
      name: 'Starhawk Nova',
      tl: 11, sm: 5, streamlined: true,
      features: { hardenedArmor: true, gravticCompensators: true, winged: true },
      sections: {
        front: [
          slot('armor_nanocomposite'),
          slot('battery_major', { count: 1, weaponType: 'missile', mount: 'fixed' }),
          slot('battery_medium', { count: 3, weaponType: 'beam', mount: 'fixed' }),
          slot('battery_medium', { count: 3, weaponType: 'beam', mount: 'fixed' }),
          slot('defensiveECM'), slot('defensiveECM'),
        ],
        central: [
          slot('armor_nanocomposite'), slot('tacticalArray'), slot('engineRoom'),
          slot('fuelTank'), slot('fuelTank'), slot('forceScreenHeavy'),
        ],
        rear: [
          slot('armor_nanocomposite'),
          slot('superFusionTorch'), slot('superFusionTorch'),
          slot('superFusionTorch'), slot('superFusionTorch'),
          slot('stardrive'),
        ],
      },
      cores: [
        { section: 'central', sys: 'controlRoom', opts: {} },
        { section: 'rear', sys: 'superFusionReactor', opts: {} },
      ],
    },
  },
  {
    name: 'PW: Wyvern Zero (TL11^, SM+6, mini-corvette)',
    design: {
      name: 'Wyvern Zero',
      tl: 11, sm: 6, streamlined: false,
      features: { hardenedArmor: true, gravticCompensators: true, emergencyEjection: true },
      sections: {
        front: [
          slot('armor_nanocomposite'), slot('armor_nanocomposite'),
          slot('battery_major', { count: 1, weaponType: 'beam', mount: 'fixed' }),
          slot('battery_major', { count: 1, weaponType: 'beam', mount: 'fixed' }),
          slot('controlRoom'),
          slot('battery_medium', { count: 3, weaponType: 'missile', mount: 'fixed' }),
        ],
        central: [
          slot('armor_nanocomposite'), slot('habitat'), slot('tacticalArray'),
          slot('battery_major', { count: 1, weaponType: 'beam', mount: 'turret' }),
          slot('stardrive'), slot('stardrive'),
        ],
        rear: [
          slot('armor_nanocomposite'), slot('fuelTank'),
          slot('superFusionTorch'), slot('superFusionTorch'),
          slot('superReactionlessPW'), slot('defensiveECM'),
        ],
      },
      cores: [
        { section: 'central', sys: 'superFusionReactor', opts: {} },
        { section: 'rear', sys: 'forceScreenLight', opts: {} },
      ],
    },
  },
  {
    name: 'PW: Tiger Manticore (TL11^, SM+9, escort frigate)',
    design: {
      name: 'Tiger Manticore',
      tl: 11, sm: 9, streamlined: false,
      features: { hardenedArmor: true, artificialGravity: true, gravticCompensators: true },
      sections: {
        front: [
          slot('armor_diamondoid'), slot('armor_diamondoid'),
          slot('habitat', { automed: 6, offices: 1, steerage: 3 }),
          slot('battery_major', { count: 1, weaponType: 'beam', mount: 'fixed' }),
          slot('tacticalArray'),
          slot('forceScreenHeavy'),
        ],
        central: [
          slot('armor_diamondoid'),
          slot('battery_major', { count: 1, weaponType: 'missile', mount: 'turret' }),
          slot('battery_major', { count: 1, weaponType: 'missile', mount: 'turret' }),
          slot('stardrive'), slot('stardrive'),
          slot('fusionReactor'),
        ],
        rear: [
          slot('armor_diamondoid'), slot('engineRoom'),
          slot('superReactionlessPW'), slot('superReactionlessPW'), slot('superReactionlessPW'),
          slot('battery_major', { count: 1, weaponType: 'beam', mount: 'turret' }),
        ],
      },
      cores: [
        { section: 'front', sys: 'controlRoom', opts: {} },
        { section: 'central', sys: 'superFusionReactor', opts: {} },
      ],
    },
  },
  {
    name: 'PW: Renegade Marauder (TL11^, SM+8, pirate corsair)',
    design: {
      name: 'Renegade Marauder',
      tl: 11, sm: 8, streamlined: false,
      features: { hardenedArmor: true, artificialGravity: true, gravticCompensators: true },
      sections: {
        front: [
          slot('armor_nanocomposite'), slot('armor_nanocomposite'),
          slot('tacticalArray'),
          slot('battery_medium', { count: 2, weaponType: 'beam', mount: 'turret' }),
          slot('habitat', { automed: 3 }),
          slot('habitat', { bunkrooms: 3, cells: 1, offices: 1 }),
        ],
        central: [
          slot('armor_nanocomposite'),
          slot('cargoHold'), slot('cargoHold'), slot('cargoHold'),
          slot('forceScreenLight'),
          slot('battery_secondary', { count: 4, weaponType: 'beam', mount: 'turret' }),
        ],
        rear: [
          slot('armor_nanocomposite'),
          slot('superReactionlessPW'), slot('superReactionlessPW'),
          slot('stardrive'), slot('stardrive'),
          slot('engineRoom'),
        ],
      },
      cores: [
        { section: 'front', sys: 'controlRoom', opts: {} },
        { section: 'rear', sys: 'superFusionReactor', opts: {} },
      ],
    },
  },
  {
    name: 'PW: Dark-Horse Racer (TL11^, SM+8, smuggler freighter)',
    design: {
      name: 'Dark-Horse Racer',
      tl: 11, sm: 8, streamlined: true,
      features: { artificialGravity: true, gravticCompensators: true },
      sections: {
        front: [
          slot('armor_lightAlloy'),
          slot('habitat', { automed: 2 }),
          slot('hangarBay'), slot('cargoHold'),
          slot('habitat', { automed: 3 }),
          slot('controlRoom'),
        ],
        central: [
          slot('armor_lightAlloy'), slot('cargoHold'),
          slot('stardrive'),
          slot('battery_secondary', { count: 2, weaponType: 'beam', mount: 'turret' }),
          slot('habitat'), slot('engineRoom'),
        ],
        rear: [
          slot('armor_lightAlloy'),
          slot('superReactionlessPW'), slot('superReactionlessPW'), slot('superReactionlessPW'),
          slot('stardrive'), slot('stardrive'),
        ],
      },
      cores: [
        { section: 'central', sys: 'forceScreenLight', opts: {} },
        { section: 'rear', sys: 'superFusionReactor', opts: {} },
      ],
    },
  },
];
