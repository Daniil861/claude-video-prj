# Video Meetings — monorepo

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

| Маршрут                           | Описание                                                                                              |
| --------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `/auth/login`                     | Форма входа, ссылка на регистрацию, ошибка при неверных данных                                        |
| `/`                               | Только для авторизованных: приветствие, счётчик встреч, 3 последние встречи, кнопки создания и выхода |
| `/auth/register`, `/meetings/new` | Заглушки                                                                                              |
| `POST /api/auth/login`            | `{ email, password }` → `{ accessToken, user }`, 401 при неверных данных                              |
| `GET /api/auth/me`                | Текущий пользователь по Bearer-токену                                                                 |
| `GET /api/meetings?limit=3`       | `{ items, total }` — встречи текущего пользователя                                                    |

Данные пока хранятся в памяти процесса Nest: перезапуск API сбрасывает их к seed-набору.

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
- Docker (опционально, для локальной Postgres)

## Установка

```bash
pnpm install
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env.local
cp .env.example .env                          # только для docker-compose
```

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
| `pnpm test`                         | unit-тесты                              |
| `pnpm format` / `pnpm format:check` | Prettier                                |
| `pnpm clean`                        | удалить артефакты сборки и node_modules |

Адресный запуск любого скрипта: `pnpm --filter @video-meetings/api <script>`.

## Инфраструктура

```bash
docker compose up -d      # Postgres 16 на порту 5432
docker compose down
```

## Соглашения

- Коммиты — Conventional Commits, проверяются commitlint через хук `commit-msg`.
- Перед коммитом lint-staged прогоняет Prettier и ESLint по staged-файлам.
