import type { ChronicleEntry, GameDate } from "./types";

/** Час, после которого на главном экране появляется строка «Записать в хронику». */
export const EVENING_HOUR = 19;

/** Вечер игровых суток: с 19:00 до начала следующих суток (после полуночи день ещё тот же). */
export function isEvening(now: Date, dayStartHour: number): boolean {
  const hour = now.getHours();
  return hour >= EVENING_HOUR || hour < dayStartHour;
}

export function blankChronicle(gameDate: GameDate): ChronicleEntry {
  return { gameDate, happened: "", noticed: "", feeling: "", mood: null, updatedAt: "" };
}

export function isBlank(entry: Pick<ChronicleEntry, "happened" | "noticed" | "feeling" | "mood">): boolean {
  return !entry.happened.trim() && !entry.noticed.trim() && !entry.feeling.trim() && entry.mood === null;
}

export const MOODS = [1, 2, 3, 4, 5] as const;

/**
 * Хроника дня в Markdown: записи от старых к новым, пустые пропускаются.
 * `moodLabel[n]` подписывает настроение 1–5; `humanDate` превращает дату в заголовок.
 */
export function chronicleMarkdown(
  entries: readonly ChronicleEntry[],
  hero: string,
  moodLabel: readonly string[],
  humanDate: (date: GameDate) => string,
): string {
  const sections = [...entries]
    .filter((e) => !isBlank(e))
    .sort((a, b) => a.gameDate.localeCompare(b.gameDate))
    .map((e) => {
      const lines = [`## ${humanDate(e.gameDate)} ${e.gameDate.slice(0, 4)}`];
      if (e.mood !== null) lines.push(`*Настроение: ${moodLabel[e.mood] ?? String(e.mood)}*`);
      for (const [title, text] of [
        ["Что произошло", e.happened],
        ["Что заметил", e.noticed],
        ["Что чувствую", e.feeling],
      ] as const) {
        if (text.trim()) lines.push(`**${title}.** ${text.trim()}`);
      }
      return lines.join("\n\n");
    });
  return [`# Хроника героя ${hero}`, ...sections].join("\n\n") + "\n";
}
