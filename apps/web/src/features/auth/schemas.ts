import { z } from 'zod';

// Shared by the server actions and the forms: one set of rules and messages on both sides.
// Mirrors LoginDto / RegisterDto in the API; the action stays the authority, the form only
// shows the same errors before a round trip.

export type LoginField = 'email' | 'password';
export type RegisterField = LoginField | 'confirmPassword';
export type FieldErrors<F extends string> = Partial<Record<F, string>>;

export const credentialsSchema = z.object({
  email: z.string().trim().min(1, 'Введите email').email('Некорректный email'),
  password: z.string().min(6, 'Пароль должен быть не короче 6 символов'),
});

const CONFIRM_REQUIRED = 'Введите пароль ещё раз';
const CONFIRM_MISMATCH = 'Пароли не совпадают';

// confirmPassword is checked here only and never sent to the API.
export const registerSchema = credentialsSchema
  .extend({ confirmPassword: z.string().min(1, CONFIRM_REQUIRED) })
  .refine((data) => data.password === data.confirmPassword, {
    message: CONFIRM_MISMATCH,
    path: ['confirmPassword'],
  });

function firstErrors<F extends string>(error: z.ZodError, fields: readonly F[]): FieldErrors<F> {
  const { fieldErrors } = z.flattenError(error);
  const result: FieldErrors<F> = {};
  for (const field of fields) {
    const message = (fieldErrors as Partial<Record<string, string[]>>)[field]?.[0];
    if (message) result[field] = message;
  }
  return result;
}

export function validateLogin(values: Record<LoginField, string>): FieldErrors<LoginField> {
  const parsed = credentialsSchema.safeParse(values);
  return parsed.success ? {} : firstErrors(parsed.error, ['email', 'password']);
}

export function validateRegister(
  values: Record<RegisterField, string>,
): FieldErrors<RegisterField> {
  const parsed = registerSchema.safeParse(values);
  if (parsed.success) return {};

  const errors = firstErrors(parsed.error, ['email', 'password', 'confirmPassword']);
  // The refine is skipped while other fields fail, so report a mismatch explicitly:
  // otherwise the confirm field looks valid until email and password are fixed.
  if (!errors.confirmPassword && values.confirmPassword !== values.password) {
    errors.confirmPassword = CONFIRM_MISMATCH;
  }
  return errors;
}
