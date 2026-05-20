import { useMemo, useState } from 'react';
import {
  Badge,
  Button,
  Divider,
  Group,
  Modal,
  Paper,
  ScrollArea,
  Skeleton,
  Stack,
  Text,
} from '@mantine/core';
import { useQuery } from '@tanstack/react-query';
import { Eye, EyeOff, MessageSquare } from 'lucide-react';
import type { ErrorLocationStatsRow, ErrorSeverity, ErrorType } from '@tahfeedh/shared';
import { scopeOfErrorType } from '@tahfeedh/shared';
import { supabase } from '../lib/supabase';
import { chapter } from '../data/quran-data';
import { ERROR_TYPE_COLOR, type OverlayMarker } from './getOverlayMarkers';
import { VerseAudioPlayer } from './VerseAudioPlayer';

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
  // 'word' → filter by word_position; 'verse' → drill-up, fetch every log on the
  // ayah (any word_position). ADR 0035.
  scope: 'word' | 'verse',
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
  if (scope === 'word') {
    if (wordPosition == null) q = q.is('word_position', null);
    else q = q.eq('word_position', wordPosition);
  }
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

interface VerseGroup {
  verseScope: Map<ErrorType, ErrorLogRow[]>;
  byWord: Map<number, Map<ErrorType, ErrorLogRow[]>>;
  ghosts: ErrorLogRow[];
}

interface WordGroup {
  byType: Map<ErrorType, ErrorLogRow[]>;
  ghosts: ErrorLogRow[];
}

export function ErrorDetailModal({
  studentId,
  marker,
  stats,
  onClose,
}: ErrorDetailModalProps) {
  const open = marker != null;
  const [showGhosts, setShowGhosts] = useState(false);

  const isVerseDrillUp = marker?.scope === 'verse';

  const { data: rows, isLoading } = useQuery({
    queryKey: [
      'error_log_at_location',
      studentId,
      marker?.surah,
      marker?.ayah,
      isVerseDrillUp ? 'verse-drillup' : marker?.wordPosition ?? 'verse',
    ],
    queryFn: () =>
      fetchErrorLogAtLocation(
        studentId,
        marker!.surah,
        marker!.ayah,
        isVerseDrillUp ? 'verse' : 'word',
        marker?.wordPosition ?? null,
      ),
    enabled: open,
    staleTime: 15_000,
  });

  // Build a Set of "cleared" signatures from stats.
  const clearedSignatures = useMemo(() => {
    const s = new Set<string>();
    for (const row of stats) if (row.cleared) s.add(row.signature);
    return s;
  }, [stats]);

  const grouped = useMemo<VerseGroup | WordGroup | null>(() => {
    if (!rows) return null;
    const active: ErrorLogRow[] = [];
    const ghosts: ErrorLogRow[] = [];
    for (const r of rows) {
      if (clearedSignatures.has(r.signature)) ghosts.push(r);
      else active.push(r);
    }

    if (isVerseDrillUp) {
      const verseScope = new Map<ErrorType, ErrorLogRow[]>();
      const byWord = new Map<number, Map<ErrorType, ErrorLogRow[]>>();
      for (const r of active) {
        if (r.word_position == null) {
          const list = verseScope.get(r.error_type);
          if (list) list.push(r);
          else verseScope.set(r.error_type, [r]);
        } else {
          let wordMap = byWord.get(r.word_position);
          if (!wordMap) {
            wordMap = new Map<ErrorType, ErrorLogRow[]>();
            byWord.set(r.word_position, wordMap);
          }
          const list = wordMap.get(r.error_type);
          if (list) list.push(r);
          else wordMap.set(r.error_type, [r]);
        }
      }
      return { verseScope, byWord, ghosts };
    }

    const byType = new Map<ErrorType, ErrorLogRow[]>();
    for (const r of active) {
      const list = byType.get(r.error_type);
      if (list) list.push(r);
      else byType.set(r.error_type, [r]);
    }
    return { byType, ghosts };
  }, [rows, clearedSignatures, isVerseDrillUp]);

  const surahName = marker ? chapter(marker.surah)?.name_simple ?? `Surah ${marker.surah}` : '';
  const locationLabel = marker
    ? marker.scope === 'verse'
      ? `${surahName} · ayah ${marker.ayah} · whole verse`
      : `${surahName} · ayah ${marker.ayah} · word ${marker.wordPosition}`
    : '';

  const isEmpty = grouped
    ? isVerseDrillUp
      ? (grouped as VerseGroup).verseScope.size === 0 &&
        (grouped as VerseGroup).byWord.size === 0 &&
        grouped.ghosts.length === 0
      : (grouped as WordGroup).byType.size === 0 && grouped.ghosts.length === 0
    : false;

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
      {marker && (
        <Stack gap={6} mb="sm">
          <Text size="xs" tt="uppercase" c="dimmed" fw={700} lts={0.8}>
            Listen to this verse
          </Text>
          <VerseAudioPlayer surah={marker.surah} ayah={marker.ayah} />
        </Stack>
      )}
      {isLoading || !grouped ? (
        <Stack gap="sm">
          <Skeleton height={64} radius="md" />
          <Skeleton height={64} radius="md" />
          <Skeleton height={64} radius="md" />
        </Stack>
      ) : isEmpty ? (
        <Text c="dimmed" ta="center" py="xl">
          No occurrences logged at this location yet.
        </Text>
      ) : (
        <ScrollArea h={460} type="auto" offsetScrollbars>
          <Stack gap="md">
            {isVerseDrillUp ? (
              <VerseDrillUpBody group={grouped as VerseGroup} />
            ) : (
              <WordBody group={grouped as WordGroup} />
            )}

            {grouped.ghosts.length > 0 && (
              <>
                <Divider />
                {!showGhosts ? (
                  <Group justify="space-between" align="center">
                    <Text size="sm" c="dimmed">
                      + {grouped.ghosts.length} ghost error
                      {grouped.ghosts.length === 1 ? '' : 's'} (cleared)
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

function WordBody({ group }: { group: WordGroup }) {
  return (
    <>
      {[...group.byType.entries()].map(([type, list]) => (
        <TypeGroup key={type} type={type} list={list} />
      ))}
    </>
  );
}

function VerseDrillUpBody({ group }: { group: VerseGroup }) {
  const sortedWords = [...group.byWord.entries()].sort((a, b) => a[0] - b[0]);
  return (
    <Stack gap="md">
      {group.verseScope.size > 0 && (
        <Stack gap={6}>
          <Text size="xs" tt="uppercase" c="dimmed" fw={700} lts={0.8}>
            Verse-scope
          </Text>
          {[...group.verseScope.entries()].map(([type, list]) => (
            <TypeGroup key={type} type={type} list={list} />
          ))}
        </Stack>
      )}
      {sortedWords.length > 0 && (
        <Stack gap={6}>
          <Text size="xs" tt="uppercase" c="dimmed" fw={700} lts={0.8}>
            Per word
          </Text>
          {sortedWords.map(([wordPos, byType]) => (
            <Paper key={wordPos} withBorder radius="md" p="xs" bg="rgba(255,255,255,0.4)">
              <Stack gap={6}>
                <Group gap={6} align="center">
                  <Badge size="sm" color="sage.7" variant="filled">
                    word {wordPos}
                  </Badge>
                </Group>
                {[...byType.entries()].map(([type, list]) => (
                  <TypeGroup key={type} type={type} list={list} />
                ))}
              </Stack>
            </Paper>
          ))}
        </Stack>
      )}
    </Stack>
  );
}

function TypeGroup({ type, list }: { type: ErrorType; list: ErrorLogRow[] }) {
  const scope = scopeOfErrorType(type);
  return (
    <Stack gap={4}>
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
        <Badge size="xs" variant="light" color={scope === 'verse' ? 'brick' : 'sage'}>
          {scope}
        </Badge>
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
  );
}

function OccurrenceRow({ row, ghost }: { row: ErrorLogRow; ghost: boolean }) {
  return (
    <Paper
      withBorder={false}
      radius="md"
      p="xs"
      style={{
        background: ghost ? 'rgba(255,255,255,0.4)' : 'rgba(255,255,255,0.78)',
        border: '1px solid rgba(21,53,30,0.08)',
        opacity: ghost ? 0.55 : 1,
      }}
    >
      <Stack gap={6}>
        <Group justify="space-between" align="center" wrap="nowrap" gap="xs">
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
                → intended {row.related_surah}:{row.related_ayah}
              </Text>
            )}
          </Group>
          <Text size="xs" c="dimmed" style={{ whiteSpace: 'nowrap' }}>
            {formatDateTime(row.created_at)}
          </Text>
        </Group>
        {row.teacher_note && (
          <Group
            gap={6}
            wrap="nowrap"
            align="flex-start"
            p={6}
            style={{
              background: 'var(--mantine-color-honey-0)',
              border: '1px solid var(--mantine-color-honey-2)',
              borderRadius: 6,
            }}
          >
            <MessageSquare
              size={12}
              color="var(--mantine-color-honey-7)"
              style={{ flexShrink: 0, marginTop: 2 }}
            />
            <Stack gap={0} style={{ minWidth: 0 }}>
              <Text size="xs" fw={700} c="honey.8" tt="uppercase" lts={0.6}>
                Note
              </Text>
              <Text size="xs" style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                {row.teacher_note}
              </Text>
            </Stack>
          </Group>
        )}
      </Stack>
    </Paper>
  );
}
