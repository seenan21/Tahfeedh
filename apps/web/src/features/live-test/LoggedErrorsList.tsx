import { ActionIcon, Badge, Group, Paper, ScrollArea, Stack, Text, Tooltip } from '@mantine/core';
import { Trash2 } from 'lucide-react';
import { chapter } from '../../data/quran-data';
import type { LoggedError } from './useTestSession';

interface Props {
  errors: LoggedError[];
  /** Live-flow shows a disabled trash icon as a future-affordance hint. Recap hides it. */
  showTrashAffordance?: boolean;
  emptyText?: string;
}

export function LoggedErrorsList({
  errors,
  showTrashAffordance = false,
  emptyText = 'Tap any word on the mushaf to log an error.',
}: Props) {
  return (
    <ScrollArea style={{ flex: 1, minHeight: 0 }}>
      {errors.length === 0 ? (
        <Text size="xs" c="dimmed" fs="italic">
          {emptyText}
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
                  {showTrashAffordance && (
                    <Tooltip label="Delete error (not implemented)" disabled>
                      <ActionIcon variant="subtle" size="sm" disabled>
                        <Trash2 size={12} />
                      </ActionIcon>
                    </Tooltip>
                  )}
                </Group>
              </Paper>
            );
          })}
        </Stack>
      )}
    </ScrollArea>
  );
}
