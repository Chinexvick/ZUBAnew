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
  /** ZUBA Arcade game id: the title can be played at /play?game=<id>. */
  play?: string;
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

// Our playable games. They run on the website at /play (ZUBA Arcade) with the
// same accounts, levels and ZUBA as the Zualingo app. `play` is the arcade id.
const g = (id: string) => ({
  poster: `/media/games/${id}-poster.webp`,
  backdrop: `/media/games/${id}-backdrop.webp`,
  stills: [`/media/games/${id}-still-1.webp`, `/media/games/${id}-still-2.webp`],
});

export const games: Title[] = [
  {
    slug: "zuba-kingdom",
    kind: "game",
    play: "kingdom",
    title: "Zuba Kingdom: Rise of the Village",
    runes: "Kingdom",
    shelf: "Play Now",
    genre: "City Builder · Strategy",
    origin: "Pan-African",
    status: "Play Now",
    format: "Web · Android",
    logline: "Start as a village chief. Build farms, markets and a royal palace, grow your people and rise to Emperor.",
    synopsis:
      "Every great kingdom started as a few round huts and a dream. Choose your king or queen, clear the land, plant your farms and build homes for your people. Upgrade the Royal Palace to unlock markets, story houses, smithies and training grounds, expand your land and climb from Village Chief to Emperor. Your kingdom keeps growing while you are away, and everything you learn in Zualingo sends gifts to your people.",
    chapters: [
      { title: "Build", body: "Place farms, woodcutters, quarries and family houses on a living isometric map. Builders work in real time; finish early with ZUBA if you cannot wait." },
      { title: "Grow", body: "More homes mean more workers. Wells, baobabs, drum circles and fountains make your people happy, and happy people work faster." },
      { title: "Rule", body: "Upgrade the Royal Palace through five levels, expand your borders and rise from Village Chief to High Chief, Prince, King and Emperor." },
      { title: "Visit", body: "Climb the Great Rulers board, visit other players' kingdoms and leave them a gift of gold." },
    ],
    cast: [
      { name: "Your Ruler", role: "A king or queen of your choosing" },
      { name: "The Villagers", role: "Farmers, drummers and children who bring the village to life" },
      { name: "The Builders", role: "Each hut gives you one more pair of hands" },
    ],
    features: [
      "20 quests and 3 new daily missions every day",
      "21 buildings and decorations, five palace levels",
      "Lessons, riddles and games send resources to your kingdom",
      "Leaderboard and kingdom visits",
      "Same kingdom on the web and in the Zualingo app",
    ],
    quote: "A village is not built in a day, but every day it can grow.",
    ...g("kingdom"),
  },
  {
    slug: "zuba-run",
    kind: "game",
    play: "run",
    title: "Zuba Run: The Shadows of Africa",
    runes: "Zuba",
    shelf: "Play Now",
    genre: "Action Runner · Adventure",
    origin: "Pan-African",
    status: "Play Now",
    format: "Web · Android",
    logline: "Long ago, every word spoken across Africa lived as a light in the Tree of Voices. Then the shadows came.",
    synopsis:
      "ZUBA, the white pup in royal violet, runs through forest, savanna and village to win back the lights of the Tree of Voices. Jump, dash and fight shadow creatures, face their guardians in boss battles and unlock a real word from an African language with every light you free.",
    chapters: [
      { title: "Forest", body: "Giant trees, hidden chests and bats in the canopy. Learn the rhythm of the run." },
      { title: "Savanna", body: "Open plains, floating platforms and phantoms that strike from the sky." },
      { title: "Village", body: "Thatched roofs, torch-lit paths and the shadow guardian waiting at the end." },
      { title: "Words of Power", body: "Every freed light is a word. Collect them and hear how they are said." },
    ],
    cast: [
      { name: "ZUBA", role: "The white pup in royal violet, hero of the ZUBA universe" },
      { name: "The Shadows", role: "Bats, phantoms and wraiths that swallow the words" },
      { name: "The Guardian", role: "Boss of the shadows" },
    ],
    features: ["Hand-painted African worlds", "Boss battles and special powers", "Outfits for ZUBA", "Earn ZUBA and unlock real words", "Same progress on the web and in the app"],
    ...g("run"),
  },
  {
    slug: "zuba-boom",
    kind: "game",
    play: "boom",
    title: "Zuba Boom",
    runes: "Boom",
    shelf: "Play Now",
    genre: "Physics Puzzle",
    origin: "Pan-African",
    status: "Play Now",
    format: "Web · Android",
    logline: "Three or four bombs. Stone forts. Only the wise win all 72 stars.",
    synopsis:
      "Pull back the slingshot, aim and let fly. Clay, wood, glass and stone forts guard the shadow masks, and every level gives you only a few bombs. Read the structure, find the weak point and bring it down in one clever shot.",
    chapters: [
      { title: "Aim", body: "Real physics: every block has weight, every fort can fall." },
      { title: "Blast", body: "Clay crumbles, wood splinters, glass shatters and stone holds. Pick your moment." },
      { title: "Master", body: "Three stars for the fewest bombs. 72 stars to collect across the levels." },
    ],
    cast: [
      { name: "ZUBA", role: "Slingshot champion" },
      { name: "The Shadow Masks", role: "Hiding behind their forts" },
    ],
    features: ["Real physics engine", "Hand-built levels with 72 stars", "Extra bombs when you need them", "Earn ZUBA for every win"],
    ...g("boom"),
  },
  {
    slug: "zuba-quiz",
    kind: "game",
    play: "quiz",
    title: "Zuba Quiz: Live Battles",
    runes: "Quiz",
    shelf: "Play Now",
    genre: "Live Multiplayer Quiz",
    origin: "Pan-African",
    status: "Play Now",
    format: "Web · Android",
    logline: "Up to 50 friends in one room. Everyone gets the same question. First right answer takes the points.",
    synopsis:
      "Create a room, share the code and battle your friends live, or play solo for ten quick questions. Questions cover African words, history and culture, and the winners take home ZUBA.",
    chapters: [
      { title: "Create", body: "Start a room and invite up to 50 friends with a short code." },
      { title: "Battle", body: "Everyone sees the same question at the same time. Speed and knowledge both count." },
      { title: "Win", body: "Climb the podium, win ZUBA and top the weekly board." },
    ],
    cast: [{ name: "ZUBA", role: "Your quiz host on the drums" }],
    features: ["Live rooms for up to 50 players", "Solo mode", "ZUBA prizes for winners", "Weekly leaderboard"],
    ...g("quiz"),
  },
  {
    slug: "kitendawili",
    kind: "game",
    play: "riddle",
    title: "Kitendawili: African Riddles",
    runes: "Riddles",
    shelf: "Play Now",
    genre: "Riddles · Live Multiplayer",
    origin: "East Africa · Pan-African",
    status: "Play Now",
    format: "Web · Android",
    logline: "\"Kitendawili!\" \"Tega!\" 200 riddles of the elders, alone or live with friends.",
    synopsis:
      "Around the fire, the elders begin: Kitendawili! And everyone answers: Tega! Solve 200 riddles from across Africa with Anansi as your guide, unlock new tiers, use a hint when you are stuck, or open a live room and race your friends.",
    chapters: [
      { title: "Listen", body: "Each riddle is a little story. Read it twice." },
      { title: "Solve", body: "Spell the answer from the letters. Fewer hints, more stars." },
      { title: "Challenge", body: "Open a live room and see who solves it first." },
    ],
    cast: [
      { name: "Anansi", role: "The clever spider who keeps the riddles" },
      { name: "The Elder", role: "Asks the riddles by the fire" },
    ],
    features: ["200 riddles across tiers", "Live riddle rooms", "Hints and magic wands", "Earn ZUBA and stars"],
    ...g("riddle"),
  },
];

export const allTitles = [...movies, ...games];

export function findTitle(kind: string, slug: string) {
  return allTitles.find((t) => t.slug === slug && (kind === "movies" ? t.kind === "movie" : t.kind === "game"));
}
