import Link from 'next/link';
import type { Metadata } from 'next';
import { Card } from '@heroui/react';
import { RegisterForm } from '@/features/auth/register-form';
import styles from '../auth-card.module.css';

export const metadata: Metadata = {
  title: 'Регистрация — Video Meetings',
};

export default function RegisterPage() {
  return (
    <Card className={styles.card}>
      <Card.Header className={styles.header}>
        <h1 className={styles.heading}>Создайте аккаунт</h1>
        <Card.Description className={styles.description}>
          Планируйте встречи и приглашайте участников по email
        </Card.Description>
      </Card.Header>

      <Card.Content>
        <RegisterForm />
      </Card.Content>

      <Card.Footer className={styles.footer}>
        <span>
          Уже есть аккаунт? <Link href="/auth/login">Войти</Link>
        </span>
      </Card.Footer>
    </Card>
  );
}
