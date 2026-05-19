import { useMemo, useState } from 'react';
import {
  Badge,
  Button,
  Divider,
  Group,
  Modal,
  ScrollArea,
  Skeleton,
  Stack,
  Text,
} from '@mantine/core';
import { useQuery } from '@tanstack/react-query';
import { Eye, EyeOff } from 'lucide-react';
import type { ErrorLocationStatsRow, ErrorSeverity, ErrorType } from '@tahfeedh/shared';
import { supabase } from '../lib/supabase';
import { chapter } from '../data/quran-data';
import { ERROR_TYPE_COLOR, type OverlayMarker } from './getOverlayMarkers';

interface ErrorDetailModalProps {
  studentId: string;
  /** When non-null, the modal is open at this marker's location. */
  marker: OverlayMarker | null;
  /** Stats rows (already loaded by the parent for overlay rendering). The
   *  modal looks up `cleared` status per signature here, avoiding a second
   *  query. ADR 0023. */
  stats: ErrorLocationStatsRow[];
  onClose: () => void;
}

interface ErrorLogRow {
  id: string;
  test_id: string;
  surah_number: number;
  ayah_number: number;
  word_position: number | null;
  error_type: ErrorType;
  severity: ErrorSeverity;
  teacher_note: string | null;
  related_surah: number | null;
  related_ayah: number | null;
  signature: string;
  created_at: string;
}

async function fetchErrorLogAtLocation(
  studentId: string,
  surah: number,
  ayah: number,
  wordPosition: number | null,
): Promise<ErrorLogRow[]> {
  let q = supabase
    .from('error_log')
    .select(
      'id, test_id, surah_number, ayah_number, word_position, error_type, severity, ' +
        'teacher_note, related_surah, related_ayah, signature, created_at',
    )
    .eq('student_id', studentId)
    .eq('surah_number', surah)
    .eq('ayah_number', ayah)
    .order('created_at', { ascending: false });
  if (wordPosition == null) q = q.is('word_position', null);
  else q = q.eq('word_position', wordPosition);
  const { data, error } = await q;
  if (error) throw error;
  return (data as unknown as ErrorLogRow[] | null) ?? [];
}

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

const SEVERITY_COLOR: Record<ErrorSeverity, string> = {
  minor: 'sage.5',
  moderate: 'honey.5',
  major: 'brick.7',
};

export function ErrorDetailModal({
  studentId,
  marker,
  stats,
  onClose,
}: ErrorDetailModalProps) {
  const open = marker != null;
  const [showGhosts, setShowGhosts] = useState(false);

  const { data: rows, isLoading } = useQuery({
    queryKey: [
      'error_log_at_location',
      studentId,
      marker?.surah,
      marker?.ayah,
      marker?.wordPosition ?? 'verse',
    ],
    queryFn: () =>
      fetchErrorLogAtLocation(studentId, marker!.surah, marker!.ayah, marker?.wordPosition ?? null),
    enabled: open,
    staleTime: 15_000,
  });

  // Build a Set of "cleared" signatures from stats.
  const clearedSignatures = useMemo(() => {
    const s = new Set<string>();
    for (const row of stats) if (row.cleared) s.add(row.signature);
    return s;
  }, [stats]);

  const grouped = useMemo(() => {
    if (!rows) return null;
    const active: ErrorLogRow[] = [];
    const ghosts: ErrorLogRow[] = [];
    for (const r of rows) {
      if (clearedSignatures.has(r.signature)) ghosts.push(r);
      else active.push(r);
    }
    // Group active by error_type
    const byType = new Map<ErrorType, ErrorLogRow[]>();
    for (const r of active) {
      const list = byType.get(r.error_type);
      if (list) list.push(r);
      else byType.set(r.error_type, [r]);
    }
    return { byType, ghosts };
  }, [rows, clearedSignatures]);

  const surahName = marker ? chapter(marker.surah)?.name_simple ?? `Surah ${marker.surah}` : '';
  const locationLabel = marker
    ? marker.scope === 'verse'
      ? `${surahName} · ayah ${marker.ayah}`
      : `${surahName} · ayah ${marker.ayah} · word ${marker.wordPosition}`
    : '';

  return (
    <Modal
      opened={open}
      onClose={() => {
        setShowGhosts(false);
        onClose();
      }}
      title={
        <Stack gap={2}>
          <Text size="xs" tt="uppercase" c="dimmed" fw={700} lts={0.8}>
            Error history
          </Text>
          <Text fw={700} fz="md">
            {locationLabel}
          </Text>
        </Stack>
      }
      size="lg"
      radius="lg"
      centered
    >
      {isLoading || !grouped ? (
        <Stack gap="sm">
          <Skeleton height={64} radius="md" />
          <Skeleton height={64} radius="md" />
          <Skeleton height={64} radius="md" />
        </Stack>
      ) : grouped.byType.size === 0 && grouped.ghosts.length === 0 ? (
        <Text c="dimmed" ta="center" py="xl">
          No occurrences logged at this location yet.
        </Text>
      ) : (
        <ScrollArea h={420} type="auto" offsetScrollbars>
          <Stack gap="md">
            {[...grouped.byType.entries()].map(([type, list]) => (
              <Stack key={type} gap="xs">
                <Group gap="xs" align="center">
                  <span
                    style={{
                      width: 10,
                      height: 10,
                      borderRadius: 2,
                      background: ERROR_TYPE_COLOR[type],
                    }}
                  />
                  <Text fw={600} size="sm">
                    {type.replace('_', ' ')}
                  </Text>
                  <Badge size="xs" variant="light">
                    {list.length} {list.length === 1 ? 'time' : 'times'}
                  </Badge>
                </Group>
                <Stack gap={4}>
                  {list.map((row) => (
                    <OccurrenceRow key={row.id} row={row} ghost={false} />
                  ))}
                </Stack>
              </Stack>
            ))}

            {grouped.ghosts.length > 0 && (
              <>
                <Divider />
                {!showGhosts ? (
                  <Group justify="space-between" align="center">
                    <Text size="sm" c="dimmed">
                      + {grouped.ghosts.length} ghost error{grouped.ghosts.length === 1 ? '' : 's'} (cleared)
                    </Text>
                    <Button
                      size="xs"
                      variant="subtle"
                      leftSection={<Eye size={14} />}
                      onClick={() => setShowGhosts(true)}
                    >
                      Show
                    </Button>
                  </Group>
                ) : (
                  <Stack gap="xs">
                    <Group justify="space-between" align="center">
                      <Text size="xs" tt="uppercase" c="dimmed" fw={700} lts={0.8}>
                        Ghost errors · cleared
                      </Text>
                      <Button
                        size="xs"
                        variant="subtle"
                        leftSection={<EyeOff size={14} />}
                        onClick={() => setShowGhosts(false)}
                      >
                        Hide
                      </Button>
                    </Group>
                    <Stack gap={4}>
                      {grouped.ghosts.map((row) => (
                        <OccurrenceRow key={row.id} row={row} ghost />
                      ))}
                    </Stack>
                  </Stack>
                )}
              </>
            )}
          </Stack>
        </ScrollArea>
      )}
    </Modal>
  );
}

function OccurrenceRow({ row, ghost }: { row: ErrorLogRow; ghost: boolean }) {
  return (
    <Group
      justify="space-between"
      align="center"
      wrap="nowrap"
      p="xs"
      style={{
        borderRadius: 8,
        background: ghost ? 'rgba(255,255,255,0.4)' : 'rgba(255,255,255,0.7)',
        border: '1px solid rgba(21,53,30,0.06)',
        opacity: ghost ? 0.55 : 1,
      }}
    >
      <Stack gap={2} style={{ minWidth: 0, flex: 1 }}>
        <Group gap={6} align="center" wrap="nowrap">
          <Badge size="xs" color={SEVERITY_COLOR[row.severity]} variant="light">
            {row.severity}
          </Badge>
          {ghost && (
            <Badge size="xs" color="gray" variant="light">
              ghost
            </Badge>
          )}
          {row.related_surah != null && row.related_ayah != null && (
            <Text size="xs" c="dimmed">
              → {row.related_surah}:{row.related_ayah}
            </Text>
          )}
        </Group>
        {row.teacher_note && (
          <Text size="xs" c="dimmed" lineClamp={2}>
            {row.teacher_note}
          </Text>
        )}
      </Stack>
      <Text size="xs" c="dimmed" style={{ whiteSpace: 'nowrap' }}>
        {formatDateTime(row.created_at)}
      </Text>
    </Group>
  );
}
