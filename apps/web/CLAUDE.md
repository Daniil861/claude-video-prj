# CLAUDE.md — apps/web

Next.js 16.3.1, App Router, React 19, TypeScript, HeroUI v3 + Tailwind CSS v4. Порт 3000. Пакет `@video-meetings/web`.
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
- **UI-компоненты — HeroUI v3** (`@heroui/react`), раскладка и всё своё — CSS-модули (`*.module.css`) рядом с компонентом. Tailwind v4 подключён, потому что на нём стоит HeroUI; утилитарные классы в разметке не используем — иначе в проекте будет два способа стилизации одного и того же.
- **HeroUI — только v3.** Без `HeroUIProvider`, без `framer-motion`, компоненты составные (`Card.Header`), обработчик — `onPress`, а не `onClick`. Документация v3 — через скилл `heroui-react` (`.claude/skills/heroui-react`); знания про v2 не применять.
- **Порядок импортов в `globals.css` важен:** сначала `tailwindcss`, потом `@heroui/styles`. PostCSS-плагин — `@tailwindcss/postcss` (`postcss.config.mjs`).
- **Токены темы — от HeroUI.** `--background`, `--surface`, `--foreground`, `--muted`, `--border`, `--accent`, `--accent-hover`, `--danger`, `--danger-soft`, `--radius` объявляет HeroUI, CSS-модули пользуются ими же. Свои значения (фирменный `--accent`, `--radius`) переопределяются в `globals.css` вне `@layer` — так они перекрывают слой темы. Не заводи токен с тем же именем, но другим смыслом.
- **Тёмная тема — по классу `dark` на `<html>`**, а не по `prefers-color-scheme`: так HeroUI переключает свои токены. Класс ставит inline-скрипт в `layout.tsx` по системной настройке до первой отрисовки (отсюда `suppressHydrationWarning` на `<html>`).
- **Компоненты HeroUI уже помечены `'use client'`** внутри пакета — их можно рендерить из server components (см. `features/auth/logout-button.tsx`).
- **Server Actions, а не route handlers.** В `src/app` нет и не должно быть `api/`-маршрутов Next: формы вызывают server actions напрямую.
- **`redirect()` бросает исключение** — вызывать его вне `try/catch`, иначе редирект будет проглочен (см. конец `loginAction`).
- **UI-тексты — на русском.** Ошибки пользователю формулируются в actions/queries, а не пробрасываются сырыми.

## Аутентификация

1. `loginAction` (`features/auth/actions.ts`): zod-валидация → `POST /auth/login` в Nest → `setSessionCookie(accessToken)` → `redirect('/')`.
2. Cookie `access_token`: `httpOnly`, `sameSite: 'lax'`, `secure` в production, `maxAge` = остаток жизни JWT.
3. Ошибки формы возвращаются через `useActionState`: `fieldErrors` (zod, по полям — под инпутом через `FieldError`) и `error` (неверные данные, сбой API — `Alert`). `email` сохраняется в стейте, чтобы форма не сбрасывалась.
4. **Форма на HeroUI (`Form` + `TextField`) — две ловушки:**
   - `validationBehavior="aria"`: валидирует только server action, браузер не блокирует отправку своими всплывающими подсказками (замена прежнему `noValidate`).
   - Ошибки полей передаются через `isInvalid` у `TextField`, **а не через `validationErrors` у `Form`**: после action React 19 сбрасывает форму, а React Aria на событии `reset` стирает серверные ошибки — они мигнут и пропадут. Значение после сброса берётся из актуального `defaultValue`, поэтому `defaultValue={state.email}` работает.
5. `src/middleware.ts` проверяет **подпись и срок** токена через `jose` (не просто наличие cookie) и удаляет недействительную cookie. Матчер: `/`, `/meetings/*`, `/auth/login`, `/auth/register`. При добавлении защищённого маршрута — добавь его в `config.matcher`.

## Работа с API

- Все запросы — через `apiFetch<T>(path, { method, body, token })`; ошибки приходят как `ApiError` с `status`.
- Данные страницы грузятся одним параллельным раундом (`loadDashboard` → `Promise.all`), результат — размеченный union `{ status: 'ok' | 'unauthorized' | 'unavailable' }`, а не выброшенное исключение.
- Базовый URL — `process.env.API_URL` (по умолчанию `http://localhost:3001/api`), переменная **без** префикса `NEXT_PUBLIC_`: она серверная.

## Env (`apps/web/.env.local`, шаблон — `.env.example`)

| Переменная   | Назначение                                                             |
| ------------ | ---------------------------------------------------------------------- |
| `API_URL`    | база Nest API, только сервер                                           |
| `JWT_SECRET` | **должен совпадать** с `apps/api/.env`, иначе middleware зациклит вход |
