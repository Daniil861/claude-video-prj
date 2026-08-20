import Link from 'next/link';
import type { Metadata } from 'next';
import styles from './page.module.css';

export const metadata: Metadata = {
  title: 'Регистрация — Video Meetings',
};

export default function RegisterPage() {
  return (
    <main className={styles.main}>
      <section className={styles.card}>
        <h1 className={styles.heading}>Регистрация</h1>
        <p className={styles.text}>Эта страница ещё в разработке.</p>
        <Link className={styles.link} href="/auth/login">
          ← Вернуться ко входу
        </Link>
      </section>
    </main>
  );
}
