'use client';

import { Button, Description, Form, Spinner } from '@heroui/react';
import { registerAction, type RegisterState } from './actions';
import { EmailField } from './email-field';
import { FormAlert } from './form-alert';
import { PasswordField } from './password-field';
import { PasswordStrength } from './password-strength';
import { validateRegister } from './schemas';
import { useAuthForm } from './use-auth-form';
import styles from './auth-form.module.css';

const INITIAL_STATE: RegisterState = {};
const INITIAL_VALUES = { email: '', password: '', confirmPassword: '' };

export function RegisterForm() {
  const { state, isPending, formRef, formAction, bind, onSubmit } = useAuthForm({
    action: registerAction,
    initialState: INITIAL_STATE,
    initialValues: INITIAL_VALUES,
    validate: validateRegister,
  });
  const password = bind('password');

  // validationBehavior="aria": errors come from useAuthForm, the browser does not block
  // submission with its own popups. See apps/web/CLAUDE.md.
  return (
    <Form
      ref={formRef}
      className={styles.form}
      action={formAction}
      onSubmit={onSubmit}
      validationBehavior="aria"
    >
      <EmailField {...bind('email')}>
        <Description>На него придут приглашения на встречи</Description>
      </EmailField>

      <PasswordField name="password" label="Пароль" autoComplete="new-password" {...password}>
        {password.value ? (
          <PasswordStrength password={password.value} />
        ) : (
          <Description>Не короче 6 символов</Description>
        )}
      </PasswordField>

      <PasswordField
        name="confirmPassword"
        label="Повторите пароль"
        autoComplete="new-password"
        {...bind('confirmPassword')}
      />

      <FormAlert message={state.error} />

      <Button type="submit" isPending={isPending} fullWidth size="lg">
        {isPending ? <Spinner color="current" size="sm" /> : null}
        {isPending ? 'Создаём аккаунт…' : 'Создать аккаунт'}
      </Button>
    </Form>
  );
}
