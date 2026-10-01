import { Brand } from '@/components/brand';
import styles from './layout.module.css';

export default function AuthLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <main className={styles.main}>
      <div className={styles.column}>
        <Brand />
        {children}
      </div>
    </main>
  );
}
