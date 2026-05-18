import { createFileRoute } from '@tanstack/react-router';
import { Settings as SettingsIcon } from 'lucide-react';
import { EmptyState } from '../components/EmptyState';

export const Route = createFileRoute('/_authed/settings')({
  component: SettingsPage,
});

function SettingsPage() {
  return (
    <EmptyState
      arabic="الإعدادات"
      english="Settings"
      icon={SettingsIcon}
      tag="Phase C onward"
      helper="Daily capacity, completed-Qur'an flag, invite code, Edit Memorization, profile."
    />
  );
}
