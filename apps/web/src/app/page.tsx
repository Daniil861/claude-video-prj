import Link from 'next/link';
import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { LogoutButton } from '@/features/auth/logout-button';
import { MeetingList } from '@/features/meetings/meeting-list';
import { loadDashboard } from '@/features/meetings/queries';
import { getSessionToken } from '@/lib/session';
import styles from './page.module.css';

export const metadata: Metadata = {
  title: 'Главная — Video Meetings',
};

export default async function HomePage() {
  const token = await getSessionToken();

  if (!token) {
    redirect('/auth/login');
  }

  const result = await loadDashboard(token);

  if (result.status === 'unauthorized') {
    redirect('/auth/login');
  }

  if (result.status === 'unavailable') {
    return (
      <main className={styles.main}>
        <section className={styles.card}>
          <h1 className={styles.heading}>Не удалось загрузить данные</h1>
          <p className={styles.error} role="alert">
            {result.message}
          </p>
          <Link className={styles.secondaryAction} href="/">
            Попробовать снова
          </Link>
        </section>
      </main>
    );
  }

  const { user, meetings } = result;

  return (
    <main className={styles.main}>
      <header className={styles.header}>
        <div>
          <h1 className={styles.heading}>Привет, {user.email}</h1>
          <p className={styles.subheading}>
            Всего встреч: <strong>{meetings.total}</strong>
          </p>
        </div>
        <LogoutButton />
      </header>

      <section className={styles.card}>
        <h2 className={styles.sectionHeading}>Последние встречи</h2>
        <MeetingList meetings={meetings.items} />
      </section>

      <Link className={styles.primaryAction} href="/meetings/new">
        Создать встречу
      </Link>
    </main>
  );
}
