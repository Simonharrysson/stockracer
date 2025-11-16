import type { GameRow } from "./types";

export const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

export const STATUS_BADGES: Record<
  GameRow["status"],
  { label: string; bg: string; color: string; border: string }
> = {
  LOBBY: {
    label: "Lobby",
    bg: "rgba(251, 191, 36, 0.12)",
    color: "#fbbf24",
    border: "rgba(251, 191, 36, 0.4)",
  },
  DRAFTING: {
    label: "Drafting",
    bg: "rgba(96, 165, 250, 0.12)",
    color: "#93c5fd",
    border: "rgba(96, 165, 250, 0.4)",
  },
  ACTIVE: {
    label: "Active",
    bg: "rgba(16, 185, 129, 0.12)",
    color: "#34d399",
    border: "rgba(16, 185, 129, 0.4)",
  },
  FINISHED: {
    label: "Finished",
    bg: "rgba(148, 163, 184, 0.12)",
    color: "#cfd6e7",
    border: "rgba(148, 163, 184, 0.4)",
  },
};

export const RANDOM_NAME_ADJECTIVES = [
  "Swift",
  "Lucky",
  "Bold",
  "Clever",
  "Brave",
  "Neon",
  "Turbo",
  "Prime",
  "Atomic",
  "Rapid",
  "Sunny",
  "Fuzzy",
  "Magic",
  "Cosmic",
  "Quantum",
  "Nova",
];

export const RANDOM_NAME_NOUNS = [
  "Bulls",
  "Bears",
  "Titans",
  "Rockets",
  "Sharks",
  "Wolves",
  "Alphas",
  "Mavericks",
  "Owls",
  "Falcons",
  "Panthers",
  "Dragons",
  "Hawks",
  "Racers",
];
