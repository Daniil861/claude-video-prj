import Link from 'next/link';
import type { Metadata } from 'next';
import styles from './page.module.css';

export const metadata: Metadata = {
  title: 'Новая встреча — Video Meetings',
};

export default function NewMeetingPage() {
  return (
    <main className={styles.main}>
      <section className={styles.card}>
        <h1 className={styles.heading}>Новая встреча</h1>
        <p className={styles.text}>Эта страница ещё в разработке.</p>
        <Link className={styles.link} href="/">
          ← Вернуться на главную
        </Link>
      </section>
    </main>
  );
}
