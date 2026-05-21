import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Anchor,
  Button,
  Group,
  Modal,
  NumberInput,
  SegmentedControl,
  Stack,
  Text,
  TextInput,
} from '@mantine/core';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { MemorizationStatus, NextNewLesson, TestCreateInput, TestMode, TestType } from '@tahfeedh/shared';
import { apiFetch } from '../../api/client';
import { supabase } from '../../lib/supabase';
import { toastError } from '../../lib/toast';

interface Props {
  opened: boolean;
  onClose: () => void;
  onCreated: (testId: string) => void;
  studentId: string;
  /** Defaults to 'guest_teacher' (student-initiated). Teacher drill-in passes
   *  'enrolled_teacher'; the modal hides the witness field and the server uses
   *  the caller as the teacher_id (M6). */
  mode?: TestMode;
  /** Subject label when launching from teacher drill-in. Renders in the modal
   *  header so the teacher confirms they're starting a test for the right student. */
  subjectLabel?: string;
}

interface PageStatusRow {
  page_number: number;
  status: MemorizationStatus;
}

// IMPORTANT: return a plain array, not a Map. React Query's structural-sharing
// pass strips Maps to {} (it walks via Object.keys) — then `.get(p)` blows up
// with "r.get is not a function" in minified prod builds.
async function fetchPageStatuses(studentId: string): Promise<PageStatusRow[]> {
  const { data, error } = await supabase
    .from('memorization_page')
    .select('page_number, status')
    .eq('student_id', studentId);
  if (error) throw error;
  return (data ?? []) as PageStatusRow[];
}

async function fetchNextNewLesson(): Promise<NextNewLesson | null> {
  const { data, error } = await supabase.rpc('next_new_lesson');
  if (error) return null;
  if (!data) return null;
  // RPC may return a single row or an array depending on Supabase version.
  const row = Array.isArray(data) ? data[0] : data;
  if (!row) return null;
  return {
    page_number: row.page_number,
    kind: row.kind,
  };
}

function validateRange(
  testType: TestType,
  start: number,
  end: number,
  statuses: Map<number, MemorizationStatus>,
): string | null {
  if (!Number.isInteger(start) || !Number.isInteger(end)) return 'Page range must be whole numbers.';
  if (start < 1 || end > 604) return 'Page range must be within 1–604.';
  if (end < start) return 'End page must be ≥ start page.';

  if (testType === 'newly_memorized') {
    const blocked: number[] = [];
    for (let p = start; p <= end; p++) {
      const s = statuses.get(p);
      if (s === 'memorized') blocked.push(p);
    }
    if (blocked.length > 0) {
      const list = blocked.length <= 5 ? blocked.join(', ') : `${blocked.slice(0, 5).join(', ')}, …`;
      return `Newly-memorized tests must cover pages you haven't passed yet. Already memorized: ${list}.`;
    }
  } else {
    // revision: pages must already be memorized.
    const ineligible: number[] = [];
    for (let p = start; p <= end; p++) {
      const s = statuses.get(p);
      if (s !== 'memorized') ineligible.push(p);
    }
    if (ineligible.length > 0) {
      const list = ineligible.length <= 5
        ? ineligible.join(', ')
        : `${ineligible.slice(0, 5).join(', ')}, …`;
      return `Revision tests must cover memorized pages. Not memorized yet: ${list}.`;
    }
  }
  return null;
}

export function TestCreationModal({
  opened,
  onClose,
  onCreated,
  studentId,
  mode = 'guest_teacher',
  subjectLabel,
}: Props) {
  const queryClient = useQueryClient();
  const isTeacherFlow = mode === 'enrolled_teacher';
  const [testType, setTestType] = useState<TestType>('newly_memorized');
  const [pageStart, setPageStart] = useState<number | string>(1);
  const [pageEnd, setPageEnd] = useState<number | string>(1);
  const [witness, setWitness] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const { data: statusRows } = useQuery({
    queryKey: ['memorization_pages', studentId],
    queryFn: () => fetchPageStatuses(studentId),
    enabled: opened,
    staleTime: 30_000,
  });

  const statuses = useMemo<Map<number, MemorizationStatus>>(() => {
    const m = new Map<number, MemorizationStatus>();
    // Defensive: a stale React Query cache from an earlier code version could
    // hold a Map here instead of an array. Array.isArray catches that without
    // throwing "r.get is not a function" later.
    if (!Array.isArray(statusRows)) {
      if (statusRows != null) {
        // eslint-disable-next-line no-console
        console.warn('[TestCreationModal] expected array of page statuses, got', typeof statusRows);
      }
      return m;
    }
    for (const r of statusRows) {
      if (r && typeof r === 'object' && 'page_number' in r && 'status' in r) {
        m.set(r.page_number, r.status);
      }
    }
    return m;
  }, [statusRows]);

  const { data: nextLesson } = useQuery({
    queryKey: ['next_new_lesson', studentId],
    queryFn: fetchNextNewLesson,
    enabled: opened && !isTeacherFlow,
    staleTime: 30_000,
  });

  useEffect(() => {
    if (!opened) return;
    setTestType('newly_memorized');
    setWitness('');
    setError(null);
    // Pre-fill start/end with the next new-lesson page if known.
    const seed = nextLesson?.page_number ?? 1;
    setPageStart(seed);
    setPageEnd(seed);
  }, [opened, nextLesson?.page_number]);

  const start = Number(pageStart);
  const end = Number(pageEnd);
  const liveError = useMemo(() => {
    if (!statusRows) return null;
    if (!Number.isInteger(start) || !Number.isInteger(end)) return null;
    return validateRange(testType, start, end, statuses);
  }, [testType, start, end, statuses, statusRows]);

  const handleSubmit = async () => {
    if (!statusRows) {
      setError('Page status still loading — try again in a moment.');
      return;
    }
    const rangeErr = validateRange(testType, start, end, statuses);
    if (rangeErr) {
      setError(rangeErr);
      return;
    }
    if (!isTeacherFlow && !witness.trim()) {
      setError('A witness name is required for guest-witnessed tests.');
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      const body: TestCreateInput = isTeacherFlow
        ? {
            test_type: testType,
            test_mode: 'enrolled_teacher',
            ranges: [{ type: 'page', start, end }],
            student_id: studentId,
          }
        : {
            test_type: testType,
            test_mode: 'guest_teacher',
            ranges: [{ type: 'page', start, end }],
            guest_tester_name: witness.trim(),
          };
      const res = await apiFetch<{ id: string }>('/api/tests/create', {
        method: 'POST',
        body: JSON.stringify(body),
      });
      // Invalidate the in-progress test cache so the parent route re-fetches
      // if the user navigates back.
      queryClient.invalidateQueries({ queryKey: ['tests_recent', studentId] });
      setSubmitting(false);
      onClose();
      setTimeout(() => onCreated(res.id), 0);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to create test';
      setError(msg);
      toastError(err, 'Could not start test');
      setSubmitting(false);
    }
  };

  const titleNode = isTeacherFlow ? (
    <Stack gap={0}>
      <Text size="xs" tt="uppercase" c="dimmed" fw={700} lts={0.8}>
        Begin Test
      </Text>
      {subjectLabel && (
        <Text fw={700} fz="md">
          for {subjectLabel}
        </Text>
      )}
    </Stack>
  ) : (
    'Begin Test'
  );

  return (
    <Modal opened={opened} onClose={onClose} title={titleNode} size="md" centered>
      <Stack gap="md">
        {isTeacherFlow ? (
          <Alert color="sage" variant="light" radius="md">
            <Text size="xs">
              You're starting a test as the witnessing teacher. Errors and pass/fail
              ratings will be attributed to you.
            </Text>
          </Alert>
        ) : (
          <Alert color="sage" variant="light" radius="md">
            <Text size="xs">
              This is a self-test you run from your device. Pick someone listening to your
              recitation — a teacher, parent, sibling, or friend — as the witness, then start.
            </Text>
          </Alert>
        )}

        <Stack gap={4}>
          <Text size="xs" fw={600} c="dimmed">
            Test type
          </Text>
          <SegmentedControl
            value={testType}
            onChange={(v) => setTestType(v as TestType)}
            data={[
              { label: 'Newly memorized', value: 'newly_memorized' },
              { label: 'Revision', value: 'revision' },
            ]}
          />
          <Text size="xs" c="dimmed">
            {testType === 'newly_memorized'
              ? 'Pick a contiguous page range that you haven’t passed yet. A strong pass promotes the page(s) from in-progress to memorized.'
              : 'Pick a contiguous page range you’ve already memorized. Used to keep pages fresh and surface drift.'}
          </Text>
        </Stack>

        {testType === 'newly_memorized' && !isTeacherFlow && nextLesson?.page_number && (
          <Alert color="sage" variant="light" radius="md">
            <Group justify="space-between">
              <Text size="xs">
                Next new lesson: page {nextLesson.page_number} ({nextLesson.kind})
              </Text>
              <Anchor
                size="xs"
                onClick={() => {
                  setPageStart(nextLesson.page_number);
                  setPageEnd(nextLesson.page_number);
                }}
              >
                Use this →
              </Anchor>
            </Group>
          </Alert>
        )}

        <Group grow>
          <NumberInput
            label="Start page"
            value={pageStart}
            min={1}
            max={604}
            onChange={(v) => {
              setPageStart(v);
              const n = typeof v === 'number' ? v : Number(v);
              if (Number.isInteger(n) && Number(pageEnd) < n) setPageEnd(n);
            }}
          />
          <NumberInput
            label="End page"
            value={pageEnd}
            min={1}
            max={604}
            onChange={setPageEnd}
          />
        </Group>

        {!isTeacherFlow && (
          <TextInput
            label="Witness name"
            placeholder="e.g. Imam Yusuf, Mom, Friend"
            value={witness}
            onChange={(e) => setWitness(e.currentTarget.value)}
          />
        )}

        {(error || liveError) && (
          <Alert color="brick" variant="light">
            {error ?? liveError}
          </Alert>
        )}

        <Group justify="flex-end">
          <Button variant="subtle" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            loading={submitting}
            color="sage"
            disabled={!!liveError}
          >
            Begin
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
