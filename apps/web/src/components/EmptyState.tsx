import { Card, Center, Stack, Text } from '@mantine/core';
import type { ReactNode } from 'react';
import { BilingualHero } from './BilingualHero';

export interface EmptyStateProps {
  arabic: string;
  english: string;
  helper?: string;
  children?: ReactNode;
}

/**
 * Cream card with a bilingual hero, used for routes that aren't built out yet
 * (Phase B uses this for tests/timeline/mushaf/goals/groups/settings) and for
 * any other "this surface has no data" moment within the app shell.
 */
export function EmptyState({ arabic, english, helper, children }: EmptyStateProps) {
  return (
    <Center mih="60vh">
      <Card maw={520} w="100%">
        <Stack gap="lg" align="center" py="md">
          <BilingualHero arabic={arabic} english={english} />
          {helper && (
            <Text c="dimmed" size="sm" ta="center" maw={420}>
              {helper}
            </Text>
          )}
          {children}
        </Stack>
      </Card>
    </Center>
  );
}
