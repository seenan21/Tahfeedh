import { createFileRoute, redirect } from '@tanstack/react-router';
import { Card, Stack, Text, Title } from '@mantine/core';
import { homeRouteForRole } from '../lib/auth';

export const Route = createFileRoute('/_authed/goals')({
  beforeLoad: ({ context }) => {
    const { user } = context;
    if (user.role !== 'student') throw redirect({ to: homeRouteForRole(user.role) });
  },
  component: GoalsPage,
});

function GoalsPage() {
  return (
    <Card maw={720} mx="auto">
      <Stack>
        <Title order={1}>Goals</Title>
        <Text c="dimmed">Coming soon</Text>
      </Stack>
    </Card>
  );
}
