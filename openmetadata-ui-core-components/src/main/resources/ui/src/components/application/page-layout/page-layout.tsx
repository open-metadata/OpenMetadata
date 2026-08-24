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
import { createContext, forwardRef, useContext, useMemo } from 'react';
import { DocumentTitle } from '../../common/document-title/document-title';
import { PageHeader } from '../page-header/page-header';
import type { PageHeaderProps } from '../page-header/page-header';
import type {
  PageLayoutContentProps,
  PageLayoutHeaderProps,
  PageLayoutPanelProps,
  PageLayoutProps,
  PageLayoutScroll,
  PanelSize,
} from './page-layout.types';

export type {
  PageLayoutContentProps,
  PageLayoutHeaderProps,
  PageLayoutPanelProps,
  PageLayoutProps,
  PageLayoutScroll,
  PanelSize,
} from './page-layout.types';

const DEFAULT_LEFT_PANEL_WIDTH = 230;
const DEFAULT_RIGHT_PANEL_WIDTH = 284;

const toCssSize = (value: PanelSize): string =>
  typeof value === 'number' ? `${value}px` : value;

// ─── Context ───────────────────────────────────────────────────────────────────

interface PageLayoutContextValue {
  scroll: PageLayoutScroll;
}

const PageLayoutContext = createContext<PageLayoutContextValue>({
  scroll: 'content',
});

const usePageLayoutContext = () => useContext(PageLayoutContext);

/**
 * In `content` mode each scroll region owns its overflow; in `page` mode the
 * region grows with its children and the root scrolls instead.
 */
const REGION_SCROLL_CLASS: Record<PageLayoutScroll, string> = {
  content: 'tw:h-full tw:overflow-y-auto',
  page: '',
};

// ─── Root ──────────────────────────────────────────────────────────────────────

/**
 * Page scaffold: an optional full-width header on top of a
 * left-panel / content / right-panel row. Regions are placed with CSS grid
 * areas, so children may appear in any order and an absent region collapses
 * to zero width — no width math, no `wrap={false}`, no Ant Design.
 *
 * @example
 * <PageLayout pageTitle="Explore" scroll="page">
 *   <PageLayout.Header>{toolbar}</PageLayout.Header>
 *   <PageLayout.LeftPanel aria-label={navLabel}>{nav}</PageLayout.LeftPanel>
 *   <PageLayout.Content>{page}</PageLayout.Content>
 *   <PageLayout.RightPanel aria-label={detailLabel}>{aside}</PageLayout.RightPanel>
 * </PageLayout>
 */
const PageLayoutRoot = forwardRef<HTMLDivElement, PageLayoutProps>(
  function PageLayout(
    {
      scroll = 'content',
      pageTitle,
      fullHeight = true,
      className,
      children,
      ...props
    },
    ref
  ) {
    const contextValue = useMemo(() => ({ scroll }), [scroll]);

    return (
      <PageLayoutContext.Provider value={contextValue}>
        {pageTitle ? <DocumentTitle title={pageTitle} /> : null}
        <div
          ref={ref}
          {...props}
          className={cx(
            'tw:grid tw:w-full tw:p-2',
            scroll === 'page' ? 'tw:overflow-y-auto' : 'tw:overflow-hidden',
            fullHeight ? 'tw:h-full' : 'tw:min-h-0',
            className
          )}
          data-scroll={scroll}
          data-testid="page-layout"
          style={{
            gridTemplateColumns: 'auto minmax(0, 1fr) auto',
            gridTemplateRows:
              scroll === 'page' ? 'auto auto' : 'auto minmax(0, 1fr)',
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

// ─── PageHeader convenience ──────────────────────────────────────────────────────

/**
 * Convenience compound: renders a `PageHeader` inside the layout's `header`
 * grid-area. Use it for the standard rich header (breadcrumb / title / actions);
 * reach for the bare `PageLayout.Header` slot when the header is fully custom.
 */
const PageLayoutPageHeader = (props: PageHeaderProps) => (
  <PageLayoutHeader>
    <PageHeader {...props} />
  </PageLayoutHeader>
);
PageLayoutPageHeader.displayName = 'PageLayout.PageHeader';

// ─── Side panels ───────────────────────────────────────────────────────────────

type PanelSide = 'left' | 'right';

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
  }: PageLayoutPanelProps) => {
    const { scroll } = usePageLayoutContext();

    return (
      <aside
        {...props}
        className={cx(
          'tw:min-w-0 tw:max-w-full tw:shrink-0',
          REGION_SCROLL_CLASS[scroll],
          bordered && PANEL_BORDER_CLASS[side],
          className
        )}
        style={{ gridArea: side, width: toCssSize(width), ...style }}>
        {children}
      </aside>
    );
  };
  Panel.displayName =
    side === 'left' ? 'PageLayout.LeftPanel' : 'PageLayout.RightPanel';

  return Panel;
};

const PageLayoutLeftPanel = createPanel('left', DEFAULT_LEFT_PANEL_WIDTH);
const PageLayoutRightPanel = createPanel('right', DEFAULT_RIGHT_PANEL_WIDTH);

// ─── Content ───────────────────────────────────────────────────────────────────

const PageLayoutContent = ({
  center = false,
  maxWidth = 1200,
  className,
  children,
  style,
  ...props
}: PageLayoutContentProps) => {
  const { scroll } = usePageLayoutContext();

  return (
    <main
      {...props}
      className={cx(
        'tw:min-w-0 tw:p-2',
        REGION_SCROLL_CLASS[scroll],
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
  PageHeader: typeof PageLayoutPageHeader;
  LeftPanel: typeof PageLayoutLeftPanel;
  Content: typeof PageLayoutContent;
  RightPanel: typeof PageLayoutRightPanel;
};

export const PageLayout = PageLayoutRoot as PageLayoutComponent;
PageLayout.Header = PageLayoutHeader;
PageLayout.PageHeader = PageLayoutPageHeader;
PageLayout.LeftPanel = PageLayoutLeftPanel;
PageLayout.Content = PageLayoutContent;
PageLayout.RightPanel = PageLayoutRightPanel;
