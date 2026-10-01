import Link from 'next/link';
import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { Plus } from '@gravity-ui/icons';
import { buttonVariants, Card } from '@heroui/react';
import { Brand } from '@/components/brand';
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

  return (
    <div className={styles.shell}>
      <header className={styles.topbar}>
        <Brand />
        <LogoutButton />
      </header>

      {result.status === 'unavailable' ? (
        <main className={styles.main}>
          <Card className={styles.card}>
            <Card.Header>
              <h1 className={styles.sectionHeading}>Не удалось загрузить данные</h1>
            </Card.Header>
            <Card.Content className={styles.unavailable}>
              <p className={styles.error} role="alert">
                {result.message}
              </p>
              <Link className={buttonVariants({ variant: 'secondary' })} href="/">
                Попробовать снова
              </Link>
            </Card.Content>
          </Card>
        </main>
      ) : (
        <main className={styles.main}>
          <section className={styles.intro}>
            <div>
              <h1 className={styles.heading}>Привет, {result.user.email}</h1>
              <p className={styles.subheading}>
                Всего встреч: <strong>{result.meetings.total}</strong>
              </p>
            </div>
            {/* A link, not a Button: it navigates. buttonVariants gives it the HeroUI look. */}
            <Link
              className={buttonVariants({ size: 'lg', className: styles.primaryAction })}
              href="/meetings/new"
            >
              <Plus aria-hidden />
              Создать встречу
            </Link>
          </section>

          <Card className={styles.card}>
            <Card.Header>
              <h2 className={styles.sectionHeading}>Последние встречи</h2>
            </Card.Header>
            <Card.Content>
              <MeetingList meetings={result.meetings.items} />
            </Card.Content>
          </Card>
        </main>
      )}
    </div>
  );
}
