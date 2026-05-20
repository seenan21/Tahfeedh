import { notifications } from '@mantine/notifications';

// Mantine v7 tints the title text with the notification `color` prop, which
// makes our sage/honey accents render as low-contrast green/yellow on white.
// Pin title + description to a readable near-black; the `color` prop still
// drives the icon + left-border accent.
const readableTextStyles = {
  title: { color: 'var(--mantine-color-text)', fontWeight: 600 },
  description: { color: 'var(--mantine-color-text)' },
} as const;

export function toastError(err: unknown, title = 'Something went wrong') {
  const message = err instanceof Error ? err.message : typeof err === 'string' ? err : 'Unexpected error';
  notifications.show({
    color: 'red',
    title,
    message,
    autoClose: 6000,
    withBorder: true,
    styles: readableTextStyles,
  });
}

export function toastSuccess(message: string, title?: string) {
  notifications.show({
    color: 'sage',
    title,
    message,
    autoClose: 3000,
    withBorder: true,
    styles: readableTextStyles,
  });
}

export function toastInfo(message: string, title?: string) {
  notifications.show({
    color: 'honey',
    title,
    message,
    autoClose: 4000,
    withBorder: true,
    styles: readableTextStyles,
  });
}
