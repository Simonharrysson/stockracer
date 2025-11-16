import { RANDOM_NAME_ADJECTIVES, RANDOM_NAME_NOUNS } from "../constants";

export function generateRandomName() {
  const pick = (arr: string[]) => arr[Math.floor(Math.random() * arr.length)];
  const num = Math.floor(Math.random() * 900 + 100); // 100-999
  return `${pick(RANDOM_NAME_ADJECTIVES)} ${pick(RANDOM_NAME_NOUNS)} ${num}`;
}
