import { createFileRoute } from '@tanstack/react-router';
import { Card, Stack, Text, Title } from '@mantine/core';

export const Route = createFileRoute('/_authed/tests')({
  component: TestsPage,
});

function TestsPage() {
  return (
    <Card maw={720} mx="auto">
      <Stack>
        <Title order={1}>Tests</Title>
        <Text c="dimmed">Coming soon</Text>
      </Stack>
    </Card>
  );
}
