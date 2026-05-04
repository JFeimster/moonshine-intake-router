const EASTERN_TIME_ZONE = "America/New_York";

function getEasternDateParts(date = new Date()): { year: number; month: number; day: number; weekday: string } {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: EASTERN_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
  });

  const parts = formatter.formatToParts(date);
  const value = (type: string) => parts.find((part) => part.type === type)?.value ?? "";

  return {
    year: Number(value("year")),
    month: Number(value("month")),
    day: Number(value("day")),
    weekday: value("weekday"),
  };
}

function toIsoDate(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function fromEasternDateParts(year: number, month: number, day: number): Date {
  return new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
}

export function getTodayIsoDate(date = new Date()): string {
  const { year, month, day } = getEasternDateParts(date);
  return toIsoDate(year, month, day);
}

export function getNextBusinessDayIsoDate(date = new Date()): string {
  const today = getEasternDateParts(date);
  let candidate = fromEasternDateParts(today.year, today.month, today.day);

  do {
    candidate = new Date(candidate.getTime() + 24 * 60 * 60 * 1000);
    const weekday = getEasternDateParts(candidate).weekday;

    if (weekday !== "Sat" && weekday !== "Sun") {
      const { year, month, day } = getEasternDateParts(candidate);
      return toIsoDate(year, month, day);
    }
  } while (true);
}

export function mapPreferredStartToNotionOption(preferredStart?: string): string {
  const normalized = preferredStart?.trim().toLowerCase() ?? "";

  if (!normalized) return "Not sure yet";
  if (normalized.includes("today")) return "Today";
  if (normalized.includes("week")) return "This week";
  if (normalized.includes("month")) return "This month";
  if (normalized.includes("yesterday") || normalized.includes("asap") || normalized.includes("immediately")) {
    return "Yesterday";
  }
  if (normalized.includes("exploring") || normalized.includes("curious")) return "Just exploring";

  return "Not sure yet";
}
