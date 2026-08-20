import { logoutAction } from './actions';
import styles from './logout-button.module.css';

export function LogoutButton() {
  return (
    <form action={logoutAction}>
      <button className={styles.button} type="submit">
        Выйти
      </button>
    </form>
  );
}
