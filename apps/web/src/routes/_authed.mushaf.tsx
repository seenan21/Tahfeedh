import { useMemo, useState } from 'react';
import { createFileRoute, redirect } from '@tanstack/react-router';
import {
  Drawer,
  Group,
  Skeleton,
  Stack,
  Text,
} from '@mantine/core';
import { useQuery } from '@tanstack/react-query';
import type { MemorizationStatus } from '@tahfeedh/shared';
import { homeRouteForRole } from '../lib/auth';
import { supabase } from '../lib/supabase';
import { MushafGrid } from '../mushaf/MushafGrid';
import { MarkPageModal } from '../mushaf/MarkPageModal';
import { MushafPage } from '../mushaf/MushafPage';

export const Route = createFileRoute('/_authed/mushaf')({
  beforeLoad: ({ context }) => {
    const { user } = context;
    if (user.role !== 'student') throw redirect({ to: homeRouteForRole(user.role) });
  },
  component: MushafRoute,
});

interface MemorizedPageRow {
  page_number: number;
  status: MemorizationStatus;
}

async function fetchPages(studentId: string): Promise<MemorizedPageRow[]> {
  const { data, error } = await supabase
    .from('memorization_page')
    .select('page_number, status')
    .eq('student_id', studentId);
  if (error) throw error;
  return (data as MemorizedPageRow[] | null) ?? [];
}

function MushafRoute() {
  const { user } = Route.useRouteContext();
  const [pickedPage, setPickedPage] = useState<number | null>(null);
  const [readerPage, setReaderPage] = useState<number | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['memorization_pages', user.id],
    queryFn: () => fetchPages(user.id),
    staleTime: 30_000,
  });

  const pageStatus = useMemo(() => {
    const m = new Map<number, MemorizationStatus>();
    for (const row of data ?? []) m.set(row.page_number, row.status);
    return m;
  }, [data]);

  const totals = useMemo(() => {
    const totals = { mastered: 0, memorized: 0, in_progress: 0 };
    for (const s of pageStatus.values()) totals[s] += 1;
    return totals;
  }, [pageStatus]);

  return (
    <Stack maw={1080} mx="auto" gap="lg" py="md">
      {/* Hero strip */}
      <Stack gap={6}>
        <Text size="xs" tt="uppercase" c="parchment.0" fw={700} lts={0.8} style={{ opacity: 0.85 }}>
          My Mushaf
        </Text>
        <Group justify="space-between" align="flex-end" wrap="wrap" gap="lg">
          <Stack gap={2}>
            <Text
              component="h1"
              style={{
                fontFamily: 'Cairo, sans-serif',
                fontWeight: 700,
                fontSize: 34,
                lineHeight: 1.1,
                direction: 'rtl',
                color: 'var(--mantine-color-parchment-0)',
                margin: 0,
              }}
            >
              مصحفي
            </Text>
            <Text
              component="h2"
              style={{
                fontFamily: '"Playfair Display", serif',
                fontWeight: 700,
                fontSize: 26,
                lineHeight: 1.1,
                color: 'var(--mantine-color-parchment-0)',
                margin: 0,
              }}
            >
              All 604 pages
            </Text>
          </Stack>
          <Group gap="md">
            <LegendDot color="var(--mantine-color-sage-7)" label={`Mastered ${totals.mastered}`} />
            <LegendDot color="var(--mantine-color-sage-4)" label={`Memorized ${totals.memorized}`} />
            <LegendDot color="var(--mantine-color-honey-4)" label={`In progress ${totals.in_progress}`} />
          </Group>
        </Group>
        <Text size="xs" c="parchment.0" style={{ opacity: 0.7 }}>
          Tap any page to mark it memorized, in-progress, or untouched. Pages are grouped by juz.
        </Text>
      </Stack>

      {isLoading ? (
        <Stack gap="md">
          <Skeleton height={120} radius="lg" />
          <Skeleton height={120} radius="lg" />
          <Skeleton height={120} radius="lg" />
        </Stack>
      ) : (
        <MushafGrid pageStatus={pageStatus} onPick={(p) => setPickedPage(p)} />
      )}

      <MarkPageModal
        opened={pickedPage != null}
        pageNumber={pickedPage}
        studentId={user.id}
        onClose={() => setPickedPage(null)}
        onOpenReader={() => {
          if (pickedPage != null) {
            setReaderPage(pickedPage);
            setPickedPage(null);
          }
        }}
      />

      <Drawer
        opened={readerPage != null}
        onClose={() => setReaderPage(null)}
        position="right"
        size="xl"
        withCloseButton
        title={readerPage != null ? `Page ${readerPage}` : ''}
        overlayProps={{ backgroundOpacity: 0.45, blur: 2 }}
      >
        {readerPage != null && <MushafPage pageNumber={readerPage} />}
      </Drawer>
    </Stack>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <Group gap={6} align="center">
      <span
        style={{
          width: 10,
          height: 10,
          borderRadius: 3,
          background: color,
          boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.18)',
        }}
      />
      <Text size="xs" c="parchment.0" style={{ opacity: 0.85 }}>
        {label}
      </Text>
    </Group>
  );
}
