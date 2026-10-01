'use client';

import { useActionState, useState } from 'react';
import { Envelope } from '@gravity-ui/icons';
import {
  Alert,
  Button,
  Description,
  FieldError,
  Form,
  InputGroup,
  Label,
  Spinner,
  TextField,
} from '@heroui/react';
import { registerAction, type RegisterState } from './actions';
import { PasswordField } from './password-field';
import { PasswordStrength } from './password-strength';
import styles from './auth-form.module.css';

const INITIAL_STATE: RegisterState = {};

export function RegisterForm() {
  const [state, formAction, isPending] = useActionState(registerAction, INITIAL_STATE);
  // Controlled only to drive the strength meter; React Aria clears it on the post-action reset.
  const [password, setPassword] = useState('');
  const errors = state.fieldErrors ?? {};

  // Same validation setup as LoginForm — see the comment there and apps/web/CLAUDE.md.
  return (
    <Form className={styles.form} action={formAction} validationBehavior="aria">
      <TextField
        name="email"
        type="email"
        autoComplete="email"
        defaultValue={state.email}
        isRequired
        isInvalid={Boolean(errors.email)}
        fullWidth
      >
        <Label>Email</Label>
        <InputGroup fullWidth>
          <InputGroup.Prefix>
            <Envelope className={styles.icon} aria-hidden />
          </InputGroup.Prefix>
          <InputGroup.Input placeholder="you@example.com" />
        </InputGroup>
        {errors.email ? (
          <FieldError>{errors.email}</FieldError>
        ) : (
          <Description>На него придут приглашения на встречи</Description>
        )}
      </TextField>

      <PasswordField
        name="password"
        label="Пароль"
        autoComplete="new-password"
        error={errors.password}
        value={password}
        onChange={setPassword}
      >
        {password ? (
          <PasswordStrength password={password} />
        ) : (
          <Description>Не короче 6 символов</Description>
        )}
      </PasswordField>

      <PasswordField
        name="confirmPassword"
        label="Повторите пароль"
        autoComplete="new-password"
        error={errors.confirmPassword}
      />

      {state.error ? (
        <Alert status="danger" role="alert">
          <Alert.Indicator />
          <Alert.Content>
            <Alert.Title>{state.error}</Alert.Title>
          </Alert.Content>
        </Alert>
      ) : null}

      <Button type="submit" isPending={isPending} fullWidth size="lg">
        {isPending ? <Spinner color="current" size="sm" /> : null}
        {isPending ? 'Создаём аккаунт…' : 'Создать аккаунт'}
      </Button>
    </Form>
  );
}
