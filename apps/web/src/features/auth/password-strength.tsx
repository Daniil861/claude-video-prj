'use client';

import { Label, Meter } from '@heroui/react';
import styles from './auth-form.module.css';

type MeterColor = 'danger' | 'warning' | 'success';

const LEVELS: { label: string; color: MeterColor }[] = [
  { label: 'Слабый', color: 'danger' },
  { label: 'Слабый', color: 'danger' },
  { label: 'Средний', color: 'warning' },
  { label: 'Хороший', color: 'success' },
  { label: 'Надёжный', color: 'success' },
];

/** Rough 0–4 score: a hint for the user, not a rule — the API only checks length. */
function scorePassword(password: string): number {
  let score = 0;
  if (password.length >= 6) score += 1;
  if (password.length >= 10) score += 1;
  if (/[a-zа-яё]/.test(password) && /[A-ZА-ЯЁ]/.test(password)) score += 1;
  if (/\d/.test(password) && /[^\p{L}\d]/u.test(password)) score += 1;
  return score;
}

export function PasswordStrength({ password }: { password: string }) {
  if (!password) {
    return null;
  }

  const score = scorePassword(password);
  const level = LEVELS[score] ?? LEVELS[0]!;

  return (
    <Meter
      className={styles.meter}
      value={score}
      minValue={0}
      maxValue={4}
      valueLabel={level.label}
      color={level.color}
      size="sm"
    >
      <Label>Надёжность пароля</Label>
      <Meter.Output />
      <Meter.Track>
        <Meter.Fill />
      </Meter.Track>
    </Meter>
  );
}
