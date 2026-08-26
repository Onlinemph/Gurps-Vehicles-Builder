// ---------------------------------------------------------------------------
// Explain-mode content for the combat tracker (combat.html) and the tactical
// hex map (tactical.html). Plain-English notes on what each control means at
// the table, shown by js/help-core.js when Explain mode is on.
// ---------------------------------------------------------------------------

export const COMBAT_FIELD_HELP = {
  'add-preset': 'Drop a ready-made ship into the fight. "PW:" entries are from Mailanka\'s fan-made Psi-Wars setting.',
  'add-saved': 'Add a design you saved in the ship designer on this browser.',
  'enc-scale': 'How far apart the fleets fight. Basic combat abstracts distance into range bands; the scale sets how many miles each band covers and the default closing speeds.',
  'enc-turn': 'How much real time one combat turn covers. Longer turns give more shots per attack (higher rate of fire) and a better Dodge, because there is more time to maneuver.',
  'enc-ruleset': 'Which combat rules to run. "GURPS Spaceships" is the basic system from SS1 ch. 4. "Psi-Wars simplified" is Mailanka\'s fan-made space-opera layer: ships fight in size categories (Fighter/Corvette/Capital/Dreadnought), ranges collapse to Neutral/Engaged/Hugging, big ships halve penetrating damage, and missiles use a fixed damage table.',
  'atk-ship': 'Who is shooting. Only ships with a working, undamaged weapon battery can fire.',
  'atk-weapon': 'Which battery fires. Each weapon system on the ship shows up here with its mount and power.',
  'atk-target': 'Who is being shot at. Their size, facing, ECM, and maneuver all change the roll.',
  'atk-situation': 'The tactical situation, which stands in for range. Attacking a ship that isn\'t engaging you back is much harder than a dogfight; in Psi-Wars, Neutral is -8, Engaged is -4, and Hugging (point-blank) has no penalty.',
  'w-beamtype': 'What kind of energy weapon this battery mounts. It sets accuracy, range, and the armor divisor — how well the beam burns through armor.',
  'w-guntype': 'Conventional cannon, railgun, or coilgun. Sets accuracy and recoil from the gun\'s caliber.',
  'w-warhead': 'What the shell or missile carries. Conventional warheads scale with impact speed; nuclear ones do fixed (very large) damage.',
  'w-psimissile': 'Psi-Wars munition from the fixed table. Missiles are armor-piercing (divisor 10) but small; torpedoes are huge warheads that armor resists normally — and torpedo racks fire every other turn (half shots).',
  'w-mode': 'Rapid and very rapid fire trade ammunition or capacitor charge for a bonus to hit.',
  'w-shots': 'How many shots this attack fires. More shots means more potential hits: every full multiple of the weapon\'s Recoil in your margin of success lands one extra shot.',
  'w-velocity': 'How fast the projectile closes with the target, in miles per second. Kinetic damage scales directly with speed — velocity IS the warhead for solid shot.',
  'tac-scale': 'The size of one map hex, if your group plays on the SS3 hex grid instead of range bands.',
  'tac-hexes': 'Distance to the target in hexes. The calculator turns it into the standard GURPS range penalty.',
  't-slot': 'Which system slot (1-6, counting down the hull) a precision attack aims for.',
};

export const COMBAT_SECTION_HELP = {
  Encounter: 'Set the stage first: pick the combat scale and turn length (and the ruleset, if your table uses Psi-Wars). Then add ships from the toolbar above — presets, saved designs, or imported JSON.',
  Attack: 'Resolving fire takes three steps, just like at the table: (1) Roll attack — gunner skill plus every modifier below. (2) The target may dodge to shake off hits. (3) Roll damage & apply — armor soaks, the rest penetrates, and damaged systems shut down automatically on each ship\'s card.',
  'Combat log': 'A running record of every roll, hit, and system knocked out — copy it into your session notes when the dust settles.',
  'Tactical range calculator': 'For groups playing on a hex map (GURPS Spaceships 3) instead of abstract range bands: convert hex distance into the to-hit range modifier.',
};

export const TAC_FIELD_HELP = {
  'add-preset': 'Place a ready-made ship on the map. "PW:" entries are from Mailanka\'s fan-made Psi-Wars setting.',
  'add-saved': 'Place a design you saved in the ship designer on this browser.',
  'tac-scale': 'How many miles one hex covers. Bigger hexes mean the same engine produces fewer hexes of movement per turn, and beams reach fewer hexes.',
  'tac-turn': 'How much real time one map turn covers. Longer turns multiply every velocity — ships streak across the map — and raise each weapon\'s shots per attack.',
  'atk-weapon': 'Which of the selected ship\'s batteries fires at the target.',
  'atk-extra': 'The specific beam or munition type, which sets accuracy, reach in hexes, and armor penetration.',
  'atk-shots': 'Shots fired this attack. Margin of success over the weapon\'s Recoil lands extra hits.',
  'atk-skill-in': 'The firing ship\'s Gunner skill. A trained professional is 12; an ace is 15+.',
};

export const TAC_SECTION_HELP = {
  Round: 'Ships act in Move order each round. Newtonian movement: your velocity vector carries over — thrust only changes it. Spend thrust to accelerate, brake, or turn, then fire. When everyone has acted, advance the round and any missiles in flight chase their targets.',
  Attack: 'Click your ship, then click an enemy to target it. Range is counted in hexes on the map and converted to the standard to-hit modifier automatically; beams also have a hard maximum reach in hexes.',
  Log: 'Every move, shot, and kill on the map, in order — the session record.',
};
