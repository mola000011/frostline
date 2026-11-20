// FROSTLINE / IRONHOLD — tuning, palette, districts, missions, shops, radio.
// One place for every number and name the rest of the game reads.

export const VIEW = { width: 1280, height: 720 };
export const WORLD = { width: 3200, height: 2400, lakeY: 1560 };
export const STEP = 1 / 60;
export const SAVE_KEY = 'frostline.save.v1';
export const BEST_KEY = 'frostline.best.v1';

export const PALETTE = {
  night: '#071223',
  nightDeep: '#050b14',
  navy: '#0E2242',
  navyLight: '#16304F',
  ice: '#A9C8DD',
  iceDeep: '#7FA9C6',
  icePale: '#C3DCEC',
  road: '#232A31',
  roadLine: '#C9A227',
  asphalt: '#2B333B',
  amber: '#FFB347',
  amberBright: '#FFC46B',
  amberDim: '#B4762A',
  red: '#FF3B30',
  blue: '#2E7CF6',
  star: '#FFC93C',
  snow: '#EAF2FF',
  text: '#F4F8FF',
  muted: '#8FA9BE',
  panel: '#0A1524',
  health: '#37C978',
  cash: '#7BE3A8',
  building: '#0A1524',
  buildingB: '#0D1B2E',
  window: '#FFB347',
  truck: '#2C4A55',
  police: '#E8EDF2',
};

export const FONT = '"DejaVu Sans", "Arial Black", sans-serif';
export const FONT_HEAVY = '900 ';

// Districts of Ironhold, a snowbound industrial rust-belt city on a frozen lake.
export const DISTRICTS = [
  { name: 'HARBOR', x: 0, y: 1000, w: 700, h: 560, tint: '#0B1B2C' },
  { name: 'FACTORY ROW', x: 700, y: 0, w: 800, h: 600, tint: '#0C1626' },
  { name: 'DOWNTOWN', x: 1400, y: 600, w: 1000, h: 900, tint: '#0E1F38' },
  { name: 'OLD TOWN', x: 2400, y: 0, w: 800, h: 1560, tint: '#0A1828' },
  { name: 'FROZEN LAKE', x: 0, y: 1560, w: 3200, h: 840, tint: '#8FB4CC' },
];

// The ice road: a ploughed diagonal across the frozen lake, from the south shore
// docks up to the harbor road. Driveable, faster than open ice, less grip than asphalt.
export const ICE_ROAD = { x1: 260, y1: 2350, x2: 2860, y2: 1600, halfWidth: 78 };

export const STREETS_X = [200, 600, 1000, 1400, 1800, 2200, 2600, 3000];
export const STREETS_Y = [200, 600, 1000, 1400];
export const ROAD_HALF = 48;

export const PLACES = {
  garage: { x: 1500, y: 210, label: 'GARAGE', color: '#FFB347' },
  gunShop: { x: 1020, y: 1010, label: 'GUN SHOP', color: '#FF6B5E' },
  clothes: { x: 2620, y: 610, label: 'OUTFITTERS', color: '#B48CFF' },
  safehouse: { x: 2440, y: 1320, label: 'SAFEHOUSE', color: '#37C978' },
  harbor: { x: 380, y: 1210, label: 'HARBOR DOCKS', color: '#7BE3A8' },
  clinic: { x: 2820, y: 1210, label: 'CLINIC', color: '#FF8FA3' },
  vault: { x: 1900, y: 800, label: 'IRONHOLD VAULT', color: '#FFC93C' },
  factory: { x: 1000, y: 300, label: 'COLD STORAGE', color: '#8FA9BE' },
};

// Respect ranks: cash + missions completed raise respect.
export const RANKS = [
  { at: 0, name: 'ROOKIE' },
  { at: 150, name: 'WHEELMAN' },
  { at: 400, name: 'SMUGGLER' },
  { at: 800, name: 'ICE RUNNER' },
  { at: 1400, name: 'KING OF THE LAKE' },
];

export function rankFor(respect) {
  let rank = RANKS[0];
  for (const r of RANKS) if (respect >= r.at) rank = r;
  return rank;
}

// The campaign: 8 story missions. Steps are scripted objectives the tracker shows.
export const MISSIONS = [
  {
    id: 1, name: 'FIRST SNOW', reward: 300, respect: 120,
    brief: 'Vera needs a driver. Get to the downtown meet before the thaw.',
    steps: [
      { type: 'goto', x: 1900, y: 1000, label: 'Drive to the downtown meet' },
      { type: 'goto', x: 2440, y: 1320, label: 'Drop Vera at the safehouse' },
    ],
  },
  {
    id: 2, name: 'ICE-ROAD RUN', reward: 650, respect: 180,
    brief: 'Smuggle the cargo across the frozen lake. Stay on the ice road, stay quiet.',
    steps: [
      { type: 'pickup', x: 380, y: 1210, label: 'Collect the cargo at Harbor Docks', hold: 2 },
      { type: 'goto', x: 2440, y: 1320, label: 'Deliver across the ice road' },
    ],
  },
  {
    id: 3, name: 'COLD STORAGE', reward: 800, respect: 220,
    brief: 'Steal the reefer truck from Factory Row. The guards nap at 2 AM.',
    steps: [
      { type: 'steal', x: 1000, y: 300, label: 'Steal the reefer truck' },
      { type: 'goto', x: 2440, y: 1320, label: 'Bring it to the safehouse' },
    ],
  },
  {
    id: 4, name: 'BLACKOUT', reward: 950, respect: 260,
    brief: 'Downtown goes dark. Lose the cops and vanish into Old Town.',
    steps: [
      { type: 'wanted', level: 3, label: 'Get the heat off: reach 3 stars, then escape' },
      { type: 'escape', x: 2820, y: 300, label: 'Reach the Old Town hideout unseen' },
    ],
  },
  {
    id: 5, name: 'HARBOR LIGHTS', reward: 1200, respect: 300,
    brief: 'The harbor heist. Grab the crate, outrun the patrol boats on the ice.',
    steps: [
      { type: 'pickup', x: 380, y: 1210, label: 'Grab the crate at the docks', hold: 3 },
      { type: 'goto', x: 1500, y: 210, label: 'Stash it at the garage' },
    ],
  },
  {
    id: 6, name: 'RESCUE ON THE ICE', reward: 1400, respect: 340,
    brief: 'Milo is stranded mid-lake in the blizzard. Bring him to the clinic.',
    steps: [
      { type: 'goto', x: 1600, y: 2000, label: 'Reach Milo on the frozen lake' },
      { type: 'goto', x: 2820, y: 1210, label: 'Drive Milo to the clinic' },
    ],
  },
  {
    id: 7, name: 'BLIZZARD CHASE', reward: 1800, respect: 420,
    brief: 'Four stars, a helicopter, and a blizzard. Survive 90 seconds.',
    steps: [
      { type: 'survive', seconds: 90, level: 4, label: 'Survive the blizzard chase (90s)' },
      { type: 'goto', x: 2440, y: 1320, label: 'Lay low at the safehouse' },
    ],
  },
  {
    id: 8, name: 'THE IRONHOLD JOB', reward: 3200, respect: 600,
    brief: 'The vault. The whole lake. Five stars. One way out: across the ice.',
    steps: [
      { type: 'pickup', x: 1900, y: 800, label: 'Crack the Ironhold Vault', hold: 4 },
      { type: 'goto', x: 1600, y: 2050, label: 'Escape across the frozen lake' },
      { type: 'goto', x: 380, y: 1210, label: 'Vanish at the Harbor Docks' },
    ],
  },
];

export const RADIO = [
  { name: 'FROST FM 88.1', desc: 'Lake City synth', tempo: 132, scale: [0, 3, 5, 7, 10] },
  { name: 'IRONHOLD ROCK 94.7', desc: 'Rust-belt guitars', tempo: 96, scale: [0, 2, 3, 7, 8] },
  { name: 'NORTHLIGHT 101.3', desc: 'Midnight jazz', tempo: 72, scale: [0, 2, 4, 7, 9] },
];

export const GARAGE_ITEMS = [
  { id: 'engine1', name: 'Tuned Engine Mk I', price: 400, desc: '+15% top speed' },
  { id: 'engine2', name: 'Tuned Engine Mk II', price: 900, desc: '+30% top speed', needs: 'engine1' },
  { id: 'armor1', name: 'Plated Doors', price: 500, desc: '+40 max health' },
  { id: 'armor2', name: 'Armored Hull', price: 1100, desc: '+100 max health', needs: 'armor1' },
  { id: 'paintAmber', name: 'Amber Flare Paint', price: 150, desc: 'Turn heads' },
  { id: 'paintIce', name: 'Glacier Blue Paint', price: 150, desc: 'Blend with the lake' },
  { id: 'tires', name: 'Studded Ice Tires', price: 350, desc: 'Grip on the frozen lake' },
];

export const GUN_ITEMS = [
  { id: 'pistol', name: 'Pistol', price: 0, desc: 'Standard sidearm' },
  { id: 'smg', name: 'Frost SMG', price: 600, desc: 'Fast fire, short range' },
  { id: 'shotgun', name: 'Harbor Shotgun', price: 850, desc: 'Heavy spread' },
];

export const OUTFITS = [
  { id: 'parka', name: 'Snow Parka', price: 0, color: '#2C4A55' },
  { id: 'amber', name: 'Amber Bomber', price: 120, color: '#B4762A' },
  { id: 'navy', name: 'Navy Longcoat', price: 200, color: '#16304F' },
  { id: 'ice', name: 'Glacier White', price: 250, color: '#C3DCEC' },
];

export const CAR_MODELS = [
  { name: 'SABLE SEDAN', color: '#22364A', speed: 1.0, accel: 1.0 },
  { name: 'RUST PICKUP', color: '#5A3A28', speed: 0.92, accel: 0.9 },
  { name: 'FROST COUPE', color: '#7FA9C6', speed: 1.12, accel: 1.1 },
  { name: 'REEFER TRUCK', color: '#2C4A55', speed: 0.85, accel: 0.8, truck: true },
  { name: 'HARBOUR VAN', color: '#4A5A3A', speed: 0.9, accel: 0.85, truck: true },
  { name: 'LAKE TAXI', color: '#C9A227', speed: 1.02, accel: 1.0 },
];

export const PLAYER = {
  walkSpeed: 170,
  runSpeed: 260,
  carAccel: 320,
  carBrake: 520,
  carMax: 420,
  carReverse: 160,
  steer: 2.6,
  radius: 13,
};

export const WANTED = {
  decayPerSec: 0.045,
  stealCar: 1,
  hitPed: 1,
  shoot: 1,
  maxPolice: [0, 2, 3, 4, 5, 6],
  heliAt: 4,
  roadblockAt: 3,
};

export const GAME_DATE = '19 NOVEMBER 2026';
export const GAME_CITY = 'IRONHOLD';
