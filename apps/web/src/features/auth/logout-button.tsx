import { ArrowRightFromSquare } from '@gravity-ui/icons';
import { Button } from '@heroui/react';
import { logoutAction } from './actions';
import styles from './auth-form.module.css';

export function LogoutButton() {
  return (
    <form action={logoutAction}>
      <Button type="submit" variant="outline">
        <ArrowRightFromSquare aria-hidden className={styles.icon} />
        Выйти
      </Button>
    </form>
  );
}
