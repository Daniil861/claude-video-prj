# CLAUDE.md — apps/web

Next.js 16.3.1, App Router, React 19, TypeScript. Порт 3000. Пакет `@video-meetings/web`.
Общие правила монорепозитория — в [корневом CLAUDE.md](../../CLAUDE.md).

> **Меняешь архитектуру — обновляй документацию в том же коммите.** Новый маршрут, изменившийся контракт с API, смена подхода к сессии или новая зависимость → правь этот файл, `README.md` и `PROGRESS.md`. Критерии и таблица «что куда» — в разделе «Актуализация документации» корневого CLAUDE.md.

## Команды

```bash
pnpm --filter @video-meetings/web dev         # next dev --port 3000
pnpm --filter @video-meetings/web build
pnpm --filter @video-meetings/web lint
pnpm --filter @video-meetings/web typecheck   # tsc --noEmit
```

Тестов здесь нет сознательно: фронт проверяется вручную в браузере.

## Структура

```
src/
  app/          маршруты App Router; стили — CSS-модули рядом (page.module.css)
    page.tsx              /            главная, server component, только для авторизованных
    auth/login/           /auth/login
    auth/register/        заглушка
    meetings/new/         заглушка
  features/     фичевые модули: server actions, client-компоненты, запросы
    auth/       actions.ts (loginAction/logoutAction), login-form.tsx, logout-button.tsx
    meetings/   queries.ts (loadDashboard), meeting-list.tsx
  lib/          инфраструктура
    api.ts          серверный fetch-клиент к Nest + класс ApiError
    session.ts      чтение/запись/удаление httpOnly cookie (next/headers)
    auth-cookie.ts  имя cookie + verifySessionToken (jose, edge-safe)
    types.ts        User / Meeting / MeetingsPage
  middleware.ts  защита маршрутов
```

Алиас импортов: `@/*` → `./src/*`.

## Правила, которые легко нарушить

- **`src/lib/api.ts` — только для сервера.** Не импортировать из клиентских компонентов: токен не должен попадать в браузер. Все запросы к Nest уходят с сервера.
- **`src/lib/session.ts` использует `next/headers`** — тоже только server components / server actions. `auth-cookie.ts` намеренно отделён, потому что его использует edge-middleware.
- **Никакого Tailwind** — обычные CSS-модули (`*.module.css`) рядом с компонентом, плюс `src/app/globals.css`.
- **Server Actions, а не route handlers.** В `src/app` нет и не должно быть `api/`-маршрутов Next: формы вызывают server actions напрямую.
- **`redirect()` бросает исключение** — вызывать его вне `try/catch`, иначе редирект будет проглочен (см. конец `loginAction`).
- **UI-тексты — на русском.** Ошибки пользователю формулируются в actions/queries, а не пробрасываются сырыми.

## Аутентификация

1. `loginAction` (`features/auth/actions.ts`): zod-валидация → `POST /auth/login` в Nest → `setSessionCookie(accessToken)` → `redirect('/')`.
2. Cookie `access_token`: `httpOnly`, `sameSite: 'lax'`, `secure` в production, `maxAge` = остаток жизни JWT.
3. Ошибки формы возвращаются через `useActionState`; `email` сохраняется в стейте, чтобы форма не сбрасывалась.
4. `src/middleware.ts` проверяет **подпись и срок** токена через `jose` (не просто наличие cookie) и удаляет недействительную cookie. Матчер: `/`, `/meetings/*`, `/auth/login`, `/auth/register`. При добавлении защищённого маршрута — добавь его в `config.matcher`.

## Работа с API

- Все запросы — через `apiFetch<T>(path, { method, body, token })`; ошибки приходят как `ApiError` с `status`.
- Данные страницы грузятся одним параллельным раундом (`loadDashboard` → `Promise.all`), результат — размеченный union `{ status: 'ok' | 'unauthorized' | 'unavailable' }`, а не выброшенное исключение.
- Базовый URL — `process.env.API_URL` (по умолчанию `http://localhost:3001/api`), переменная **без** префикса `NEXT_PUBLIC_`: она серверная.

## Env (`apps/web/.env.local`, шаблон — `.env.example`)

| Переменная   | Назначение                                                             |
| ------------ | ---------------------------------------------------------------------- |
| `API_URL`    | база Nest API, только сервер                                           |
| `JWT_SECRET` | **должен совпадать** с `apps/api/.env`, иначе middleware зациклит вход |
