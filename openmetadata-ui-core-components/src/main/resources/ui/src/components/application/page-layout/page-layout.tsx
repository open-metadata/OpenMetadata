/*
 *  Copyright 2025 Collate.
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *  http://www.apache.org/licenses/LICENSE-2.0
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */
import { cx } from '@/utils/cx';
import type { HTMLAttributes, ReactNode } from 'react';
import { createContext, forwardRef, useContext, useMemo } from 'react';

// ─── Types ─────────────────────────────────────────────────────────────────────

/**
 * `default` keeps a 16px horizontal gutter; `compact` uses a uniform 8px
 * gutter and is meant for pages whose header is a full-bleed shell. The
 * variant lives in context so `PageLayout.Content` picks the matching gutter
 * without the caller repeating it.
 */
export type PageLayoutVariant = 'default' | 'compact';

/** A pixel number (`230` → `230px`) or any CSS length string (`'16rem'`). */
export type PanelSize = number | string;

const DEFAULT_LEFT_PANEL_WIDTH = 230;
const DEFAULT_RIGHT_PANEL_WIDTH = 284;

const toCssSize = (value: PanelSize): string =>
  typeof value === 'number' ? `${value}px` : value;

// ─── Context ───────────────────────────────────────────────────────────────────

interface PageLayoutContextValue {
  variant: PageLayoutVariant;
}

const PageLayoutContext = createContext<PageLayoutContextValue>({
  variant: 'default',
});

const usePageLayoutContext = () => useContext(PageLayoutContext);

const GUTTER_CLASS: Record<PageLayoutVariant, string> = {
  default: 'tw:px-4',
  compact: 'tw:p-2',
};

// ─── Root ──────────────────────────────────────────────────────────────────────

export interface PageLayoutProps extends HTMLAttributes<HTMLDivElement> {
  /** Gutter density applied to `PageLayout.Content`. */
  variant?: PageLayoutVariant;
  /**
   * Fill the parent's height (the default — the app shell wants a full-height
   * page). Set `false` for content that should grow with its children.
   */
  fullHeight?: boolean;
  children?: ReactNode;
}

/**
 * Page scaffold: an optional full-width header on top of a
 * left-panel / content / right-panel row. Regions are placed with CSS grid
 * areas, so children may appear in any order and an absent region collapses
 * to zero width — no width math, no `wrap={false}`, no Ant Design.
 *
 * @example
 * <PageLayout variant="compact">
 *   <PageLayout.Header>{toolbar}</PageLayout.Header>
 *   <PageLayout.LeftPanel aria-label={t('label.navigation')}>{nav}</PageLayout.LeftPanel>
 *   <PageLayout.Content>{page}</PageLayout.Content>
 *   <PageLayout.RightPanel aria-label={t('label.detail-plural')}>{aside}</PageLayout.RightPanel>
 * </PageLayout>
 */
const PageLayoutRoot = forwardRef<HTMLDivElement, PageLayoutProps>(
  function PageLayout(
    { variant = 'default', fullHeight = true, className, children, ...props },
    ref
  ) {
    const contextValue = useMemo(() => ({ variant }), [variant]);

    return (
      <PageLayoutContext.Provider value={contextValue}>
        <div
          ref={ref}
          {...props}
          className={cx(
            'tw:grid tw:w-full tw:overflow-hidden',
            fullHeight ? 'tw:h-full' : 'tw:min-h-0',
            className
          )}
          data-testid="page-layout"
          data-variant={variant}
          style={{
            gridTemplateColumns: 'auto minmax(0, 1fr) auto',
            gridTemplateRows: 'auto minmax(0, 1fr)',
            gridTemplateAreas: '"header header header" "left content right"',
            ...props.style,
          }}>
          {children}
        </div>
      </PageLayoutContext.Provider>
    );
  }
);

// ─── Header ────────────────────────────────────────────────────────────────────

export interface PageLayoutHeaderProps
  extends HTMLAttributes<HTMLElement> {
  children?: ReactNode;
}

const PageLayoutHeader = ({
  className,
  children,
  style,
  ...props
}: PageLayoutHeaderProps) => (
  <header
    {...props}
    className={cx('tw:min-w-0', className)}
    style={{ gridArea: 'header', ...style }}>
    {children}
  </header>
);
PageLayoutHeader.displayName = 'PageLayout.Header';

// ─── Side panels ───────────────────────────────────────────────────────────────

type PanelSide = 'left' | 'right';

export interface PageLayoutPanelProps extends HTMLAttributes<HTMLElement> {
  /** Panel width — px number or CSS length. */
  width?: PanelSize;
  /** Draw the divider between the panel and the content. Default `true`. */
  bordered?: boolean;
  /**
   * Accessible name for this complementary landmark. Every panel is an
   * `<aside>`; a name lets assistive tech tell two panels apart. Provide one
   * unless an `aria-labelledby` is supplied instead.
   */
  'aria-label'?: string;
  children?: ReactNode;
}

const PANEL_BORDER_CLASS: Record<PanelSide, string> = {
  left: 'tw:border-r tw:border-secondary',
  right: 'tw:border-l tw:border-secondary',
};

const createPanel = (side: PanelSide, defaultWidth: number) => {
  const Panel = ({
    width = defaultWidth,
    bordered = true,
    className,
    children,
    style,
    ...props
  }: PageLayoutPanelProps) => (
    <aside
      {...props}
      className={cx(
        'tw:h-full tw:min-w-0 tw:max-w-full tw:shrink-0 tw:overflow-y-auto',
        bordered && PANEL_BORDER_CLASS[side],
        className
      )}
      style={{ gridArea: side, width: toCssSize(width), ...style }}>
      {children}
    </aside>
  );
  Panel.displayName = side === 'left' ? 'PageLayout.LeftPanel' : 'PageLayout.RightPanel';

  return Panel;
};

const PageLayoutLeftPanel = createPanel('left', DEFAULT_LEFT_PANEL_WIDTH);
const PageLayoutRightPanel = createPanel('right', DEFAULT_RIGHT_PANEL_WIDTH);

// ─── Content ───────────────────────────────────────────────────────────────────

export interface PageLayoutContentProps
  extends HTMLAttributes<HTMLElement> {
  /** Center the content and cap it at `maxWidth`. */
  center?: boolean;
  /** Max content width when `center` is set. Default `1200px`. */
  maxWidth?: PanelSize;
  children?: ReactNode;
}

const PageLayoutContent = ({
  center = false,
  maxWidth = 1200,
  className,
  children,
  style,
  ...props
}: PageLayoutContentProps) => {
  const { variant } = usePageLayoutContext();

  return (
    <main
      {...props}
      className={cx(
        'tw:h-full tw:min-w-0 tw:overflow-y-auto',
        GUTTER_CLASS[variant],
        className
      )}
      style={{ gridArea: 'content', ...style }}>
      {center ? (
        <div
          className="tw:mx-auto tw:w-full"
          style={{ maxWidth: toCssSize(maxWidth) }}>
          {children}
        </div>
      ) : (
        children
      )}
    </main>
  );
};
PageLayoutContent.displayName = 'PageLayout.Content';

// ─── Compound export ────────────────────────────────────────────────────────────

type PageLayoutComponent = typeof PageLayoutRoot & {
  Header: typeof PageLayoutHeader;
  LeftPanel: typeof PageLayoutLeftPanel;
  Content: typeof PageLayoutContent;
  RightPanel: typeof PageLayoutRightPanel;
};

export const PageLayout = PageLayoutRoot as PageLayoutComponent;
PageLayout.Header = PageLayoutHeader;
PageLayout.LeftPanel = PageLayoutLeftPanel;
PageLayout.Content = PageLayoutContent;
PageLayout.RightPanel = PageLayoutRightPanel;
