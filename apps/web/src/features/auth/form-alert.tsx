import { Alert } from '@heroui/react';

/** Form-level error that is not tied to a field: wrong credentials, API failure. */
export function FormAlert({ message }: { message?: string }) {
  if (!message) {
    return null;
  }

  return (
    <Alert status="danger" role="alert">
      <Alert.Indicator />
      <Alert.Content>
        <Alert.Title>{message}</Alert.Title>
      </Alert.Content>
    </Alert>
  );
}
