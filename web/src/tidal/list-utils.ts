export function parseListField(value: string): string[] {
  return String(value)
    .split(/[\n,]/)
    .map((v) => v.trim())
    .filter(Boolean);
}

export function uniqueCaseInsensitive(values: string[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();

  for (const value of values) {
    const trimmed = String(value).trim();
    if (!trimmed) {
      continue;
    }
    const key = trimmed.toLowerCase();
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    out.push(trimmed);
  }

  return out;
}

export function normalizeTextMatch(value: string): string {
  return String(value).trim().replace(/\s+/g, ' ').toLowerCase();
}
