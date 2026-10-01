import Link from 'next/link';
import type { Metadata } from 'next';
import { Card } from '@heroui/react';
import { LoginForm } from '@/features/auth/login-form';
import styles from '../auth-card.module.css';

export const metadata: Metadata = {
  title: 'Вход — Video Meetings',
};

export default function LoginPage() {
  return (
    <Card className={styles.card}>
      <Card.Header className={styles.header}>
        <h1 className={styles.heading}>Вход</h1>
        <Card.Description className={styles.description}>
          Войдите, чтобы управлять встречами
        </Card.Description>
      </Card.Header>

      <Card.Content>
        <LoginForm />
      </Card.Content>

      <Card.Footer className={styles.footer}>
        <span>
          Нет аккаунта? <Link href="/auth/register">Зарегистрироваться</Link>
        </span>
      </Card.Footer>
    </Card>
  );
}
