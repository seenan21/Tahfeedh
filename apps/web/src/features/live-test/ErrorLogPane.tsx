import { useState } from 'react';
import { Badge, Button, Group, Paper, Select, Stack, Text, Textarea } from '@mantine/core';
import type { TestRating, TestType } from '@tahfeedh/shared';
import { LoggedErrorsList } from './LoggedErrorsList';
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

      <div style={{ flex: 1, minHeight: 0, marginBottom: 'var(--mantine-spacing-md)' }}>
        <LoggedErrorsList errors={errors} showTrashAffordance />
      </div>

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
