// ---------------------------------------------------------------------------
// Explain-mode content for the streamlined designer.
// ---------------------------------------------------------------------------

export const SECTION_HELP = {
  'Basics': 'The kind of machine you are building and how big a frame it sits on. The frame capacity is your weight budget — everything else spends it.',
  'Propulsion': 'What makes it go: pick an engine technology and how much power, and carry enough fuel (or battery) for the range you want.',
  'Armor': 'Protective plating. DR (Damage Resistance) is how many points of damage each hit loses before it hurts the vehicle.',
  'Crew & Payload': 'Who and what it carries. People and cargo consume the frame’s weight budget just like machinery.',
  'Accessories': 'Optional fittings — each adds weight and cost, some add capabilities or fix problems (like fire suppression removing the “f”).',
  'Equipment': 'Anything else with a weight and a price: custom gear, or real components pulled from the official GVB data files.',
  'Weapons': 'Armament and its mounting. Turrets traverse freely but double the installed weight; pintle mounts are cheap but exposed.',
};

export const FIELD_HELP = {
  'f-name': 'Whatever you want to call the design.',
  'f-tl': 'Tech Level — the engineering era. TL5 is steam (~1850s), TL6 WWII, TL7 Cold War, TL8 the present, TL9+ the future. It gates which engines, armor materials and accessories exist, and how good they are.',
  'f-chassis': 'The fundamental type of vehicle: what it rolls, floats or flies on. Sets base handling, speed factors, hull shape and which rules apply.',
  'f-maxlwt': 'Frame capacity: the maximum the vehicle can weigh fully loaded. This is your design budget — structure, engine, armor, fuel, people and cargo all spend pounds against it.',
  'f-quality': 'How the frame is built: Standard is normal; Lightweight uses pricier materials to free up budget; Heavy-Duty is cheap, rugged (+1 HT) but heavy.',
  'f-streamlining': 'The body shape’s slipperiness. Streamlined adds ~15% top speed; boxy loses 10%. Matters most above 50 mph.',
  'f-cab': 'Where the crew sits: enclosed behind glass, in an open cockpit, or fully exposed like a motorcycle rider (who can be targeted directly).',
  'f-wheels': 'How many wheels. Mostly flavor here — it shows up in the hit-location string.',
  'f-length': 'Overall length, used to find the Size Modifier. Auto estimates it from weight and vehicle type.',
  'f-engine': 'The powerplant technology: what it burns (or doesn’t), how heavy it is per horsepower, and its fire risk.',
  'f-power': 'Rated engine output. More horsepower per ton = faster: top speed scales with the square root of hp/ton.',
  'f-fuel': 'Fuel carried, as weight. More fuel = more range, less budget for everything else. For electric vehicles this is battery weight instead.',
  'f-armor-material': 'What the plate is made of. Better materials protect the same for less weight — at a much higher price per pound.',
  'f-dr-all': 'Convenience: set every facing to one DR value.',
  'f-dr-front': 'DR on the front facing — where most hits come from in a chase or charge.',
  'f-dr-sides': 'DR on each side.',
  'f-dr-rear': 'DR on the rear facing.',
  'f-dr-top': 'DR on the roof — matters against attacks from above.',
  'f-dr-under': 'DR on the belly — mines and blasts from below.',
  'f-crew': 'People needed to run the vehicle (driver, gunner...). Each weighs 200 lbs with gear and gets a crew station.',
  'f-passengers': 'People just riding along, 200 lbs each with gear.',
  'f-cargo': 'Cargo capacity in pounds — hauling budget reserved for stuff rather than people.',
};

export const OPTION_HELP = {
  'f-chassis': {
    wheeled: 'Selected: a car or truck — fast and cheap on roads, mediocre off them.',
    motorcycle: 'Selected: two wheels, one exposed rider — agile (+1 Hnd) but fragile (SR 2).',
    tracked: 'Selected: tank-style tracks — slower, but stable and at home off-road.',
    halftrack: 'Selected: front wheels + rear tracks, the WWII compromise.',
    hovercraft: 'Selected: rides an air cushion over land or water — fast, but clumsy (-2 Hnd).',
    boat: 'Selected: a displacement hull — speed is capped at hull speed (1.55 × √length in feet).',
    planingBoat: 'Selected: a speedboat hull that skims the surface — needs 20+ hp/ton to get on plane.',
    submarine: 'Selected: a submersible — needs electric or fusion power to run underwater.',
    airplane: 'Selected: fixed wings — needs 40+ hp/ton to fly, and a runway (see stall speed).',
    helicopter: 'Selected: rotors — hovers, but needs 60+ hp/ton and tops out around 220 mph.',
    airship: 'Selected: a lighter-than-air gasbag — huge, slow (90 mph cap), ponderous (-2 Hnd).',
  },
  'f-engine': {
    gasoline: 'Selected: light and cheap, but flammable — your HT gets an “f”.',
    diesel: 'Selected: heavier than gasoline but not flammable, sips fuel.',
    gasTurbine: 'Selected: very light per hp and thirsty — helicopter/tank territory (TL7+).',
    steam: 'Selected: massive TL5 technology burning coal or wood.',
    electric: 'Selected: quiet, no fire risk; range comes from battery weight and improves enormously with TL.',
    fusion: 'Selected: TL10+ reactor — effectively unlimited range.',
    sail: 'Selected: wind power for boats — free, unlimited range, hull-speed pace.',
    pedal: 'Selected: muscle power — 0.4 hp per crew member.',
  },
  'f-armor-material': {
    wood: 'Selected: heavy, flammable, cheap — TL5 improvisation.',
    iron: 'Selected: early plate, heavy for what it stops.',
    steel: 'Selected: honest structural steel.',
    hardSteel: 'Selected: face-hardened armor steel — the TL6 warfighting standard.',
    aluminum: 'Selected: light alloy — good protection per pound at a higher price.',
    titanium: 'Selected: aerospace armor — light and very expensive (TL7+).',
    composite: 'Selected: layered ceramics/fibers (TL8) — half the weight of steel.',
    advComposite: 'Selected: TL9 advanced laminates — a third of steel’s weight.',
    nanoweave: 'Selected: TL10 nanocomposite — a tenth of steel’s weight, princely cost.',
  },
};

export const STAT_HELP = {
  'ST/HP': 'Hit points — how much damage the vehicle takes before it starts dying. From 4 × cube root of empty weight.',
  'Hnd/SR': 'Handling: bonus/penalty to driving rolls. Stability Rating: how hard it is to skid or roll.',
  'HT': 'The vehicle’s “constitution” for breakdown rolls. “f” = flammable fuel aboard.',
  'Move': 'Acceleration / top speed in yards per second (mph ÷ 2).',
  'LWt.': 'Loaded weight in tons — everything aboard.',
  'Load': 'Payload capacity in tons: occupants plus cargo.',
  'SM': 'Size Modifier: the to-hit bonus for shooting at it. +3 is car-sized.',
  'Occ.': 'Occupants: crew + passengers.',
  'DR': 'Damage Resistance by facing (front/sides/rear/top/under): points of damage stopped per hit.',
  'Range': 'How far it travels on full fuel at cruise speed.',
  'Cost': 'Total price, including 20% assembly.',
  'Locations': 'Hit locations: G glazed cab, O open cab, E exposed riders, nW wheels, C tracks, T turret, t open mount, X fixed weapon, Wi wings, R rotors, M masts, Sk skirts, r retractable gear.',
};
