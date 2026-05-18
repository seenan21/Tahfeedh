import { Badge, Group, Stack, Text } from '@mantine/core';
import type { LucideIcon } from 'lucide-react';

interface EmptySlotCardProps {
  title: string;
  icon: LucideIcon;
  helper: string;
  badge?: string;
  accent?: 'sage' | 'honey';
}

const ACCENT_STYLES = {
  sage: {
    iconBg: 'linear-gradient(135deg, var(--mantine-color-sage-4) 0%, var(--mantine-color-sage-7) 100%)',
    ring: 'color-mix(in srgb, var(--mantine-color-sage-4) 30%, transparent)',
  },
  honey: {
    iconBg: 'linear-gradient(135deg, var(--mantine-color-honey-4) 0%, var(--mantine-color-honey-5) 100%)',
    ring: 'color-mix(in srgb, var(--mantine-color-honey-4) 30%, transparent)',
  },
} as const;

/**
 * Inner-card placeholder for the NEW LESSON and REVIEW rows on the Today
 * view. Will be wired to the algorithm-computed plan in Phase C / M5.
 */
export function EmptySlotCard({ title, icon: Icon, helper, badge, accent = 'sage' }: EmptySlotCardProps) {
  const a = ACCENT_STYLES[accent];
  return (
    <div
      style={{
        position: 'relative',
        padding: 18,
        borderRadius: 14,
        background:
          'linear-gradient(180deg, white 0%, color-mix(in srgb, white 92%, var(--mantine-color-parchment-0)) 100%)',
        boxShadow:
          '0 1px 2px rgba(21,53,30,0.06), 0 8px 16px -8px rgba(21,53,30,0.12)',
        border: '1px solid rgba(21,53,30,0.06)',
      }}
    >
      <Group gap="md" wrap="nowrap" align="flex-start">
        <div
          style={{
            width: 44, height: 44, borderRadius: 12, flex: '0 0 44px',
            background: a.iconBg,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: `0 0 0 4px ${a.ring}`,
          }}
        >
          <Icon size={20} strokeWidth={2} color="white" />
        </div>
        <Stack gap={4} flex={1}>
          <Group gap="xs" justify="space-between" align="center">
            <Text fw={600} size="md">{title}</Text>
            {badge && (
              <Badge variant="light" color="mihrab.7" size="xs" radius="sm">
                {badge}
              </Badge>
            )}
          </Group>
          <Text size="sm" c="dimmed" lh={1.45}>
            {helper}
          </Text>
        </Stack>
      </Group>
    </div>
  );
}
