'use client';

import { Button, Form, Spinner } from '@heroui/react';
import { loginAction, type LoginState } from './actions';
import { EmailField } from './email-field';
import { FormAlert } from './form-alert';
import { PasswordField } from './password-field';
import { validateLogin } from './schemas';
import { useAuthForm } from './use-auth-form';
import styles from './auth-form.module.css';

const INITIAL_STATE: LoginState = {};
const INITIAL_VALUES = { email: '', password: '' };

export function LoginForm() {
  const { state, isPending, formRef, formAction, bind, onSubmit } = useAuthForm({
    action: loginAction,
    initialState: INITIAL_STATE,
    initialValues: INITIAL_VALUES,
    validate: validateLogin,
  });

  // Same setup as RegisterForm — see the comment there and apps/web/CLAUDE.md.
  return (
    <Form
      ref={formRef}
      className={styles.form}
      action={formAction}
      onSubmit={onSubmit}
      validationBehavior="aria"
    >
      <EmailField {...bind('email')} />

      <PasswordField
        name="password"
        label="Пароль"
        autoComplete="current-password"
        {...bind('password')}
      />

      <FormAlert message={state.error} />

      <Button type="submit" isPending={isPending} fullWidth size="lg">
        {isPending ? <Spinner color="current" size="sm" /> : null}
        {isPending ? 'Входим…' : 'Войти'}
      </Button>
    </Form>
  );
}
