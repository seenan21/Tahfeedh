import { Group, Paper, Stack, Text } from '@mantine/core';
import type { LucideIcon } from 'lucide-react';

interface EmptySlotCardProps {
  title: string;
  icon: LucideIcon;
  helper: string;
}

/**
 * Inner-card placeholder for the NEW LESSON and REVIEW rows on the Today
 * view. Will be wired to the algorithm-computed plan in Phase C / M5.
 */
export function EmptySlotCard({ title, icon: Icon, helper }: EmptySlotCardProps) {
  return (
    <Paper bg="white" radius="md" shadow="sm" p="md">
      <Group gap="md" wrap="nowrap" align="flex-start">
        <Icon size={20} strokeWidth={1.75} color="var(--mantine-color-mihrab-9)" />
        <Stack gap={2} flex={1}>
          <Text fw={600}>{title}</Text>
          <Text size="sm" c="dimmed">
            {helper}
          </Text>
        </Stack>
      </Group>
    </Paper>
  );
}
