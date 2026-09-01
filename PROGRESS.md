# Состояние проекта

Файл-хендофф: что сделано, что дальше, какие решения уже приняты и почему.
Обновлять при каждом заметном шаге. Технические детали запуска — в [README.md](README.md).

**Обновлено:** 2026-09-01
**Последний коммит:** `a2c0d5a chore: add agent skills`

---

## Сделано

### 1. Монорепозиторий (`8d3367a`)

pnpm workspaces + Turborepo, два приложения и два пакета общих конфигов.

- `apps/web` — Next.js 16.3.1, App Router, TypeScript, React 19, порт 3000. Без Tailwind — обычные CSS-модули.
- `apps/api` — Nest.js 11, TypeScript, порт 3001, глобальный префикс `/api`.
- `packages/eslint-config` — flat-конфиги `base` / `next` / `nest`. `eslint-config-next` живёт здесь, его версию надо бампать вместе с Next.
- `packages/typescript-config` — `base.json` / `nextjs.json` / `nestjs.json`.
- Prettier, EditorConfig, `.gitattributes` (eol=lf), husky + lint-staged + commitlint (Conventional Commits).
- `docker-compose.yml` с Postgres 16 — **пока никем не используется**, заготовка на будущее.

### 2. Аутентификация и главная страница (`18a00ea`)

**API:**

| Эндпоинт                    | Что делает                                                                                        |
| --------------------------- | ------------------------------------------------------------------------------------------------- |
| `POST /api/auth/login`      | `{ email, password }` → `{ accessToken, user }`, 401 при неверных данных, 400 при невалидном теле |
| `GET /api/auth/me`          | Текущий пользователь по `Authorization: Bearer <jwt>`                                             |
| `GET /api/meetings?limit=3` | `{ items, total }` — встречи текущего пользователя, новые первыми                                 |

- `src/auth/` — `AuthService` (bcrypt + `@nestjs/jwt`), свой `JwtAuthGuard` (без passport), декоратор `@CurrentUser()`, `LoginDto`.
- `src/users/`, `src/meetings/` — хранилища **в памяти процесса**, за интерфейсами сервисов.
- Глобальный `ValidationPipe` (`whitelist`, `forbidNonWhitelisted`).

**Web:**

- `/auth/login` — server action `loginAction`: zod-валидация → Nest → httpOnly cookie → `redirect('/')`. Ошибка через `useActionState`, email сохраняется после неудачной попытки.
- `/` — server component: приветствие с email, счётчик встреч, 3 последние встречи, «Создать встречу», «Выйти».
- `src/middleware.ts` — проверяет подпись и срок JWT через `jose`, удаляет недействительную cookie.
- `/auth/register`, `/meetings/new` — заглушки.
- `src/lib/api.ts` — серверный клиент к Nest. **Не импортировать из клиентских компонентов**: токен не должен попадать в браузер.

---

### 3. Скиллы агента и CLAUDE.md (`a2c0d5a` + коммит с документацией)

- `.claude/skills/` и `.agents/skills/` — установленные скиллы (`heroui-react`, `git-commit`, `requesting-code-review`), плюс `skills-lock.json`. Дубль в двух папках — так их кладёт установщик, обе версии одинаковы.
- `CLAUDE.md` в корне и в каждом из `apps/*` — контекст для агента: команды, соглашения, ловушки конкретного приложения.
  - Корневой — про монорепозиторий, env, Conventional Commits и ссылку на этот файл.
  - `apps/web/CLAUDE.md` — про серверную границу (`lib/api.ts` и `lib/session.ts` не импортировать из клиентских компонентов), CSS-модули вместо Tailwind, `redirect()` вне `try/catch`, `config.matcher` в middleware.
  - `apps/api/CLAUDE.md` — про хранилища в памяти за интерфейсами сервисов, `@CurrentUser()` вместо чтения `request`, `whitelist` в `ValidationPipe`, осознанный `as` в `auth.module.ts`.

---

## Дальше (не начато)

Порядок не зафиксирован — выбирается в начале следующей сессии.

1. **Регистрация** — `POST /api/auth/register` + рабочая форма `/auth/register` вместо заглушки.
2. **Реальная БД** — Prisma + Postgres (compose уже есть), схема `User` / `Meeting`, миграции, seed. Меняется только внутренность `UsersService` / `MeetingsService`, контроллеры не трогаются.
3. **Создание встречи** — `POST /api/meetings` + форма `/meetings/new`.
4. Возможно позже: refresh-токены, полный список встреч с пагинацией, тесты фронтенда (Vitest + Testing Library — сознательно отложены).

---

## Принятые решения

| Решение                                                  | Почему                                                                                               |
| -------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| Данные в памяти, а не БД                                 | Договорились начать без Docker; слой репозитория меняется на Prisma без правки контроллеров          |
| JWT в httpOnly cookie, а не localStorage                 | Токен недоступен браузерному JS; главная — server component, без вспышки неавторизованного состояния |
| Server Actions вместо route handlers в Next              | Меньше слоёв: нет промежуточного `/api/...` в Next                                                   |
| Свой `JwtAuthGuard` вместо passport-jwt                  | ~20 строк вместо трёх зависимостей и стратегий                                                       |
| Middleware проверяет подпись и срок, а не наличие cookie | Иначе просроченный токен зацикливает редиректы: гард пускает → страница ловит 401 → снова на логин   |
| Общие ESLint/TS-конфиги в `packages/`                    | Одни правила на оба приложения                                                                       |
| Env по приложению, а не один корневой                    | Next не читает корневой `.env`                                                                       |
| Тесты только на API                                      | Договорились: фронт проверяется вручную/браузером                                                    |

---

## Что помнить про окружение

- **`JWT_SECRET` обязан совпадать** в `apps/api/.env` и `apps/web/.env.local`, иначе middleware не проверит токен и вход зациклится.
- Перезапуск API **сбрасывает данные** к seed-набору. Тестовые аккаунты: `demo@example.com` и `anna@example.com`, пароль `password123`.
- `pnpm dev` не поднимется, если на портах 3000/3001 висят процессы с прошлого запуска.
- В `apps/api/src/auth/auth.module.ts` есть осознанный `as` для `signOptions`: `jsonwebtoken` типизирует `expiresIn` шаблонным литеральным юнионом, значение из конфига его статически не удовлетворяет.

## Как проверить, что всё живо

```bash
pnpm lint && pnpm typecheck && pnpm test && pnpm build
pnpm --filter @video-meetings/api test:e2e
pnpm dev     # http://localhost:3000/auth/login
```

Ожидаемо: 14 unit-тестов и 11 e2e-тестов проходят, lint и typecheck чистые.

Браузерная проверка логина делалась Playwright'ом, установленным во временную папку вне репозитория — в проекте его нет и переустанавливать его при обычной работе не нужно.
