import type { CSSProperties, ReactNode } from 'react';
import { useOverflowEdges } from '@/hooks/use-overflow-edges';
import { cx } from '@/utils/cx';

const EDGE_SHADOW =
  'tw:pointer-events-none tw:absolute tw:inset-y-0 tw:w-7 tw:from-black/10 tw:to-transparent tw:dark:from-black/40';

export interface ScrollShadowProps {
  children: ReactNode;
  /** Classes for the horizontally scrolling element. */
  className?: string;
  style?: CSSProperties;
  /**
   * Where the end shadow sits, for content with a column pinned to the end
   * (e.g. `tw:right-10` before a 40px sticky action column). @default 'tw:right-0'
   */
  endShadowClassName?: string;
}

/**
 * Scrolls its content horizontally and shadows whichever edge hides content —
 * the only scroll cue where the scrollbar is an overlay (macOS). Same shadow as
 * the card `Tabs`.
 */
export const ScrollShadow = ({
  children,
  className,
  style,
  endShadowClassName = 'tw:right-0',
}: ScrollShadowProps) => {
  const { ref, edges } = useOverflowEdges(true);

  return (
    <div className="tw:relative tw:w-full tw:min-w-0">
      <div
        className={cx('tw:overflow-x-auto', className)}
        ref={ref}
        style={style}>
        {children}
      </div>
      {edges.start && (
        <div
          aria-hidden="true"
          className={cx(EDGE_SHADOW, 'tw:left-0 tw:bg-linear-to-r')}
          data-testid="scroll-shadow-start"
        />
      )}
      {edges.end && (
        <div
          aria-hidden="true"
          className={cx(EDGE_SHADOW, 'tw:bg-linear-to-l', endShadowClassName)}
          data-testid="scroll-shadow-end"
        />
      )}
    </div>
  );
};
