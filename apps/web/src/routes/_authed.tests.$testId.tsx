import { createFileRoute } from '@tanstack/react-router';
import { LiveTestRoute } from '../features/live-test/LiveTestRoute';

export const Route = createFileRoute('/_authed/tests/$testId')({
  component: LiveTestRoute,
});
