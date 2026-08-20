import type { Meeting } from '@/lib/types';
import styles from './meeting-list.module.css';

const dateFormat = new Intl.DateTimeFormat('ru-RU', {
  day: 'numeric',
  month: 'long',
  hour: '2-digit',
  minute: '2-digit',
});

export function MeetingList({ meetings }: { meetings: Meeting[] }) {
  if (meetings.length === 0) {
    return <p className={styles.empty}>Встреч пока нет. Создайте первую.</p>;
  }

  return (
    <ul className={styles.list}>
      {meetings.map((meeting) => (
        <li className={styles.item} key={meeting.id}>
          <span className={styles.title}>{meeting.title}</span>
          <span className={styles.meta}>
            {dateFormat.format(new Date(meeting.startsAt))} · {meeting.durationMinutes} мин
          </span>
        </li>
      ))}
    </ul>
  );
}
