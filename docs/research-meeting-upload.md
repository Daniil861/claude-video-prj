# Research: технологии для загрузки файлов во встречу

**План:** [docs/plan-meeting-file-upload.md](plan-meeting-file-upload.md)
**PRD:** [docs/prd-meeting-file-upload.md](prd-meeting-file-upload.md)
**Дата:** 2026-10-12

Цель документа — выбрать конкретные библиотеки и приёмы для каждой фазы плана до начала реализации. Выводы проверены на версиях, которые стоят в репозитории, а не только по документации. Где проверка не делалась, это сказано явно.

## Версии в репозитории

| Пакет                      | Версия | Что важно для фичи                                                                           |
| -------------------------- | ------ | -------------------------------------------------------------------------------------------- |
| `@nestjs/platform-express` | 11.2.1 | Тянет `express@5.2.1` и `multer@2.2.0` (а через него `busboy@1.6.0`)                         |
| `@nestjs/common`           | 11.2.1 | Тянет `file-type@21.3.4` и `load-esm@1.0.3` для `FileTypeValidator`                          |
| `express`                  | 5.2.1  | `res.sendFile` через `send@1.2.1` и `range-parser@1.3.0` — Range «из коробки»                |
| `next`                     | 16.3.1 | `middleware.ts` ещё работает, но в 16 переименован в `proxy`. Лимит буферизации тела — 10 МБ |
| Node.js                    | 24.18  | `require()` ESM-модулей работает без флагов. В Jest — нет (см. ниже)                         |

Из-за строгого `node_modules` в pnpm транзитивные пакеты (`file-type`, `content-disposition`, `multer`) из кода `apps/api` не импортируются — их нужно добавить в `dependencies` явно. Это проверено: `require('file-type')` из `apps/api` падает с `MODULE_NOT_FOUND`.

## Сводка рекомендаций

| Вопрос                       | Рекомендация                                                                                                 | Фаза |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------ | ---- |
| Приём multipart в Nest       | `FileInterceptor` (multer 2.2) со **своим** `StorageEngine` на диск, `defParamCharset: 'utf8'`               | 1, 3 |
| Лимит 100 МБ в потоке        | `limits.fileSize` у multer → 413; текст ошибки переписать на русский                                         | 3    |
| Проверка до чтения тела      | Отдельный интерсептор **перед** `FileInterceptor`: владелец встречи (404) и счётчик файлов                   | 1, 3 |
| Лимит 20 файлов без гонки    | Финальная проверка в транзакции с `SELECT … FOR UPDATE` по строке встречи                                    | 3    |
| Проверка типа по содержимому | `file-type@21` напрямую (`fileTypeFromFile` по временному файлу); `txt`/`md` — своя проверка UTF-8           | 3    |
| `FileTypeValidator` из Nest  | **Не использовать**: требует `file.buffer`, то есть файл целиком в памяти                                    | 3    |
| E2E и ESM-пакет `file-type`  | `test:e2e` запускать с `--experimental-vm-modules`                                                           | 3    |
| Отдача с Range               | `res.sendFile()` Express 5, а не `StreamableFile`                                                            | 5    |
| `Content-Disposition`        | Пакет `content-disposition` (`filename*` по RFC 5987/6266 + ASCII-фолбэк)                                    | 5    |
| Прокси загрузки в Next       | Route handler в `app/api/...` **вне** `config.matcher`; `fetch(..., { body: request.body, duplex: 'half' })` | 4    |
| Прогресс и отмена в браузере | `XMLHttpRequest` + `upload.onprogress` + `abort()`; не больше 3 загрузок одновременно                        | 4    |
| Прокси отдачи в Next         | Route handler пробрасывает `Range`/`If-Range` и отвечает `upstream.body` с белым списком заголовков          | 6    |
| Раскладка на диске           | `FILES_DIR/meetings/<meetingId>/<fileId>`, временные — `FILES_DIR/.tmp/<uuid>`                               | 1, 3 |

Ниже — обоснование по каждому пункту.

---

## 1. Приём файла в Nest (Фазы 1 и 3)

### Варианты

| Вариант                                        | Плюсы                                                                                                        | Минусы                                                                                    |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------- |
| **`FileInterceptor` + multer, своё хранилище** | Уже в зависимостях Nest. Лимиты, очистка при обрыве, слив тела при ошибке, маппинг ошибок в 413/400 — готовы | Нужно знать две ловушки (кодировка имени и текст ошибки), см. ниже                        |
| `busboy` напрямую в своём интерсепторе         | Полный контроль над потоком                                                                                  | Обрыв, слив тела, лимиты, очистку придётся писать и тестировать самим — это и есть multer |
| `@fastify/multipart`                           | Хороший потоковый API                                                                                        | Требует смены платформы Nest на Fastify — несоразмерно                                    |
| `memoryStorage` + `ParseFilePipe`              | Минимум кода, работает `FileTypeValidator`                                                                   | 100 МБ на запрос в памяти — прямо запрещено PRD                                           |

**Выбор: multer через `FileInterceptor`, но со своим `StorageEngine`** (или `diskStorage` с функциями `destination`/`filename`).

### Что multer 2.2 уже делает за нас (проверено по исходникам `lib/make-middleware.js`)

- Подписывается на `aborted`, `close` и `error` запроса. При обрыве удаляет и уже записанные, и **ещё пишущиеся** файлы (`pendingFiles` с выставленным `path`) через `storage._removeFile`.
- При ошибке (например, `LIMIT_FILE_SIZE`) **дочитывает и выбрасывает** остаток тела, прежде чем ответить. Клиент получает 413, а не `EPIPE`/`ECONNRESET` — это важно и для e2e на «100 МБ + 1», и для XHR в браузере.
- `limits.fileSize` срабатывает по событию `limit` busboy — то есть в потоке, на первом лишнем байте, а не после записи.

Nest переводит ошибки multer в HTTP (`multer.utils.js` → `transformException`): `LIMIT_FILE_SIZE` → `PayloadTooLargeException` (413), `LIMIT_FILE_COUNT`/`LIMIT_UNEXPECTED_FILE`/битый multipart → 400.

### Ловушки

1. **Кириллица в имени файла ломается по умолчанию.** Multer передаёт busboy `defParamCharset: 'latin1'`, а браузеры кладут имя в `filename="..."` в UTF-8 без `filename*`. Без `defParamCharset: 'utf8'` в опциях `FileInterceptor` «Отчёт.pdf» сохранится как `ÐÑÑÐµÑ.pdf`. Тест на кириллицу из Фазы 5 это поймает, но лучше заложить сразу в Фазе 1.
2. **Текст 413 — английский** (`File too large`). PRD требует «понятное сообщение». Варианты: обернуть интерсептор и заменить сообщение у `PayloadTooLargeException`, либо фильтр исключений на модуль `files`. Код ответа менять не нужно.
3. Опции `limits`, кроме `fileSize`: `files: 1`, `fields: 0`, `parts: 1` — один файл на запрос по плану, лишние части отклоняются 400 до записи на диск.
4. Порядок интерсепторов. `@UseInterceptors(MeetingUploadGuardInterceptor, FileInterceptor('file', …))` — первый выполняется **до** того, как multer начнёт читать тело. В нём: проверка владельца (404) и мягкая проверка лимита 20 файлов. Иначе 100 МБ в чужую встречу сначала целиком запишутся на диск, а 404 придёт потом. Guard (`JwtAuthGuard`) и так работает раньше интерсепторов, поэтому 401 тоже приходит до чтения тела.
5. Если ответить ошибкой, не прочитав тело, Node сам «сливает» запрос после `res.end()` (`req._dump()`), соединение не рвётся. Проверить это e2e-тестом на 404 с вложенным файлом.

### Свой StorageEngine: что в нём

- Имя временного файла — `crypto.randomUUID()`, каталог — `FILES_DIR/.tmp`. Имя от клиента в путь не попадает (PRD, «Технические ограничения»).
- `.tmp` должен быть на том же разделе, что и итоговый каталог, — тогда перенос в итоговое место через `fs.rename` атомарен.
- Считать размер по `bytesWritten` потока записи, а не по `Content-Length` клиента.
- `_removeFile` — `fs.rm(path, { force: true })`: файл мог не успеть создаться.
- На Windows `unlink` открытого на запись файла проходит (Node открывает файлы с `FILE_SHARE_DELETE`), но имя освобождается только после закрытия дескриптора. Для нас это неважно — имена уникальны.
- При старте модуля (`onModuleInit`) очищать `FILES_DIR/.tmp`: после падения процесса посреди загрузки там остаются хвосты. Так закрывается пункт «нет сирот» и для краша, а не только для обрыва соединения.

### Порядок записи (Фаза 3, «согласованность хранения»)

```
поток → FILES_DIR/.tmp/<uuid>         (multer + свой StorageEngine; лимит 100 МБ в потоке)
     → проверка типа по .tmp-файлу    (file-type; при отказе — unlink, 415/400)
     → транзакция БД:
         SELECT id FROM "Meeting" WHERE id = $1 AND "ownerId" = $2 FOR UPDATE
         count(MeetingFile) < 20, иначе отказ
         INSERT MeetingFile (id = fileId, storageKey = meetings/<meetingId>/<fileId>)
         fs.rename(.tmp/<uuid> → meetings/<meetingId>/<fileId>)   ← внутри транзакции
     → при любой ошибке после записи на диск: unlink временного файла
```

Почему `rename` внутри интерактивной транзакции Prisma (`prisma.$transaction(async (tx) => …)`): если `rename` упадёт, строка откатится; если упадёт коммит — останется файл без строки, но в каталоге конкретной встречи, и его можно удалить в `catch`. Обратного случая — строка есть, файла нет — не бывает.

### Гонка на лимите 20 файлов

Проверка `count < 20` без блокировки пропускает гонку: три параллельные загрузки при 19 файлах все видят 19 и все проходят. Это ровно сценарий PRD «три файла одновременно». `SELECT … FOR UPDATE` по строке встречи сериализует вставки файлов **одной** встречи и не мешает остальным. В Prisma 7 это `tx.$queryRaw` внутри интерактивной транзакции. Ранняя проверка в интерсепторе (до чтения тела) остаётся — она экономит трафик, но окончательное решение принимает транзакция.

Какой код у «21-го файла»: в плане код не зафиксирован. Предлагаю **409 Conflict** с сообщением о лимите — запрос корректен, но противоречит состоянию встречи. 422 тоже допустим; главное — записать выбор в README вместе с остальными кодами Фазы 3.

---

## 2. Проверка типа по содержимому (Фаза 3)

### `FileTypeValidator` из Nest не подходит

В `@nestjs/common@11.2.1` `FileTypeValidator.isValid` читает сигнатуру **только из `file.buffer`**. При дисковом хранилище буфера нет, и валидатор либо всегда отказывает, либо (с `fallbackToMimetype`) молча проверяет `Content-Type` клиента — то есть ровно то, что PRD запрещает. Значит, проверку пишем сами, на временном файле.

### `file-type@21` — подходит по составу форматов

Проверено вызовом `supportedExtensions` из установленной версии:

| Формат из PRD                                    | Распознаётся `file-type`                              |
| ------------------------------------------------ | ----------------------------------------------------- |
| `mp4`, `webm`, `mov`, `mp3`, `m4a`, `wav`, `ogg` | да                                                    |
| `pdf`, `docx`, `pptx`, `xlsx`                    | да (Office — по содержимому ZIP, не просто «это zip») |
| `png`, `jpg`, `webp`                             | да                                                    |
| `exe`                                            | да — отказ будет с точной причиной «обнаружен exe»    |
| `txt`, `md`                                      | **нет** — у текста нет сигнатуры                      |

Использовать `fileTypeFromFile(tmpPath)`: читает с диска столько, сколько нужно (для Office — заголовки ZIP), не загружая файл в память. Белый список строить по **обнаруженному** `ext`/`mime`, а не по расширению имени. Нюансы сопоставления:

- `mov` → `video/quicktime`, `m4a` → `audio/x-m4a`, `webm` без видео всё равно `video/webm`, `ogg` с opus может прийти как `opus`/`audio/ogg`. Белый список — набор разрешённых `ext` от `file-type` с явным маппингом в «тип для списка» и `Content-Type` для отдачи.
- «Подменённое расширение»: обнаруженный тип разрешён, но расширение имени с ним не совпадает (например, `report.pdf`, а внутри PNG). Отклонять — так требует PRD. Сравнивать с группой допустимых расширений (`jpg`/`jpeg`).
- **`txt` и `md`**: `file-type` вернёт `undefined`. Тогда файл принимается, только если расширение `.txt`/`.md`, первые 64 КБ декодируются `new TextDecoder('utf-8', { fatal: true })` и в них нет `\0`. Это отсечёт бинарник, переименованный в `.txt`.
- Сохранённый в БД MIME — тот, что определён сервером. Он же уйдёт в `Content-Type` при отдаче (Фаза 5).

### Ловушка: `file-type` — чистый ESM, а API и Jest — CommonJS

Проверено пробным тестом в `apps/api`:

| Среда                                           | `require('file-type')`                         | `import()` / `loadEsm()`                                         |
| ----------------------------------------------- | ---------------------------------------------- | ---------------------------------------------------------------- |
| Node 24 (`nest start`, `node dist/main`)        | работает (`require(esm)`)                      | работает                                                         |
| Jest 30 + ts-jest, как сейчас                   | `Cannot use import statement outside a module` | `ERR_VM_DYNAMIC_IMPORT_CALLBACK_MISSING_FLAG`                    |
| Jest с `NODE_OPTIONS=--experimental-vm-modules` | —                                              | **работает** (`loadEsm` вернул `image/x-icon` для `favicon.ico`) |

E2E поднимают приложение внутри Jest, поэтому это затронет все тесты Фазы 3. Рекомендация:

- В коде загружать модуль через `loadEsm` из пакета `load-esm` (тот же приём, что у Nest). Для типов — `import type { FileTypeResult } from 'file-type'`.
- Скрипт `test:e2e` поменять на `node --experimental-vm-modules node_modules/jest/bin/jest.js --config ./test/jest-e2e.json`. Флаг в аргументах `node`, а не в `NODE_OPTIONS`, — так скрипт одинаково работает в PowerShell и bash без `cross-env`. Jest будет печатать предупреждение `ExperimentalWarning: VM Modules` — это ожидаемо.
- Unit-тесты (`pnpm test`, хук `pre-commit`) флаг не получают. Если появится unit-тест на детектор типов — либо добавить флаг и туда, либо замокать модуль детектора.
- Альтернатива без флага — свой детектор сигнатур на ~15 форматов. Простые форматы (PNG, JPEG, PDF, WebP, WAV, OGG, MP3, EBML) — это несколько байт, но `docx`/`pptx`/`xlsx` и семейство ISO-BMFF (`mp4`/`mov`/`m4a`) требуют разбора структуры. Писать и поддерживать это ради обхода флага Jest невыгодно. В PROGRESS.md решение фиксируется так: «`file-type` вместо своего детектора, потому что Office и ISO-BMFF; цена — флаг `--experimental-vm-modules` у e2e».

Новые прямые зависимости `apps/api`: `file-type`, `load-esm`, `multer` (только `@types/multer` для `Express.Multer.File`, сам пакет уже есть у Nest — но в pnpm тип виден только при явной зависимости), `content-disposition` + `@types/content-disposition`. Версии — те, что уже в дереве, чтобы не тащить дубли.

---

## 3. Отдача файла с Range (Фаза 5)

### `StreamableFile` — нет, `res.sendFile` — да

`StreamableFile` из Nest не разбирает заголовок `Range`: всегда 200 и весь файл. Перемотка в `<video>` работать будет плохо, а Safari/iOS вообще требует 206 для медиа. Есть открытая проблема с Range и `StreamableFile` на iOS ([nestjs/nest#14873](https://github.com/nestjs/nest/issues/14873)). Писать разбор Range руками через `range-parser` + `fs.createReadStream({ start, end })` можно, но это повтор того, что уже есть в Express.

**Выбор: `@Res() res: Response` и `res.sendFile(absPath, options, callback)`** в одном обработчике. Express 5 (`send@1.2.1`) сам делает:

- `Accept-Ranges: bytes`, `206` + `Content-Range` для одиночного диапазона, `416` + `Content-Range: bytes */size` для невыполнимого;
- `If-Range`, `ETag`, `Last-Modified`, `304` по условным заголовкам, `HEAD`;
- корректный `Content-Length` и стриминг без чтения файла в память.

Детали:

- Путь строится только из `storageKey` в БД и `FILES_DIR`, опция `root: FILES_DIR` даёт дополнительную защиту от выхода за каталог.
- `Content-Type` выставить **до** вызова `sendFile` из сохранённого MIME — `send` не перезаписывает уже установленный заголовок. Ключ хранения без расширения, так что угадывать тип по имени `send` всё равно не смог бы.
- Добавить `X-Content-Type-Options: nosniff`: браузер не будет «угадывать» HTML в `inline`-ответе.
- `Cache-Control: private, no-transform` — файлы персональные, а `no-transform` запрещает промежуточному звену (включая сжатие ответов в Next) менять тело диапазонного ответа.
- Ошибку в колбэке `sendFile` (файл есть в БД, но пропал с диска) превращать в 404, если заголовки ещё не отправлены; если уже отправлены — только логировать через `Logger`.
- `@Res()` выключает стандартную обработку ответа Nest для этого метода — это осознанно и только здесь. Проверки владельца и файла выполняются до `sendFile`, поэтому 401/404 по-прежнему идут через исключения Nest.

### `Content-Disposition` с кириллицей, пробелами и `../`

Пакет `content-disposition` (его использует сам Express в `res.attachment`):

```ts
contentDisposition(file.originalName, { type: isInline ? 'inline' : 'attachment' });
// attachment; filename="Otchet 2026.pdf"; filename*=UTF-8''%D0%9E%D1%82%D1%87%D1%91%D1%82%202026.pdf
```

- Генерирует `filename*` (RFC 5987/6266) и ASCII-фолбэк в `filename`.
- Обрезает путь до базового имени — `../../etc/passwd` превратится в `passwd`. Имя, полученное от multer, тоже уже без пути (`preservePath: false` по умолчанию), но хранить в БД стоит базовое имя явно.
- `inline` — для видео, аудио, PDF и изображений; `attachment` — для остального и для `?download=1`.

---

## 4. Прокси загрузки в Next (Фаза 4)

### Почему route handler, а не Server Action

Подтверждает PRD: у Server Actions лимит тела (`serverActions.bodySizeLimit`, по умолчанию 1 МБ) и нет событий прогресса. Route handler получает `request.body` как поток и может передать его дальше без буферизации.

### Главная ловушка: буферизация тела в `middleware`/`proxy`

В Next 16 перед запуском `middleware.ts` (в 16 — `proxy.ts`) тело запроса клонируется и буферизуется в памяти, лимит — `experimental.proxyClientMaxBodySize`, по умолчанию 10 МБ. **При превышении запрос не отклоняется: в route handler молча приходит только первые 10 МБ**, в лог пишется предупреждение. Загрузка 100 МБ «пройдёт», а в API уйдёт обрезанный multipart — получим 400 `Unexpected end of form` без явной причины.

Проверено по исходникам `next@16.3.1`: тело клонируется лениво, только когда middleware действительно вызывается для пути (`next-server.js`, `runMiddleware` → `cloneBodyStream()`). Значит, достаточно, чтобы путь загрузки **не попадал в `config.matcher`**.

Сейчас `matcher` — `['/', '/meetings/:path*', '/auth/login', '/auth/register']`. Если положить обработчик в `app/meetings/[id]/files/route.ts`, он попадёт под `/meetings/:path*` и будет обрезан. Рекомендация:

- Route handlers файлов — в `app/api/meetings/[id]/files/route.ts` (POST, загрузка) и `app/api/meetings/[id]/files/[fileId]/route.ts` (DELETE) и `…/[fileId]/content/route.ts` (GET, отдача). Префикс `/api` в `matcher` не входит.
- Аутентификацию в них делать самим: `getSessionToken()` из `lib/session.ts`; нет cookie — сразу 401, не трогая тело. Подпись токена проверит Nest — дублировать `verifySessionToken` не обязательно, но и не вредно.
- Поднимать `proxyClientMaxBodySize` до 100 МБ **не нужно** — опция экспериментальная и держит каждый запрос в памяти, что противоречит PRD.
- Комментарий у `config.matcher` в `middleware.ts`: почему `/api/*` туда добавлять нельзя.

### Код прокси (эскиз)

```ts
// app/api/meetings/[id]/files/route.ts
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const token = await getSessionToken();
  if (!token) return Response.json({ message: 'Требуется вход' }, { status: 401 });

  const { id } = await params;
  const upstream = await fetch(`${API_URL}/meetings/${encodeURIComponent(id)}/files`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': request.headers.get('content-type') ?? '', // keeps the multipart boundary
      ...(request.headers.get('content-length')
        ? { 'Content-Length': request.headers.get('content-length')! }
        : {}),
    },
    body: request.body,
    duplex: 'half', // required by undici for a streamed request body
    signal: request.signal, // client cancel → abort upstream → multer cleans the temp file
    cache: 'no-store',
  });

  return new Response(upstream.body, {
    status: upstream.status,
    headers: { 'Content-Type': upstream.headers.get('content-type') ?? 'application/json' },
  });
}
```

- `duplex: 'half'` обязателен для потокового тела в `fetch` Node/undici, иначе `TypeError`. В типах DOM `RequestInit` поля `duplex` нет — понадобится узкое расширение типа, а не `as any`.
- `signal: request.signal` — цепочка отмены: `xhr.abort()` → Next закрывает запрос → `fetch` в API прерывается → у Nest срабатывает `aborted`/`close` → multer удаляет временный файл. **Это звено нужно проверить руками в Фазе 4**: прерывается ли `request.signal` в Next 16 при разрыве клиента на Node-рантайме. Проверка — отменить загрузку и убедиться, что `FILES_DIR/.tmp` пуст. Если сигнал не срабатывает, запасной вариант — читать `request.body` через `getReader()` и вызывать `controller.abort()` по ошибке чтения.
- Ответ API отдаётся как есть: статус, JSON с сообщением. Клиенту не нужно знать, что между ним и Nest есть прокси.

### CSRF

Server Actions проверяют `Origin` сами, route handlers — нет. Cookie `access_token` выставлена с `SameSite=Lax`, а браузер не прикладывает Lax-cookie к межсайтовым `POST`/`DELETE` (ни из `fetch`/XHR, ни из формы). Этого достаточно. Дешёвая страховка — сравнить `Origin` запроса с хостом в `POST` и `DELETE` и отвечать 403 при несовпадении.

### Клиент: XHR, а не fetch

- `fetch` не даёт событий прогресса **отправки**. Потоковое тело в `fetch` (`ReadableStream` + `duplex`) в браузере требует HTTP/2 и всё равно не даёт процентов. Поэтому `XMLHttpRequest`: `xhr.upload.onprogress` (`loaded/total`), `xhr.abort()` — отмена одного файла, у каждого файла свой XHR.
- Тело — `FormData` с одним полем `file`. Браузер сам поставит `multipart/form-data; boundary=…` — заголовок вручную не задавать.
- Одновременно не больше 3 загрузок, остальные в очереди. На HTTP/1.1 браузер держит не больше 6 соединений на хост, а страница тоже делает запросы. 20 одновременных XHR по 100 МБ забьют канал без выигрыша.
- Клиентская проверка до отправки (тип по расширению и `file.type`, размер `> 100 * 1024 * 1024`, лимит 20 с учётом уже загруженных и стоящих в очереди) — только UX. Сервер проверяет всё заново.
- Обновление списка без перезагрузки: ответ POST содержит созданную запись — её добавляют в клиентское состояние списка. Альтернатива — `router.refresh()`, но он перезапросит всю страницу на каждый файл.
- Drag-and-drop: в HeroUI v3 есть `DropZone` и `FileTrigger` из React Aria. Детали API — по скиллу `heroui-react` в момент реализации.

---

## 5. Прокси отдачи в Next (Фаза 6)

`GET app/api/meetings/[id]/files/[fileId]/content/route.ts`:

- Пробросить в API заголовки `Range` и `If-Range` (и `If-None-Match`/`If-Modified-Since` — для 304), плюс `Authorization: Bearer`.
- Вернуть `new Response(upstream.body, { status: upstream.status, headers })`, где `headers` — **белый список** из ответа API: `Content-Type`, `Content-Length`, `Content-Range`, `Accept-Ranges`, `Content-Disposition`, `ETag`, `Last-Modified`, `Cache-Control`, `X-Content-Type-Options`. Копировать всё подряд нельзя: `Transfer-Encoding`/`Connection` от upstream ломают ответ.
- `?download=1` прокинуть в запрос к API.
- `<video src="/api/meetings/:id/files/:fileId/content">` — тот же origin, cookie уходит сама, токена нет ни в JS, ни в URL. Перемотка работает, потому что браузер шлёт `Range`, а прокси его не теряет.
- `cache: 'no-store'` у `fetch` и `Cache-Control: private, no-transform` в ответе — чтобы Next не кешировал персональные файлы и не сжимал диапазонные ответы.
- PDF — `<iframe>` или ссылка в новой вкладке на тот же URL (`inline`), изображения — `<img>`. Отдельная библиотека для PDF не нужна.

---

## 6. Хранилище и очистка (Фазы 1, 3, 5)

Раскладка в `FILES_DIR`:

```
FILES_DIR/
  .tmp/<uuid>                     — идущие загрузки, чистится при старте
  meetings/<meetingId>/<fileId>   — итоговые файлы
```

- `storageKey` в БД = `meetings/<meetingId>/<fileId>` — относительный путь, так `FILES_DIR` можно переносить.
- Каталог на встречу упрощает метод очистки из Фазы 5: удалить файлы встречи — `fs.rm(dir, { recursive: true, force: true })`, затем строки (или их удалит каскад). Удалить файлы владельца — выбрать его встречи и пройтись по каталогам. Сначала диск, потом БД: если диск упал — строки остались, и повтор очистки их найдёт.
- `FILES_DIR` в `.env.test` указывает на отдельный каталог, например `apps/api/.files-test`. `global-setup.ts` очищает его рядом с `clearDatabase`. Оба каталога (`.files`, `.files-test`) — в `.gitignore`.
- Путь из `FILES_DIR` приводить к абсолютному через `path.resolve` один раз при старте: относительный путь иначе зависит от того, откуда запущен процесс (turbo, jest, `node dist/main`).
- Отдельное хранилище (MinIO/S3) не нужно: решение «локальный диск» уже принято в плане, а раскладка по `storageKey` позволит заменить внутренности сервиса хранения без изменения контракта — тот же приём, что сработал при переходе на Prisma.

---

## 7. Что это меняет в плане

Поправки, которые стоит внести в план или учесть при выполнении задач:

1. **Фаза 1.** В опции `FileInterceptor` сразу `defParamCharset: 'utf8'` и `limits: { files: 1, fields: 0, parts: 1 }`. Интерсептор проверки встречи ставится **перед** `FileInterceptor`. Новые зависимости `apps/api` — в PROGRESS.md.
2. **Фаза 3.** Проверка типа — `file-type` через `loadEsm` по временному файлу, не `FileTypeValidator`. В этом же коммите `test:e2e` получает `--experimental-vm-modules` — это правка скрипта, она идёт в README и `apps/api/CLAUDE.md`. Лимит 20 — через `SELECT … FOR UPDATE`. Код для 21-го файла выбрать и записать (предложение — 409).
3. **Фаза 3.** E2E на «100 МБ + 1»: генерировать файл потоком во временный каталог, а не `Buffer.alloc(100 МБ)` в тесте, — иначе тест сам держит 200 МБ в памяти. Для supertest — `.attach('file', path)`.
4. **Фаза 3.** E2E на «оборванную загрузку»: supertest обрыв не умеет. Нужен сырой `http.request` к `app.getHttpServer()` с multipart-телом, которое после части данных делает `req.destroy()`. Проверка — `FILES_DIR/.tmp` пуст и строк нет. Ждать очистки опросом короткими интервалами: удаление идёт асинхронно после закрытия сокета.
5. **Фаза 4.** Формулировку «путь исключается из буферизации тела в middleware/proxy» конкретизировать: обработчики лежат в `app/api/...`, а этот префикс не входит в `config.matcher`. Проверить, что отмена в браузере очищает `.tmp` в API (цепочка `request.signal`).
6. **Фаза 5.** Отдача — `res.sendFile`, не `StreamableFile`. `Content-Disposition` — пакет `content-disposition`.
7. **Вне скоупа, но рядом.** `middleware.ts` в Next 16 устарел и переименован в `proxy.ts` (codemod `middleware-to-proxy`). На фичу не влияет, но заслуживает отдельной задачи в «Дальше».

## Риски, которые остаются

| Риск                                                                          | Что делать                                                                                       |
| ----------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| `request.signal` в route handler не прерывается при разрыве клиента           | Проверить в Фазе 4 руками; запасной вариант — ручное чтение `request.body` с `abort()` по ошибке |
| `--experimental-vm-modules` меняет поведение Jest для других тестов           | Прогнать весь `test:e2e` (47 тестов) с флагом до начала Фазы 3 отдельным шагом                   |
| Медленный клиент держит соединение и место в `.tmp`                           | Для учебного проекта приемлемо; при необходимости — `server.requestTimeout` у Node               |
| Неверная классификация редких вариантов форматов (`ogg`/`opus`, `webm` audio) | E2E с реальными маленькими файлами каждого типа из PRD в `test/fixtures`                         |

## Источники

- Next.js — [`proxyClientMaxBodySize`](https://nextjs.org/docs/app/api-reference/config/next-config-js/proxyClientMaxBodySize); исходники `next@16.3.1`: `dist/server/body-streams.js`, `dist/server/next-server.js`.
- NestJS — [File upload](https://docs.nestjs.com/techniques/file-upload); исходники `@nestjs/common@11.2.1` (`pipes/file/file-type.validator.js`) и `@nestjs/platform-express@11.2.1` (`multer/multer/multer.utils.js`).
- [nestjs/nest#14873](https://github.com/nestjs/nest/issues/14873) — `StreamableFile` и Range-запросы на iOS.
- multer — исходники `multer@2.2.0` (`lib/make-middleware.js`, `storage/disk.js`, README: `defParamCharset`).
- file-type — исходники и `supportedExtensions` у `file-type@21.3.4`.
- Express 5 — `res.sendFile` поверх `send@1.2.1` (`Accept-Ranges`, 206, 416, `If-Range`).
- [LogRocket: video streaming server на Node](https://blog.logrocket.com/build-video-streaming-server-node/) — ручная реализация Range для сравнения.
- RFC 6266 / RFC 5987 — `Content-Disposition` и `filename*`.
