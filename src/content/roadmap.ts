export type Phase = {
  n: number;
  name: string;
  quest: string;
  status: "cleared" | "active" | "locked";
  objectives: string[];
  lore: string;
};

// Update `status` as the project moves forward: cleared, active or locked.
export const phases: Phase[] = [
  {
    n: 1,
    name: "The Awakening",
    quest: "Light the first fire.",
    status: "cleared",
    objectives: ["Token launch", "Community formation", "Brand foundation"],
    lore: "Before the village, there was a single spark. Someone had to strike it.",
  },
  {
    n: 2,
    name: "The Rising",
    quest: "Gather the tribe.",
    status: "active",
    objectives: ["Community growth", "Creator partnerships", "Ecosystem development"],
    lore: "One drum is a heartbeat. A thousand drums are a nation.",
  },
  {
    n: 3,
    name: "The First Chapter",
    quest: "Open the storybook.",
    status: "locked",
    objectives: ["Gaming prototypes", "Animation development", "New experiences"],
    lore: "Every legend begins with a first page. Ours will be drawn by African hands.",
  },
  {
    n: 4,
    name: "The Expansion",
    quest: "Cross the great river.",
    status: "locked",
    objectives: ["Partnerships", "Ecosystem utilities", "International growth"],
    lore: "The river does not ask the stone for permission. It carves its own path to the sea.",
  },
  {
    n: 5,
    name: "Africa to the World",
    quest: "Take the main stage.",
    status: "locked",
    objectives: ["Games", "Animation", "Digital experiences", "New IP"],
    lore: "We were never the side quest. We are the main story.",
  },
];
