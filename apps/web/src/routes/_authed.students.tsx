import { createFileRoute, redirect } from '@tanstack/react-router';
import { Card, Stack, Text, Title } from '@mantine/core';
import { homeRouteForRole } from '../lib/auth';

export const Route = createFileRoute('/_authed/students')({
  beforeLoad: ({ context }) => {
    const { user } = context;
    if (user.role !== 'teacher') throw redirect({ to: homeRouteForRole(user.role) });
  },
  component: StudentsPage,
});

function StudentsPage() {
  const { user } = Route.useRouteContext();

  return (
    <Card maw={720} mx="auto">
      <Stack>
        <Title order={1}>Students</Title>
        <Text>
          Welcome, {user.displayName ?? user.email}. Your enrolled students will live here once the
          enrollment flow is in (M6).
        </Text>
        <Text size="sm" c="dimmed">
          Role: {user.role}
        </Text>
      </Stack>
    </Card>
  );
}
