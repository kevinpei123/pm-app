export type ParsedQuickAdd = {
  title: string;
  dueDate: Date | null;
  startDate: Date | null;
  durationMinutes: number | null;
  tagNames: string[];
  assigneeTokens: string[];
  recurrenceRule: string | null;
};

const TAG_RE = /(^|\s)#([\w-]+)/g;
const ASSIGNEE_RE = /(^|\s)@([\w.-]+)/g;
const DURATION_RE = /\b(\d+)\s*(m|min|mins|minute|minutes|h|hr|hrs|hour|hours|d|day|days)\b/i;
const EVERY_RE = /\bevery\s+(day|weekday|weekend|week|month|year|monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i;

function stripTokens(input: string) {
  return input.replace(TAG_RE, " ").replace(ASSIGNEE_RE, " ").replace(/\s+/g, " ").trim();
}

function parseDuration(input: string) {
  const match = input.match(DURATION_RE);
  if (!match) return null;
  const value = Number(match[1]);
  const unit = match[2].toLowerCase();
  if (Number.isNaN(value)) return null;
  if (unit.startsWith("m")) return value;
  if (unit.startsWith("h")) return value * 60;
  if (unit.startsWith("d")) return value * 60 * 24;
  return null;
}

function parseEveryRule(input: string) {
  const match = input.match(EVERY_RE);
  if (!match) return null;
  const token = match[1].toLowerCase();
  switch (token) {
    case "day":
      return "FREQ=DAILY";
    case "weekday":
      return "FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR";
    case "weekend":
      return "FREQ=WEEKLY;BYDAY=SA,SU";
    case "week":
      return "FREQ=WEEKLY";
    case "month":
      return "FREQ=MONTHLY";
    case "year":
      return "FREQ=YEARLY";
    default: {
      const days: Record<string, string> = {
        monday: "MO",
        tuesday: "TU",
        wednesday: "WE",
        thursday: "TH",
        friday: "FR",
        saturday: "SA",
        sunday: "SU",
      };
      if (days[token]) {
        return `FREQ=WEEKLY;BYDAY=${days[token]}`;
      }
      return null;
    }
  }
}

function parseDateLike(input: string) {
  const now = new Date();
  const lower = input.toLowerCase();
  const base = new Date(now);

  if (lower.includes("tomorrow")) {
    base.setDate(base.getDate() + 1);
  } else if (lower.includes("today")) {
    // keep today
  } else if (lower.includes("next week")) {
    base.setDate(base.getDate() + 7);
  } else if (lower.includes("next month")) {
    base.setMonth(base.getMonth() + 1);
  }

  const inMatch = lower.match(/\bin\s+(\d+)\s*(day|days|week|weeks|hour|hours|minute|minutes)\b/);
  if (inMatch) {
    const value = Number(inMatch[1]);
    const unit = inMatch[2];
    if (!Number.isNaN(value)) {
      if (unit.startsWith("day")) base.setDate(base.getDate() + value);
      if (unit.startsWith("week")) base.setDate(base.getDate() + value * 7);
      if (unit.startsWith("hour")) base.setHours(base.getHours() + value);
      if (unit.startsWith("minute")) base.setMinutes(base.getMinutes() + value);
    }
  }

  const timeMatch = lower.match(/\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/);
  if (timeMatch) {
    let hours = Number(timeMatch[1]);
    const minutes = Number(timeMatch[2] ?? "0");
    const meridian = timeMatch[3];
    if (meridian === "pm" && hours < 12) hours += 12;
    if (meridian === "am" && hours === 12) hours = 0;
    base.setHours(hours, minutes, 0, 0);
  }

  if (base.getTime() === now.getTime()) {
    return null;
  }
  return base;
}

export function parseQuickAdd(input: string): ParsedQuickAdd {
  const tagNames: string[] = [];
  const assigneeTokens: string[] = [];

  let match: RegExpExecArray | null;
  const tagRe = new RegExp(TAG_RE);
  while ((match = tagRe.exec(input)) !== null) {
    if (match[2]) tagNames.push(match[2].toLowerCase());
  }

  const assigneeRe = new RegExp(ASSIGNEE_RE);
  while ((match = assigneeRe.exec(input)) !== null) {
    if (match[2]) assigneeTokens.push(match[2]);
  }

  const durationMinutes = parseDuration(input);
  const dueDate = parseDateLike(input);
  const recurrenceRule = parseEveryRule(input);

  const title = stripTokens(input)
    .replace(/\b(tomorrow|today|next\s+week|next\s+month)\b/gi, "")
    .replace(/\bin\s+\d+\s*(day|days|week|weeks|hour|hours|minute|minutes)\b/gi, "")
    .replace(DURATION_RE, "")
    .replace(EVERY_RE, "")
    .replace(/\s+/g, " ")
    .trim();

  return {
    title: title || input.trim(),
    dueDate,
    startDate: null,
    durationMinutes,
    tagNames,
    assigneeTokens,
    recurrenceRule,
  };
}
