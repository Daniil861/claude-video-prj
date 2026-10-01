'use server';

import { redirect } from 'next/navigation';
import { ApiError, apiFetch } from '@/lib/api';
import { clearSessionCookie, setSessionCookie } from '@/lib/session';
import type { User } from '@/lib/types';
import {
  validateLogin,
  validateRegister,
  type FieldErrors,
  type LoginField,
  type RegisterField,
} from './schemas';

export interface LoginState {
  /** Form-level error: wrong credentials or an API failure. */
  error?: string;
  /** Per-field validation messages, shown under the matching input. */
  fieldErrors?: FieldErrors<LoginField>;
}

export interface RegisterState {
  /** Form-level error: an API failure not tied to a field. */
  error?: string;
  /** Per-field messages, including "email already taken" from the API. */
  fieldErrors?: FieldErrors<RegisterField>;
}

/** Same body and response for `/auth/login` and `/auth/register`. */
interface AuthResponse {
  accessToken: string;
  user: User;
}

function readField(formData: FormData, name: string): string {
  return String(formData.get(name) ?? '');
}

function hasErrors(errors: object): boolean {
  return Object.keys(errors).length > 0;
}

async function startSession(path: '/auth/login' | '/auth/register', body: unknown): Promise<void> {
  const { accessToken } = await apiFetch<AuthResponse>(path, { method: 'POST', body });
  await setSessionCookie(accessToken);
}

export async function loginAction(_prevState: LoginState, formData: FormData): Promise<LoginState> {
  const values = { email: readField(formData, 'email'), password: readField(formData, 'password') };
  const fieldErrors = validateLogin(values);

  if (hasErrors(fieldErrors)) {
    return { fieldErrors };
  }

  try {
    await startSession('/auth/login', { email: values.email.trim(), password: values.password });
  } catch (error) {
    if (error instanceof ApiError) {
      return { error: error.status === 401 ? 'Неверный email или пароль' : error.message };
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
  const values = {
    email: readField(formData, 'email'),
    password: readField(formData, 'password'),
    confirmPassword: readField(formData, 'confirmPassword'),
  };
  const fieldErrors = validateRegister(values);

  if (hasErrors(fieldErrors)) {
    return { fieldErrors };
  }

  try {
    // confirmPassword is not part of the API contract.
    await startSession('/auth/register', { email: values.email.trim(), password: values.password });
  } catch (error) {
    if (error instanceof ApiError) {
      return error.status === 409
        ? { fieldErrors: { email: 'Этот email уже зарегистрирован' } }
        : { error: error.message };
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
