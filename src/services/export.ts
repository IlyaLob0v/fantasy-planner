import { useCallback, useState } from "react";

import { MOOD_LABEL } from "@/app/strings";
import { chronicleMarkdown } from "@/domain/chronicle";
import { humanDate } from "@/domain/time";
import { ipc } from "@/ipc";
import { saveTextFile } from "@/ipc/files";

import { useGame } from "./game";

export type ExportState = "idle" | "saving" | "saved";

/** Выгрузка летописи (JSON со всеми данными) и хроники дня (Markdown) в файл, который выберет человек. */
export function useExport() {
  const { character, chronicle, today, reportError } = useGame();
  const [state, setState] = useState<ExportState>("idle");

  const run = useCallback(
    (write: () => Promise<boolean>) => {
      setState("saving");
      write()
        .then((saved) => {
          setState(saved ? "saved" : "idle");
        })
        .catch((e: unknown) => {
          setState("idle");
          reportError(e);
        });
    },
    [reportError],
  );

  const exportData = useCallback(() => {
    run(async () => saveTextFile(`летопись-${today}.json`, "json", await ipc.exportData()));
  }, [run, today]);

  const exportChronicle = useCallback(() => {
    run(() => saveTextFile(`хроника-${today}.md`, "md", chronicleMarkdown(chronicle, character.name, MOOD_LABEL, humanDate)));
  }, [run, today, chronicle, character.name]);

  return { state, exportData, exportChronicle };
}
