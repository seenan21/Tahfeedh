import { createFileRoute } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { Stack, Text, Title, Loader, Alert, ScrollArea, Card } from '@mantine/core';
import { apiFetch } from '../api/client';
import type { QfChapter } from '@tahfeedh/shared';

interface ChaptersResponse {
  chapters: QfChapter[];
}

export const Route = createFileRoute('/')({
  component: HomePage,
});

function HomePage() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['qf', 'chapters'],
    queryFn: () => apiFetch<ChaptersResponse>('/api/qf/chapters'),
  });

  return (
    <Stack>
      <Title order={2}>M1 smoke test</Title>
      <Text c="dimmed">Fetching 114 surahs through Express → QF Content API.</Text>

      {isLoading && <Loader />}
      {error && <Alert color="red">{(error as Error).message}</Alert>}
      {data && (
        <ScrollArea h={500}>
          <Stack gap="xs">
            {data.chapters.map((c) => (
              <Card key={c.id} withBorder padding="xs">
                <Text>
                  {c.id}. {c.name_simple}{' '}
                  <Text component="span" c="dimmed">
                    — {c.translated_name.name} · {c.verses_count} ayahs
                  </Text>
                </Text>
              </Card>
            ))}
          </Stack>
        </ScrollArea>
      )}
    </Stack>
  );
}
