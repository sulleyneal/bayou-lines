/* ============================================================
   BAYOU LINES — data.js
   All game content lives here. Edit freely; it's just lists.
   Loaded as a classic script (no modules), exposes window.DATA.
   ============================================================ */
(function () {
  "use strict";

  /* ---------- TUNING CONSTANTS ----------
     One place to fiddle with feel. Nothing here can punish the
     player; the worst case is "it takes one more lazy Saturday." */
  const CONFIG = {
    saveKey: "bayou-lines-save-v2",
    dayLengthMs: 20 * 60 * 1000,   // full dawn→night→dawn loop (~20 min)
    junkPity: [3, 8],              // bucks for hauling litter, technically
    baseWaitMs: [4000, 13000],     // how long the bobber sits before a nibble
    nibbleMs: [900, 2500],         // nibble → bite delay
    legendaryPB: true,             // legendaries always feel like an event
    timeBiasMult: 2.0,             // how much a favored time-of-day helps odds
    currentBias: 0.78,             // river locations: slightly shorter windows
  };

  /* ---------- TIME OF DAY ----------
     The cycle is a 0..1 fraction. These phases drive the catch
     bias and the little hint line, not a spreadsheet. */
  const PHASES = [
    { id: "dawn",   label: "dawn",         from: 0.00, hint: "Mist on the water. The early bite is a rumor worth chasing." },
    { id: "day",    label: "midday",       from: 0.18, hint: "Sun's up. Bass are lazy, bluegill are bold." },
    { id: "golden", label: "golden hour",  from: 0.55, hint: "That gold light. Bass get ambitious around now." },
    { id: "dusk",   label: "dusk",         from: 0.72, hint: "Bugs coming off the water. Everything's hungry at dusk." },
    { id: "night",  label: "night",        from: 0.82, hint: "Catfish own the dark. Bring patience and a thermos." },
  ];

  /* ---------- SHARED FLAVOR (used when a location adds nothing special) ---------- */
  const GENERIC = {
    nibble: [
      "Something's sniffing around down there…",
      "Movement. Stay cool. Cooler than that.",
      "A nibble. Do not check your email right now.",
      "Interest detected. The bobber knows things.",
    ],
    miss: [
      "It got away. It happens. The bayou keeps no score.",
      "Gone. Probably told its friends. Free marketing.",
      "Missed it — but the sit was the point anyway.",
      "It spit the hook. Bold move. Recast whenever.",
    ],
    breakoff: [
      "Whatever that was, it kept the lure and your respect. The line just wasn't ready.",
      "It tested the line, found it wanting, and left without a word. Spool up heavier sometime.",
      "Too much fish for too little line. The bayou bats last. No harm done.",
    ],
  };

  /* ============================================================
     SPECIES
     Reusable fish definitions. A location lists which species it
     holds and with what rarity weight. `value` = bucks per pound.
     `time` = phases where this fish bites better (optional).
     `cls`  = 'common' | 'trophy' | 'legendary' (line gate).
     ============================================================ */
  const S = {
    bluegill: {
      name: "Bluegill", emoji: "🐟", w: [0.2, 1.1], value: 5, cls: "common",
      flavor: [
        "Small, scrappy, and convinced it's a state record.",
        "It glared at you the whole way in. Respect.",
        "A perch by any other name. Somebody'd name it anyway.",
      ],
    },
    redear: {
      name: "Redear Sunfish (Shellcracker)", emoji: "🐟", w: [0.3, 1.6], value: 6, cls: "common",
      time: ["day", "golden"],
      flavor: [
        "Shellcracker. Eats snails for a living, which is a whole personality.",
        "Bigger cousin of the bluegill, same chip on the shoulder.",
      ],
    },
    smallbass: {
      name: "Pond Bass", emoji: "🐠", w: [0.5, 2.6], value: 8, cls: "common",
      time: ["golden", "dawn"],
      flavor: [
        "A bass that hasn't read the tournament magazines yet.",
        "Half a pound of pure misplaced confidence.",
      ],
    },
    bream: {
      name: "Bream", emoji: "🐟", w: [0.3, 1.4], value: 6, cls: "common",
      flavor: [
        "Bream. The reason cane poles exist.",
        "Came in sideways and proud of it.",
      ],
    },
    crappie: {
      name: "White Crappie (Sac-au-lait)", emoji: "🐟", w: [0.5, 2.4], value: 11, cls: "common",
      flavor: [
        "Sac-au-lait. The official fish of 'we're eating good tonight.'",
        "Papermouth came in easy, like it had somewhere to be.",
        "Best fried. This is not a debate.",
      ],
    },
    blackcrappie: {
      name: "Black Crappie", emoji: "🐟", w: [0.6, 3.1], value: 13, cls: "common",
      time: ["dawn", "dusk"],
      flavor: [
        "Speckled and dignified. The crappie that went to college.",
        "Slab. The word exists specifically for this fish.",
      ],
    },
    largemouth: {
      name: "Largemouth Bass", emoji: "🐠", w: [1.0, 7.5], value: 14, cls: "common",
      time: ["golden", "dawn"],
      flavor: [
        "Jumped twice on the way in. Showoff.",
        "Inhaled it like a Friday afternoon RFI.",
        "Somewhere, a tournament angler just felt a disturbance.",
      ],
    },
    trophybass: {
      name: "Trophy Largemouth", emoji: "🐠", w: [7.0, 12.0], value: 22, cls: "trophy",
      time: ["golden", "dawn"],
      flavor: [
        "A double-digit fish. You'll be talking about this at the next plan review.",
        "Came up from the deep like it was reviewing your submittal. Approved.",
      ],
    },
    channelcat: {
      name: "Channel Catfish", emoji: "🐡", w: [2.0, 14.0], value: 9, cls: "common",
      time: ["night", "dusk"],
      flavor: [
        "Came in slow and grumpy, like a Monday morning kickoff meeting.",
        "Whiskers fully operational. Attitude: bayou standard.",
        "It fought like it was billing you hourly.",
      ],
    },
    bluecat: {
      name: "Blue Catfish", emoji: "🐡", w: [4.0, 28.0], value: 11, cls: "trophy",
      time: ["night"],
      flavor: [
        "Big blue. Came up off the channel bottom like a sunken pirogue.",
        "Tail like a canoe paddle. Forearms tomorrow: regret.",
      ],
    },
    flathead: {
      name: "Flathead Catfish", emoji: "🐡", w: [5.0, 40.0], value: 13, cls: "trophy",
      time: ["night"],
      flavor: [
        "Flathead. Yellow, mean, and built like a culvert.",
        "It went under a log on principle. You won anyway.",
      ],
    },
    spottedgar: {
      name: "Spotted Gar", emoji: "🐊", w: [2.5, 9.0], value: 7, cls: "common",
      flavor: [
        "A living fossil. Predates the permit process, barely.",
        "All teeth and bad intentions. Released with mutual respect.",
        "It's been in this bayou longer than the parish has had roads.",
      ],
    },
    longnosegar: {
      name: "Longnose Gar", emoji: "🐊", w: [3.0, 18.0], value: 9, cls: "trophy",
      flavor: [
        "A snout like a survey rod. Twice as hard to land.",
        "Armor-plated and unbothered. The original design-build.",
      ],
    },
    alligatorgar: {
      name: "Alligator Gar", emoji: "🐊", w: [20.0, 95.0], value: 16, cls: "trophy",
      time: ["dusk", "night"],
      flavor: [
        "A genuine river monster. You did not so much catch it as briefly detain it.",
        "Older than the levee system and far less likely to fail.",
      ],
    },
    bowfin: {
      name: "Bowfin (Choupique)", emoji: "🐉", w: [3.0, 12.0], value: 8, cls: "common",
      flavor: [
        "Choupique. Pure swamp violence on the end of a line.",
        "It tried to eat the bobber, the line, and possibly the boat.",
        "An apex grudge with fins.",
      ],
    },
    drum: {
      name: "Freshwater Drum (Gaspergou)", emoji: "🐟", w: [1.5, 15.0], value: 8, cls: "common",
      flavor: [
        "Gaspergou. Grunts at you on the way in. Rude, frankly.",
        "Drum. Has lucky-stone ear bones, which it would not share.",
      ],
    },
    whitebass: {
      name: "White Bass", emoji: "🐠", w: [0.5, 3.0], value: 9, cls: "common",
      time: ["dawn", "dusk"],
      flavor: [
        "Came through in a school, like a bid set with too many addenda.",
        "Scrappy little silver freight train.",
      ],
    },
    striper: {
      name: "Striped Bass", emoji: "🐠", w: [4.0, 30.0], value: 15, cls: "trophy",
      time: ["dawn", "dusk"],
      flavor: [
        "Striper. Hit it like a deadline you forgot about.",
        "Big water, big shoulders. Reeled like undoing a change order.",
      ],
    },
    // ---- saltwater / coastal ----
    redfish: {
      name: "Redfish (Red Drum)", emoji: "🐠", w: [2.0, 12.0], value: 16, cls: "common",
      time: ["golden", "dawn"],
      flavor: [
        "Copper-bright with that tail spot. The marsh's calling card.",
        "Tailed in the shallows, ate clean. Poetry with fins.",
      ],
    },
    speck: {
      name: "Speckled Trout", emoji: "🐟", w: [1.0, 6.0], value: 14, cls: "common",
      time: ["dawn", "dusk"],
      flavor: [
        "Specks. Soft mouth, hard to keep pinned. Worth it.",
        "Yellow-mouthed and elegant. The marsh's house specialty.",
      ],
    },
    flounder: {
      name: "Southern Flounder", emoji: "🐟", w: [1.0, 7.0], value: 15, cls: "common",
      time: ["day"],
      flavor: [
        "A doormat with both eyes on one side and zero on yours.",
        "Came up flat and indignant. Excellent table fare regardless.",
      ],
    },
    sheepshead: {
      name: "Sheepshead", emoji: "🐟", w: [1.5, 9.0], value: 12, cls: "common",
      flavor: [
        "Human teeth. We're not going to talk about the teeth.",
        "Convict-striped bait thief. You out-thieved it. Barely.",
      ],
    },
    blackdrum: {
      name: "Black Drum", emoji: "🐟", w: [3.0, 35.0], value: 11, cls: "trophy",
      flavor: [
        "Big drum. Hauled up like a sack of wet sediment, in the best way.",
        "Knuckle-headed and heavy. The marsh's structural engineer.",
      ],
    },
  };

  /* ============================================================
     LEGENDARIES — one (or more) named soul per location.
     Tiny encounter rate, big payout, big flavor.
     ============================================================ */
  const L = {
    turtle: {
      name: "The Bait-Stealing Turtle", emoji: "🐢", w: [4.0, 9.0], value: 4, cls: "common", legendary: true,
      flavor: [
        "He's done this before. He'll do it again. You both know the arrangement.",
        "Surfaced, made eye contact, took the bait, left. A professional.",
      ],
    },
    bartholomew: {
      name: "Bartholomew, the Lunker", emoji: "👑", w: [11.0, 16.5], value: 30, cls: "trophy", legendary: true,
      flavor: [
        "The legend himself. Locals say he's turned down better bait than yours.",
        "Bartholomew regarded you briefly, decided you'd earned this, and let it happen.",
        "Frame this one. Put it next to the P.E. stamp.",
      ],
    },
    cane: {
      name: "Old Cane, the Caney Giant", emoji: "👑", w: [13.0, 18.5], value: 40, cls: "legendary",
      legendary: true, time: ["golden"],
      flavor: [
        "The fish Caney Lake is quietly famous for. She's bigger than the rumor.",
        "She came up once, looked at the boat, and decided the story needed an ending.",
      ],
    },
    cypressking: {
      name: "The Cypress King", emoji: "🐉", w: [10.0, 16.0], value: 36, cls: "legendary",
      legendary: true, time: ["dusk", "night"],
      flavor: [
        "A choupique so old the cypress knees lean in to listen. Released, reverently.",
        "Pure black water given fins and a grudge. You met him. That's enough.",
      ],
    },
    drumming: {
      name: "The Ouachita Drummer", emoji: "🥁", w: [18.0, 32.0], value: 34, cls: "legendary",
      legendary: true,
      flavor: [
        "You felt the grunt through the hull before you saw it. Pure river bass note.",
        "An old gaspergou the size of an ice chest. It grumbled the whole way in.",
      ],
    },
    bigtex: {
      name: "Big Tex, the Bend Beast", emoji: "👑", w: [14.0, 21.0], value: 48, cls: "legendary",
      legendary: true, time: ["dawn", "golden"],
      flavor: [
        "Toledo Bend's worst-kept secret and best-kept fish. Twenty-something pounds of legend.",
        "Crossed two state lines of rumor to get here, and he was worth the drive.",
      ],
    },
    grandfather: {
      name: "Grandfather Gator-Gar", emoji: "🐲", w: [80.0, 160.0], value: 30, cls: "legendary",
      legendary: true, time: ["night"],
      flavor: [
        "Not a catch. A negotiation. He let go when he was good and ready, and so did you.",
        "Eight feet of Pleistocene patience. The Basin keeps its elders well.",
      ],
    },
    gator: {
      name: "An Alligator (briefly)", emoji: "🐊", w: [120.0, 400.0], value: 0, cls: "common", legendary: true,
      flavor: [
        "Immediately and mutually released. No hard feelings. Some soft ones.",
        "You did not catch this. You will tell people you caught this. Both things are true.",
      ],
    },
    bullred: {
      name: "The Old Bull Red of Venice", emoji: "👑", w: [30.0, 52.0], value: 44, cls: "legendary",
      legendary: true, time: ["dawn", "dusk"],
      flavor: [
        "A bull redfish with a tail spot like a thumbprint of God. Photographed and released.",
        "The whole marsh seems to go quiet for him. You'll understand when you see it.",
      ],
    },
    // the white whale — not bound to any water; only reachable through the chase (S5)
    grayghost: {
      name: "the Gray Ghost", emoji: "🐋", w: [62.0, 96.0], value: 0, cls: "legendary",
      legendary: true, ghost: true,
      flavor: [
        "Older than the name of the parish. You held it a moment in the moonlight, and you let it go.",
        "Not a catch. A meeting. Some things you don't keep — you just get to say you stood with one.",
        "Pale as river fog, scarred by a hundred broken lines. It looked at you like it knew your grandfather.",
      ],
    },
  };

  /* ============================================================
     GHOST — the Gray Ghost chase scenes (played manually, not by the
     normal story trigger). The endgame payoff for learning every water.
     ============================================================ */
  const GHOST = {
    ready: { id: "ghost_ready", who: "boudreaux", ch: 4, title: "A Night Like This", lines: [
      "You feel that? Moon's pulled tight, and you've fished every drop of water from the pond to the gulf. Learned it all.",
      "If the Gray Ghost is ever gonna show himself, it's a night exactly like this one. I got chills just sayin' it.",
      "Heavy line, son. The heaviest they make. He's parted every other kind. Now go keep a line wet, and… good luck. Lord, good luck." ] },
    nearMiss: { id: "ghost_nearmiss", who: "boudreaux", ch: 4, title: "You Had Him", lines: [
      "You felt that, didn't you. That wasn't a fish. That was THE fish. The whole rod doubled and the water went to boil.",
      "And then your line gave. They always give. He's stronger than anything you can buy at my table, that's the hell of it.",
      "Eighty-pound braid, son. The offshore stuff. Nothing less holds him. Get it, and get back out here on the next big moon." ] },
    finale: [
      { id: "ghost_win1", who: "boudreaux", ch: 4, title: "The Gray Ghost", lines: [
        "…I don't believe it. Fifty years on this water and I'm watchin' it with my own two eyes.",
        "You held him. You actually HELD him. Look at the size — look at the SCARS on him. Every one a line he broke. Every one a story like mine.",
        "Let him go, son. Quick, while the moon's still on him. He don't belong to anybody. Never did." ] },
      { id: "ghost_win2", who: "amelia", ch: 4, title: "Don't Name Him", lines: [
        "I'm not gonna name this one. You don't name the Gray Ghost. He's already got every name there is.",
        "Did you see his eye? Mr. Boudreaux's cryin' and tryin' to act like he ain't. Miss Darlene already started the fryer for everybody.",
        "Thank you for lettin' me see it. I'm gonna tell my grandkids I was here the night you stood with the Ghost." ] },
      { id: "ghost_win3", who: "darlene", ch: 4, title: "Humble, Out Here", lines: [
        "Mama was right. Good luck just to see him. And you let him swim off easy, no fuss, no braggin'.",
        "That's the whole secret, baby. The bayou gives the most to the ones who'd give it right back.",
        "Now come eat. The whole landing's down at the water. Tonight, the fish fry's on the house — for the one who met the Ghost and let him go." ] },
    ],
  };

  /* ============================================================
     JUNK — non-aquatic catches. Pity bucks, maximum flavor.
     ============================================================ */
  const JUNK = {
    // pond / general
    frisbee:   { name: "A faded Frisbee", emoji: "🥏", flavor: "Reads 'WORLD'S OKAYEST DAD.' Aim for the stars." },
    homework:  { name: "Somebody's homework", emoji: "📓", flavor: "Long division, mostly wrong. The bayou grades on a curve." },
    plans:     { name: "A roll of redlined plans", emoji: "📜", flavor: "Stamped REVISE AND RESUBMIT. Even out here. There is no escape." },
    cone:      { name: "One DOTD traffic cone", emoji: "🚧", flavor: "Slightly faded. Carries the quiet authority of a lane closure with no workers present." },
    culvert:   { name: '18" RCP culvert section', emoji: "🕳️", flavor: "Condition assessment: structurally deficient, hydraulically smug." },
    garmin:    { name: "Somebody's Garmin", emoji: "⌚", flavor: "Battery at 43%. Last activity: 'Morning Run' — 0.12 miles. We've all been there." },
    croc:      { name: "A single Croc, sport mode", emoji: "👟", flavor: "Strap back. Whoever lost this was moving with purpose." },
    hymnal:    { name: "Waterlogged church hymnal", emoji: "📖", flavor: "Opened to 'How Great Thou Art.' The bayou has taste." },
    boot:      { name: "A boot (the classic)", emoji: "🥾", flavor: "Tradition demands every fishing game include one boot. Compliance achieved." },
    mre:       { name: "Unopened MRE: 'Menu 12'", emoji: "🥫", flavor: "Jalapeño pepper jack beef patty. Floats, apparently. Concerning." },
    benchy:    { name: "A 3D-printed Benchy", emoji: "⛵", flavor: "Someone's first print, sailed off into legend. First layer looks decent, honestly." },
    lath:      { name: "Survey lath with flagging", emoji: "📍", flavor: "Pink flagging reads 'PROP. ROW.' The right-of-way claims even the water now." },
    bikehelmet:{ name: "A mountain-bike helmet", emoji: "🪖", flavor: "Mud-caked. Somewhere a rider is having a much worse Tuesday than you." },
    lawnchair: { name: "A folding lawn chair", emoji: "🪑", flavor: "One cupholder intact. Honestly the most useful thing you've caught all day." },
    license:   { name: "An expired fishing license", emoji: "🎫", flavor: "Lapsed 2019. The photo is somehow worse than yours. Comforting." },
    propane:   { name: "An empty propane bottle", emoji: "🧪", flavor: "Green, dinged, smells faintly of someone's better camping trip." },
    rcgauge:   { name: "A rusted USGS stream gauge plate", emoji: "📐", flavor: "Datum unknown. Reads 'GAGE HEIGHT,' which is how the old-timers spelled it. Respect." },
    phone:     { name: "A flip phone, still defiant", emoji: "📟", flavor: "One bar. One bar! Out here! Your smartphone could never." },
    cooler:    { name: "A lost cooler (empty, obviously)", emoji: "🧊", flavor: "The drinks are gone. The disappointment is fresh. Always empty. Always." },
    decoy:     { name: "A duck decoy", emoji: "🦆", flavor: "It has seen things. It is keeping the receipts." },
    netfloat:  { name: "A crab-trap float", emoji: "🟠", flavor: "Cyc string still attached. Drifted up from the coast to say hello." },
    rod:       { name: "Someone else's snapped rod tip", emoji: "🎣", flavor: "Ultralight. They hooked something they shouldn't have. You can relate." },
  };

  /* ============================================================
     EQUIPMENT — four tracks, each with named, flavored tiers.
     Tier 0 is the free starting gear. Buying tier N costs price[N].
       rod:  biteWindow (ms reel window), maxWeight (clean land cap)
       line: breakResist (0..1), maxClass ('common'|'trophy'|'legendary')
       lure: junkChance, rarityBoost (shifts toward rarer), bias{species:mult}
       boat: tier (the location gate)
     ============================================================ */
  const EQUIPMENT = {
    rod: [
      { name: "Hand-Me-Down Zebco 33", flavor: "Smells like your grandfather's tackle box. Reliable as a stop sign.", price: 0, biteWindow: 1900, maxWeight: 8 },
      { name: "Ugly Stik, Genuinely Ugly", flavor: "Indestructible. You have personally tested this against a tailgate.", price: 130, biteWindow: 2300, maxWeight: 16 },
      { name: "Medium-Heavy Baitcaster", flavor: "Backlashes only when someone's watching. Otherwise a dream.", price: 480, biteWindow: 2700, maxWeight: 30 },
      { name: "Custom Graphite, Cork Handle", flavor: "Light as a good idea, sensitive as a peer review. You feel everything.", price: 1500, biteWindow: 3100, maxWeight: 60 },
      { name: "The Stamped-and-Sealed Surf Rod", flavor: "P.E.-approved. Rated for fish that don't technically exist yet.", price: 4200, biteWindow: 3600, maxWeight: 999 },
    ],
    line: [
      { name: "Mystery Mono (found on the spool)", flavor: "Unknown vintage. Holds knots out of sheer habit.", price: 0, breakResist: 0.10, maxClass: "common" },
      { name: "Fresh 10 lb Monofilament", flavor: "Clear, stretchy, forgiving. Like a good change-order negotiation.", price: 100, breakResist: 0.30, maxClass: "common" },
      { name: "15 lb Fluorocarbon", flavor: "Invisible underwater and slightly smug about it.", price: 360, breakResist: 0.55, maxClass: "trophy" },
      { name: "30 lb Braided Superline", flavor: "Zero stretch, all opinion. Sets the hook before you decide to.", price: 1100, breakResist: 0.78, maxClass: "trophy" },
      { name: "80 lb Offshore Braid", flavor: "You could tow the jon boat with this. Don't. But you could.", price: 3200, breakResist: 0.94, maxClass: "legendary" },
    ],
    lure: [
      { name: "A Can of Garden Worms", flavor: "Free, honest, and beloved by absolutely everything in the water.", price: 0, junkChance: 0.22, rarityBoost: 0, bias: {} },
      { name: "Beetle Spin & a Bobber", flavor: "The panfish handshake. Sorts the junk from the bream nicely.", price: 90, junkChance: 0.16, rarityBoost: 0.10, bias: { bluegill: 1.4, bream: 1.4, redear: 1.4, crappie: 1.3, blackcrappie: 1.3 } },
      { name: "Jig & Crankbait Box", flavor: "Now we're targeting. Crappie on the jig, bass on the crank.", price: 280, junkChance: 0.11, rarityBoost: 0.22, bias: { crappie: 1.6, blackcrappie: 1.6, largemouth: 1.5, smallbass: 1.4, whitebass: 1.4 } },
      { name: "Stink Bait & Big Spinnerbaits", flavor: "Smells like a crime scene. Catfish file it under 'irresistible.'", price: 850, junkChance: 0.07, rarityBoost: 0.34, bias: { channelcat: 1.8, bluecat: 1.7, flathead: 1.7, largemouth: 1.4, trophybass: 1.4 } },
      { name: "Gold Spoons & Live Shrimp", flavor: "The coastal cheat code. Redfish see gold and lose all composure.", price: 2400, junkChance: 0.05, rarityBoost: 0.46, bias: { redfish: 1.9, speck: 1.7, flounder: 1.5, sheepshead: 1.4, blackdrum: 1.4 } },
    ],
    boat: [
      { name: "Bank Fishing & Good Boots", flavor: "The original watercraft: dry land. Gets you to the close stuff.", price: 0, tier: 0 },
      { name: "Jon Boat w/ Trolling Motor", flavor: "Aluminum, dented, beloved. Idles into water the bank can't reach.", price: 220, tier: 1 },
      { name: "Aluminum Bass Boat", flavor: "Carpeted, livewelled, and faster than your last deadline. Opens up the big lakes.", price: 1000, tier: 2 },
      { name: "Mud Boat / Go-Devil", flavor: "Sounds like a chainsaw arguing with a lawnmower. Goes where roads gave up.", price: 2600, tier: 3 },
      { name: "Center Console w/ Saltwater Gear", flavor: "Twin batteries, a cooler that holds ice past noon, and the marsh in range.", price: 7500, tier: 4 },
    ],
  };

  /* ============================================================
     LOCATIONS — the ladder. Each has a palette, species table,
     junk table, idle lines, and an unlock gate.
     palette.sky / palette.water are CSS gradient strings (the
     "golden-hour reference"); the day/night filter shifts them.
     unlock: { bucks, boatTier, milestone:{here:N} }
     species/junk: [{ ref, weight }] referencing S/L/JUNK by key.
     ============================================================ */
  function sky(a, b, c, d) { return `linear-gradient(to bottom, ${a} 0%, ${b} 45%, ${c} 78%, ${d} 100%)`; }
  function wtr(a, b, c) { return `linear-gradient(to bottom, ${a} 0%, ${b} 12%, ${c} 70%)`; }

  const LOCATIONS = [
    {
      id: "pond",
      name: "The Neighborhood Pond",
      blurb: "retention pond, technically · but the bream don't know that",
      unlock: null, // starting water, always open
      accent: "#7fb069",
      palette: {
        sky: sky("#3c4a52", "#6e7e6a", "#a8b075", "#d8d29a"),
        water: wtr("#6a7a5f", "#2f5a44", "#13321f"),
        cypress: "#16241a",
      },
      idle: [
        "It's a drainage pond with delusions of grandeur. You love it here.",
        "Somebody's HOA paid good money to make this look natural. Worth it.",
        "The fountain aerator clicks on at noon. Wildlife.",
      ],
      species: [
        { ref: "bluegill", weight: 40 },
        { ref: "redear", weight: 18 },
        { ref: "smallbass", weight: 22 },
        { ref: "bream", weight: 14 },
        { ref: "channelcat", weight: 5 },
      ],
      legendaries: [{ ref: "turtle", weight: 0.8 }],
      junk: ["frisbee", "homework", "boot", "croc", "garmin", "cooler", "license"],
    },
    {
      id: "lincoln",
      name: "Lincoln Parish Park Lake",
      blurb: "famous for the mountain bike trails · the fishing is a bonus",
      unlock: { bucks: 120, boatTier: 0, milestone: { here: 10, at: "pond" } },
      accent: "#62a87c",
      palette: {
        sky: sky("#3a4456", "#6a6b78", "#c08a5a", "#e6c187"),
        water: wtr("#5d5a4a", "#235047", "#0f2a26"),
        cypress: "#13211d",
      },
      idle: [
        "A mountain biker just rolled past and silently judged your casting form. Mildly.",
        "Pine needles on the water. The whole place smells like a good decision.",
        "Somewhere on the trail, somebody just said 'on your left.' Not your problem.",
      ],
      species: [
        { ref: "bream", weight: 28 },
        { ref: "redear", weight: 18 },
        { ref: "crappie", weight: 22 },
        { ref: "largemouth", weight: 20 },
        { ref: "channelcat", weight: 10 },
      ],
      legendaries: [{ ref: "bartholomew", weight: 0.5 }],
      junk: ["bikehelmet", "garmin", "lawnchair", "frisbee", "license", "propane", "boot"],
    },
    {
      id: "darbonne",
      name: "Lake D'Arbonne",
      blurb: "somewhere off the D'Arbonne · no deadlines out here",
      unlock: { bucks: 350, boatTier: 1, milestone: { here: 12, at: "lincoln" } },
      accent: "#e8c170",
      palette: {
        sky: sky("#4a3b54", "#8a4f4a", "#f2a65a", "#f7c98b"),
        water: wtr("#5b4a3f", "#1f4e4a", "#0e2826"),
        cypress: "#0c1f1d",
      },
      idle: [
        "The bayou doesn't bill hours.",
        "No submittals out here. Just water.",
        "The water's doing that gold thing it does around 7pm.",
        "Cicadas at 92 decibels. Somehow still peaceful.",
      ],
      species: [
        { ref: "crappie", weight: 30 },
        { ref: "blackcrappie", weight: 16 },
        { ref: "largemouth", weight: 20 },
        { ref: "channelcat", weight: 16 },
        { ref: "spottedgar", weight: 8 },
        { ref: "bowfin", weight: 4 },
      ],
      legendaries: [{ ref: "bartholomew", weight: 0.5 }],
      junk: ["plans", "cone", "culvert", "lath", "hymnal", "mre", "benchy", "rcgauge"],
    },
    {
      id: "caney",
      name: "Caney Lake",
      blurb: "trophy bass water · people whisper about the records here",
      unlock: { bucks: 800, boatTier: 2, milestone: { here: 15, at: "darbonne" } },
      accent: "#6fae8e",
      palette: {
        sky: sky("#34405a", "#5b6a86", "#cf9a5a", "#efd29a"),
        water: wtr("#4a5a52", "#1d5a4e", "#0c2b24"),
        cypress: "#0e211c",
      },
      idle: [
        "This lake has produced state-record bass. It would like you to know that.",
        "Deep, clear, and quietly competitive. Even the water has a PR.",
        "A bass boat eased by at idle, nodded, said nothing. Lake etiquette.",
      ],
      species: [
        { ref: "largemouth", weight: 28 },
        { ref: "trophybass", weight: 12 },
        { ref: "blackcrappie", weight: 18 },
        { ref: "crappie", weight: 16 },
        { ref: "channelcat", weight: 14 },
        { ref: "whitebass", weight: 8 },
      ],
      legendaries: [{ ref: "cane", weight: 0.4 }],
      junk: ["plans", "lath", "cooler", "rod", "garmin", "propane", "decoy"],
    },
    {
      id: "blackbayou",
      name: "Black Bayou Lake NWR",
      blurb: "cypress, Spanish moss, and a heron that's seen everything",
      unlock: { bucks: 1400, boatTier: 2, milestone: { here: 15, at: "caney" } },
      accent: "#5e8f73",
      palette: {
        sky: sky("#2e3a4e", "#4a5266", "#9a7a6a", "#caa884"),
        water: wtr("#3a4540", "#17453e", "#08201c"),
        cypress: "#091a16",
      },
      idle: [
        "A great blue heron has been standing in exactly that spot since the Carter administration.",
        "Spanish moss, black water, and the kind of quiet that has weight to it.",
        "A barred owl asked who cooks for you. Honestly, takeout, mostly.",
      ],
      species: [
        { ref: "bowfin", weight: 24 },
        { ref: "spottedgar", weight: 18 },
        { ref: "longnosegar", weight: 12 },
        { ref: "crappie", weight: 16 },
        { ref: "channelcat", weight: 16 },
        { ref: "drum", weight: 10 },
      ],
      legendaries: [{ ref: "cypressking", weight: 0.45 }],
      junk: ["hymnal", "decoy", "culvert", "lath", "rcgauge", "boot", "phone"],
    },
    {
      id: "ouachita",
      name: "Ouachita River",
      blurb: "current matters here · the bite's quicker, the fish are bigger",
      unlock: { bucks: 2200, boatTier: 2, milestone: { here: 15, at: "blackbayou" } },
      accent: "#a98b5e",
      current: true,
      palette: {
        sky: sky("#3e3a48", "#6a5a5a", "#bb8a5a", "#e0bd86"),
        water: wtr("#5a5040", "#3a4a44", "#16241f"),
        cypress: "#10201a",
      },
      idle: [
        "The current's working. You can feel the river thinking about somewhere downstream.",
        "A tow pushing barges sounded its horn a mile off. The river's a working road.",
        "Eddies and seams. The fish stack up behind structure, same as everybody at quitting time.",
      ],
      species: [
        { ref: "flathead", weight: 18 },
        { ref: "bluecat", weight: 18 },
        { ref: "channelcat", weight: 16 },
        { ref: "drum", weight: 18 },
        { ref: "whitebass", weight: 14 },
        { ref: "longnosegar", weight: 10 },
      ],
      legendaries: [{ ref: "drumming", weight: 0.4 }],
      junk: ["rcgauge", "culvert", "propane", "phone", "cooler", "netfloat", "plans"],
    },
    {
      id: "toledo",
      name: "Toledo Bend",
      blurb: "big water on the Texas line · you'll want the bass boat for this",
      unlock: { bucks: 3600, boatTier: 2, milestone: { here: 18, at: "ouachita" } },
      accent: "#5f9bb0",
      palette: {
        sky: sky("#34415c", "#5a7090", "#d09a64", "#f0d5a4"),
        water: wtr("#46586a", "#1f5e72", "#0c2e38"),
        cypress: "#0d2128",
      },
      idle: [
        "The horizon is just more lake. You can't see the far bank and you don't need to.",
        "Two states share this water and neither one is in a hurry today.",
        "Standing timber stretches out for acres. Bass condos, fully leased.",
      ],
      species: [
        { ref: "largemouth", weight: 26 },
        { ref: "trophybass", weight: 14 },
        { ref: "striper", weight: 14 },
        { ref: "whitebass", weight: 16 },
        { ref: "channelcat", weight: 16 },
        { ref: "crappie", weight: 14 },
      ],
      legendaries: [{ ref: "bigtex", weight: 0.4 }],
      junk: ["decoy", "rod", "cooler", "propane", "netfloat", "license", "lawnchair"],
    },
    {
      id: "atchafalaya",
      name: "Atchafalaya Basin",
      blurb: "the wild one · the biggest river swamp in the country, and it knows",
      unlock: { bucks: 5200, boatTier: 3, milestone: { here: 18, at: "toledo" } },
      accent: "#7a9e5e",
      palette: {
        sky: sky("#2a3442", "#46523e", "#8a7a4a", "#bca870"),
        water: wtr("#3e4636", "#27452e", "#0c1f14"),
        cypress: "#0a160e",
      },
      idle: [
        "A million acres of swamp breathing slow around you. You're a guest. A welcome one.",
        "Something big rolled in the next slough over. You decided not to investigate. Wisdom.",
        "The Basin doesn't do small. Even the bugs are committed to the bit.",
      ],
      species: [
        { ref: "bowfin", weight: 22 },
        { ref: "flathead", weight: 16 },
        { ref: "bluecat", weight: 16 },
        { ref: "alligatorgar", weight: 8 },
        { ref: "longnosegar", weight: 14 },
        { ref: "drum", weight: 14 },
      ],
      legendaries: [
        { ref: "grandfather", weight: 0.3 },
        { ref: "gator", weight: 0.5 },
      ],
      junk: ["netfloat", "decoy", "propane", "boot", "phone", "mre", "rod"],
    },
    {
      id: "venice",
      name: "Coastal Marsh — Grand Isle / Venice",
      blurb: "where the river finally gives up and meets the gulf · saltwater country",
      unlock: { bucks: 8500, boatTier: 4, milestone: { here: 18, at: "atchafalaya" } },
      accent: "#5ea7b8",
      coastal: true,
      palette: {
        sky: sky("#36465e", "#6a86a0", "#dca866", "#f6dca6"),
        water: wtr("#4e6a72", "#1f6e80", "#0a3038"),
        cypress: "#0c2630",
      },
      idle: [
        "Gulls working bait offshore. Surf in the distance. The marsh smells like the whole world started here.",
        "Roseau cane and open water to the horizon. Out past it, the rigs blink on for the night.",
        "Brown pelican folded itself up and dropped on a baitfish like a controlled demolition.",
      ],
      species: [
        { ref: "redfish", weight: 26 },
        { ref: "speck", weight: 22 },
        { ref: "flounder", weight: 14 },
        { ref: "sheepshead", weight: 14 },
        { ref: "blackdrum", weight: 16 },
        { ref: "channelcat", weight: 4 },
      ],
      legendaries: [{ ref: "bullred", weight: 0.4 }],
      junk: ["netfloat", "cooler", "propane", "decoy", "croc", "boot", "phone"],
    },
  ];

  /* ============================================================
     ACHIEVEMENTS — "The Tackle Box". Funny names, gentle goals.
     check(g) receives the live game facade; returns true when earned.
     ============================================================ */
  const ACHIEVEMENTS = [
    { id: "first_cast", name: "Wet a Line", desc: "Catch your first anything.", check: g => g.totalCatches() >= 1 },
    { id: "revise", name: "Revise and Resubmit", desc: "Haul up the redlined plans 3 times.", check: g => g.junkCount("plans") >= 3 },
    { id: "deficient", name: "Structurally Deficient", desc: "Haul 25 pieces of junk from the water.", check: g => g.stats.junk >= 25 },
    { id: "litter", name: "Parish Cleanup Crew", desc: "Haul 60 pieces of junk. The parish thanks you, technically.", check: g => g.stats.junk >= 60 },
    { id: "sacaulait", name: "Sac-au-lait Society", desc: "Land 50 crappie of any color.", check: g => g.speciesTotal(["crappie", "blackcrappie"]) >= 50 },
    { id: "patience", name: "Project Float", desc: "Catch 100 fish total. No rush, you got there.", check: g => g.totalCatches() >= 100 },
    { id: "pb10", name: "Personal Best", desc: "Land anything over 10 pounds.", check: g => g.stats.pb >= 10 },
    { id: "pb25", name: "Heavy Tackle", desc: "Land anything over 25 pounds.", check: g => g.stats.pb >= 25 },
    { id: "whiskers", name: "Whiskers After Dark", desc: "Land a catfish at night.", check: g => g.flags.nightCat },
    { id: "golden", name: "Golden Hour Glory", desc: "Land a bass during golden hour.", check: g => g.flags.goldenBass },
    { id: "firstboat", name: "Float Plan Approved", desc: "Buy your first boat.", check: g => g.equip.boat >= 1 },
    { id: "bassboat", name: "Carpet and a Livewell", desc: "Own the aluminum bass boat.", check: g => g.equip.boat >= 2 },
    { id: "fullrod", name: "Stamped and Sealed", desc: "Max out the rod track.", check: g => g.equip.rod >= 4 },
    { id: "travel3", name: "Out-of-Towner", desc: "Unlock three different fishing spots.", check: g => g.unlockedCount() >= 3 },
    { id: "asbuilt", name: "As-Built Conditions", desc: "Catch every common species at a single location.", check: g => g.flags.asBuilt },
    { id: "substantial", name: "Substantial Completion", desc: "Unlock every location on the map.", check: g => g.unlockedCount() >= LOCATIONS.length },
    { id: "firstlegend", name: "Local Legend", desc: "Land any named legendary fish.", check: g => g.legendCount() >= 1 },
    { id: "submittal", name: "100% Submittal", desc: "Land every named legendary in the game.", check: g => g.legendCount() >= g.legendTotal() },
    { id: "gator", name: "Mutually Released", desc: "Briefly 'catch' the alligator. Nobody talk about it.", check: g => g.caught["gator"] },
    { id: "rich", name: "Liquid Assets", desc: "Have 5,000 Bayou Bucks in pocket at once.", check: g => g.bucks >= 5000 },
    { id: "saltlife", name: "Brackish Convert", desc: "Land your first saltwater fish in the marsh.", check: g => g.flags.firstSalt },
    { id: "rainmaker", name: "Rainmaker", desc: "Land a fish in the rain.", check: g => g.flags.rainCatch },
    { id: "frontrunner", name: "Front-Runner", desc: "Land a fish as a front moves in.", check: g => g.flags.frontCatch },
    { id: "trotline", name: "Set It and Forget It", desc: "Bring in fish on the trotline.", check: g => g.flags.trotline },
    { id: "favor", name: "Good Neighbor", desc: "Finish your first bounty at the landing.", check: g => (g.stats.bountiesDone || 0) >= 1 },
    { id: "landing", name: "Pillar of the Community", desc: "Finish 12 bounties for the regulars.", check: g => (g.stats.bountiesDone || 0) >= 12 },
    { id: "homestead", name: "Home on the Water", desc: "Build the camp all the way up.", check: g => g.camp.tier >= 4 },
    { id: "trophies", name: "Wall of Fame", desc: "Mount 12 different fish on the trophy wall.", check: g => g.trophyCount() >= 12 },
    { id: "daily1", name: "Showed Up", desc: "Finish a daily challenge.", check: g => (g.stats.dailiesDone || 0) >= 1 },
    { id: "streak7", name: "Regular Out Here", desc: "Keep a 7-day streak going.", check: g => (g.daily.streak || 0) >= 7 },
    { id: "running", name: "Right Place, Right Time", desc: "Land a fish during a seasonal run.", check: g => g.flags2 && g.flags2.runCatch },
    { id: "grayghost", name: "The Gray Ghost", desc: "Meet the legend the whole bayou whispers about.", check: g => g.ghost && g.ghost.caught },
    { id: "guide20", name: "Field Notes", desc: "Log 20 different species in the Field Guide.", check: g => g.speciesCaughtCount() >= 20 },
    { id: "fullbox", name: "The Whole Tackle Box", desc: "Catch at least one of every species in the game.", check: g => g.speciesCaughtCount() >= g.speciesTotalCount() },
  ];

  /* ============================================================
     WEATHER — rolls every so often. biteSpeed < 1 = faster bites,
     rarityBoost nudges the table toward rarer fish. `fx` keys a
     scene overlay. The pre-front bite is the classic local truth.
     ============================================================ */
  const WEATHER = [
    { id: "clear",    label: "clear skies",        weight: 30, biteSpeed: 1.00, rarityBoost: 0.00, fx: null,       report: "Bluebird sky. Pretty as a postcard, and the fish get a little shy under it." },
    { id: "partly",   label: "partly cloudy",      weight: 24, biteSpeed: 0.95, rarityBoost: 0.03, fx: "clouds",   report: "Clouds drifting through. Comfortable water, steady bite. A good day to be out." },
    { id: "overcast", label: "overcast",           weight: 16, biteSpeed: 0.86, rarityBoost: 0.06, fx: "overcast", report: "Gray and soft. Fish lose their caution under a low ceiling — keep a line wet." },
    { id: "fog",      label: "morning fog",        weight: 9,  biteSpeed: 0.82, rarityBoost: 0.06, fx: "fog",      report: "Fog sitting on the water like it pays rent. Eerie, quiet, and excellent." },
    { id: "rain",     label: "light rain",         weight: 10, biteSpeed: 0.78, rarityBoost: 0.09, fx: "rain",     report: "A warm rain dimpling the surface. They feed hard in this — you might get wet, worth it." },
    { id: "front",    label: "a front moving in",  weight: 6,  biteSpeed: 0.62, rarityBoost: 0.15, fx: "front",    report: "Pressure's dropping ahead of a front. The bite is ON. Whatever you were doing, do this instead." },
  ];

  /* ============================================================
     SEASONS — tracks your real-world season, so the marsh matches
     your window. Each shifts scenery tint and favors certain fish.
     months are 0-indexed (Jan = 0).
     ============================================================ */
  const SEASONS = [
    { id: "spring", label: "spring", months: [2, 3, 4], tint: "hue-rotate(-6deg) saturate(1.06)",
      bias: { largemouth: 1.3, trophybass: 1.3, crappie: 1.3, blackcrappie: 1.3, smallbass: 1.2 },
      report: "Spring. Fish are shallow and spawning-minded — bass and crappie are players right now." },
    { id: "summer", label: "summer", months: [5, 6, 7], tint: "saturate(1.08) brightness(1.02)",
      bias: { channelcat: 1.3, bluecat: 1.3, flathead: 1.3, bowfin: 1.2, redfish: 1.2 },
      report: "High summer. Catfish own the warm nights; everything else hugs the shade and waits for dark." },
    { id: "fall", label: "fall", months: [8, 9, 10], tint: "hue-rotate(9deg) saturate(1.04)",
      bias: { largemouth: 1.25, whitebass: 1.3, striper: 1.3, crappie: 1.2, speck: 1.2 },
      report: "Fall feed-up. Cooling water, schooling bait, and fish trying to fatten before winter. Prime time." },
    { id: "winter", label: "winter", months: [11, 0, 1], tint: "hue-rotate(-12deg) saturate(.92) brightness(.98)",
      bias: { crappie: 1.4, blackcrappie: 1.4 },
      report: "Winter. The bite slows and goes deep, but the crappie stack up thick and willing." },
  ];

  /* ============================================================
     CHARACTERS — the regulars at the landing. They post bounties
     and say their piece. Pure flavor + a face for the bounty board.
     ============================================================ */
  const CHARACTERS = {
    amelia:    { name: "Amelia June",  emoji: "👧", blurb: "Names every fish she sees. Has strong opinions on all of them." },
    boudreaux: { name: "Mr. Boudreaux",emoji: "🧓", blurb: "Runs the bait shop out of a cooler and a folding table. Knows the water cold." },
    darlene:   { name: "Miss Darlene", emoji: "👩", blurb: "Fries fish for the whole landing on Fridays. Pays in compliments and cash." },
    tee:       { name: "Tee-Claude",   emoji: "🧢", blurb: "Eleven years old, out-fishes everyone, and will not let you forget it." },
  };

  /* ============================================================
     BOUNTY TEMPLATES — the game instantiates concrete bounties from
     these (rolling a target in [min,max] and a reward). kinds:
       species  — catch N of a species group
       weight   — land one fish over X lb
       junk     — haul N junk
       variety  — catch N different species (this outing)
       legendary— land any named legendary
     ============================================================ */
  const BOUNTY_TEMPLATES = [
    { id: "mess",    giver: "darlene",   kind: "species", group: ["crappie", "blackcrappie"], noun: "sac-au-lait", min: 5, max: 10, perReward: 9,
      flavor: "Friday fry's coming and I'm short. Bring me a mess of sac-au-lait, cher — {N} of 'em ought to do." },
    { id: "catfry",  giver: "darlene",   kind: "species", group: ["channelcat", "bluecat", "flathead"], noun: "catfish", min: 3, max: 6, perReward: 16,
      flavor: "Whiskers for the grease this week. {N} catfish, any size, and I'll know if you cheat." },
    { id: "bigun",   giver: "tee",       kind: "weight", min: 4, max: 9, reward: 140,
      flavor: "Betcha can't catch one bigger'n my cousin's. {X} pounds. Go on, I'll wait. (He won't wait.)" },
    { id: "cleanup", giver: "boudreaux", kind: "junk", min: 5, max: 12, perReward: 6,
      flavor: "Parish pays a little to pull junk out the water. {N} pieces and I'll square you up." },
    { id: "namer",   giver: "amelia",    kind: "variety", min: 3, max: 5, perReward: 22,
      flavor: "I want to name some NEW ones! Bring me {N} different kinds — any kinds, I'm not picky, I just like naming." },
    { id: "story",   giver: "boudreaux", kind: "legendary", reward: 350,
      flavor: "Word is there's a big old one in this water. Bring me a story worth telling and I'll make it worth your while." },
  ];

  /* ============================================================
     CAMP — a home base you build up, plus decor you hang on it.
     Cosmetic + a place to mount your trophies. Buy tiers in order.
     ============================================================ */
  const CAMP = {
    tiers: [
      { name: "A folding chair & a cooler", flavor: "Home base is wherever you set the cooler down.", price: 0 },
      { name: "A little plank dock", flavor: "Now you can sit with your feet off the water. Luxury.", price: 300 },
      { name: "A tin-roof lean-to", flavor: "Shade, and a place to hang the rods. Coming up in the world.", price: 900 },
      { name: "A proper fish camp", flavor: "Bunks, a stove, a screen door that slaps. Heaven, with mosquitoes.", price: 2600 },
      { name: "The whole compound", flavor: "Dock, cabin, porch, a flag. People ask to visit now.", price: 7000 },
    ],
    decor: [
      { id: "lights", name: "A string of porch lights", price: 150, flavor: "Warm light over dark water. Worth every penny." },
      { id: "torch", name: "A tiki torch", price: 90, flavor: "Citronella. The mosquitoes are unimpressed, but it's a vibe." },
      { id: "flag", name: "A flag on a pole", price: 120, flavor: "Pelican State colors, snapping in the river wind." },
      { id: "smoker", name: "A barrel smoker", price: 300, flavor: "The smell alone raises the property value." },
      { id: "dog", name: "A camp dog", price: 250, flavor: "Shows up, stays, judges your casting form. Family now." },
      { id: "chair2", name: "A second good chair", price: 110, flavor: "For company, or for your feet. No judgment here." },
    ],
  };

  /* ============================================================
     DAILY — one seeded challenge per calendar day (same for everyone),
     a streak for showing up, and a featured "hot bite" location that
     pays extra that day. Gentle: miss a day, you just lose the streak.
     ============================================================ */
  const DAILY = [
    { id: "d_panfish", kind: "species", group: ["bluegill", "bream", "redear", "crappie", "blackcrappie"], min: 5, max: 9, per: 11, text: "Land {N} panfish today" },
    { id: "d_cats",    kind: "species", group: ["channelcat", "bluecat", "flathead"], min: 3, max: 6, per: 20, text: "Land {N} catfish today" },
    { id: "d_bass",    kind: "species", group: ["largemouth", "smallbass", "trophybass"], min: 3, max: 6, per: 18, text: "Land {N} bass today" },
    { id: "d_big",     kind: "weight", min: 6, max: 12, reward: 170, text: "Land something over {X} lb today" },
    { id: "d_haul",    kind: "total", min: 8, max: 15, per: 9, text: "Land {N} fish, any kind, today" },
    { id: "d_variety", kind: "variety", min: 3, max: 5, per: 26, text: "Land {N} different species today" },
    { id: "d_junk",    kind: "junk", min: 4, max: 8, per: 8, text: "Haul {N} pieces of junk today" },
    { id: "d_legend",  kind: "legendary", reward: 420, text: "Cross paths with any legendary today" },
  ];

  /* ============================================================
     RUNS — seasonal migrations/bites. When a run is on (by real-world
     month) at a location, those species surge there. Tells you where
     to be and when. months are 0-indexed.
     ============================================================ */
  const RUNS = [
    { id: "bassprespawn", group: ["largemouth", "trophybass"], locs: ["caney", "toledo", "darbonne"], months: [1, 2], label: "the prespawn bass bite", report: "Big females are staging to spawn — the year's best shot at a true giant." },
    { id: "crappiespawn", group: ["crappie", "blackcrappie"], locs: ["darbonne", "caney", "toledo", "lincoln"], months: [2, 3], label: "the crappie spawn", report: "Crappie are stacked in the shallows to spawn. Back the truck up." },
    { id: "whitebass", group: ["whitebass", "striper"], locs: ["ouachita", "toledo", "caney"], months: [2, 3], label: "the white bass run", report: "White bass are running up the river in schools, hitting like freight trains." },
    { id: "catfishsummer", group: ["channelcat", "bluecat", "flathead"], locs: ["ouachita", "atchafalaya", "toledo", "darbonne"], months: [5, 6, 7], label: "the summer catfish bite", report: "Warm nights have the catfish prowling. Stink bait and patience pay off now." },
    { id: "garsummer", group: ["spottedgar", "longnosegar", "alligatorgar", "bowfin"], locs: ["blackbayou", "atchafalaya"], months: [6, 7], label: "the gar are rolling", report: "Gar are rolling on the surface in the heat. Primal stuff out in the basin." },
    { id: "redfishfall", group: ["redfish", "blackdrum"], locs: ["venice"], months: [8, 9, 10], label: "the bull red run", report: "Bull reds are schooling in the passes. The marsh is absolutely on fire." },
    { id: "specwinter", group: ["speck"], locs: ["venice"], months: [11, 0, 1], label: "the speckled trout bite", report: "Cold water has the specks bunched up tight under the diving birds." },
  ];

  /* ============================================================
     STORY — a low-pressure spine carried by the locals. Each beat
     plays once when its check(g) passes (next time you're idle).
     The arc quietly seeds the Gray Ghost — the white-whale legend
     you'll chase in the endgame.
     ============================================================ */
  const STORY = [
    { id: "welcome", who: "boudreaux", ch: 1, title: "A Place to Sit", check: () => true, lines: [
      "Well, look who found the landing. Boudreaux. I run the bait shop — that cooler and that folding table yonder.",
      "Ain't much to it out here. You cast, you wait, you visit. The fish'll come or they won't. Either way the evening's free.",
      "Go on, wet a line. I'll be here. I'm always here." ] },
    { id: "firstfish", who: "amelia", ch: 1, title: "Amelia Names It", check: g => g.totalCatches() >= 1, lines: [
      "You caught one! You caught one! Lemme see — oh, he's HANDSOME. I'm gonna call him Gerald.",
      "I name all of 'em. Mr. Boudreaux says that's silly but Mr. Boudreaux named his truck, so.",
      "Catch more, okay? I'm runnin' out of names and I got a whole list." ] },
    { id: "regular", who: "boudreaux", ch: 1, title: "Good for Business", check: g => g.totalCatches() >= 6, lines: [
      "You been out here enough now, folks are startin' to call you a regular. That's a compliment, mostly.",
      "Truth told, the shop's been slow. Big-box place out on the highway sells bait next to the motor oil. Hard to compete with cheap.",
      "But you keep comin' round and buyin' the good stuff. Keeps the lights on a little longer. I 'preciate it. I do." ] },
    { id: "newwater", who: "tee", ch: 2, title: "Tee-Claude Has Opinions", check: g => g.unlockedCount() >= 2, lines: [
      "So you the one been catchin' fish two lakes over. Big deal. I caught a eight-pounder when I was NINE.",
      "Name's Tee-Claude. I'm the best angler at this landing and everybody knows it, especially me.",
      "You wanna race? Not a real race. Just… see who catches the better fish. I already won, but you can try." ] },
    { id: "fries", who: "darlene", ch: 2, title: "Miss Darlene's Fridays", check: g => (g.stats.bountiesDone || 0) >= 1, lines: [
      "Baby, that mess of fish you brought? That's Friday handled. Whole landing eats when you bring it in like that.",
      "I been fryin' fish for these people thirty years. Cornmeal, hot grease, a little cayenne. That's the whole gospel.",
      "You come hungry Friday, you hear? You earned a plate. Bring that no-account Tee-Claude too. He eats free, struggle as he is." ] },
    { id: "campup", who: "boudreaux", ch: 2, title: "Your Own Spot", check: g => g.camp.tier >= 1, lines: [
      "Heard you fixed up a little spot on the water. Dock and everything. That's how it starts, you know.",
      "Man gets a dock, next thing he's got a chair, then a cabin, then he's the one tellin' the stories.",
      "You're puttin' down roots out here. The bayou notices that kinda thing. It'll be good to you for it." ] },
    { id: "firstlegend", who: "amelia", ch: 3, title: "A Real Legend", check: g => g.legendCount() >= 1, lines: [
      "You caught a FAMOUS one! The kind that's got a NAME already, not just a name I gave it!",
      "Mr. Boudreaux went quiet when I told him. He gets quiet when it's somethin' real.",
      "He said… he said if you can catch THAT, maybe you oughta hear about the Gray Ghost. He wouldn't say more. He looked spooked." ] },
    { id: "thelegend", who: "boudreaux", ch: 3, title: "The Gray Ghost", check: g => g.unlockedCount() >= 4, lines: [
      "Alright. You earned the story, so sit. Pour somethin'. This one's old.",
      "They call it the Gray Ghost. Big fish — biggest anybody's ever raised — and nobody agrees what it even IS. Cat, gar, somethin' older.",
      "Every water from the pond to the gulf, somebody's hooked it once. Felt the whole rod bend double, heard the drag scream, and then… nothin'. Cut line. Every time.",
      "My daddy lost it on the D'Arbonne in '71. I lost it myself, twice. It don't get caught. It gets ENCOUNTERED.",
      "But you… you fish different. So I'll tell you what the old-timers told me: it shows for them that learn the water. All of it. Keep at it, and maybe it'll show for you." ] },
    { id: "deeper", who: "darlene", ch: 3, title: "What Darlene Knows", check: g => g.unlockedCount() >= 6, lines: [
      "Boudreaux told you about the Ghost, huh. I can see it on you. Gets in your head, that story.",
      "My mama swore it only showed on the big moons. Full and new, when the water's pulled tight and the whole bayou holds its breath.",
      "She also swore it's good luck just to see it. Bad luck to brag about it. So if you find it, baby — you be humble out there." ] },
  ];

  window.DATA = { CONFIG, PHASES, GENERIC, S, L, JUNK, EQUIPMENT, LOCATIONS, ACHIEVEMENTS,
    WEATHER, SEASONS, CHARACTERS, BOUNTY_TEMPLATES, CAMP, DAILY, RUNS, STORY, GHOST };
})();
