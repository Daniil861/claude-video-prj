import { Button } from '@heroui/react';
import { logoutAction } from './actions';

export function LogoutButton() {
  return (
    <form action={logoutAction}>
      <Button type="submit" variant="outline" size="sm">
        Выйти
      </Button>
    </form>
  );
}
