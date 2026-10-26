# Библия стиля: собственный арт «Штаба гильдии»

Задача: все иллюстрации приложения (фоны локаций, герой, лут, оверлеи) выглядят как одна книга.
Генерируются нейросетью по промптам ниже, затем проходят отбор, кадрирование и конвертацию
в WebP и подключаются через `src/assets/registry.ts`. UI-элементы (рамки, ленты, печати)
в картинки не входят: их рисуем в SVG отдельно (см. раздел «Рамки»).

## 1. Мир

Обобщённое фэнтези без чужого лора: королевство у северных гор, гильдия странствующих
рыцарей, сосновые леса, болота гоблинов, драконы в старых шахтах. Имена и гербы придумываем
сами. Запрещено: персонажи, гербы, расы и места известных вселенных, узнаваемые костюмы и
символы (см. CLAUDE.md).

## 2. Стиль

- **Техника:** живописная цифровая иллюстрация в духе книжной масляной живописи: видимые
  мазки, мягкие края, лёгкая фактура холста. Не фото, не 3D-рендер, не аниме, не комикс.
- **Свет:** тёплый источник в сцене (факел, костёр, закат, окно таверны) против холодной
  глубокой тени. Атмосферная дымка в глубине.
- **Палитра** (совпадает с токенами UI): пергамент `#E8DCC0`, тёмное дерево `#2E2018`,
  золото `#C9A24A`, глубокий синий `#1E3550`, бордовый `#6B1E2A`. Фиолетовый и неоновый
  не используем.
- **Настроение:** уютное приключение, «вернулся в свой замок». Мрачно, но не страшно;
  гоблины хитрые и забавные, драконы величественные, без крови и жестокости.

## 3. Композиция фонов

- Формат 16:9, исходник от 2560×1440 (лучше 2752×1536), итог WebP 2560 px по ширине.
- **Спокойные зоны под панели.** На главном экране слева стоит колонка статуса (~25 %
  ширины), справа список квестов (~35 %), середина свободна. Поэтому края кадра делаем
  тёмными и спокойными, без контрастных деталей, а главный объект сцены ставим в
  центральную треть на 35–50 % высоты. Его координаты идут в `focus` реестра.
- На картинке нет текста, рамок, кнопок, подписей и водяных знаков.
- Для экрана персонажа подходит как горизонтальный, так и вертикальный кадр. Фигура героя
  центрирована, `focus` на голове и плечах.

## 4. Список ассетов и промпты

Промпты на английском: так модели понимают их точнее. Общий хвост стиля добавляется к
каждому промпту:

> `painterly digital illustration, storybook oil painting, visible brushstrokes, canvas
> texture, warm torchlight against deep blue shadows, atmospheric haze, muted palette of
> parchment beige, dark walnut wood, antique gold, deep navy and burgundy, cinematic
> composition, main subject in the center third, darker calm low-detail areas along the
> left and right edges, no text, no frame, no border, no watermark, no UI`

Негативный промпт (для моделей, которые его принимают):

> `photo, 3d render, anime, cartoon, comic, neon, purple glow, text, letters, logo,
> watermark, frame, border, UI, gore, blood, modern objects`

| ключ | сцена | промпт (до общего хвоста) |
|---|---|---|
| `location.gatehouse` | Надвратная башня гильдии в сумерках, дом героя (V0.1) | `a fortified stone gatehouse of a knights' guild on a mountain pass at dusk, lit lanterns on the walls, a raised portcullis with warm light spilling out, two armored knights in dark blue and burgundy tabards keeping watch on the battlements, banners with a golden key emblem, pine forest and snowy peaks behind, first stars in the sky` |
| `location.forest` | Сосновый бор, лагерь следопытов (V0.3) | `an ancient pine forest at misty dawn, a small rangers' camp with a canvas tent and a smoldering campfire, a knight's horse grazing, shafts of golden light through tall trunks, mischievous goblin eyes glinting from the ferns in the far background` |
| `location.tavern` | Таверна «Пьяный грифон» (V0.3) | `the cozy interior of a timber tavern called the Drunken Griffin, a big stone hearth with roaring fire, long oak tables with tankards and bread, adventurers resting, a carved griffin figurehead above the bar, warm candlelight, smoky air` |
| `location.goblin_market` | Гоблинский рынок на болоте (V0.3) | `a ramshackle goblin market on stilts above a foggy swamp at twilight, crooked wooden stalls with lanterns, small green goblins haggling over trinkets, rope bridges, glowing mushrooms, humorous and lively` |
| `location.dragon_lair` | Логово дракона в старой шахте (V0.3, фон боссов) | `a vast abandoned dwarven-style mine hall turned into a dragon's lair, a huge ancient dragon with bronze scales sleeping coiled on a hoard of gold coins, faint ember glow from its nostrils, broken stone columns, a tiny knight with a torch at the entrance for scale` |
| `hero` | Рыцарь-странник, экран персонажа (V0.1) | `a lone knight-errant seen from behind, standing on a cliff edge at sunrise, worn steel armor with a dark blue cloak, longsword at the hip, looking over a sea of clouds with distant castles and a dragon flying far away` |
| `treasury` | Казна гильдии, экран Сундука (V0.2) | `a vaulted stone treasury beneath a guild hall, iron-bound chests, scattered gold coins, shelves with potions and scrolls, a heavy round door with a golden key emblem, a single warm lantern, a goblin servant polishing a goblet` |
| `overlay.levelup` | Оверлей нового уровня (V0.1) | `a triumphant knight raising a sword on a mountain top as a golden dawn breaks, banners flying, a dragon circling in the sky, epic and uplifting` |

### Лут (V0.3)

Квадрат 1024×1024, один предмет по центру на тёмном пергаментном фоне с виньеткой, без
рамки (рамку карточки рисует UI). Общий хвост для лута:

> `single item centered, painterly storybook illustration, dark parchment background with
> soft vignette, warm rim light, no text, no frame`

Примеры: `a dragon scale shield with a golden rim`, `a goblin's lucky dice in a leather pouch`,
`an enchanted rangers' compass`, `a knight's helm with a burgundy plume`, `a jar of
glowing fireflies`, `a map of the northern kingdom sealed with red wax`.

## 5. Модели и параметры

| вариант | модель | параметры | цена за картинку |
|---|---|---|---|
| рекомендую | Flux 1.1 Pro Ultra (Replicate) | `aspect_ratio: 16:9`, `raw: false`, выход 2752×1536 | ~0,06 $ |
| альтернатива | OpenAI gpt-image | 1536×1024, затем апскейл до 2560 | ~0,04–0,2 $ |
| вручную | Midjourney | `--ar 16:9 --style raw --v 7` | подписка |

На каждый ассет делаем 3–4 варианта и выбираем лучший по композиции (спокойные края под
панели) и единству стиля с уже принятыми картинками. Для единства берём первую удачную
картинку как референс стиля для остальных, если модель это поддерживает.

## 6. Рамки и UI-кит

Рамки, уголки, ленты, печати и потёртые края рисуются в SVG (`src/components/kit`), а не
генерируются: так они масштабируются без потерь, перекрашиваются токенами `theme` и не
спорят с иллюстрацией. Стиль рамок задают примеры, которые пришлёт Илья.

## 7. Кредиты

У сгенерированных картинок в `credit` указываются: название сцены, «Штаб гильдии,
сгенерировано <модель>», год и лицензия «собственный арт проекта».
