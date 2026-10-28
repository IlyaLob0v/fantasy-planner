import { useState } from "react";

import { isMobile } from "@/app/platform";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { describeError } from "@/ipc";
import { useGame } from "@/services/game";

const SERVER_HINT = "http://192.168.1.10:8080";

/** «Сегодня, 21:40», «вчера, 21:40» или «24 октября, 21:40». */
function when(iso: string): string {
  const at = new Date(iso);
  const time = at.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
  const day = (d: Date) => d.toDateString();
  const now = new Date();
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (day(at) === day(now)) return `сегодня, ${time}`;
  if (day(at) === day(yesterday)) return `вчера, ${time}`;
  return `${at.toLocaleDateString("ru-RU", { day: "numeric", month: "long" })}, ${time}`;
}

function Quiet({ text }: { text: string | null }) {
  return text ? <p className="text-xs text-parchment/55">{text}</p> : null;
}

function SignInForm() {
  const { sync } = useGame();
  const { status, busy, error, signIn } = sync;
  const [server, setServer] = useState(status?.server ?? "");
  const [email, setEmail] = useState(status?.email ?? "");
  const [password, setPassword] = useState("");
  const [deviceName, setDeviceName] = useState(status?.deviceName ?? (isMobile ? "Телефон" : "ПК"));
  const ready = server.trim() !== "" && email.trim() !== "" && password !== "" && deviceName.trim() !== "";
  const send = (create: boolean) => {
    signIn({ server, email, password, deviceName, create })
      .then(() => {
        setPassword("");
      })
      .catch(() => undefined);
  };
  const field = "flex flex-col gap-1 text-xs text-parchment/60";
  return (
    <form
      className="grid max-w-md gap-2.5"
      onSubmit={(e) => {
        e.preventDefault();
        if (ready) send(false);
      }}
    >
      <label className={field}>
        Адрес штаба гильдии
        <Input
          value={server}
          placeholder={SERVER_HINT}
          inputMode="url"
          autoComplete="url"
          onChange={(e) => {
            setServer(e.target.value);
          }}
        />
      </label>
      <label className={field}>
        E-mail
        <Input
          type="email"
          value={email}
          autoComplete="email"
          onChange={(e) => {
            setEmail(e.target.value);
          }}
        />
      </label>
      <label className={field}>
        Пароль, от 8 символов
        <Input
          type="password"
          value={password}
          autoComplete="current-password"
          onChange={(e) => {
            setPassword(e.target.value);
          }}
        />
      </label>
      <label className={field}>
        Как назвать это устройство
        <Input
          value={deviceName}
          maxLength={60}
          onChange={(e) => {
            setDeviceName(e.target.value);
          }}
        />
      </label>
      <div className="flex flex-wrap gap-2">
        <Button type="submit" size="sm" disabled={!ready || busy}>
          Войти
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={!ready || busy}
          onClick={() => {
            send(true);
          }}
        >
          Создать аккаунт
        </Button>
      </div>
      <Quiet text={error} />
    </form>
  );
}

/** Первое подключение, когда и здесь, и в аккаунте уже есть свой герой: сложить их нельзя, выбирается один. */
function ChooseHero() {
  const { sync, character } = useGame();
  const { busy, error, link, signOut } = sync;
  const keep = (choice: "remote" | "local") => {
    link(choice).catch(() => undefined);
  };
  return (
    <div className="flex max-w-md flex-col gap-2.5 text-sm text-parchment/80">
      <p>
        В аккаунте уже есть летопись героя. Какого героя оставить? Местный герой «{character.name}» ({character.level} уровень) в любом случае
        сохранится в файл резервной копии рядом с базой.
      </p>
      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          disabled={busy}
          onClick={() => {
            keep("remote");
          }}
        >
          Взять героя из аккаунта
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={busy}
          onClick={() => {
            keep("local");
          }}
        >
          Отправить героя с этого устройства
        </Button>
      </div>
      <p className="text-xs text-parchment/50">
        Если отправить героя отсюда, летопись в аккаунте заменится, а её копия пробудет на сервере 30 дней. Другие устройства примут этого героя при
        следующей сверке.
      </p>
      <Quiet text={error} />
      <Button
        size="sm"
        variant="quiet"
        className="self-start px-0"
        onClick={() => {
          void signOut();
        }}
      >
        Выйти
      </Button>
    </div>
  );
}

function ChangePassword({ onDone }: { onDone: (note: string) => void }) {
  const { busy, changePassword } = useGame().sync;
  const [password, setPassword] = useState("");
  const [fresh, setFresh] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ready = password !== "" && fresh.length >= 8 && !sending && !busy;
  const field = "flex flex-col gap-1 text-xs text-parchment/60";
  return (
    <form
      className="grid gap-2.5"
      onSubmit={(e) => {
        e.preventDefault();
        if (!ready) return;
        setSending(true);
        changePassword(password, fresh)
          .then(() => {
            onDone("Пароль сменён. Другие устройства вышли из почты и войдут уже с новым");
          })
          .catch((err: unknown) => {
            setError(describeError(err));
          })
          .finally(() => {
            setSending(false);
          });
      }}
    >
      <label className={field}>
        Нынешний пароль
        <Input
          type="password"
          value={password}
          autoComplete="current-password"
          onChange={(e) => {
            setPassword(e.target.value);
          }}
        />
      </label>
      <label className={field}>
        Новый пароль, от 8 символов
        <Input
          type="password"
          value={fresh}
          autoComplete="new-password"
          onChange={(e) => {
            setFresh(e.target.value);
          }}
        />
      </label>
      <div className="flex flex-wrap gap-2">
        <Button type="submit" size="sm" disabled={!ready}>
          Сменить пароль
        </Button>
        <Button
          type="button"
          size="sm"
          variant="quiet"
          onClick={() => {
            onDone("");
          }}
        >
          Отмена
        </Button>
      </div>
      <Quiet text={error} />
    </form>
  );
}

function Linked() {
  const { sync } = useGame();
  const { status, busy, error, syncNow, signOut } = sync;
  const [changing, setChanging] = useState(false);
  const [note, setNote] = useState("");
  if (!status) return null;
  const last = status.lastSyncAt ? `Последняя сверка: ${when(status.lastSyncAt)}` : "Сверки ещё не было";
  return (
    <div className="flex max-w-md flex-col gap-2 text-sm text-parchment/80">
      <p>
        {status.email} · {status.deviceName}
      </p>
      <p className="text-xs text-parchment/55">
        {busy ? "Сверяю летопись…" : last}
        {status.pending > 0 && !busy ? ` · ждут отправки: ${String(status.pending)}` : ""}
      </p>
      <Quiet text={error} />
      <Quiet text={note || null} />
      {changing ? (
        <ChangePassword
          onDone={(text) => {
            setChanging(false);
            setNote(text);
          }}
        />
      ) : null}
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="outline" disabled={busy} onClick={syncNow}>
          Сверить летопись
        </Button>
        {changing ? null : (
          <Button
            size="sm"
            variant="quiet"
            disabled={busy}
            onClick={() => {
              setNote("");
              setChanging(true);
            }}
          >
            Сменить пароль
          </Button>
        )}
        <Button
          size="sm"
          variant="quiet"
          disabled={busy}
          onClick={() => {
            void signOut();
          }}
        >
          Выйти
        </Button>
      </div>
    </div>
  );
}

/** Раздел устава «Гильдейская почта» (specs/sync.md, раздел 6). */
export function GuildMail() {
  const { status } = useGame().sync;
  if (!status) return null;
  if (!status.signedIn) return <SignInForm />;
  return status.linked ? <Linked /> : <ChooseHero />;
}
