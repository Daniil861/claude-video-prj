'use client';

import { useActionState } from 'react';
import { Alert, Button, FieldError, Form, Input, Label, Spinner, TextField } from '@heroui/react';
import { loginAction, type LoginState } from './actions';
import styles from './auth-form.module.css';

const INITIAL_STATE: LoginState = {};

export function LoginForm() {
  const [state, formAction, isPending] = useActionState(loginAction, INITIAL_STATE);
  const emailError = state.fieldErrors?.email;
  const passwordError = state.fieldErrors?.password;

  // validationBehavior="aria": the server action is the single source of validation messages,
  // the browser does not block submission with its own popups.
  // Errors go through `isInvalid`, not Form `validationErrors`: React resets the form after
  // the action, and React Aria drops server errors on reset.
  return (
    <Form className={styles.form} action={formAction} validationBehavior="aria">
      <TextField
        name="email"
        type="email"
        autoComplete="email"
        defaultValue={state.email}
        isRequired
        isInvalid={Boolean(emailError)}
        fullWidth
      >
        <Label>Email</Label>
        <Input placeholder="demo@example.com" />
        <FieldError>{emailError}</FieldError>
      </TextField>

      <TextField
        name="password"
        type="password"
        autoComplete="current-password"
        isRequired
        isInvalid={Boolean(passwordError)}
        fullWidth
      >
        <Label>Пароль</Label>
        <Input />
        <FieldError>{passwordError}</FieldError>
      </TextField>

      {state.error ? (
        <Alert status="danger" role="alert">
          <Alert.Indicator />
          <Alert.Content>
            <Alert.Title>{state.error}</Alert.Title>
          </Alert.Content>
        </Alert>
      ) : null}

      <Button type="submit" isPending={isPending} fullWidth>
        {isPending ? <Spinner color="current" size="sm" /> : null}
        {isPending ? 'Входим…' : 'Войти'}
      </Button>
    </Form>
  );
}
