import { Stack, Text } from '@mantine/core';

/**
 * The auth/landing entry-point quote. DESIGN-SYSTEM §8 — "the app cites
 * itself into the tradition before functioning as a tool."
 *
 * Hadith on the importance of refreshing one's hifz, Sahih al-Bukhari 5033.
 */
export function IntroHadith() {
  return (
    <Stack gap={6} align="center" mb="md">
      <Text
        component="p"
        ta="center"
        style={{
          fontFamily: '"Scheherazade New", serif',
          fontWeight: 400,
          fontSize: 24,
          lineHeight: 1.6,
          direction: 'rtl',
          maxWidth: 540,
          margin: 0,
        }}
      >
        تَعَاهَدُوا هَذَا الْقُرْآنَ، فَوَالَّذِي نَفْسِي بِيَدِهِ لَهُوَ أَشَدُّ تَفَصِّيًا مِنَ الْإِبِلِ فِي عُقُلِهَا
      </Text>
      <Text
        component="p"
        ta="center"
        c="dimmed"
        style={{
          fontFamily: 'Roboto, sans-serif',
          fontStyle: 'italic',
          fontSize: 14,
          maxWidth: 540,
          margin: 0,
        }}
      >
        "Keep refreshing your knowledge of the Qur'an, for it is more liable to
        escape than camels which are tethered." — Sahih al-Bukhari 5033
      </Text>
    </Stack>
  );
}
