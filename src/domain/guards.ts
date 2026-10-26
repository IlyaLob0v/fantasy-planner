export type JsonRecord = Record<string, unknown>;

export function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function readNumber(source: JsonRecord, key: string): number {
  const value = source[key];
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(`Ожидалось число в поле «${key}»`);
  }
  return value;
}

export function readRecord(source: JsonRecord, key: string): JsonRecord {
  const value = source[key];
  if (!isRecord(value)) {
    throw new Error(`Ожидался объект в поле «${key}»`);
  }
  return value;
}
