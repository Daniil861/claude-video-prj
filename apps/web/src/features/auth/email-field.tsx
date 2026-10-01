'use client';

import type { ReactNode } from 'react';
import { Envelope } from '@gravity-ui/icons';
import { FieldError, InputGroup, Label, TextField } from '@heroui/react';
import styles from './auth-form.module.css';

interface EmailFieldProps {
  value: string;
  error?: string;
  onChange: (value: string) => void;
  onBlur: () => void;
  /** Rendered under the input while there is no error, e.g. a hint. */
  children?: ReactNode;
}

export function EmailField({ value, error, onChange, onBlur, children }: EmailFieldProps) {
  return (
    <TextField
      name="email"
      type="email"
      autoComplete="email"
      value={value}
      onChange={onChange}
      onBlur={onBlur}
      isRequired
      isInvalid={Boolean(error)}
      fullWidth
    >
      <Label>Email</Label>
      <InputGroup variant="secondary" fullWidth>
        <InputGroup.Prefix>
          <Envelope className={styles.icon} aria-hidden />
        </InputGroup.Prefix>
        <InputGroup.Input placeholder="you@example.com" />
      </InputGroup>
      {error ? <FieldError className={styles.error}>{error}</FieldError> : children}
    </TextField>
  );
}
