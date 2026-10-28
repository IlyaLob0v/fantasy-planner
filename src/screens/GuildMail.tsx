import { useState } from "react";

import { isMobile } from "@/app/platform";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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

function Linked() {
  const { sync } = useGame();
  const { status, busy, error, syncNow, signOut } = sync;
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
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="outline" disabled={busy} onClick={syncNow}>
          Сверить летопись
        </Button>
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
