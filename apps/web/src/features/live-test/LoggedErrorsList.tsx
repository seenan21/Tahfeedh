import { Badge, Group, Paper, ScrollArea, Stack, Text } from '@mantine/core';
import { MessageSquare } from 'lucide-react';
import { scopeOfErrorType } from '@tahfeedh/shared';
import { chapter } from '../../data/quran-data';
import { ERROR_TYPE_COLOR } from '../../mushaf/getOverlayMarkers';
import type { LoggedError } from './useTestSession';

interface Props {
  errors: LoggedError[];
  emptyText?: string;
}

export function LoggedErrorsList({
  errors,
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
            const typeColor = ERROR_TYPE_COLOR[e.error_type];
            const scope = scopeOfErrorType(e.error_type);
            return (
              <Paper
                key={e.id}
                p="xs"
                radius="md"
                withBorder
                style={{
                  borderColor: 'rgba(21,53,30,0.08)',
                  borderInlineStartWidth: 3,
                  borderInlineStartColor: typeColor,
                  background: 'rgba(255,255,255,0.85)',
                }}
              >
                <Group gap={4} wrap="nowrap" align="flex-start">
                  <Stack gap={4} style={{ minWidth: 0, flex: 1 }}>
                    <Group gap={6} wrap="wrap">
                      <Badge
                        size="xs"
                        variant="filled"
                        color="dark.4"
                        leftSection={
                          <span
                            style={{
                              width: 8,
                              height: 8,
                              borderRadius: 2,
                              background: typeColor,
                              display: 'inline-block',
                            }}
                          />
                        }
                        tt="capitalize"
                      >
                        {e.error_type.replace('_', ' ')}
                      </Badge>
                      <Badge size="xs" variant="light" color={scope === 'verse' ? 'brick' : 'sage'}>
                        {scope}
                      </Badge>
                    </Group>
                    <Text size="xs" fw={600}>
                      {ch?.name_simple} {e.surah}:{e.ayah}
                      {e.word_position
                        ? ` · word ${e.word_position}`
                        : ' · whole verse'}
                    </Text>
                    {e.error_type === 'wrong_verse' && e.related_surah && e.related_ayah && (
                      <Text size="xs" c="dimmed">
                        → intended: {chapter(e.related_surah)?.name_simple} {e.related_surah}:
                        {e.related_ayah}
                      </Text>
                    )}
                    {e.teacher_note && (
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
                          <Text
                            size="xs"
                            style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}
                          >
                            {e.teacher_note}
                          </Text>
                        </Stack>
                      </Group>
                    )}
                  </Stack>
                </Group>
              </Paper>
            );
          })}
        </Stack>
      )}
    </ScrollArea>
  );
}
