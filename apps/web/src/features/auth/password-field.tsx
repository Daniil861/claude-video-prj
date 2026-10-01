'use client';

import { useState, type ReactNode } from 'react';
import { Eye, EyeSlash, Lock } from '@gravity-ui/icons';
import { Button, FieldError, InputGroup, Label, TextField } from '@heroui/react';
import styles from './auth-form.module.css';

interface PasswordFieldProps {
  name: string;
  label: string;
  autoComplete: 'current-password' | 'new-password';
  error?: string;
  value?: string;
  onChange?: (value: string) => void;
  /** Rendered under the input while there is no error, e.g. a strength meter. */
  children?: ReactNode;
}

export function PasswordField({
  name,
  label,
  autoComplete,
  error,
  value,
  onChange,
  children,
}: PasswordFieldProps) {
  const [isVisible, setIsVisible] = useState(false);

  return (
    <TextField
      name={name}
      type={isVisible ? 'text' : 'password'}
      autoComplete={autoComplete}
      value={value}
      onChange={onChange}
      isRequired
      isInvalid={Boolean(error)}
      fullWidth
    >
      <Label>{label}</Label>
      <InputGroup fullWidth>
        <InputGroup.Prefix>
          <Lock className={styles.icon} aria-hidden />
        </InputGroup.Prefix>
        <InputGroup.Input />
        <InputGroup.Suffix className={styles.toggleSuffix}>
          <Button
            isIconOnly
            size="sm"
            variant="ghost"
            aria-label={isVisible ? 'Скрыть пароль' : 'Показать пароль'}
            onPress={() => setIsVisible((visible) => !visible)}
          >
            {isVisible ? <EyeSlash aria-hidden /> : <Eye aria-hidden />}
          </Button>
        </InputGroup.Suffix>
      </InputGroup>
      {error ? <FieldError>{error}</FieldError> : children}
    </TextField>
  );
}
