import { addDays } from "./time";
import type { GameDate, QuestFields, RealRewardFields, RitualFields } from "./types";

/**
 * Стартовый набор гильдии: настоящие квесты, которые заодно показывают, как всё устроено.
 * Выдаётся один раз; любой квест можно выполнить, перенести или убрать, как свой.
 */
export interface StarterPack {
  quests: QuestFields[];
  boss: QuestFields;
  stages: Array<Pick<QuestFields, "title" | "damage">>;
  rituals: RitualFields[];
  rewards: RealRewardFields[];
}

function quest(
  type: "main" | "side" | "boss",
  title: string,
  description: string,
  attribute: QuestFields["attribute"],
  difficulty: QuestFields["difficulty"],
  scheduledDate: GameDate | null,
  sortOrder: number,
  dueDate: GameDate | null = null,
): QuestFields {
  return { type, title, description, attribute, difficulty, scheduledDate, dueDate, sortOrder, parentId: null, damage: 1, label: null };
}

export function starterPack(today: GameDate): StarterPack {
  const day = (n: number) => addDays(today, n);
  return {
    quests: [
      quest(
        "side",
        "Сломать печать первого приказа",
        "Нажми на круглую печать слева: монеты полетят в сундук, опыт наполнит полосу уровня. Ошибся — нажми «Отменить».",
        "agility",
        1,
        today,
        0,
      ),
      quest(
        "main",
        "Составить план похода на неделю",
        "Главный квест — важное дело со сроком. Открой Доску квестов и разложи дела по дням недели.",
        "intellect",
        2,
        today,
        1,
        day(2),
      ),
      quest("side", "Размять кости: десять приседаний", "Побочные квесты — короткая рутина. За них меньше золота, зато их много.", "strength", 1, today, 2),
      quest(
        "side",
        "Выставить награду в лавке",
        "В Сокровищнице назначь себе настоящую награду, например вечер с любимой книгой, и копи на неё золото.",
        "agility",
        1,
        day(1),
        0,
      ),
      quest(
        "side",
        "Записать вечер в хронику",
        "После семи вечера на главном экране появится строка «Записать в хронику». Три коротких ответа — и день сохранён в Летописи.",
        "intellect",
        1,
        day(2),
        0,
      ),
      quest(
        "side",
        "Перетащить этот свиток на любой день",
        "Квесты без даты ждут в первой колонке доски. Перетащи свиток на нужный день, когда решишь за него взяться.",
        "agility",
        1,
        null,
        0,
      ),
    ],
    boss: quest(
      "boss",
      "Освоить Штаб гильдии",
      "Босс — большой проект из этапов. Каждый пройденный этап отнимает у него силы, за победу дают трофей.",
      "intellect",
      2,
      null,
      1,
    ),
    stages: [
      { title: "Выполнить первый квест", damage: 2 },
      { title: "Совершить первый ритуал", damage: 2 },
      { title: "Купить награду в лавке", damage: 3 },
      { title: "Записать день в Летопись", damage: 3 },
    ],
    rituals: [
      {
        title: "Глоток из родника",
        realName: "стакан воды после пробуждения",
        attribute: "agility",
        schedule: "daily",
        weekdaysMask: null,
        timesPerWeek: null,
        intervalDays: null,
        startDate: today,
        pausedUntil: null,
        difficulty: 1,
        sortOrder: 0,
      },
      {
        title: "Чтение свитков",
        realName: "20 минут чтения",
        attribute: "intellect",
        schedule: "times_per_week",
        weekdaysMask: null,
        timesPerWeek: 3,
        intervalDays: null,
        startDate: today,
        pausedUntil: null,
        difficulty: 1,
        sortOrder: 1,
      },
    ],
    rewards: [
      { title: "Вечер с книгой у камина", description: "Без дел и без экрана, только чай и страницы.", price: 60, repeatable: true },
      { title: "Пир в таверне", description: "Ужин с друзьями там, куда давно хотелось.", price: 250, repeatable: true },
    ],
  };
}
