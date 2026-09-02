# Перевод хранилищ на Prisma + Postgres

Дата: 2026-09-02
Статус: реализовано. Расхождения между исходным дизайном и тем, что получилось, — в разделе «Итог реализации» в конце.

## Задача

Заменить два хранилища в памяти (`UsersService`, `MeetingsService`) на Postgres через Prisma. База уже поднята из `docker-compose.yml` и отвечает на `localhost:5432`.

Это отменяет решение «Данные в памяти, а не БД» из PROGRESS.md. Отмена осознанная: оно было принято как временное («договорились начать без Docker»), и слой сервисов изначально проектировался под такую замену.

## Границы

**Входит:** обе сущности — `User` и `Meeting` — за один заход. Схема, миграция, сид, подключение к Nest, перевод обоих сервисов, отдельная тестовая БД, скрипты, env, документация.

**Не входит:** форма `/auth/register` в `apps/web` (остаётся заглушкой), новые эндпоинты, `POST /api/meetings`, refresh-токены. HTTP-контракт API не меняется ни в одной точке.

## Решения и их причины

| Решение                                                                         | Почему                                                                                                                                                                                             |
| ------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Prisma внутрь существующих сервисов, без отдельного слоя репозиториев           | `UsersService`/`MeetingsService` уже являются границей хранилища — их публичные методы не меняются. Отдельные `*Repository` дали бы +2 файла и уровень косвенности поверх двух строк логики. YAGNI |
| Обе сущности сразу, а не сначала `User`                                         | Иначе `Meeting.ownerId` остаётся строкой без FK, а сид-встречи ссылаются на id из БД — пришлось бы синхронизировать вручную и потом переделывать                                                   |
| Отдельная БД `video_meetings_test` для e2e                                      | Прогон `test:e2e` чистит и засеивает таблицы. На общей БД он стирал бы данные, наклацанные в браузере, — особенно неприятно при живом `pnpm dev`                                                   |
| `String @id @default(cuid())`, но сид задаёт `usr_1`/`usr_2`/`mtg_1…mtg_5` явно | Существующие проверки в e2e (`DEMO_USER = { id: 'usr_1' }`) остаются валидными. Иначе пришлось бы править тесты, не относящиеся к задаче                                                           |
| `startsAt` — `DateTime` в БД, ISO-строка в ответе; маппинг в сервисе            | Интерфейс `Meeting` объявляет `startsAt: string`, фронт на это опирается. Полагаться на автосериализацию `Date` в Nest нельзя: TS-тип врал бы про содержимое объекта                               |
| Дубль email ловится и проверкой в сервисе, и constraint `@unique`               | Проверка даёт понятный 409 без обращения к коду ошибки; constraint закрывает гонку между проверкой и вставкой (`P2002` → тот же `ConflictException`)                                               |
| Сид уезжает из `onModuleInit` в `prisma/seed.ts`                                | С настоящей БД засеивание при каждом старте приложения неверно. Сид становится идемпотентным (`upsert`) и запускается командой                                                                     |
| `MeetingsService.reset()` удаляется                                             | Тестовый метод в продакшн-классе. Очистку берёт на себя тестовый хелпер                                                                                                                            |
| `meetings.service.spec.ts` переезжает в интеграционные тесты против тестовой БД | Сортировка, лимит и фильтрация становятся `orderBy`/`take`/`where` в SQL. Мок `findMany` проверял бы аргументы вызова, а не поведение: сломанный `orderBy` такой тест не поймает                   |
| `PrismaModule` помечен `@Global()`                                              | Иначе его импортирует каждый потребляющий модуль по отдельности, без выгоды                                                                                                                        |
| `postinstall: prisma generate`                                                  | Без сгенерированного клиента не проходят ни `typecheck`, ни `build`                                                                                                                                |

## Схема

`apps/api/prisma/schema.prisma`:

```prisma
model User {
  id           String    @id @default(cuid())
  email        String    @unique
  name         String
  passwordHash String
  createdAt    DateTime  @default(now())
  meetings     Meeting[]
}

model Meeting {
  id              String   @id @default(cuid())
  ownerId         String
  owner           User     @relation(fields: [ownerId], references: [id], onDelete: Cascade)
  title           String
  startsAt        DateTime
  durationMinutes Int
  createdAt       DateTime @default(now())

  @@index([ownerId, startsAt])
}
```

Email хранится нормализованным (`trim().toLowerCase()`) — нормализация уже есть в `UsersService` и остаётся там, иначе `@unique` не защищает от `Igor@x.com` против `igor@x.com`.

## Подключение к Nest

`src/prisma/prisma.service.ts` — `PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy`: `$connect()` на инициализации, `$disconnect()` на уничтожении. `app.close()` в e2e закрывает соединения, иначе Jest не завершится.

`src/prisma/prisma.module.ts` — `@Global()`, экспортирует `PrismaService`.

Сервисы сохраняют публичные имена методов и становятся асинхронными:

| Метод                              | Было                | Стало                   |
| ---------------------------------- | ------------------- | ----------------------- |
| `UsersService.findByEmail`         | `User \| undefined` | `Promise<User \| null>` |
| `UsersService.findById`            | `User \| undefined` | `Promise<User \| null>` |
| `UsersService.create`              | `Promise<User>`     | сигнатура не меняется   |
| `AuthService.getPublicUserById`    | `PublicUser`        | `Promise<PublicUser>`   |
| `MeetingsService.findRecentByUser` | `Meeting[]`         | `Promise<Meeting[]>`    |
| `MeetingsService.countByUser`      | `number`            | `Promise<number>`       |
| `MeetingsService.findPageByUser`   | `MeetingsPage`      | `Promise<MeetingsPage>` |
| `MeetingsService.reset`            | есть                | удаляется               |

Следствие в контроллерах: `AuthController.getMe` и `MeetingsController.findMine` возвращают `Promise<...>`. HTTP-контракт не меняется.

## Сидинг

`apps/api/prisma/seed.ts` экспортирует функцию сида и запускается как скрипт. Данные — те же, что сейчас зашиты в сервисах: пользователи `usr_1` (`SEED_USER_EMAIL`, «Demo User») и `usr_2` (`anna@example.com`, «Anna Petrova»), пароль из `SEED_USER_PASSWORD`, пять встреч `mtg_1…mtg_5` с прежними заголовками и датами — четыре у `usr_1`, одна у `usr_2`.

Идемпотентность через `upsert` по id: повторный запуск не создаёт дублей и не падает.

## Тесты

Целевое состояние: **7 unit-тестов** (`app.controller.spec.ts` + `auth.service.spec.ts`) и **28 тестов, требующих БД** — 21 существующий e2e плюс 7 переехавших из `meetings.service.spec.ts`.

- `apps/api/.env.test` — свой `DATABASE_URL` на `video_meetings_test`, свой `JWT_SECRET`.
- `test/setup-e2e.ts` (`setupFiles`) — грузит `.env.test` в `process.env` **до** импорта модулей: `PrismaClient` читает `DATABASE_URL` при создании, а не через `ConfigService`.
- `test/global-setup.ts` (`globalSetup`) — `prisma migrate deploy` против тестовой БД, затем очистка таблиц и вызов **той же** функции сида из `prisma/seed.ts`.
- `auth.service.spec.ts` — правка на две строки: заглушка `UsersService` начинает возвращать промисы. Остаётся юнит-тестом без БД.
- `meetings.service.spec.ts` → `test/meetings.service.e2e-spec.ts`: реальный `PrismaService`, каждый тест создаёт собственного владельца и свои встречи, чтобы не зависеть ни от сида, ни от порядка выполнения.
- 21 существующий e2e-тест не правится.

## Скрипты и окружение

`apps/api/package.json`: `db:generate`, `db:migrate` (`migrate dev`), `db:deploy` (`migrate deploy`), `db:seed`, `db:reset`, `postinstall: prisma generate`.

`DATABASE_URL` добавляется в `apps/api/.env.example` и `apps/api/.env`. Сейчас он есть только в корневом `.env`, который `ConfigModule` читает третьим в списке `envFilePath` — работает, но неявно и ломается при смене порядка. Корневой `.env` остаётся за docker-compose.

## Риски

| Риск                                                                            | Что делаем                                                                                                                                      |
| ------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `prisma migrate deploy` может не создать отсутствующую БД `video_meetings_test` | Проверяется первым шагом реализации. Если не создаёт — добавляется явный шаг создания базы перед миграцией                                      |
| `docker` CLI недоступен ни в PowerShell, ни в Git Bash в этом окружении         | Управление контейнером остаётся за пользователем. Доступность проверяется подключением к порту 5432, а не через `docker ps`                     |
| Turbo кэширует `typecheck`/`build`, не зная о сгенерированном клиенте Prisma    | Клиент генерируется в `postinstall`; если кэш начнёт врать, `prisma/schema.prisma` добавляется во `inputs` соответствующих задач в `turbo.json` |
| E2E пишут в БД, которую чистит `globalSetup`                                    | Запуск `test:e2e` при живом `pnpm dev` безопасен: дев-приложение смотрит в другую базу                                                          |

## Документация (в том же коммите)

| Файл                    | Что правится                                                                                                                                                    |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `PROGRESS.md`           | Новый раздел в «Сделано»; решение «Данные в памяти» переформулировано с указанием замены, а не удалено; пункт «Реальная БД» уходит из «Дальше»; счётчики тестов |
| `README.md`             | Шаг поднятия БД и миграций в инструкции запуска, новые скрипты, тестовая БД                                                                                     |
| `CLAUDE.md` (корень)    | `docker-compose.yml` больше не заготовка; таблица решений; счётчики тестов; `DATABASE_URL` в разделе про окружение                                              |
| `apps/api/CLAUDE.md`    | Доступ к БД только через сервисы, `PrismaService` не тянуть в контроллеры; хранилища больше не в памяти                                                         |
| `apps/api/.env.example` | `DATABASE_URL`                                                                                                                                                  |

---

## Итог реализации

Реализовано 2026-09-02. Дизайн выше сохранён в исходном виде; ниже — всё, в чём реальность разошлась с ним.

### Prisma 7 вместо предполагавшегося классического API

Главное расхождение. Стабильная версия — 7.10.0 (тег `latest` на npm указывает на `8.0.0-rc`, поэтому первая установка притащила RC и была откачена). В седьмом мажоре:

- `url` в блоке `datasource` **не поддерживается** — подключение задаётся в `prisma.config.ts`;
- `PrismaClient` требует driver adapter.

Следствие: добавились `@prisma/adapter-pg`, `pg`, `@types/pg` и файл `prisma.config.ts`, а `PrismaService` конструирует клиент как `new PrismaClient({ adapter: new PrismaPg({ connectionString }) })`. Решение взять 7, а не закреплять 6, согласовано отдельно: 6 работала бы ровно по исходному дизайну, но это осознанный выбор предыдущего мажора на только что начатом проекте.

### Что ещё разошлось

| Пункт дизайна                                            | Как получилось                                                                                                                                                                 |
| -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Риск: `migrate deploy` может не создать отсутствующую БД | Не подтвердился — `video_meetings_test` создалась сама. Явный шаг создания не понадобился                                                                                      |
| «7 unit-тестов остаётся»                                 | Осталось 8: в `auth.service.spec.ts` на один тест больше, чем я насчитал                                                                                                       |
| Сид запускается как `node --experimental-strip-types`    | Заменено на `ts-node` — он уже в зависимостях, и не зависит от режима модулей                                                                                                  |
| `globalSetup` вызывает CLI через `npx`                   | Вызывает `process.execPath` с путём к `prisma/build/index.js`: `npx` на Windows требовал бы shell, а это давало `DeprecationWarning` в выводе тестов                           |
| Данные сида вынесены в `prisma/seed-data.ts`             | В дизайне не оговаривалось; понадобилось, чтобы `seed.ts` и тесты делили один источник                                                                                         |
| `tsconfig.json`                                          | Пришлось расширить `include` до `prisma/**/*.ts` и `prisma.config.ts`, иначе type-aware ESLint не видит эти файлы. `tsconfig.build.json` их исключает — в `dist` сиду не место |
| `pnpm-workspace.yaml`                                    | Понадобилось разрешить build-скрипты `prisma` и `@prisma/engines` (`allowBuilds`), иначе pnpm не даёт скачать движок                                                           |

### Регрессия, которую поймали тесты

`toPublicUser` строился на `Omit<User, 'passwordHash'>`. Как только `User` стал строкой таблицы, колонка `createdAt` начала попадать в ответы `/auth/login`, `/auth/register` и `/auth/me` — три e2e-теста упали именно на этом. Исправлено в коде, а не в тестах: `PublicUser` теперь `Pick<User, 'id' | 'email' | 'name'>`, а `toPublicUser` собирает объект поимённо. Новая колонка больше не утечёт молча.

### Проверено

`pnpm lint`, `pnpm typecheck`, `pnpm build` — чисто. **8 unit-тестов** и **28 e2e** проходят. Дополнительно — дымовой прогон против собранного API и настоящей Postgres: `POST /api/auth/login` возвращает пользователя без `createdAt`, `GET /api/meetings` — четыре встречи и `startsAt` строкой в ISO.
