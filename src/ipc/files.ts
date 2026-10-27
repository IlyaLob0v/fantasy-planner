import { save } from "@tauri-apps/plugin-dialog";
import { writeTextFile } from "@tauri-apps/plugin-fs";

/** Сохранение файла: система спрашивает, куда положить. false, если человек передумал. */
export async function saveTextFile(defaultName: string, extension: "json" | "md", text: string): Promise<boolean> {
  const path = await save({
    defaultPath: defaultName,
    filters: [{ name: extension === "json" ? "Летопись" : "Хроника", extensions: [extension] }],
  });
  if (path === null) return false;
  await writeTextFile(path, text);
  return true;
}
