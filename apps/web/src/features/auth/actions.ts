'use server';

import { redirect } from 'next/navigation';
import { z } from 'zod';
import { ApiError, apiFetch } from '@/lib/api';
import { clearSessionCookie, setSessionCookie } from '@/lib/session';
import type { User } from '@/lib/types';

export interface LoginState {
  error?: string;
  /** Field values kept so the form does not reset after a failed attempt. */
  email?: string;
}

interface LoginResponse {
  accessToken: string;
  user: User;
}

const loginSchema = z.object({
  email: z.string().trim().min(1, 'Введите email').email('Некорректный email'),
  password: z.string().min(6, 'Пароль должен быть не короче 6 символов'),
});

export async function loginAction(_prevState: LoginState, formData: FormData): Promise<LoginState> {
  const email = String(formData.get('email') ?? '');
  const parsed = loginSchema.safeParse({ email, password: String(formData.get('password') ?? '') });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Проверьте введённые данные', email };
  }

  try {
    const { accessToken } = await apiFetch<LoginResponse>('/auth/login', {
      method: 'POST',
      body: parsed.data,
    });
    await setSessionCookie(accessToken);
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

export async function logoutAction(): Promise<void> {
  await clearSessionCookie();
  redirect('/auth/login');
}
