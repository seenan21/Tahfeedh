import { notifications } from '@mantine/notifications';

// Mantine v7 tints the notification background AND the title text with the
// notification `color` prop, which makes our sage/honey accents render as
// low-contrast green-on-green or yellow-on-cream. We pin the root background
// to white and the title/description text to a hard dark color so the `color`
// prop drives only the icon + left-border accent.
const readableStyles = {
  root: {
    backgroundColor: '#ffffff',
    borderColor: 'rgba(21, 53, 30, 0.12)',
  },
  title: {
    color: '#15351E', // mihrab.9 — readable on white regardless of color prop
    fontWeight: 700,
  },
  description: {
    color: '#1a1a1a',
  },
} as const;

export function toastError(err: unknown, title = 'Something went wrong') {
  const message = err instanceof Error ? err.message : typeof err === 'string' ? err : 'Unexpected error';
  notifications.show({
    color: 'red',
    title,
    message,
    autoClose: 6000,
    withBorder: true,
    styles: readableStyles,
  });
}

export function toastSuccess(message: string, title?: string) {
  notifications.show({
    color: 'sage',
    title,
    message,
    autoClose: 3000,
    withBorder: true,
    styles: readableStyles,
  });
}

export function toastInfo(message: string, title?: string) {
  notifications.show({
    color: 'honey',
    title,
    message,
    autoClose: 4000,
    withBorder: true,
    styles: readableStyles,
  });
}
