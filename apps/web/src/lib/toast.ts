import { notifications } from '@mantine/notifications';

export function toastError(err: unknown, title = 'Something went wrong') {
  const message = err instanceof Error ? err.message : typeof err === 'string' ? err : 'Unexpected error';
  notifications.show({
    color: 'red',
    title,
    message,
    autoClose: 6000,
    withBorder: true,
  });
}

export function toastSuccess(message: string, title?: string) {
  notifications.show({
    color: 'sage',
    title,
    message,
    autoClose: 3000,
    withBorder: true,
  });
}

export function toastInfo(message: string, title?: string) {
  notifications.show({
    color: 'honey',
    title,
    message,
    autoClose: 4000,
    withBorder: true,
  });
}
