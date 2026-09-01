# CLAUDE.md

Монорепозиторий `video-meetings`: pnpm workspaces + Turborepo, два приложения и два пакета общих конфигов.

## Обязательное перед началом и в конце работы

- **Читай [PROGRESS.md](PROGRESS.md) в начале сессии** — это файл-хендофф: что сделано, что дальше, какие решения приняты и почему. Технические детали запуска — в [README.md](README.md).
- **Обновляй PROGRESS.md при каждом заметном шаге** (новая фича, изменение архитектуры, новое решение) — раздел «Сделано», «Дальше», таблицу «Принятые решения».
- Документация проекта ведётся **на русском языке**. Комментарии в коде и docstring — на английском (см. существующий код).

## Структура

```
apps/
  web/                Next.js 16, App Router  — http://localhost:3000       (см. apps/web/CLAUDE.md)
  api/                Nest.js 11              — http://localhost:3001/api   (см. apps/api/CLAUDE.md)
packages/
  eslint-config/      flat-конфиги: base / next / nest
  typescript-config/  base.json / nextjs.json / nestjs.json
```

`eslint-config-next` живёт в `packages/eslint-config` — его версию бампать вместе с версией Next.

## Команды

Все команды запускаются из корня через Turborepo:

```bash
pnpm dev            # web + api параллельно
pnpm dev:web        # только Next.js
pnpm dev:api        # только Nest.js (watch)
pnpm lint           # ESLint по всем пакетам
pnpm typecheck      # tsc --noEmit по всем пакетам
pnpm test           # unit-тесты (фактически только apps/api)
pnpm build
pnpm format         # Prettier
```

Адресно: `pnpm --filter @video-meetings/api <script>`, `pnpm --filter @video-meetings/web <script>`.

**Проверка перед коммитом:**

```bash
pnpm lint && pnpm typecheck && pnpm test && pnpm build
pnpm --filter @video-meetings/api test:e2e
```

Ожидаемо: 14 unit- и 11 e2e-тестов проходят, lint и typecheck чистые.

## Окружение

- Node.js >= 20.11, pnpm 11 (`corepack enable pnpm`).
- Env — **по приложению**, а не один корневой: Next не читает корневой `.env`.
  - `apps/api/.env` ← `apps/api/.env.example`
  - `apps/web/.env.local` ← `apps/web/.env.example`
  - корневой `.env` — только для docker-compose.
- **`JWT_SECRET` обязан совпадать** в `apps/api/.env` и `apps/web/.env.local`, иначе middleware не проверит токен и вход зациклится.
- `docker-compose.yml` поднимает Postgres 16, но **пока никем не используется** — заготовка под Prisma.
- `pnpm dev` не поднимется, если на портах 3000/3001 висят процессы с прошлого запуска.

## Соглашения

- **Коммиты — Conventional Commits**, проверяются commitlint через хук `commit-msg`. lint-staged прогоняет Prettier по staged-файлам.
- Prettier: одинарные кавычки, точки с запятой, trailing comma `all`, printWidth 100, 2 пробела. Не форматируй руками — `pnpm format`.
- TypeScript strict, включая `noUncheckedIndexedAccess`. `any` не использовать; для внешних данных — `unknown` + сужение (см. `apps/web/src/lib/api.ts`).
- `no-console` — предупреждение, разрешены только `warn`/`error`. В Nest используй `Logger`.
- Переносы строк — LF (`.gitattributes`).

## Архитектурные решения (не менять без обсуждения)

| Решение                                                  | Почему                                                                                      |
| -------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| Данные в памяти, а не БД                                 | Договорились начать без Docker; слой репозитория меняется на Prisma без правки контроллеров |
| JWT в httpOnly cookie, а не localStorage                 | Токен недоступен браузерному JS; главная — server component                                 |
| Server Actions вместо route handlers в Next              | Меньше слоёв: нет промежуточного `/api/...` в Next                                          |
| Свой `JwtAuthGuard` вместо passport-jwt                  | ~20 строк вместо трёх зависимостей и стратегий                                              |
| Middleware проверяет подпись и срок, а не наличие cookie | Иначе просроченный токен зацикливает редиректы                                              |
| Тесты только на API                                      | Фронт проверяется вручную/браузером                                                         |

Полный список с контекстом — в PROGRESS.md.
