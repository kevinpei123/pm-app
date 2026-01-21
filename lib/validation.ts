export function requireTrimmed(value: unknown, message: string) {
  const text = String(value ?? "").trim();
  if (!text) {
    return { ok: false as const, error: message };
  }
  return { ok: true as const, value: text };
}

export function maxLen(value: string, max: number, message: string) {
  if (value.length > max) {
    return { ok: false as const, error: message };
  }
  return { ok: true as const };
}

export function parsePriority(value: unknown, min: number, max: number) {
  const num = Number(value);
  if (!Number.isInteger(num) || num < min || num > max) {
    return { ok: false as const, error: `Priority must be an integer between ${min} and ${max}` };
  }
  return { ok: true as const, value: num };
}

export function parseDateInput(value: unknown) {
  const raw = String(value ?? "").trim();
  if (!raw) return { ok: true as const, value: null };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    return { ok: false as const, error: "Due date must be a valid date" };
  }
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) {
    return { ok: false as const, error: "Due date must be a valid date" };
  }
  return { ok: true as const, value: parsed };
}

export function parseDateTimeInput(value: unknown) {
  const raw = String(value ?? "").trim();
  if (!raw) return { ok: true as const, value: null };
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) {
    return { ok: false as const, error: "Date must be a valid datetime" };
  }
  return { ok: true as const, value: parsed };
}
