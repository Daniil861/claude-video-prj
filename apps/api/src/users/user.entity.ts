import type { User as UserRow } from '@prisma/client';

export type User = UserRow;

/**
 * User data safe to send to the client. Spelled out as an allow-list rather than
 * Omit<User, 'passwordHash'>, so a new column cannot leak into API responses.
 */
export type PublicUser = Pick<User, 'id' | 'email' | 'name'>;

export function toPublicUser(user: User): PublicUser {
  return { id: user.id, email: user.email, name: user.name };
}
