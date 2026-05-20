import { Skeleton, Stack } from '@mantine/core';

export type SkeletonRowVariant = 'card' | 'list';

export interface SkeletonRowProps {
  variant?: SkeletonRowVariant;
  lines?: number;
  height?: number;
  radius?: number | string;
}

export function SkeletonRow({ variant = 'card', lines = 3, height, radius = 'md' }: SkeletonRowProps) {
  if (variant === 'list') {
    return (
      <Stack gap="sm">
        {Array.from({ length: lines }).map((_, i) => (
          <Skeleton key={i} height={height ?? 56} radius={radius} />
        ))}
      </Stack>
    );
  }
  return <Skeleton height={height ?? 108} radius={radius} />;
}
