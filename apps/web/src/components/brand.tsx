import { Video } from '@gravity-ui/icons';
import styles from './brand.module.css';

/** Product logo and name, shared by the auth screens and the signed-in pages. */
export function Brand() {
  return (
    <div className={styles.brand}>
      <span className={styles.logo}>
        <Video aria-hidden />
      </span>
      Video Meetings
    </div>
  );
}
