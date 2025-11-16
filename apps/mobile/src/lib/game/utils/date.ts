import { MONTHS } from "../constants";

export function formatShortDate(value?: string | null, fallback = "—") {
  if (!value) return fallback;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return fallback;
  const month = MONTHS[date.getMonth()];
  if (!month) return fallback;
  const day = date.getDate();
  const year = date.getFullYear();
  const currentYear = new Date().getFullYear();
  const suffix = year === currentYear ? "" : `, ${year}`;
  return `${month} ${day}${suffix}`;
}
