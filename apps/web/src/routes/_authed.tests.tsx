import { createFileRoute } from '@tanstack/react-router';
import { GraduationCap } from 'lucide-react';
import { EmptyState } from '../components/EmptyState';

export const Route = createFileRoute('/_authed/tests')({
  component: TestsPage,
});

function TestsPage() {
  return (
    <EmptyState
      arabic="الاختبارات"
      english="Tests"
      icon={GraduationCap}
      tag="Phase D"
      helper="Begin a guest-witnessed test or browse your past tests. The live test view with error logging ships next."
    />
  );
}
