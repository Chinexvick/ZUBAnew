export type Utility = {
  key: string;
  verb: string;
  name: string;
  body: string;
  lore: string;
  status: "Live" | "In production" | "Planned";
};

// What $ZUBA unlocks across the ZUBA universe. Update `status` as each one ships.
export const utilities: Utility[] = [
  {
    key: "watch",
    verb: "Watch",
    name: "Theatre Pass",
    body: "Season passes, early premieres and behind-the-scenes access to ZUBA films and series, paid for in $ZUBA.",
    lore: "The griot never told a story to an empty fire.",
    status: "Planned",
  },
  {
    key: "read",
    verb: "Read",
    name: "Story Vault",
    body: "Comics, illustrated folktales and lore books from the ZUBA universe, unlocked with $ZUBA.",
    lore: "Every page is a door. The coin is the key.",
    status: "Planned",
  },
  {
    key: "play",
    verb: "Play",
    name: "Game Key",
    body: "Items, early access and season passes across ZUBA games, starting with ZUBA, our endless runner built on the ZUBA animation, now in production.",
    lore: "Run far enough and the road starts telling you its name.",
    status: "In production",
  },
  {
    key: "own",
    verb: "Own",
    name: "Collectibles",
    body: "Character and scene NFTs minted with $ZUBA. Some carry perks inside the games and stories they come from.",
    lore: "What the village makes, the village keeps.",
    status: "Planned",
  },
  {
    key: "gather",
    verb: "Gather",
    name: "Events",
    body: "Tickets to premieres, watch parties, meetups and creator workshops, online and across Africa.",
    lore: "One drum is a heartbeat. A thousand drums are a nation.",
    status: "Planned",
  },
  {
    key: "compete",
    verb: "Compete",
    name: "Tournaments",
    body: "Entry and prize pools for game tournaments and creative contests in art, animation and writing.",
    lore: "Champions are not born in the palace. They are made in the arena.",
    status: "Planned",
  },
  {
    key: "speak",
    verb: "Speak",
    name: "Language App",
    body: "Learn African languages such as Yoruba, Swahili and Zulu through stories and games. Premium lessons unlock with $ZUBA.",
    lore: "A people who keep their tongue keep their way home.",
    status: "Planned",
  },
];
