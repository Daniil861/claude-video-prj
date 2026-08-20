import Link from 'next/link';
import type { Metadata } from 'next';
import { LoginForm } from '@/features/auth/login-form';
import styles from './page.module.css';

export const metadata: Metadata = {
  title: 'Вход — Video Meetings',
};

export default function LoginPage() {
  return (
    <main className={styles.main}>
      <section className={styles.card}>
        <h1 className={styles.heading}>Вход</h1>
        <p className={styles.subheading}>Войдите, чтобы управлять встречами</p>

        <LoginForm />

        <p className={styles.footer}>
          Нет аккаунта? <Link href="/auth/register">Зарегистрироваться</Link>
        </p>
      </section>
    </main>
  );
}
