'use client';

import { useActionState } from 'react';
import { loginAction, type LoginState } from './actions';
import styles from './login-form.module.css';

const INITIAL_STATE: LoginState = {};

export function LoginForm() {
  const [state, formAction, isPending] = useActionState(loginAction, INITIAL_STATE);

  return (
    <form className={styles.form} action={formAction} noValidate>
      <label className={styles.field}>
        <span className={styles.label}>Email</span>
        <input
          className={styles.input}
          type="email"
          name="email"
          autoComplete="email"
          defaultValue={state.email}
          placeholder="demo@example.com"
          required
        />
      </label>

      <label className={styles.field}>
        <span className={styles.label}>Пароль</span>
        <input
          className={styles.input}
          type="password"
          name="password"
          autoComplete="current-password"
          minLength={6}
          required
        />
      </label>

      {state.error ? (
        <p className={styles.error} role="alert">
          {state.error}
        </p>
      ) : null}

      <button className={styles.submit} type="submit" disabled={isPending}>
        {isPending ? 'Входим…' : 'Войти'}
      </button>
    </form>
  );
}
