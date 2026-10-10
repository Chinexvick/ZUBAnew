export type WPSection = {
  heading: string;
  paragraphs: string[];
  bullets?: string[];
  stats?: { value: string; label: string; source?: string }[];
  table?: { columns: string[]; rows: string[][] };
};

export type WPChapter = { id: string; title: string; kicker: string; sections: WPSection[] };

export type Whitepaper = {
  title: string;
  subtitle: string;
  version: string;
  abstract: string;
  facts: { label: string; value: string }[];
  chapters: WPChapter[];
  sources: { title: string; url: string }[];
};

export const whitepaper: Whitepaper = {
  title: "The ZUBA Whitepaper",
  subtitle: "Africa's stories, built into games and animation the whole world can play.",
  version: "Version 1.0 · October 2026",
  abstract:
    "ZUBA is a community-driven gaming and animation project on BNB Smart Chain. We create original games, animated films and story worlds rooted in African myth, history and modern life, and we use the $ZUBA token as the shared key to that universe: the way holders access films, stories and games, collect, compete, gather and take part in what gets built next. This paper explains why ZUBA exists, what we are building, how the token is structured and how it is meant to be used, and the risks every reader should understand.",
  facts: [
    { label: "Token", value: "$ZUBA" },
    { label: "Network", value: "BNB Smart Chain" },
    { label: "Total supply", value: "500,000,000,000" },
  ],
  chapters: [
    {
      id: "why-we-are-here",
      title: "Why We Are Here",
      kicker: "Every legend begins with a reason.",
      sections: [
        {
          heading: "A story we grew up without",
          paragraphs: [
            "We grew up on games, cartoons and animated legends that never looked like us, never sounded like us and never carried our worlds. We loved them anyway. But somewhere along the way we noticed what was missing.",
            "Africa has always been full of heroes, monsters, gods, warriors, spirits and stories powerful enough to shake the world: a spider who stole the stories from the sky, a boy who could not walk and then founded an empire, leaders who gave their lives so a continent could stand upright. These are not side quests. They are main storylines.",
          ],
        },
        {
          heading: "What ZUBA is",
          paragraphs: [
            "ZUBA is a gaming and animation universe where African culture meets future technology. We build playable worlds, cinematic characters and animated legends inspired by real myths, real cities and real history, and we build them with the community that believes in them.",
            "Our mascot and guide is ZUBA, a small white pup who carries a gold coin. In our lore, the coin holds the echo of every story the elders ever told. Wherever it sings, people remember who they are.",
          ],
        },
        {
          heading: "What we are not",
          paragraphs: ["Not a meme. Not a pump. Not a trend. A world, and a story told across games, films and the people who hold the coin."],
        },
      ],
    },
    {
      id: "the-problem",
      title: "The Problem",
      kicker: "The oldest storyteller on Earth is still waiting at the door.",
      sections: [
        {
          heading: "Under-represented on the world's screens",
          paragraphs: [
            "Global games and animation are dominated by stories, settings and studios from a handful of regions. Norse gods, Greek heroes, Japanese spirits and Arthurian knights all have their franchises. African mythology and history rarely appear, and when they do they are often told from the outside.",
            "For hundreds of millions of young Africans, that means playing and watching worlds where the characters rarely look like them, the stories rarely reflect their history, and the landscapes feel foreign.",
          ],
        },
        {
          heading: "Barriers for African creators",
          paragraphs: ["Talent is not the bottleneck. Across the continent there is a growing generation of artists, animators, writers and developers. What holds them back is structural."],
          bullets: [
            "Funding: animation and game production are expensive and slow, and early-stage African studios have limited access to capital.",
            "Distribution: getting work in front of a global audience usually depends on gatekeepers far from the creators.",
            "Ownership: when African stories are licensed or adapted elsewhere, the value and the IP rarely flow back to the people and communities they come from.",
            "Community: fans who care about these stories have had no direct way to back them, shape them or share in their growth.",
          ],
        },
      ],
    },
    {
      id: "the-opportunity",
      title: "The Opportunity",
      kicker: "The world is hungry for new myths.",
      sections: [
        {
          heading: "The audience is already here",
          paragraphs: [
            "Games are the largest entertainment industry on Earth, and Africa is one of its fastest-growing frontiers. The continent is also the youngest in the world, and it plays mostly on the phone in its pocket.",
          ],
          stats: [
            { value: "≈$197B", label: "global games revenue in 2025", source: "Newzoo (Nov 2025 update)" },
            { value: "3.6B", label: "players worldwide in 2025", source: "Newzoo" },
            { value: "$1.8B", label: "African games market in 2024", source: "Carry1st & Newzoo" },
            { value: "≈349M", label: "gamers in Africa in 2024, about 90% of revenue from mobile", source: "Carry1st & Newzoo" },
            { value: "≈19", label: "median age in Africa, the youngest of any continent", source: "Pew Research Center, UN data" },
          ],
        },
        {
          heading: "Culture travels when it is told with pride",
          paragraphs: [
            "Anime proved it. A form rooted in one country's culture became a global industry: the Association of Japanese Animations measured the anime market at a record ¥3.84 trillion (about US$25 billion) in 2024, with more than half of that coming from outside Japan.",
            "African animation is starting the same journey. Disney+ released Kizazi Moto: Generation Fire, an anthology of African sci-fi films, in 2023, and the Nigerian superhero series Iyanu premiered on Cartoon Network and Max in 2025. Global platforms are now actively looking for African stories.",
          ],
          stats: [
            { value: "¥3.84T", label: "global anime market in 2024 (≈US$25B)", source: "Association of Japanese Animations" },
            { value: "56%", label: "of anime revenue earned overseas in 2024", source: "Association of Japanese Animations" },
          ],
        },
        {
          heading: "Why now",
          paragraphs: [
            "A young, mobile-first audience, global platforms opening their doors, and tools that let a community fund and own what it loves: these have never lined up like this before. ZUBA is built for this moment.",
          ],
        },
      ],
    },
    {
      id: "the-zuba-universe",
      title: "The ZUBA Universe",
      kicker: "One studio, one village, one coin.",
      sections: [
        {
          heading: "Three parts working as one",
          paragraphs: ["ZUBA brings together the people who make the stories, the people who love them, and a token that connects the two."],
          bullets: [
            "The Studio: a creative team that develops original games, animated films and story worlds rooted in African culture.",
            "The Village: the ZUBA community of holders, players, viewers and creators who back the work, spread it and help decide what comes next.",
            "The Coin: $ZUBA, the shared key to the universe, used to access, collect, compete and take part.",
          ],
        },
        {
          heading: "Our mission",
          paragraphs: ["To build world-class African-inspired games and animated universes that inspire, entertain, and give creatives and players real ownership in the worlds they help grow."],
        },
        {
          heading: "Our vision",
          paragraphs: ["To become the leading blockchain-powered gaming and animation studio emerging from Africa, creating global franchises that stand alongside the biggest names in entertainment."],
        },
      ],
    },
    {
      id: "what-we-are-building",
      title: "What We Are Building",
      kicker: "The forge is lit.",
      sections: [
        {
          heading: "Films and series",
          paragraphs: [
            "Our animated slate starts with myths, legends and heroes, told in a modern 2D African animation style. Current concepts in development include:",
          ],
          bullets: [
            "Anansi: Keeper of Stories, from Akan folklore",
            "Sundiata: Lion of Manden, from the epic of the Mali Empire",
            "Lumumba: Voice of the River, a tribute to Congo's first prime minister",
            "Sankara: Land of the Upright, a tribute to Burkina Faso's revolutionary leader",
          ],
        },
        {
          heading: "Games",
          paragraphs: [
            "Our flagship is ZUBA: Rise of the Ancestors, a metroidvania in which ZUBA restores the shattered Coin of Echoes across five African-inspired realms, unlocking ancestral abilities at forgotten shrines. It is at the prototype stage as part of Phase 03.",
            "Alongside it, we are developing concepts drawn from legends across the continent: Ninki Nanka: Swamp Legend, Impundulu: Storm Riders, Oware: Clash of Kings and Grootslang: Cave of a Thousand Gems.",
          ],
        },
        {
          heading: "The wider story universe",
          paragraphs: ["Beyond films and games, the ZUBA universe extends into comics and lore books, collectible characters, community events and an African-language learning app, all connected by the same characters, the same world and the same coin."],
        },
        {
          heading: "Built in the open",
          paragraphs: ["Every step is logged in the Developer Notebook on our website, so holders can always see what has been shipped, what is in progress and what is next."],
        },
      ],
    },
    {
      id: "the-zuba-token",
      title: "The $ZUBA Token",
      kicker: "Forged once. Never again.",
      sections: [
        {
          heading: "Token details",
          paragraphs: ["$ZUBA is a BEP-20 token on BNB Smart Chain with a fixed total supply. It trades on PancakeSwap and can be tracked on DEX Screener and verified on BscScan."],
          table: {
            columns: ["Item", "Detail"],
            rows: [
              ["Name / symbol", "ZUBA / $ZUBA"],
              ["Network", "BNB Smart Chain (BEP-20)"],
              ["Contract", "0xE1bf97baCF682AE17cA3E239aB68a7b525f994A4"],
              ["Total supply", "500,000,000,000"],
            ],
          },
        },
        {
          heading: "Allocation",
          paragraphs: ["The supply was allocated with the community first: the large majority went to the open market at a fair launch."],
          table: {
            columns: ["Allocation", "Share", "Tokens", "Purpose"],
            rows: [
              ["Liquidity & fair launch", "85%", "425,000,000,000", "The trading pool on PancakeSwap, open to everyone"],
              ["Marketing", "10%", "50,000,000,000", "Listings, creator campaigns, events, community growth"],
              ["Development", "5%", "25,000,000,000", "Games, animation and the tools that power the universe"],
            ],
          },
        },
        {
          heading: "Security and transparency",
          paragraphs: ["The ZUBA contract has been audited by VBS Labs, and the project has completed KYC verification with Vital Block Security. Both documents are linked from our website, and the contract is public on BscScan for anyone to inspect."],
          bullets: [
            "Always copy the contract address from the official website or official channels.",
            "The team will never DM you first or ask for your seed phrase.",
          ],
        },
      ],
    },
    {
      id: "what-zuba-unlocks",
      title: "What $ZUBA Unlocks",
      kicker: "One key for every door in the universe.",
      sections: [
        {
          heading: "Planned utilities",
          paragraphs: ["$ZUBA is designed to be used, not just held. The utilities below are planned and will roll out as each product launches; details may change as we build and as the community gives feedback."],
          table: {
            columns: ["Utility", "What it unlocks", "Status"],
            rows: [
              ["Theatre Pass", "Season passes, early premieres and behind-the-scenes access to ZUBA films and series", "Planned"],
              ["Story Vault", "Comics, illustrated folktales and lore books", "Planned"],
              ["Game Key", "Items, early access and season passes in ZUBA games", "Planned (flagship in prototype)"],
              ["Collectibles", "Character and scene NFTs, some with perks in games and stories", "Planned"],
              ["Events", "Tickets to premieres, watch parties, meetups and creator workshops", "Planned"],
              ["Tournaments", "Entry and prize pools for game tournaments and creative contests", "Planned"],
              ["Language App", "Premium lessons for learning African languages through stories and games", "Planned"],
            ],
          },
        },
        {
          heading: "For creators",
          paragraphs: ["We intend to use $ZUBA to reward the artists, animators, writers and players who contribute to the universe, through contests, commissions and community programmes."],
        },
      ],
    },
    {
      id: "the-value-loop",
      title: "The Value Loop",
      kicker: "When the stories are used, the coin is used.",
      sections: [
        {
          heading: "How usage connects to the token",
          paragraphs: [
            "The core idea is simple: the more people watch, read, play, collect and compete in the ZUBA universe, the more often $ZUBA is needed to do it. Better stories attract more fans; more fans use more utilities; that usage funds and motivates more stories.",
          ],
          bullets: [
            "Spend to access: passes, premium chapters and premium lessons priced in $ZUBA.",
            "Spend to take part: event tickets, tournament entries and collectible mints.",
            "Earn by contributing: creator and community rewards paid in $ZUBA.",
          ],
        },
        {
          heading: "Where the studio earns",
          paragraphs: ["A healthy studio needs revenue beyond the token. Over time, ZUBA intends to earn from several streams that also feed the universe:"],
          bullets: [
            "Game revenue: sales, in-game items and season passes",
            "Film and series distribution and licensing",
            "Merchandise and brand partnerships built on ZUBA characters",
            "Events, tournaments and sponsorships",
            "Premium subscriptions to the language app and story content",
          ],
        },
        {
          heading: "An illustrative scenario",
          paragraphs: [
            "To show how the loop works, imagine a single utility: a Theatre Pass priced at the equivalent of US$3 per month and paid in $ZUBA. The table shows how much $ZUBA-denominated spending different audience sizes would represent.",
            "This is a hypothetical illustration of a mechanism, not a forecast, target or promise. It does not predict the price of $ZUBA or any return. Actual pricing, audience size and how spent tokens are handled have not been decided and will be published before launch.",
          ],
          table: {
            columns: ["Monthly pass holders", "Monthly spend (US$ equiv.)", "Yearly spend (US$ equiv.)"],
            rows: [
              ["10,000", "$30,000", "$360,000"],
              ["100,000", "$300,000", "$3,600,000"],
              ["1,000,000", "$3,000,000", "$36,000,000"],
            ],
          },
        },
      ],
    },
    {
      id: "the-road-ahead",
      title: "The Road Ahead",
      kicker: "Five phases from the first spark to the world stage.",
      sections: [
        {
          heading: "The quest line",
          paragraphs: ["Our roadmap is organised into five phases. Progress on each one is reported in the Developer Notebook."],
          table: {
            columns: ["Phase", "Focus", "Status"],
            rows: [
              ["01 · The Awakening", "Token launch, community formation, brand foundation", "Cleared"],
              ["02 · The Rising", "Community growth, creator partnerships, ecosystem development", "In progress"],
              ["03 · The First Chapter", "Gaming prototypes, animation development, new experiences", "Next"],
              ["04 · The Expansion", "Partnerships, ecosystem utilities, international growth", "Planned"],
              ["05 · Africa to the World", "Games, animation, digital experiences, new IP", "Planned"],
            ],
          },
        },
      ],
    },
    {
      id: "the-village",
      title: "The Village",
      kicker: "I am because we are.",
      sections: [
        {
          heading: "Community-driven",
          paragraphs: [
            "ZUBA is built on Ubuntu, the idea that a person is a person through other people. Holders are not an audience; they are the village that carries the legend.",
            "Today the village gathers on X (@zubatoken), Telegram and WhatsApp, alongside a growing list of partner projects.",
          ],
        },
        {
          heading: "How holders take part",
          bullets: [
            "Share the stories and bring new people to the fire",
            "Create fan art, writing and animation and enter community contests",
            "Give feedback on characters, games and films as they are developed",
            "Take part in community votes on selected creative decisions, as we introduce them",
          ],
          paragraphs: [],
        },
      ],
    },
    {
      id: "risks-and-disclaimer",
      title: "Risks & Disclaimer",
      kicker: "Every traveller should know the road.",
      sections: [
        {
          heading: "Please read carefully",
          paragraphs: [
            "This whitepaper is for information only. It is not an offer to sell, a solicitation to buy, or financial, investment, legal or tax advice. Do your own research and consult a qualified adviser before making any decision.",
            "$ZUBA is a utility and community token. Holding it does not give you ownership of the company, a share of profits, or any right to a return.",
          ],
          bullets: [
            "Crypto assets are highly volatile, and you could lose all of the value you put in.",
            "Planned products, utilities and timelines may change, be delayed or not happen.",
            "Laws and regulations on crypto assets differ by country and may change.",
            "Smart contracts, wallets and exchanges carry technical and security risks.",
            "Figures in the illustrative scenario are hypothetical and are not forecasts.",
          ],
        },
      ],
    },
  ],
  sources: [
    { title: "GamesBeat: Global game revenues hit $196.7B in 2025 (Newzoo)", url: "https://gamesbeat.com/?p=312704" },
    { title: "Newzoo: The Games Market in 2025 (summary)", url: "https://gamedevreports.substack.com/p/newzoo-the-games-market-in-2025" },
    { title: "CNBC Africa: Carry1st, Africa's gaming market hit $1.8bn in 2024", url: "https://cnbcafrica.com/media/6368648884112/carry1st-africas-gaming-market-hit-18bn-in-2024" },
    { title: "PocketGamer.biz: Africa's gaming revenue is more than 90% mobile", url: "https://www.pocketgamer.biz/africas-gaming-revenue-is-more-than-90-mobile/" },
    { title: "Pew Research Center: 5 facts about Africa's population growth (2026)", url: "https://www.pewresearch.org/short-reads/2026/05/19/5-facts-about-africas-population-growth/" },
    { title: "Anime News Network: Global anime market grew 15% to record ¥3.84 trillion in 2024", url: "https://www.animenewsnetwork.com/news/2025-10-30/global-anime-market-grew-15-percent-to-record-3.84-trillion-yen-in-2024/.230464" },
    { title: "Animation Scoop: Disney sets debut for Kizazi Moto: Generation Fire", url: "https://www.animationscoop.com/disney-sets-debut-for-kizazi-moto-generation-fire/" },
    { title: "Graphic Policy: Cartoon Network and Max unveil the premiere date for Iyanu", url: "https://graphicpolicy.com/2025/02/17/cartoon-network-and-max-unveils-the-premiere-date-for-iyanu-april-2025" },
  ],
};
