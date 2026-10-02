# Video Meetings — monorepo

> Текущее состояние работ, планы и принятые решения — в [PROGRESS.md](PROGRESS.md).

pnpm workspaces + Turborepo. Внутри два приложения и два пакета общих конфигов.

```
apps/
  web/      Next.js 16 (App Router, TypeScript) — http://localhost:3000
  api/      Nest.js 11 (TypeScript)             — http://localhost:3001/api
packages/
  eslint-config/       общие ESLint flat-конфиги: base / next / nest
  typescript-config/   общие tsconfig: base / nextjs / nestjs
```

## Что уже работает

| Маршрут                     | Описание                                                                                              |
| --------------------------- | ----------------------------------------------------------------------------------------------------- |
| `/auth/login`               | Форма входа, ссылка на регистрацию, ошибка при неверных данных                                        |
| `/`                         | Только для авторизованных: приветствие, счётчик встреч, 3 последние встречи, кнопки создания и выхода |
| `/auth/register`            | Регистрация: email, пароль с индикатором надёжности, повтор пароля; после успеха — сразу на главную   |
| `/meetings/new`             | Заглушка                                                                                              |
| `POST /api/auth/login`      | `{ email, password }` → `{ accessToken, user }`, 401 при неверных данных                              |
| `POST /api/auth/register`   | `{ email, password }` → 201 и то же тело; 409, если email занят. `name` — локальная часть email       |
| `GET /api/auth/me`          | Текущий пользователь по Bearer-токену                                                                 |
| `POST /api/meetings`        | `{ title, date, participants, durationMinutes? }` → 201 и встреча; 400 при невалидном теле            |
| `GET /api/meetings?limit=N` | `{ items, total }` — встречи текущего пользователя, новые первыми; без `limit` — все                  |
| `GET /api/meetings/:id`     | Одна встреча текущего пользователя; 404, если её нет или она чужая                                    |

Данные хранятся в Postgres через Prisma и переживают перезапуск API. Сид больше не накатывается при старте приложения — это отдельная команда `db:seed`.

### Тестовые аккаунты

| Email              | Пароль        |
| ------------------ | ------------- |
| `demo@example.com` | `password123` |
| `anna@example.com` | `password123` |

### Как устроена авторизация

`POST /api/auth/login` возвращает JWT. Server action в Next кладёт его в **httpOnly cookie** `access_token` — в браузерный JavaScript токен не попадает, все запросы к Nest уходят только с сервера. `src/middleware.ts` проверяет подпись и срок токена через `jose` и уводит на `/auth/login`, попутно удаляя недействительную cookie.

## Требования

- Node.js >= 20.11 (проверено на 24.x)
- pnpm 11 — `corepack enable pnpm`
- Docker — для Postgres. **Обязателен:** без базы API не стартует

## Установка

```bash
pnpm install
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env.local
cp .env.example .env                          # только для docker-compose

docker compose up -d                          # Postgres 16 на порту 5432
pnpm --filter @video-meetings/api db:deploy   # накатить миграции
pnpm --filter @video-meetings/api db:seed     # тестовые аккаунты и встречи
```

Без последнего шага приложение поднимется, но войти будет некем: таблицы пустые.

> **Важно:** `JWT_SECRET` в `apps/api/.env` и `apps/web/.env.local` должен совпадать — иначе middleware не сможет проверить выданный API токен и вход будет зацикливаться.

## Запуск

```bash
pnpm dev          # web + api параллельно
pnpm dev:web      # только Next.js
pnpm dev:api      # только Nest.js (watch)
```

## Скрипты (корень)

| Скрипт                              | Что делает                              |
| ----------------------------------- | --------------------------------------- |
| `pnpm dev`                          | dev-режим всех приложений               |
| `pnpm build`                        | production-сборка всех приложений       |
| `pnpm start`                        | запуск собранных приложений             |
| `pnpm lint` / `pnpm lint:fix`       | ESLint по всем пакетам                  |
| `pnpm typecheck`                    | `tsc --noEmit` по всем пакетам          |
| `pnpm test`                         | unit-тесты (БД не нужна)                |
| `pnpm format` / `pnpm format:check` | Prettier                                |
| `pnpm clean`                        | удалить артефакты сборки и node_modules |

Адресный запуск любого скрипта: `pnpm --filter @video-meetings/api <script>`.

## База данных

```bash
docker compose up -d      # Postgres 16 на порту 5432
docker compose down
```

Скрипты Prisma — в `apps/api`, запуск через `pnpm --filter @video-meetings/api <script>`:

| Скрипт        | Что делает                                                  |
| ------------- | ----------------------------------------------------------- |
| `db:migrate`  | создать и накатить миграцию по изменениям схемы (dev)       |
| `db:deploy`   | накатить уже созданные миграции; создаёт БД, если её нет    |
| `db:seed`     | засеять тестовые аккаунты и встречи (идемпотентно)          |
| `db:reset`    | удалить БД, накатить всё заново и засеять                   |
| `db:generate` | перегенерировать Prisma Client (также идёт в `postinstall`) |

### Тесты и БД

`pnpm test` — unit-тесты, БД не требуется.

`pnpm --filter @video-meetings/api test:e2e` работает с **отдельной** базой `video_meetings_test` из `apps/api/.env.test`. Перед прогоном он сам накатывает миграции (создавая БД при необходимости), чистит таблицы и засевает их заново. Дев-база не трогается, так что гонять тесты при живом `pnpm dev` безопасно.

## Соглашения

- Коммиты — Conventional Commits, проверяются commitlint через хук `commit-msg`.
- Хук `pre-commit` (husky): lint-staged прогоняет Prettier по staged-файлам, затем `pnpm lint` и `pnpm test` по всему репозиторию. Упал любой шаг — коммит отменяется. Обойти в крайнем случае: `git commit --no-verify`.
