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

## Требования

- Node.js >= 20.11 (проверено на 24.x)
- pnpm 11 — `corepack enable pnpm`
- Docker (опционально, для локальной Postgres)

## Установка

```bash
pnpm install
cp .env.example .env
```

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
