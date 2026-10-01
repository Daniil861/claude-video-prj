import Link from 'next/link';
import type { Metadata } from 'next';
import { Card } from '@heroui/react';
import { LoginForm } from '@/features/auth/login-form';
import styles from './page.module.css';

export const metadata: Metadata = {
  title: 'Вход — Video Meetings',
};

export default function LoginPage() {
  return (
    <main className={styles.main}>
      <Card className={styles.card}>
        <Card.Header>
          <h1 className={styles.heading}>Вход</h1>
          <Card.Description>Войдите, чтобы управлять встречами</Card.Description>
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
    </main>
  );
}
