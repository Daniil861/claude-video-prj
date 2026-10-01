import { Chip } from '@heroui/react';
import type { Meeting } from '@/lib/types';
import styles from './meeting-list.module.css';

const TIME_OPTIONS: Intl.DateTimeFormatOptions = {
  day: 'numeric',
  month: 'long',
  hour: '2-digit',
  minute: '2-digit',
};
const dateFormat = new Intl.DateTimeFormat('ru-RU', TIME_OPTIONS);
const dateWithYearFormat = new Intl.DateTimeFormat('ru-RU', { ...TIME_OPTIONS, year: 'numeric' });

/** The year is noise for this year's meetings, but required for any other. */
function formatStart(startsAt: Date, now: Date): string {
  const format = startsAt.getFullYear() === now.getFullYear() ? dateFormat : dateWithYearFormat;
  return format.format(startsAt);
}

export function MeetingList({ meetings }: { meetings: Meeting[] }) {
  if (meetings.length === 0) {
    return <p className={styles.empty}>Встреч пока нет. Создайте первую.</p>;
  }

  const now = new Date();

  return (
    <ul className={styles.list}>
      {meetings.map((meeting) => {
        const startsAt = new Date(meeting.startsAt);
        const endsAt = startsAt.getTime() + meeting.durationMinutes * 60_000;

        return (
          <li className={styles.item} key={meeting.id}>
            <div className={styles.body}>
              <span className={styles.title}>{meeting.title}</span>
              <span className={styles.meta}>
                <time dateTime={meeting.startsAt}>{formatStart(startsAt, now)}</time> ·{' '}
                {meeting.durationMinutes} мин
              </span>
            </div>
            {endsAt < now.getTime() ? (
              <Chip size="sm" variant="soft">
                Прошла
              </Chip>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}
