import { cancel, isPermissionGranted, requestPermission, Schedule, sendNotification } from "@tauri-apps/plugin-notification";

/** Номера запланированных напоминаний на телефоне: по одному на сутки недели, с 1 по 7. */
const SCHEDULED_IDS = Array.from({ length: 7 }, (_, i) => i + 1);

const TITLE = "Штаб гильдии";

/** Обёртки над плагином уведомлений ОС. */
export const notify = {
  /** Есть ли разрешение; если нет, система спрашивает человека один раз. */
  ensurePermission: async (): Promise<boolean> => (await isPermissionGranted()) || (await requestPermission()) === "granted",
  show: (body: string) => {
    sendNotification({ title: TITLE, body });
  },
  /** Телефон: заменяет запланированные напоминания новым списком. Срабатывают, даже если приложение закрыто. */
  replaceScheduled: async (items: ReadonlyArray<{ at: Date; body: string }>) => {
    await cancel(SCHEDULED_IDS);
    items.slice(0, SCHEDULED_IDS.length).forEach((item, i) => {
      sendNotification({ id: i + 1, title: TITLE, body: item.body, schedule: Schedule.at(item.at, false, true) });
    });
  },
};
