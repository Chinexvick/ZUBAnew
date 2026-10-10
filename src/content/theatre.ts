import { media } from "./media";

export type Chapter = { title: string; body: string };
export type Person = { name: string; role: string };

export type Title = {
  slug: string;
  kind: "movie" | "game";
  title: string;
  runes: string;
  shelf: string; // Netflix-style row name
  genre: string;
  origin: string;
  status: string;
  format: string;
  logline: string;
  synopsis: string;
  chapters: Chapter[];
  cast: Person[];
  features?: string[];
  quote?: string;
  note?: string;
  poster: string;
  backdrop: string;
  stills: string[];
};

// Prefer the 2D version of each image when it exists.
const img = (key: string) => media[`${key}-2d`] ?? media[key] ?? "";

export const movies: Title[] = [
  {
    slug: "anansi-keeper-of-stories",
    kind: "movie",
    title: "Anansi: Keeper of Stories",
    runes: "Anansi",
    shelf: "Myths & Legends",
    genre: "Folktale · Adventure · Comedy",
    origin: "Akan · Ghana",
    status: "In Development",
    format: "Animated Feature",
    logline:
      "Every story in the world belonged to the Sky God. One small spider decided they should belong to everyone.",
    synopsis:
      "Long ago the world was quiet. No fireside tales, no lessons for children, no songs about who we were. Nyame, the Sky God, kept every story locked in a golden box above the clouds. Anansi, the smallest and cleverest creature of the forest, climbs a single silver thread to ask the price. The price is impossible. That is exactly the kind of challenge Anansi likes.",
    chapters: [
      {
        title: "Chapter I · The Locked Sky",
        body: "The villages below have forgotten how to dream. Elders have nothing to pass down, children have nothing to imagine. Anansi spins a web to the heavens and stands before Nyame's throne of thunder.",
      },
      {
        title: "Chapter II · The Price",
        body: "Nyame laughs and names his price: Onini the python, Osebo the leopard, the Mmoboro hornets and Mmoatia, the forest spirit no one has ever caught. Kings and warriors have tried and failed.",
      },
      {
        title: "Chapter III · Four Impossible Hunts",
        body: "Anansi does not fight. He plays. He tricks the proud python into measuring himself against a palm branch, leads the leopard into a pit, calls down a false rainstorm for the hornets and builds a sticky doll for Mmoatia. Each hunt is a lesson in wit over strength.",
      },
      {
        title: "Chapter IV · Stories for Everyone",
        body: "Anansi carries the golden box down the web, and it bursts open. Stories scatter to every fireside on Earth. From that day on, the Akan call their tales Anansesem: the spider's stories.",
      },
    ],
    cast: [
      { name: "Kwaku Anansi", role: "The trickster spider" },
      { name: "Nyame", role: "The Sky God" },
      { name: "Aso", role: "Anansi's wife and true strategist" },
      { name: "Mmoatia", role: "The forest spirit" },
    ],
    quote: "Strength can lift a stone. Only wit can lift the sky.",
    poster: img("anansi-poster"),
    backdrop: img("anansi-backdrop"),
    stills: [img("anansi-still-1"), img("anansi-still-2")],
  },
  {
    slug: "sundiata-lion-of-manden",
    kind: "movie",
    title: "Sundiata: Lion of Manden",
    runes: "Sundiata",
    shelf: "Myths & Legends",
    genre: "Epic · Legend · Action",
    origin: "Mandinka · Mali Empire",
    status: "In Development",
    format: "Animated Feature",
    logline: "They laughed at the boy who could not walk. He rose and built an empire.",
    synopsis:
      "Based on the Epic of Sundiata, still sung by griots across West Africa. Sundiata Keita was born the son of a king, but he could not walk. He was mocked and exiled while his kingdom fell to the sorcerer-king Soumaoro Kanté. This is the story of how he stood up, gathered the scattered peoples of Manden and founded the Mali Empire.",
    chapters: [
      {
        title: "Chapter I · The Prophecy",
        body: "A hunter-seer tells King Naré Maghan that a buffalo woman, Sogolon, will bear him a son who will rule the world. The son is born, and for seven years he cannot stand.",
      },
      {
        title: "Chapter II · The Iron Rod",
        body: "Shamed by the queen mother, Sundiata calls for an iron rod. The first one bends. The second, forged by the master smiths, holds. The boy rises to his feet and the griots sing for the first time.",
      },
      {
        title: "Chapter III · Exile",
        body: "Driven from home, Sundiata and his mother wander from kingdom to kingdom, learning the ways of hunters, kings and warriors. Meanwhile Soumaoro, the sorcerer-king of Sosso, crushes Manden.",
      },
      {
        title: "Chapter IV · Kirina",
        body: "Sundiata returns at the head of a united army. At the battle of Kirina he breaks Soumaoro's magic with a single arrow tipped with a white rooster's spur. From the victory comes the Mali Empire and the Kouroukan Fouga, one of the world's earliest charters of rights.",
      },
    ],
    cast: [
      { name: "Sundiata Keita", role: "The Lion of Manden" },
      { name: "Sogolon", role: "His mother, the buffalo woman" },
      { name: "Balla Fasséké", role: "The griot, keeper of memory" },
      { name: "Soumaoro Kanté", role: "Sorcerer-king of Sosso" },
    ],
    quote: "A lion's strength is not in rising first, but in rising.",
    poster: img("sundiata-poster"),
    backdrop: img("sundiata-backdrop"),
    stills: [img("sundiata-still-1"), img("sundiata-still-2")],
  },
  {
    slug: "lumumba-voice-of-the-river",
    kind: "movie",
    title: "Lumumba: Voice of the River",
    runes: "Lumumba",
    shelf: "Heroes of the Motherland",
    genre: "Historical · Drama · Tribute",
    origin: "Congo",
    status: "In Development",
    format: "Animated Feature",
    logline: "He spoke one speech to a king and changed what a nation believed it could be.",
    synopsis:
      "Patrice Émery Lumumba began as a postal clerk and became the first Prime Minister of the independent Congo. On 30 June 1960, in front of the Belgian king, he gave a speech that refused to say thank you for freedom. Within seven months he was dead, but his voice never left the river.",
    chapters: [
      {
        title: "Chapter I · The Clerk Who Wrote",
        body: "In Stanleyville a young postal clerk reads everything he can find and writes letters, essays and poems about a Congo run by Congolese. He organises, speaks and founds the Mouvement National Congolais.",
      },
      {
        title: "Chapter II · Independence Day",
        body: "30 June 1960. The ceremony expects gratitude. Lumumba takes the microphone and speaks of dignity, of suffering, and of a free Congo that will show Africa what it can do.",
      },
      {
        title: "Chapter III · The Storm",
        body: "Mutiny, secession in Katanga, foreign interests and Cold War pressure crash into the new nation within weeks. Lumumba fights to hold the country together and is removed from power.",
      },
      {
        title: "Chapter IV · The Unfinished Song",
        body: "Captured and taken to Katanga, Lumumba is killed on 17 January 1961 at the age of 35. His last letter to his wife Pauline promises that history will one day have its say, and that Africa will write its own.",
      },
    ],
    cast: [
      { name: "Patrice Lumumba", role: "First Prime Minister of the Congo" },
      { name: "Pauline Lumumba", role: "His wife and confidante" },
      { name: "The People of the River", role: "Who carried his words" },
    ],
    quote: "The day will come when history will speak. Africa will write its own history.",
    note: "A respectful tribute concept drawn from the historical record. Some scenes are dramatised.",
    poster: img("lumumba-poster"),
    backdrop: img("lumumba-backdrop"),
    stills: [img("lumumba-still-1"), img("lumumba-still-2")],
  },
  {
    slug: "sankara-land-of-the-upright",
    kind: "movie",
    title: "Sankara: Land of the Upright",
    runes: "Sankara",
    shelf: "Heroes of the Motherland",
    genre: "Historical · Drama · Tribute",
    origin: "Burkina Faso",
    status: "In Development",
    format: "Animated Feature",
    logline: "He renamed a country to remind its people to stand tall, then showed them how.",
    synopsis:
      "Captain Thomas Sankara became president of Upper Volta in 1983 at 33. A year later he renamed it Burkina Faso, the Land of Upright People. In four years his government vaccinated millions of children, planted millions of trees, fought for the rights of women and sold off the official limousines. He played guitar, rode a bicycle and drove a small car. He was assassinated on 15 October 1987, at the age of 37.",
    chapters: [
      {
        title: "Chapter I · The Guitar Captain",
        body: "A young officer who reads Marx and plays the guitar in a band. He wins the hearts of soldiers and farmers alike by speaking plainly about poverty, pride and self-reliance.",
      },
      {
        title: "Chapter II · Upright",
        body: "In 1984 Upper Volta becomes Burkina Faso. Sankara launches nationwide vaccination drives, literacy campaigns and a green wall of trees against the advancing desert.",
      },
      {
        title: "Chapter III · No Limousines",
        body: "Ministers lose their Mercedes. Salaries shrink, starting with his own. Women are named to government. Not everyone in power is happy with a leader who lives like his people.",
      },
      {
        title: "Chapter IV · Ideas Cannot Be Killed",
        body: "On 15 October 1987 Sankara is killed in a coup. The country mourns quietly, then loudly. Decades later a new generation across Africa wears his face on its chest and repeats his words.",
      },
    ],
    cast: [
      { name: "Thomas Sankara", role: "President of Burkina Faso, 1983–1987" },
      { name: "The Farmers of the Sahel", role: "Who planted the green wall" },
      { name: "The Next Generation", role: "Who carry the idea" },
    ],
    quote: "While revolutionaries as individuals can be murdered, you cannot kill ideas.",
    note: "A respectful tribute concept drawn from the historical record. Some scenes are dramatised.",
    poster: img("sankara-poster"),
    backdrop: img("sankara-backdrop"),
    stills: [img("sankara-still-1"), img("sankara-still-2")],
  },
];

export const games: Title[] = [
  {
    slug: "zuba-rise-of-the-ancestors",
    kind: "game",
    title: "ZUBA: Rise of the Ancestors",
    runes: "Zuba",
    shelf: "ZUBA Originals",
    genre: "Metroidvania · Platformer · Adventure",
    origin: "Pan-African",
    status: "Prototype · Phase 03",
    format: "PC · Console · Mobile (planned)",
    logline: "The Coin of Echoes has shattered. One small pup must carry a continent's memory home.",
    synopsis:
      "When the Coin of Echoes, the relic that holds every story the ancestors ever told, shatters across five realms, the world starts forgetting itself. ZUBA, a pup raised by an old griot, is the only one who can still hear the coin sing. Explore living myths, unlock ancestral abilities at forgotten shrines and restore what was lost.",
    chapters: [
      {
        title: "Realm I · The Sahel of Whispers",
        body: "Wind-carved mud-brick cities where griots have lost their songs. Unlock Drum Dash, a burst of speed timed to the talking drum.",
      },
      {
        title: "Realm II · The Canopy Kingdom",
        body: "A rainforest built on the backs of giant trees. Earn Kente Glide and weave through the air on threads of light.",
      },
      {
        title: "Realm III · The Mirror Delta",
        body: "Flooded ruins ruled by water spirits. Learn Echo Bark to reveal hidden paths and shatter illusions.",
      },
      {
        title: "Realm IV & V · Savanna of Kings, Highlands of Thunder",
        body: "The final shards lie where lions keep court and lightning birds nest. The ancestors are waiting, and so is the one who broke the coin.",
      },
    ],
    cast: [
      { name: "ZUBA", role: "The pup who hears the coin sing" },
      { name: "Baba Griot", role: "Mentor and keeper of the last song" },
      { name: "The Hollow King", role: "The one who broke the coin" },
    ],
    features: [
      "Hand-crafted interconnected world across 5 African-inspired realms",
      "Ancestral shrines that unlock new abilities",
      "Collect story Echoes and listen to them in the Codex",
      "Holder perks: early access builds and in-game cosmetics (planned)",
    ],
    quote: "Every step you take, an ancestor took first.",
    poster: img("zuba-game-poster"),
    backdrop: img("zuba-game-backdrop"),
    stills: [img("zuba-game-still-1"), img("zuba-game-still-2")],
  },
  {
    slug: "ninki-nanka-swamp-legend",
    kind: "game",
    title: "Ninki Nanka: Swamp Legend",
    runes: "Ninki Nanka",
    shelf: "Legends You Can Play",
    genre: "Action-Adventure · Stealth",
    origin: "Gambia · Senegal",
    status: "Concept",
    format: "PC · Console",
    logline: "Legend says whoever sees the dragon dies. So you will hunt it blind.",
    synopsis:
      "The elders of the Gambia River say the Ninki Nanka is a swamp dragon with a crocodile's head and mirror-scales, and that to look upon it is death. When the dragon drags young Lamin's village into fear, he enters the swamp with a blindfold, a spear and the sounds of the river as his only guide.",
    chapters: [
      {
        title: "Act I · The Warning",
        body: "Strange tracks, silent birds and a fishing boat found split in two. Lamin's grandfather teaches him to hunt with his ears.",
      },
      {
        title: "Act II · The Sunken Shrines",
        body: "Explore mangrove mazes and half-sunk stone shrines, using echo-sight to map the swamp around you.",
      },
      {
        title: "Act III · The Mirror",
        body: "Face the dragon in its lair, where every surface reflects. Open your eyes at the wrong moment and it is over.",
      },
    ],
    cast: [
      { name: "Lamin", role: "Young hunter" },
      { name: "Grandfather Seyni", role: "Former dragon tracker" },
      { name: "Ninki Nanka", role: "The swamp dragon" },
    ],
    features: [
      "Echo-sight: see the world through sound",
      "Blindfold mechanic: risk and reward with every glance",
      "Mangrove swamp with day/night cycle",
    ],
    poster: img("ninki-poster"),
    backdrop: img("ninki-backdrop"),
    stills: [img("ninki-still-1"), img("ninki-still-2")],
  },
  {
    slug: "impundulu-storm-riders",
    kind: "game",
    title: "Impundulu: Storm Riders",
    runes: "Impundulu",
    shelf: "Legends You Can Play",
    genre: "Sky Racing · Multiplayer",
    origin: "Zulu · Xhosa",
    status: "Concept",
    format: "PC · Mobile",
    logline: "Bond with a lightning bird. Race the storm. Become the Storm Keeper.",
    synopsis:
      "In the old stories the Impundulu is a bird of lightning whose wings are the thunder itself. In Storm Riders, young riders across the Drakensberg bond with these birds and race through floating rock rings in the heart of the storm for the title of Storm Keeper.",
    chapters: [
      {
        title: "Season I · The Hatching",
        body: "Find and raise your Impundulu from a storm-egg. Every bird has its own temper, speed and lightning style.",
      },
      {
        title: "Season II · The Peaks",
        body: "Race the courses of the Drakensberg, where Ndebele-pattern rings mark the path and the storm changes every lap.",
      },
      {
        title: "Season III · Storm Keeper",
        body: "The grand race. One rider will hold the storm for a year.",
      },
    ],
    cast: [
      { name: "Thandeka", role: "Rookie rider" },
      { name: "Inyoni", role: "Her untamed lightning bird" },
    ],
    features: ["Online races up to 8 riders", "Raise and customise your bird", "Dynamic storms that rewrite each track"],
    poster: img("impundulu-poster"),
    backdrop: img("impundulu-backdrop"),
    stills: [img("impundulu-still-1"), img("impundulu-still-2")],
  },
  {
    slug: "oware-clash-of-kings",
    kind: "game",
    title: "Oware: Clash of Kings",
    runes: "Oware",
    shelf: "Legends You Can Play",
    genre: "Strategy · PvP",
    origin: "Akan · Ghana",
    status: "Concept",
    format: "Mobile · Web",
    logline: "The oldest strategy game on Earth, reborn as a battle for the Golden Stool.",
    synopsis:
      "Oware, the mancala game played across Africa for centuries, becomes an arena where every seed is a soldier. Sow, capture and outthink rival kings in fast ranked matches, story campaigns and community tournaments.",
    chapters: [
      {
        title: "Campaign · The Seven Courts",
        body: "Challenge seven legendary court masters, each with their own style, from the patient farmer to the reckless warlord.",
      },
      {
        title: "Arena · Ranked Seasons",
        body: "Climb from Village Player to King of the Board in quick competitive matches.",
      },
      {
        title: "Community · Tournaments",
        body: "Holder-hosted tournaments with community prize pools (planned).",
      },
    ],
    cast: [
      { name: "Nana Ama", role: "Grandmaster of the Golden Court" },
      { name: "The Seed Spirits", role: "Your army" },
    ],
    features: ["Classic Abapa oware rules", "3-minute matches", "Cross-platform ranked play"],
    poster: img("oware-poster"),
    backdrop: img("oware-backdrop"),
    stills: [img("oware-still-1"), img("oware-still-2")],
  },
  {
    slug: "grootslang-cave-of-a-thousand-gems",
    kind: "game",
    title: "Grootslang: Cave of a Thousand Gems",
    runes: "Grootslang",
    shelf: "Legends You Can Play",
    genre: "Roguelite · Puzzle · Exploration",
    origin: "Richtersveld · South Africa",
    status: "Concept",
    format: "PC · Console",
    logline: "The deepest cave in the world is full of diamonds. Something very old is guarding them.",
    synopsis:
      "Legends of the Richtersveld tell of the Grootslang, a creature as old as the world, half elephant and half serpent, coiled in a bottomless cave full of gems. Each run takes you deeper into a cave that rearranges itself, and the Grootslang remembers everyone who tried to steal from it.",
    chapters: [
      {
        title: "Depth I · The Wonder Hole",
        body: "Glittering caverns, simple puzzles and the first sign that you are being watched.",
      },
      {
        title: "Depth II · The Breathing Walls",
        body: "The cave shifts with every descent. Crystals hum, and the hum is getting louder.",
      },
      {
        title: "Depth III · The Coil",
        body: "Reach the bottom and decide: take the gem or leave a gift.",
      },
    ],
    cast: [
      { name: "Kea", role: "Gem-reader and climber" },
      { name: "The Grootslang", role: "The first creature" },
    ],
    features: ["Procedural cave layouts", "Choices the Grootslang remembers", "Crystal-light puzzles"],
    poster: img("grootslang-poster"),
    backdrop: img("grootslang-backdrop"),
    stills: [img("grootslang-still-1"), img("grootslang-still-2")],
  },
];

export const allTitles = [...movies, ...games];

export function findTitle(kind: string, slug: string) {
  return allTitles.find((t) => t.slug === slug && (kind === "movies" ? t.kind === "movie" : t.kind === "game"));
}
