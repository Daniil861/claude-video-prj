# CLAUDE.md — apps/api

Nest.js 11, TypeScript. Порт 3001, глобальный префикс `/api`. Пакет `@video-meetings/api`.
Общие правила монорепозитория — в [корневом CLAUDE.md](../../CLAUDE.md).

> **Меняешь архитектуру — обновляй документацию в том же коммите.** Новый или изменённый эндпоинт, новый модуль, смена хранилища или способа аутентификации → правь таблицу эндпоинтов ниже, `README.md` и `PROGRESS.md`. Критерии и таблица «что куда» — в разделе «Актуализация документации» корневого CLAUDE.md.

## Команды

```bash
pnpm --filter @video-meetings/api dev        # nest start --watch
pnpm --filter @video-meetings/api test       # jest, rootDir=src, *.spec.ts
pnpm --filter @video-meetings/api test:e2e   # jest --config ./test/jest-e2e.json, *.e2e-spec.ts
pnpm --filter @video-meetings/api lint
pnpm --filter @video-meetings/api typecheck
```

Ожидаемо: 8 unit- и 28 e2e-тестов проходят. E2E требуют поднятого Postgres — они работают с отдельной БД `video_meetings_test` из `.env.test` и сами накатывают на неё миграции и сид.

```bash
pnpm --filter @video-meetings/api db:migrate   # создать и накатить миграцию по изменениям схемы
pnpm --filter @video-meetings/api db:seed      # засеять БД (идемпотентно)
pnpm --filter @video-meetings/api db:reset     # снести и накатить всё заново
```

## Структура

```
src/
  main.ts        bootstrap: CORS, префикс /api, глобальный ValidationPipe
  app.module.ts  ConfigModule (isGlobal) + AuthModule + MeetingsModule
  auth/          auth.service.ts, auth.controller.ts, jwt-auth.guard.ts,
                 current-user.decorator.ts, jwt-payload.interface.ts,
                 dto/login.dto.ts, dto/register.dto.ts
  prisma/        prisma.service.ts (PrismaClient + driver adapter), prisma.module.ts (@Global)
  users/         users.service.ts, user.entity.ts
  meetings/      meetings.service.ts, meetings.controller.ts, meeting.entity.ts
prisma/          schema.prisma, migrations/, seed.ts, seed-data.ts
prisma.config.ts конфиг Prisma 7: путь к схеме, DATABASE_URL, команда сида
test/            e2e- и интеграционные спеки, global-setup.ts, setup-e2e.ts, jest-e2e.json
```

## Эндпоинты

| Метод  | Путь                    | Описание                                                                                             |
| ------ | ----------------------- | ---------------------------------------------------------------------------------------------------- |
| `POST` | `/api/auth/login`       | `{ email, password }` → `{ accessToken, user }`; 401 при неверных данных, 400 при невалидном теле    |
| `POST` | `/api/auth/register`    | `{ email, password }` → 201 и `{ accessToken, user }`; 409 если email занят, 400 при невалидном теле |
| `GET`  | `/api/auth/me`          | текущий пользователь по `Authorization: Bearer <jwt>`                                                |
| `GET`  | `/api/meetings?limit=3` | `{ items, total }` — встречи текущего пользователя, новые первыми                                    |

## Правила, которые легко нарушить

- **Доступ к БД — только через сервисы.** `PrismaService` инжектится в `UsersService` / `MeetingsService` и никуда больше. Не тяни его в контроллеры, гарды и DTO: граница хранилища проходит по сервисам, и она уже один раз окупилась при переезде с памяти на Postgres.
- **`PublicUser` — явный `Pick`, а не `Omit` от строки таблицы.** Добавишь колонку в модель `User` — она не утечёт в ответ API молча. Именно `Omit` пропустил `createdAt` наружу при миграции.
- **`startsAt` в БД — `DateTime`, в ответе — ISO-строка.** `MeetingsService` маппит явно (`toMeeting`). Не возвращай строку таблицы из сервиса как есть: тип `Meeting` объявляет `startsAt: string`, и фронт на это опирается.
- **Сид не запускается при старте приложения** — только командой `db:seed`. Не возвращай засеивание в `onModuleInit`: на настоящей БД оно выполнялось бы при каждом `pnpm dev:api`.
- **Дубль email ловится дважды**: проверкой в `UsersService.create` (даёт понятный 409) и уникальным индексом (`P2002` → тот же `ConflictException`). Убирать вторую защиту нельзя — между проверкой и вставкой есть гонка.
- **Меняешь `schema.prisma` — создавай миграцию** (`db:migrate`), а не правь БД руками. Prisma Client перегенерируется в `postinstall` и в `db:generate`.
- **Аутентификация — свой `JwtAuthGuard`, без passport.** Он валидирует `Authorization: Bearer <jwt>` и кладёт payload в `request.user`; читать payload только через `@CurrentUser()`, не лазить в `request` напрямую.
- Guard вешается на контроллер целиком (`@UseGuards(JwtAuthGuard)` на классе `MeetingsController`) или на метод (`/auth/me`). `AuthModule` экспортирует `JwtAuthGuard` и `JwtModule` — другие модули импортируют `AuthModule`, чтобы получить guard.
- **Глобальный `ValidationPipe` со `whitelist` и `forbidNonWhitelisted`**: любое поле, не описанное в DTO, даёт 400. Новые поля тела запроса обязаны попасть в DTO с декораторами `class-validator`.
- **Логин не раскрывает существование email**: при отсутствии пользователя и при неверном пароле — одно и то же `UnauthorizedException('Неверный email или пароль')`. Сохраняй это поведение.
- **Логирование — через `Logger` из `@nestjs/common`**, не `console.log` (правило `no-console` разрешает только `warn`/`error`).
- **Типы-«только типы» импортируются через `import type`** — так написан весь существующий код.
- Сообщения ошибок API — на русском (их показывает фронт).
- В `auth.module.ts` есть осознанный `as JwtModuleOptions['signOptions']`: `jsonwebtoken` типизирует `expiresIn` шаблонным литеральным юнионом, значение из конфига его статически не удовлетворяет. Не «чинить».

## Тесты

- Unit-спеки лежат рядом с кодом (`*.spec.ts`, `rootDir: src`) и **не должны требовать БД**. Всё, что ходит в Postgres, живёт в `test/` (`*.e2e-spec.ts`, отдельный конфиг).
- `test/global-setup.ts` один раз за прогон накатывает миграции на `video_meetings_test`, чистит таблицы и зовёт функцию сида из `prisma/seed.ts`. Не дублируй данные сида в тестах — импортируй.
- Тест, создающий свои строки, обязан использовать уникальные значения (email, id владельца): БД переживает прогон, и общие значения делают тесты зависимыми от порядка.
- Новую бизнес-логику покрывать тестами обязательно: тестируется только API, фронт — вручную.

## Env (`apps/api/.env`, шаблон — `.env.example`)

`ConfigModule` читает `.env.local`, `.env`, `../../.env` (в этом порядке).

| Переменная                               | Назначение                                                                      |
| ---------------------------------------- | ------------------------------------------------------------------------------- |
| `PORT`                                   | по умолчанию 3001                                                               |
| `CORS_ORIGIN`                            | по умолчанию `http://localhost:3000`                                            |
| `JWT_SECRET`                             | **должен совпадать** с `apps/web/.env.local`; читается через `getOrThrow`       |
| `JWT_EXPIRES_IN`                         | по умолчанию `1h`                                                               |
| `SEED_USER_EMAIL` / `SEED_USER_PASSWORD` | seed-пользователь `usr_1`; второй — `anna@example.com` с тем же паролем         |
| `DATABASE_URL`                           | строка подключения к Postgres; в `.env.test` указывает на `video_meetings_test` |

Тестовые аккаунты: `demo@example.com`, `anna@example.com`, пароль `password123` — появляются в БД после `db:seed`.

`PrismaService` читает `DATABASE_URL` из `process.env` напрямую, а не через `ConfigService`: клиент создаётся раньше, чем Nest успевает поднять конфиг. Поэтому в e2e переменная кладётся в окружение в `test/setup-e2e.ts` до импорта модулей.
