// Partner With Us: tracks, the questions each track asks, and the page copy.
export type FieldKind = "text" | "url" | "textarea" | "select" | "email";
export type Field = { id: string; label: string; kind: FieldKind; required?: boolean; placeholder?: string; options?: string[]; hint?: string };

export type Track = {
  id: string;
  name: string;
  short: string;
  icon: string;
  blurb: string;
  gets: string[];
  fields: Field[];
};

const contact: Field = {
  id: "contact",
  label: "Contact person's Telegram or WhatsApp",
  kind: "text",
  required: true,
  placeholder: "@handle or +234…",
  hint: "An active line. This is how our team will reach you.",
};
const email: Field = { id: "email", label: "Email (optional)", kind: "email", placeholder: "you@studio.com" };

const projectFields = (proposalLabel: string, proposalHint: string): Field[] => [
  { id: "name", label: "Your name", kind: "text", required: true },
  { id: "company", label: "Company or project name", kind: "text", required: true },
  { id: "social", label: "X page or other social media", kind: "text", required: true, placeholder: "https://x.com/yourproject" },
  { id: "website", label: "Website", kind: "url", placeholder: "https://" },
  { id: "proposal", label: proposalLabel, kind: "textarea", required: true, hint: proposalHint },
  contact,
  email,
];

export const tracks: Track[] = [
  {
    id: "anime",
    name: "Anime & Movies",
    short: "Studios",
    icon: "watch",
    blurb: "Co-produce African anime, films and series with the ZUBA universe and its community behind you.",
    gets: ["Co-production and IP collaboration", "Premieres to the ZUBA community", "Token-powered fan funding and rewards"],
    fields: projectFields("Your intention or proposal", "What you want to build together, the stage you're at, and what you need from ZUBA."),
  },
  {
    id: "games",
    name: "Games",
    short: "Projects",
    icon: "play",
    blurb: "Bring your game into the ZUBA ecosystem: crossovers, in-game $ZUBA utility, shared launches.",
    gets: ["$ZUBA integration and in-game rewards", "Cross-promotion to our players", "Access to ZUBA characters and worlds"],
    fields: projectFields("Your intention or proposal", "Your game, its platform and stage, and how you'd like to work with ZUBA."),
  },
  {
    id: "marketing",
    name: "Marketing",
    short: "Agencies & KOLs",
    icon: "gather",
    blurb: "Agencies, KOLs, communities and listing platforms who can carry the ZUBA story further.",
    gets: ["Campaign partnerships", "Co-hosted AMAs and Spaces", "Long-term ambassador deals"],
    fields: projectFields("Your offer or proposal", "Your reach, past campaigns and what you propose for ZUBA."),
  },
  {
    id: "testers",
    name: "Testers",
    short: "Players",
    icon: "compete",
    blurb: "Play our games before anyone else, report what you find, and earn $ZUBA for every round of testing.",
    gets: ["Early builds of ZUBA games", "Rewards in $ZUBA tokens", "Your name in the credits"],
    fields: [
      { id: "name", label: "Your name", kind: "text", required: true },
      { id: "social", label: "X handle", kind: "text", required: true, placeholder: "@yourhandle" },
      { id: "device", label: "What do you play on?", kind: "select", required: true, options: ["Android", "iPhone", "PC", "Android + PC", "iPhone + PC"] },
      { id: "wallet", label: "BNB Chain wallet (for $ZUBA rewards)", kind: "text", required: true, placeholder: "0x…" },
      { id: "experience", label: "Tell us about yourself as a gamer", kind: "textarea", hint: "Games you love, how often you play, any testing you've done." },
      contact,
      email,
    ],
  },
  {
    id: "creators",
    name: "Creators",
    short: "Content",
    icon: "brush",
    blurb: "Artists, streamers, writers and meme makers who want to tell ZUBA stories and get rewarded for it.",
    gets: ["Paid and token-rewarded content", "Early access to art and trailers", "Features on ZUBA channels"],
    fields: [
      { id: "name", label: "Your name or creator name", kind: "text", required: true },
      { id: "platform", label: "Main platform", kind: "select", required: true, options: ["X", "YouTube", "TikTok", "Instagram", "Twitch", "Telegram", "Other"] },
      { id: "social", label: "Link to your channel or page", kind: "text", required: true, placeholder: "https://" },
      { id: "audience", label: "Audience size", kind: "select", options: ["Under 1K", "1K–10K", "10K–50K", "50K–250K", "250K+"] },
      { id: "proposal", label: "What would you create for ZUBA?", kind: "textarea", required: true },
      contact,
      email,
    ],
  },
  {
    id: "talent",
    name: "Developers & Animators",
    short: "Join the team",
    icon: "id",
    blurb: "Game developers, animators, illustrators and storytellers: apply to join ZUBA's team of talents.",
    gets: ["Work on African games and anime", "Paid roles and token incentives", "A team that builds for the world"],
    fields: [
      { id: "name", label: "Full name", kind: "text", required: true },
      {
        id: "role",
        label: "Your craft",
        kind: "select",
        required: true,
        options: ["Game developer", "Unity / Unreal developer", "2D animator", "3D animator", "Illustrator / concept artist", "Writer / storyteller", "Sound / music", "Web3 / smart contracts", "Other"],
      },
      { id: "portfolio", label: "Portfolio or showreel", kind: "url", required: true, placeholder: "https://" },
      { id: "experience", label: "Years of experience", kind: "select", required: true, options: ["Under 1 year", "1–3 years", "3–5 years", "5+ years"] },
      { id: "social", label: "X, LinkedIn or other profile", kind: "text" },
      { id: "proposal", label: "Why ZUBA? Tell us what you'd bring", kind: "textarea", required: true },
      contact,
      email,
    ],
  },
];

export const trackById = (id: string) => tracks.find((t) => t.id === id);
