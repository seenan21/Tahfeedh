import { createFileRoute, useParams } from '@tanstack/react-router';
import { TestRecapView } from '../features/live-test/TestRecapView';

export const Route = createFileRoute('/_authed/tests/$testId/recap')({
  component: RecapPage,
});

function RecapPage() {
  const { testId } = useParams({ from: '/_authed/tests/$testId/recap' });
  return <TestRecapView testId={testId} />;
}
