import { useState } from 'react';
import { ActionIcon, Badge, Button, Group, Paper, ScrollArea, Select, Stack, Text, Textarea, Tooltip } from '@mantine/core';
import { Trash2 } from 'lucide-react';
import type { TestRating, TestType } from '@tahfeedh/shared';
import { chapter } from '../../data/quran-data';
import type { LoggedError } from './useTestSession';

const RATING_OPTIONS: Record<TestType, Array<{ value: TestRating; label: string }>> = {
  newly_memorized: [
    { value: 'strong_pass', label: 'Strong pass — promote to memorized' },
    { value: 'pass_needs_practice', label: 'Pass with practice notes' },
    { value: 'fail', label: 'Fail — needs another attempt' },
  ],
  revision: [
    { value: 'excellent', label: 'Excellent — clean' },
    { value: 'good', label: 'Good — small slips' },
    { value: 'needs_work', label: 'Needs work — frequent errors' },
    { value: 'fail', label: 'Fail — major gaps' },
  ],
};

interface Props {
  testType: TestType;
  guestTesterName: string | null;
  errors: LoggedError[];
  rangeLabel: string;
  onEndTest: (rating: TestRating, notes?: string) => Promise<void>;
  submitting: boolean;
}

export function ErrorLogPane({ testType, guestTesterName, errors, rangeLabel, onEndTest, submitting }: Props) {
  const [rating, setRating] = useState<TestRating | null>(null);
  const [notes, setNotes] = useState('');

  return (
    <Paper p="md" radius="md" withBorder style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <Stack gap={2} mb="sm">
        <Text fw={700} size="sm">
          {testType === 'newly_memorized' ? 'New lesson test' : 'Revision test'}
        </Text>
        <Text size="xs" c="dimmed">
          {rangeLabel}
          {guestTesterName ? ` · witnessed by ${guestTesterName}` : ''}
        </Text>
      </Stack>

      <Stack gap={4} mb="xs">
        <Group justify="space-between">
          <Text size="xs" fw={600} c="dimmed">
            Errors logged
          </Text>
          <Badge variant="light" color="brick" size="sm">
            {errors.length}
          </Badge>
        </Group>
      </Stack>

      <ScrollArea style={{ flex: 1, minHeight: 0 }} mb="md">
        {errors.length === 0 ? (
          <Text size="xs" c="dimmed" fs="italic">
            Tap any word on the mushaf to log an error.
          </Text>
        ) : (
          <Stack gap={6}>
            {errors.map((e) => {
              const ch = chapter(e.surah);
              return (
                <Paper key={e.id} p="xs" radius="sm" withBorder>
                  <Group justify="space-between" gap={4} wrap="nowrap" align="flex-start">
                    <Stack gap={0} style={{ minWidth: 0 }}>
                      <Group gap={6}>
                        <Badge size="xs" variant="filled" color="brick">
                          {e.error_type}
                        </Badge>
                        <Badge size="xs" variant="light">
                          {e.severity}
                        </Badge>
                      </Group>
                      <Text size="xs" fw={600} mt={2}>
                        {ch?.name_simple} {e.surah}:{e.ayah}
                        {e.word_position ? ` · word ${e.word_position}` : ''}
                      </Text>
                      {e.error_type === 'wrong_verse' && e.related_surah && e.related_ayah && (
                        <Text size="xs" c="dimmed">
                          intended: {chapter(e.related_surah)?.name_simple} {e.related_surah}:{e.related_ayah}
                        </Text>
                      )}
                      {e.teacher_note && (
                        <Text size="xs" c="dimmed" lineClamp={2}>
                          {e.teacher_note}
                        </Text>
                      )}
                    </Stack>
                    <Tooltip label="Delete error (not implemented)" disabled>
                      <ActionIcon variant="subtle" size="sm" disabled>
                        <Trash2 size={12} />
                      </ActionIcon>
                    </Tooltip>
                  </Group>
                </Paper>
              );
            })}
          </Stack>
        )}
      </ScrollArea>

      <Stack gap="xs">
        <Select
          label="Rating"
          placeholder="Pick a rating"
          value={rating}
          onChange={(v) => setRating(v as TestRating | null)}
          data={RATING_OPTIONS[testType]}
          allowDeselect={false}
        />
        <Textarea
          label="Notes (optional)"
          value={notes}
          onChange={(e) => setNotes(e.currentTarget.value)}
          autosize
          minRows={1}
          maxRows={3}
        />
        <Button
          color="sage"
          disabled={!rating}
          loading={submitting}
          onClick={() => rating && onEndTest(rating, notes.trim() || undefined)}
        >
          End test
        </Button>
      </Stack>
    </Paper>
  );
}
