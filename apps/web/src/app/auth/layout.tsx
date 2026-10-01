import { Video } from '@gravity-ui/icons';
import styles from './layout.module.css';

export default function AuthLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <main className={styles.main}>
      <div className={styles.column}>
        <div className={styles.brand}>
          <span className={styles.logo}>
            <Video aria-hidden />
          </span>
          Video Meetings
        </div>
        {children}
      </div>
    </main>
  );
}
