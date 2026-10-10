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

// Placeholder until the full text is in place.
export const whitepaper: Whitepaper = {
  title: "The ZUBA Whitepaper",
  subtitle: "Africa's stories, built into games and animation the whole world can play.",
  version: "Version 1.0 · October 2026",
  abstract: "Draft in progress.",
  facts: [
    { label: "Token", value: "$ZUBA" },
    { label: "Network", value: "BNB Smart Chain" },
    { label: "Supply", value: "500,000,000,000" },
  ],
  chapters: [{ id: "why-we-are-here", title: "Why We Are Here", kicker: "Every legend begins with a reason.", sections: [{ heading: "Draft", paragraphs: ["Coming soon."] }] }],
  sources: [],
};
