import { Stack, Text } from '@mantine/core';

export interface BilingualHeroProps {
  arabic: string;
  english: string;
  align?: 'center' | 'start';
}

/**
 * Paired Arabic-above-English hero per DESIGN-SYSTEM §8.
 * Arabic uses Cairo (700), English uses Playfair Display (700).
 * Both registered as fonts in apps/web/src/styles/fonts.css.
 */
export function BilingualHero({ arabic, english, align = 'center' }: BilingualHeroProps) {
  return (
    <Stack gap={4} align={align === 'center' ? 'center' : 'flex-start'}>
      <Text
        component="span"
        style={{
          fontFamily: 'Cairo, sans-serif',
          fontWeight: 700,
          fontSize: 36,
          lineHeight: 1.2,
          direction: 'rtl',
        }}
      >
        {arabic}
      </Text>
      <Text
        component="span"
        style={{
          fontFamily: '"Playfair Display", serif',
          fontWeight: 700,
          fontSize: 36,
          lineHeight: 1.15,
        }}
      >
        {english}
      </Text>
    </Stack>
  );
}
