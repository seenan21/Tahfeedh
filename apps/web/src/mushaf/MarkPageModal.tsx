import { useEffect, useMemo, useState } from 'react';
import {
  Button,
  Group,
  Loader,
  Modal,
  SegmentedControl,
  Stack,
  Text,
} from '@mantine/core';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { MemorizationMarkStatus, MushafPageData } from '@tahfeedh/shared';
import { apiFetch } from '../api/client';
import { chapter, quranIndex } from '../data/quran-data';
import { toArabicIndic } from '../lib/numerals';

type MarkChoice = 'untouched' | 'in_progress_first' | 'in_progress_second' | 'memorized';

interface MarkPageModalProps {
  opened: boolean;
  pageNumber: number | null;
  studentId: string;
  onClose: () => void;
  onOpenReader: () => void;
}

async function loadPageData(pageNumber: number): Promise<MushafPageData> {
  const mod = await import(`../data/pages/${pageNumber}.json`);
  return mod.default as MushafPageData;
}

/** Build the explicit ayah list for the first or second half of a page. */
function buildHalfVerses(
  page: MushafPageData,
  pageInfo: { surah_start: number; ayah_start: number; surah_end: number; ayah_end: number },
  half: 'first' | 'second',
): Array<{ surah: number; ayah: number }> {
  const mid = page.midpoint_ayah_break;
  const verses: Array<{ surah: number; ayah: number }> = [];

  const from =
    half === 'first'
      ? { surah: pageInfo.surah_start, ayah: pageInfo.ayah_start }
      : mid.second_half_first_ayah;
  const to =
    half === 'first' ? mid.first_half_last_ayah : { surah: pageInfo.surah_end, ayah: pageInfo.ayah_end };

  if (from.surah === to.surah) {
    for (let a = from.ayah; a <= to.ayah; a++) {
      verses.push({ surah: from.surah, ayah: a });
    }
    return verses;
  }

  // Cross-surah half (rare but possible)
  const startSurah = quranIndex.surahs[String(from.surah)];
  if (startSurah) {
    for (let a = from.ayah; a <= startSurah.ayah_count; a++) {
      verses.push({ surah: from.surah, ayah: a });
    }
  }
  for (let s = from.surah + 1; s < to.surah; s++) {
    const mid2 = quranIndex.surahs[String(s)];
    if (!mid2) continue;
    for (let a = 1; a <= mid2.ayah_count; a++) verses.push({ surah: s, ayah: a });
  }
  for (let a = 1; a <= to.ayah; a++) verses.push({ surah: to.surah, ayah: a });
  return verses;
}

export function MarkPageModal({
  opened,
  pageNumber,
  studentId,
  onClose,
  onOpenReader,
}: MarkPageModalProps) {
  const queryClient = useQueryClient();
  const [choice, setChoice] = useState<MarkChoice>('memorized');
  const [pageData, setPageData] = useState<MushafPageData | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (!opened || pageNumber == null) return;
    setChoice('memorized');
    setPageData(null);
    setLoadError(null);
    let cancelled = false;
    loadPageData(pageNumber)
      .then((d) => {
        if (!cancelled) setPageData(d);
      })
      .catch((e: unknown) => {
        if (!cancelled) setLoadError(e instanceof Error ? e.message : 'failed to load page');
      });
    return () => {
      cancelled = true;
    };
  }, [opened, pageNumber]);

  const pageInfo = pageNumber != null ? quranIndex.pages[String(pageNumber)] : null;
  const startSurah = pageInfo ? chapter(pageInfo.surah_start) : null;
  const endSurah = pageInfo ? chapter(pageInfo.surah_end) : null;

  const surahLabel =
    startSurah && endSurah && startSurah.id !== endSurah.id
      ? `${startSurah.name_simple} – ${endSurah.name_simple}`
      : (startSurah?.name_simple ?? '');

  const halfPreview = useMemo(() => {
    if (!pageData || !pageInfo) return null;
    if (choice === 'in_progress_first')
      return pageData.midpoint_ayah_break.first_half_last_ayah;
    if (choice === 'in_progress_second')
      return pageData.midpoint_ayah_break.second_half_first_ayah;
    return null;
  }, [choice, pageData, pageInfo]);

  const mutation = useMutation({
    mutationFn: async (): Promise<void> => {
      if (pageNumber == null || !pageInfo || !pageData) {
        throw new Error('page data not loaded');
      }
      let status: MemorizationMarkStatus;
      let verses: Array<{ surah: number; ayah: number }> | undefined;

      if (choice === 'memorized') status = 'memorized';
      else if (choice === 'untouched') status = 'untouched';
      else {
        status = 'in_progress';
        verses = buildHalfVerses(
          pageData,
          pageInfo,
          choice === 'in_progress_first' ? 'first' : 'second',
        );
      }

      await apiFetch('/api/memorization/mark', {
        method: 'POST',
        body: JSON.stringify({ pageNumber, status, verses }),
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['memorization_pages', studentId] });
      await queryClient.invalidateQueries({ queryKey: ['next_new_lesson', studentId] });
      onClose();
    },
  });

  if (pageNumber == null) return null;

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={
        <Stack gap={0}>
          <Text size="xs" tt="uppercase" c="dimmed" fw={700} lts={0.8}>
            Page {pageNumber}
            {surahLabel ? ` · ${surahLabel}` : ''}
          </Text>
          <Text fw={600} fz="lg">
            Mark memorization
          </Text>
        </Stack>
      }
      size="md"
    >
      <Stack gap="md">
        <SegmentedControl
          fullWidth
          value={choice}
          onChange={(v) => setChoice(v as MarkChoice)}
          data={[
            { label: 'Untouched', value: 'untouched' },
            { label: 'First half', value: 'in_progress_first' },
            { label: 'Second half', value: 'in_progress_second' },
            { label: 'Memorized', value: 'memorized' },
          ]}
        />

        <Text size="sm" c="dimmed" component="div">
          {choice === 'memorized' && (
            <>The whole page lands in your memorized set and starts feeding the review queue.</>
          )}
          {choice === 'untouched' && (
            <>The page row is cleared. Past review state for these ayahs is kept.</>
          )}
          {choice === 'in_progress_first' && halfPreview && pageInfo && (
            <>
              First half: ayah {pageInfo.surah_start === halfPreview.surah ? pageInfo.ayah_start : 1}
              {' → '}
              {halfPreview.surah}:{halfPreview.ayah}
              {' '}
              <Text component="span" c="dimmed" size="xs" style={{ fontFamily: 'Amiri, serif' }}>
                ({toArabicIndic(halfPreview.ayah)})
              </Text>
            </>
          )}
          {choice === 'in_progress_second' && halfPreview && pageInfo && (
            <>
              Second half: ayah {halfPreview.surah}:{halfPreview.ayah}
              {' → '}
              {pageInfo.surah_end}:{pageInfo.ayah_end}
            </>
          )}
        </Text>

        {loadError && (
          <Text size="sm" c="brick.7">
            {loadError}
          </Text>
        )}

        {mutation.isError && (
          <Text size="sm" c="brick.7">
            Couldn't save: {(mutation.error as Error).message}
          </Text>
        )}

        <Group justify="space-between" mt="sm">
          <Button variant="subtle" color="mihrab.9" onClick={onOpenReader} disabled={!pageData}>
            Open in mushaf
          </Button>
          <Group gap="xs">
            <Button variant="default" onClick={onClose} disabled={mutation.isPending}>
              Cancel
            </Button>
            <Button
              color="mihrab.9"
              onClick={() => mutation.mutate()}
              loading={mutation.isPending}
              disabled={!pageData}
              leftSection={!pageData ? <Loader size={12} color="parchment.0" /> : undefined}
            >
              Save
            </Button>
          </Group>
        </Group>
      </Stack>
    </Modal>
  );
}
