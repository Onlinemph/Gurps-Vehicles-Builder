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
  'df-mover': 'The pilot making a move this turn. Their acceleration bonus (+1 per 25G) is added to the contest.',
  'df-opponent': 'The ship being outflown. It resists with its own Pilot skill and acceleration bonus.',
  'df-maneuver': 'What the mover is trying to do. Each maneuver is a quick contest of Pilot skill: both roll, higher margin of success wins.',
  'df-stunt': 'A flashy second Pilot roll before the contest — threading an asteroid gap, skimming a hull. Every -2 of risk adds +1 to the contest if it works; failing puts you in an uncontrolled drift (or wrecks the engines on a bad failure).',
  'df-intim': 'The commanding officer\'s Intimidation skill, for hailing the enemy with a threat. Looming over a smaller ship helps: +1 per size category you outclass them by.',
  'df-will': 'The enemy crew\'s Will. Beat it and they fight defensively; beat it by 5 or more and they break and run.',
  'bb-ship': 'The ship in orbit doing the shooting. Its Gunner skill applies at -4, and lining up the shot takes 20 seconds.',
  'bb-weapon': 'Which beam battery fires at the surface. Only weapons that can reach Long range can bombard from orbit.',
  'bb-beamtype': 'The beam type sets the damage dice. Ground damage is five times the rolled dDamage, delivered as an explosion.',
  'cmd-a': 'The ship your commanding officer directs the battle from.',
  'cmd-b': 'The opposing flagship, home of the enemy commander.',
  'cmd-a-skill': 'Your commander\'s Tactics skill, and how they use it: straight, Desperate (+2 but weaker defenses), or Cunning (-3 but double the winnings — and each extra Cunning gambit this fight is another -2, because the enemy learns your tricks).',
  'cmd-b-skill': 'The enemy commander\'s Tactics skill and approach.',
  'cmd-lead': 'The commander\'s Leadership skill, used for rousing speeches and for coordinating damage-control teams.',
};

export const COMBAT_OPTION_HELP = {
  'atk-situation': {
    rendezvous: 'Docked or matched course at arm\'s length — you cannot miss.',
    formation: 'Flying formation, or a missile salvo on final approach: point-blank.',
    collision: 'Head-on pass: closing so fast the window to shoot is brief.',
    engaged: 'A dogfight — both ships actively maneuvering against each other.',
    neutral: 'Neither ship has committed to a fight: long-range sparring, -8 to hit in Psi-Wars.',
    hugging: 'Psi-Wars point-blank: flying right down their hull. No range penalty — and torpedoes hurt.',
  },
  'w-mode': {
    single: 'One aimed shot per weapon.',
    rapid: 'Hose the target: more shots for a bonus to hit, but each costs ammunition or capacitor charge.',
    veryRapid: 'Maximum rate of fire — the biggest to-hit bonus and the fastest way to empty the magazine.',
  },
  'w-beamtype': {
    laser: 'The workhorse: accurate, decent range, halves armor (÷2).',
    uvLaser: 'Shorter wavelength, better focus: one range column better than a laser.',
    xrayLaser: 'Punches armor at ÷5 and burns through to internals.',
    graser: 'Gamma-ray laser: ÷10 armor — almost nothing stops it.',
    heatRay: 'A superscience thermal beam: no armor divisor, raw burn.',
    particle: 'Charged particles: shorter ranged and less accurate, but ÷5 armor and radiation.',
    antiparticle: 'Antimatter particles: double damage dice with explosive, irradiating hits.',
    ghostParticle: 'Superscience: ignores armor entirely (÷∞) — only bulk stops it.',
    plasma: 'A short-ranged fire hose of star-stuff: double dice, explosive, but sAcc -6.',
    graviton: 'Superscience gravity beam: ignores armor but only a tenth of the output reaches as damage.',
    tractor: 'No damage — grabs and holds the target instead.',
    conversion: 'TL12 superscience: ÷10 armor with a corrosive follow-up.',
    disintegrator: 'The ultimate: ignores armor, dissolves matter.',
    lightning: 'A crackling TL7 superscience arc — cheap, short-ranged, surge effects.',
  },
  'w-psimissile': {
    lightMissile: 'A 20cm shipkiller for fighters: small warhead but armor-piercing (÷10).',
    lightTorpedo: 'A 20cm torpedo: a huge slow warhead (6d×20) that armor resists normally. Racks fire every other turn.',
    mediumMissile: 'The 40cm standard anti-ship missile: 6d×2 at ÷10 armor.',
    mediumTorpedo: 'A 40cm capital-ship killer: 6d×40. Halve it against hardened armor.',
    heavyMissile: 'An 80cm precision lance: 6d×4 at ÷10 — cracks any armor belt.',
    heavyTorpedo: 'The 80cm dreadnought-buster: 6d×80. Nothing shrugs this off.',
  },
  'df-maneuver': {
    close: 'Chase them down. Win: you are Engaged (Close range). Win by 10+, or win while already engaged: you are Advantaged — on their tail.',
    evade: 'Break away. Your acceleration bonus doubles; winning shakes the pursuer off (and evasive flying gives +1 dodge).',
    hold: 'Fly your course. Contest only matters to shake an Advantaged pursuer off your tail.',
    retreat: 'Leave the battle. You must first break every engagement on you — then win the contest to escape.',
  },
  'df-stunt': {
    0: 'No stunt — fly it straight.',
    '-2': 'A small flourish: +1 to the contest if the Pilot roll at -2 succeeds.',
    '-4': 'Risky: +2 if the roll at -4 succeeds.',
    '-6': 'Daring: +3 at -6.',
    '-8': 'Reckless: +4 at -8.',
    '-10': 'Legendary: +5 at -10 — miss badly and you wreck your own engines.',
  },
};

export const COMBAT_SECTION_HELP = {
  Dogfight: 'Psi-Wars flying is a duel of Pilot skill. Pick who is making a move and against whom, choose the maneuver (add a stunt if you dare), and roll the contest — engagement and Advantaged status update on the ship cards, and being on someone\'s tail stacks up to +4 to hit. The second row is for drama: a commander can Issue a Threat to break the enemy\'s nerve, or you can simply Ram them — both ships take (lowest dST)d damage, and force screens do not help.',
  Command: 'The battle of wits above the battle of ships. Turn order runs small-to-big: fighters and corvettes act before capitals and dreadnoughts, sharpest pilot first. A Contest of Tactics between the commanders banks a pool of +1 bonuses for the winner to spend on any rolls (Desperate and Cunning Tactics raise the stakes; a precognitive or telepathic commander sees it coming). Leadership can Inspire the crew (+1 to everyone on a success by 5+) or Supervise damage control (+1 to the next jury-rig).',
  'Orbital bombardment': 'Blasting the planet you are fighting over: any beam that reaches Long range can fire at the surface at -4 after 20 seconds of lining up. A hit lands five times its rolled dDamage as an explosion; a miss scatters 10 yards per point it missed by.',
  Encounter: 'Set the stage first: pick the combat scale and turn length (and the ruleset, if your table uses Psi-Wars). Then add ships from the toolbar above — presets, saved designs, or imported JSON.',
  Attack: 'Resolving fire takes three steps, just like at the table: (1) Roll attack — gunner skill plus every modifier below. (2) The target may dodge (or, against Psi-Wars missiles, roll point defense) to shake off hits. (3) Roll damage & apply — armor soaks, the rest penetrates, and damaged systems shut down automatically on each ship\'s card. In Psi-Wars, a player-character ship that just got mauled can spend a character point on a Flesh Wound to shrug it off as a graze.',
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

export const TAC_OPTION_HELP = {
  'tac-scale': {
    0: 'Knife-fight scale: 10 miles per hex. Beams reach far across the map; ships cross it in a blink.',
    1: 'The standard battle: 100 miles per hex.',
    2: 'Fleet actions: 1,000 miles per hex — long-range beams and missile waves.',
    3: 'Orbital distances: 10,000 miles per hex. Only the biggest weapons matter.',
  },
  'tac-turn': {
    '20s': 'Frantic 20-second turns: little movement, few shots, lots of decisions.',
    '1m': 'One-minute turns: the dogfighting standard.',
    '3m': 'Three-minute turns: velocities triple and rate of fire climbs.',
    '10m': 'Ten-minute turns: ships streak across the map between shots.',
  },
};

export const TAC_SECTION_HELP = {
  Round: 'Ships act in Move order each round. Newtonian movement: your velocity vector carries over — thrust only changes it. Spend thrust to accelerate, brake, or turn, then fire. When everyone has acted, advance the round and any missiles in flight chase their targets.',
  Attack: 'Click your ship, then click an enemy to target it. Range is counted in hexes on the map and converted to the standard to-hit modifier automatically; beams also have a hard maximum reach in hexes.',
  Log: 'Every move, shot, and kill on the map, in order — the session record.',
};
