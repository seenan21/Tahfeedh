import { createFileRoute } from '@tanstack/react-router';
import { EmptyState } from '../components/EmptyState';

export const Route = createFileRoute('/_authed/settings')({
  component: SettingsPage,
});

function SettingsPage() {
  return (
    <EmptyState
      arabic="الإعدادات"
      english="Settings"
      helper="Daily capacity, completed-Qur'an flag, invite code, Edit Memorization, profile. Phase C onward."
    />
  );
}
