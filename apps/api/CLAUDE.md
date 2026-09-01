# CLAUDE.md — apps/api

Nest.js 11, TypeScript. Порт 3001, глобальный префикс `/api`. Пакет `@video-meetings/api`.
Общие правила монорепозитория — в [корневом CLAUDE.md](../../CLAUDE.md).

## Команды

```bash
pnpm --filter @video-meetings/api dev        # nest start --watch
pnpm --filter @video-meetings/api test       # jest, rootDir=src, *.spec.ts
pnpm --filter @video-meetings/api test:e2e   # jest --config ./test/jest-e2e.json, *.e2e-spec.ts
pnpm --filter @video-meetings/api lint
pnpm --filter @video-meetings/api typecheck
```

Ожидаемо: 14 unit- и 11 e2e-тестов проходят.

## Структура

```
src/
  main.ts        bootstrap: CORS, префикс /api, глобальный ValidationPipe
  app.module.ts  ConfigModule (isGlobal) + AuthModule + MeetingsModule
  auth/          auth.service.ts, auth.controller.ts, jwt-auth.guard.ts,
                 current-user.decorator.ts, jwt-payload.interface.ts, dto/login.dto.ts
  users/         users.service.ts (in-memory + seed), user.entity.ts
  meetings/      meetings.service.ts (in-memory), meetings.controller.ts, meeting.entity.ts
test/            e2e-спеки + jest-e2e.json
```

## Эндпоинты

| Метод  | Путь                    | Описание                                                                                          |
| ------ | ----------------------- | ------------------------------------------------------------------------------------------------- |
| `POST` | `/api/auth/login`       | `{ email, password }` → `{ accessToken, user }`; 401 при неверных данных, 400 при невалидном теле |
| `GET`  | `/api/auth/me`          | текущий пользователь по `Authorization: Bearer <jwt>`                                             |
| `GET`  | `/api/meetings?limit=3` | `{ items, total }` — встречи текущего пользователя, новые первыми                                 |

## Правила, которые легко нарушить

- **Хранилища — в памяти процесса.** `UsersService` / `MeetingsService` держат данные в `Map`; перезапуск сбрасывает их к seed. Это осознанно: при переезде на Prisma меняется **только внутренность сервисов**, контроллеры не трогаются. Не протаскивай детали хранилища в контроллеры.
- **Аутентификация — свой `JwtAuthGuard`, без passport.** Он валидирует `Authorization: Bearer <jwt>` и кладёт payload в `request.user`; читать payload только через `@CurrentUser()`, не лазить в `request` напрямую.
- Guard вешается на контроллер целиком (`@UseGuards(JwtAuthGuard)` на классе `MeetingsController`) или на метод (`/auth/me`). `AuthModule` экспортирует `JwtAuthGuard` и `JwtModule` — другие модули импортируют `AuthModule`, чтобы получить guard.
- **Глобальный `ValidationPipe` со `whitelist` и `forbidNonWhitelisted`**: любое поле, не описанное в DTO, даёт 400. Новые поля тела запроса обязаны попасть в DTO с декораторами `class-validator`.
- **Логин не раскрывает существование email**: при отсутствии пользователя и при неверном пароле — одно и то же `UnauthorizedException('Неверный email или пароль')`. Сохраняй это поведение.
- **Логирование — через `Logger` из `@nestjs/common`**, не `console.log` (правило `no-console` разрешает только `warn`/`error`).
- **Типы-«только типы» импортируются через `import type`** — так написан весь существующий код.
- Сообщения ошибок API — на русском (их показывает фронт).
- В `auth.module.ts` есть осознанный `as JwtModuleOptions['signOptions']`: `jsonwebtoken` типизирует `expiresIn` шаблонным литеральным юнионом, значение из конфига его статически не удовлетворяет. Не «чинить».

## Тесты

- Unit-спеки лежат рядом с кодом (`*.spec.ts`, `rootDir: src`), e2e — в `test/` (`*.e2e-spec.ts`, отдельный конфиг).
- Новую бизнес-логику покрывать тестами обязательно: тестируется только API, фронт — вручную.

## Env (`apps/api/.env`, шаблон — `.env.example`)

`ConfigModule` читает `.env.local`, `.env`, `../../.env` (в этом порядке).

| Переменная                               | Назначение                                                                |
| ---------------------------------------- | ------------------------------------------------------------------------- |
| `PORT`                                   | по умолчанию 3001                                                         |
| `CORS_ORIGIN`                            | по умолчанию `http://localhost:3000`                                      |
| `JWT_SECRET`                             | **должен совпадать** с `apps/web/.env.local`; читается через `getOrThrow` |
| `JWT_EXPIRES_IN`                         | по умолчанию `1h`                                                         |
| `SEED_USER_EMAIL` / `SEED_USER_PASSWORD` | seed-пользователь `usr_1`; второй — `anna@example.com` с тем же паролем   |

Тестовые аккаунты: `demo@example.com`, `anna@example.com`, пароль `password123`.
