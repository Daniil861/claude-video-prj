'use server';

import { redirect } from 'next/navigation';
import { z } from 'zod';
import { ApiError, apiFetch } from '@/lib/api';
import { clearSessionCookie, setSessionCookie } from '@/lib/session';
import type { User } from '@/lib/types';

export interface LoginState {
  /** Form-level error: wrong credentials or an API failure. */
  error?: string;
  /** Per-field validation messages, shown under the matching input. */
  fieldErrors?: Partial<Record<'email' | 'password', string>>;
  /** Field values kept so the form does not reset after a failed attempt. */
  email?: string;
}

export interface RegisterState {
  /** Form-level error: an API failure not tied to a field. */
  error?: string;
  /** Per-field messages, including "email already taken" from the API. */
  fieldErrors?: Partial<Record<'email' | 'password' | 'confirmPassword', string>>;
  /** Field values kept so the form does not reset after a failed attempt. */
  email?: string;
}

/** Same body and response for `/auth/login` and `/auth/register`. */
interface AuthResponse {
  accessToken: string;
  user: User;
}

// Mirrors LoginDto / RegisterDto in the API so the user sees the error before a round trip.
const credentialsSchema = z.object({
  email: z.string().trim().min(1, 'Введите email').email('Некорректный email'),
  password: z.string().min(6, 'Пароль должен быть не короче 6 символов'),
});

// confirmPassword is checked here only and never sent to the API.
const registerSchema = credentialsSchema
  .extend({ confirmPassword: z.string().min(1, 'Повторите пароль') })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Пароли не совпадают',
    path: ['confirmPassword'],
  });

async function startSession(path: '/auth/login' | '/auth/register', body: unknown): Promise<void> {
  const { accessToken } = await apiFetch<AuthResponse>(path, { method: 'POST', body });
  await setSessionCookie(accessToken);
}

export async function loginAction(_prevState: LoginState, formData: FormData): Promise<LoginState> {
  const email = String(formData.get('email') ?? '');
  const parsed = credentialsSchema.safeParse({
    email,
    password: String(formData.get('password') ?? ''),
  });

  if (!parsed.success) {
    const { fieldErrors } = z.flattenError(parsed.error);
    return {
      fieldErrors: { email: fieldErrors.email?.[0], password: fieldErrors.password?.[0] },
      email,
    };
  }

  try {
    await startSession('/auth/login', parsed.data);
  } catch (error) {
    if (error instanceof ApiError) {
      return {
        error: error.status === 401 ? 'Неверный email или пароль' : error.message,
        email,
      };
    }

    throw error;
  }

  // Outside the try block: redirect() signals by throwing.
  redirect('/');
}

export async function registerAction(
  _prevState: RegisterState,
  formData: FormData,
): Promise<RegisterState> {
  const email = String(formData.get('email') ?? '');
  const parsed = registerSchema.safeParse({
    email,
    password: String(formData.get('password') ?? ''),
    confirmPassword: String(formData.get('confirmPassword') ?? ''),
  });

  if (!parsed.success) {
    const { fieldErrors } = z.flattenError(parsed.error);
    return {
      fieldErrors: {
        email: fieldErrors.email?.[0],
        password: fieldErrors.password?.[0],
        confirmPassword: fieldErrors.confirmPassword?.[0],
      },
      email,
    };
  }

  try {
    await startSession('/auth/register', {
      email: parsed.data.email,
      password: parsed.data.password,
    });
  } catch (error) {
    if (error instanceof ApiError) {
      return error.status === 409
        ? { fieldErrors: { email: 'Этот email уже зарегистрирован' }, email }
        : { error: error.message, email };
    }

    throw error;
  }

  // Outside the try block: redirect() signals by throwing.
  redirect('/');
}

export async function logoutAction(): Promise<void> {
  await clearSessionCookie();
  redirect('/auth/login');
}
