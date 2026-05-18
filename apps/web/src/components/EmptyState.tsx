import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { Sparkles } from 'lucide-react';
import { BilingualHero } from './BilingualHero';
import classes from './EmptyState.module.css';

export interface EmptyStateProps {
  arabic: string;
  english: string;
  helper?: string;
  icon?: LucideIcon;
  tag?: string;
  children?: ReactNode;
}

/**
 * Hero-style empty state — large outlined icon over a halo, bilingual title,
 * tag chip, helper copy, and optional CTAs. Used for routes that haven't
 * been built out yet (Phase B uses this for tests/timeline/mushaf/goals/
 * groups/settings) and for any "this surface has no data" moment.
 */
export function EmptyState({
  arabic,
  english,
  helper,
  icon: Icon = Sparkles,
  tag = 'Coming soon',
  children,
}: EmptyStateProps) {
  return (
    <div className={classes.shell}>
      <div className={classes.card}>
        <div className={classes.iconHalo}>
          <Icon size={32} strokeWidth={1.5} color="var(--mantine-color-mihrab-9)" />
        </div>
        {tag && <div className={classes.tag}>{tag}</div>}
        <BilingualHero arabic={arabic} english={english} />
        {helper && <p className={classes.helper}>{helper}</p>}
        {children}
      </div>
    </div>
  );
}
