import { createFileRoute } from '@tanstack/react-router';
import { EmptyState } from '../components/EmptyState';

export const Route = createFileRoute('/_authed/tests')({
  component: TestsPage,
});

function TestsPage() {
  return (
    <EmptyState
      arabic="الاختبارات"
      english="Tests"
      helper="Begin a guest-witnessed test or browse your test history. Shipping in Phase D."
    />
  );
}
