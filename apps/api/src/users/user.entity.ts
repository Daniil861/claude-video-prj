export interface User {
  id: string;
  email: string;
  name: string;
  passwordHash: string;
}

/** User data safe to send to the client. */
export type PublicUser = Omit<User, 'passwordHash'>;

export function toPublicUser(user: User): PublicUser {
  const { passwordHash: _passwordHash, ...publicUser } = user;
  return publicUser;
}
