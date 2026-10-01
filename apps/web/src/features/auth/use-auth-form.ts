'use client';

import {
  startTransition,
  useActionState,
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from 'react';
import type { FieldErrors } from './schemas';

interface AuthFormState<F extends string> {
  error?: string;
  fieldErrors?: FieldErrors<F>;
}

interface FieldBinding {
  value: string;
  error?: string;
  onChange: (value: string) => void;
  onBlur: () => void;
}

/**
 * Form state for the auth forms: controlled values, client-side validation with the same rules
 * as the server action, and server errors that disappear once the field is edited.
 *
 * Submission goes through onSubmit + startTransition: React resets a form after running its
 * `action`, which would wipe both passwords on every error. Pass `formAction` to `action` as
 * well — React skips it once onSubmit prevents default, but before hydration the form still
 * posts to the server action instead of a GET that would put the password in the URL.
 */
export function useAuthForm<F extends string>(options: {
  action: (state: AuthFormState<F>, formData: FormData) => Promise<AuthFormState<F>>;
  initialState: AuthFormState<F>;
  initialValues: Record<F, string>;
  validate: (values: Record<F, string>) => FieldErrors<F>;
}) {
  const { action, initialState, initialValues, validate } = options;
  const [state, formAction, isPending] = useActionState(action, initialState);
  const [values, setValues] = useState(initialValues);
  // Fields whose client error is shown: blurred with a value, or everything after a submit.
  const [touched, setTouched] = useState<ReadonlySet<F>>(() => new Set());
  // Values at the last submit: a server error is shown only while its field is unchanged.
  const [submitted, setSubmitted] = useState<Record<F, string> | null>(null);
  const [focusRequest, setFocusRequest] = useState(0);
  const formRef = useRef<HTMLFormElement>(null);

  const clientErrors = validate(values);
  const fields = Object.keys(initialValues) as F[];

  function errorFor(field: F): string | undefined {
    if (touched.has(field) && clientErrors[field]) {
      return clientErrors[field];
    }
    const serverError = state.fieldErrors?.[field];
    return serverError && submitted?.[field] === values[field] ? serverError : undefined;
  }

  // Move focus to the first invalid field after a failed submit, so keyboard and screen reader
  // users land on the error (its message is announced through aria-describedby).
  useEffect(() => {
    formRef.current?.querySelector<HTMLInputElement>('input[aria-invalid="true"]')?.focus();
  }, [state, focusRequest]);

  function bind(field: F): FieldBinding {
    return {
      value: values[field],
      error: errorFor(field),
      onChange: (value) => setValues((current) => ({ ...current, [field]: value })),
      onBlur: () => {
        if (values[field] && !touched.has(field)) {
          setTouched((current) => new Set(current).add(field));
        }
      },
    };
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setTouched(new Set(fields));

    if (Object.keys(clientErrors).length > 0) {
      setFocusRequest((request) => request + 1);
      return;
    }

    const formData = new FormData(event.currentTarget);
    setSubmitted(values);
    startTransition(() => formAction(formData));
  }

  return { state, isPending, formRef, formAction, bind, onSubmit };
}
