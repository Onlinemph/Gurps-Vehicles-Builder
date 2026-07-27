// ---------------------------------------------------------------------------
// GURPS Spaceships designer — Explain mode content.
// ---------------------------------------------------------------------------

export const SECTION_HELP = {
  'Hull': 'A spacecraft is defined by its Size Modifier: SM sets its loaded mass, '
    + 'length, hit points and handling all at once. Everything else is chosen by '
    + 'filling the hull’s 20 system slots.',
  'Systems': 'Think of each slot as 5% of the ship by mass. Want more cargo? More '
    + 'slots of cargo hold. Faster? More engine slots. The [core] slots are buried '
    + 'in the middle of each section — the safest place for the bridge or reactor, '
    + 'hit only by attacks that penetrate everything above them.',
  'Design features': 'Features are ship-wide options rather than slot-filling '
    + 'systems: gravity, wings, stealth coatings, automation. Superscience features '
    + 'are marked ^ — leave them out of hard-SF settings.',
};

export const FIELD_HELP = {
  'f-tl': 'The setting’s technology level. TL7 is the space age, TL9 the near '
    + 'future, TL10–12 increasingly advanced interstellar tech. Higher TL unlocks '
    + 'better drives, reactors, armor and sensors.',
  'f-sm': 'Size Modifier: the single dial that scales the whole ship. Each +1 SM '
    + 'roughly triples loaded mass. It is also the bonus to hit the ship in combat.',
  'f-streamlined': 'A streamlined hull is a wedge or needle that can fly fast in '
    + 'atmosphere (air speed √G × 2,500 mph). The price: hull armor protects less '
    + 'per slot, and it needs at least one armor system up front as a heat shield.',
};

export const STAT_HELP = {
  'dST/HP': 'Damage Sustained Threshold / Hit Points on the spaceship damage scale. Comes straight from hull size.',
  'Hnd/SR': 'Handling (bonus to Piloting maneuvers) and Stability Rating. From the hull, adjusted for acceleration and low TL.',
  'HT': 'Health — rolled to avoid breakdowns and survive major damage. 13 base; -1 if a small ship lacks an engine room.',
  'Move': 'Acceleration in G and top speed. Reactionless drives show “c” (no fuel limit); reaction drives show delta-V in miles per second.',
  'LWt.': 'Loaded weight in tons — fixed by SM; every system aboard is 5% of this.',
  'Load': 'Tons of cargo and people the ship can carry: cargo holds + hangar bays + 0.1 tons per occupant.',
  'SM': 'Size Modifier — also the bonus for enemies to hit you.',
  'Occ': 'Occupancy. ASV = long-term (cabins, 2 each); SV = short-term seats; crew stations listed first.',
  'dDR': 'Damage Resistance on the spaceship scale (front/central/rear). Multiply by 10 for personal-scale DR.',
  'Range': 'FTL rating, if the ship has a stardrive.',
  'Cost': 'Sum of all system, weapon and feature costs.',
  'Top air speed': 'Atmospheric speed — needs wings, contragravity, or acceleration above local gravity.',
  'Delta-V': 'Total velocity change the fuel supply allows. Spend it to speed up, slow down, and match orbits.',
  'Power Points': 'High-energy systems [!] each need one Power Point when running. Provided by reactors and solar panels.',
  'Complexity': 'Rating of the ship’s computer network, from the control room.',
  'Comm/sensor': 'Comm/sensor array level — the ship’s eyes; higher is better at detection and communication.',
  'Workspaces': 'Maintenance stations that must be crewed by technicians on long voyages.',
};
