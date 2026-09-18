/*
 *  Copyright 2026 Collate.
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
import { isReactComponent } from '@/utils/is-react-component';
import {
  ChevronLeftDouble,
  ChevronRightDouble,
  LayoutLeft,
} from '@untitledui/icons';
import type { FC, ReactNode } from 'react';
import {
  createContext,
  forwardRef,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from 'react';
import { DocumentTitle } from '../../common/document-title/document-title';
import type {
  PageShellLabels,
  PageShellNavColumnProps,
  PageShellNavItemProps,
  PageShellProps,
  PageShellRegionProps,
  SubNavState,
} from './page-shell.types';

export type {
  PageShellLabels,
  PageShellNavColumnProps,
  PageShellNavItemProps,
  PageShellProps,
  PageShellRegionProps,
  SubNavState,
} from './page-shell.types';

const DEFAULT_NAV_WIDTH = 180;
const DEFAULT_RAIL_WIDTH = 44;

/**
 * Shell spacing. The values nest outside-in — each is the gap between one
 * region's edge and the next region inside it:
 *
 *   viewport padding                6
 *   nav ↔ canvas seam               8
 *   canvas padding                  8
 *   canvas header inset        16 / 20
 *   canvas header ↔ body gap       16
 */
const SPACING = {
  viewport: 'tw:p-1.5',
  shellGap: 'tw:gap-2',
  canvas: 'tw:p-2',
  canvasHeader: 'tw:px-5 tw:py-4',
  canvasGap: 'tw:gap-4',
} as const;

/**
 * Region edges are outlines, not borders. These containers are not focusable,
 * so their outline is free, and an outline costs no layout — a border sits
 * inside the box and would add itself to every region's padding.
 */
const EDGE = 'tw:outline-[0.25px] tw:-outline-offset-[0.25px]';

const TRANSITION = 'tw:transition-all tw:duration-200 tw:ease-out';

// ─── Context ───────────────────────────────────────────────────────────────────

interface PageShellContextValue {
  labels: PageShellLabels;
  isMainNavCollapsed: boolean;
  subNav: SubNavState;
  navWidth: number;
  railWidth: number;
  toggleMainNav: () => void;
  toggleSubNavWidth: () => void;
  toggleSubNavVisibility: () => void;
}

const PageShellContext = createContext<PageShellContextValue | null>(null);

const usePageShell = (component: string): PageShellContextValue => {
  const context = useContext(PageShellContext);

  if (!context) {
    throw new Error(`${component} must be rendered inside a PageShell`);
  }

  return context;
};

/**
 * Which column an item sits in, so it can drop its label when that column is a
 * rail. Scoped per column because the main nav and the sub nav collapse
 * independently.
 */
const PageShellColumnContext = createContext<{ isCollapsed: boolean }>({
  isCollapsed: false,
});

// ─── State ─────────────────────────────────────────────────────────────────────

/** Controlled when a value is supplied, self-managed otherwise. */
const useSemiControlled = <T,>(
  controlled: T | undefined,
  fallback: T,
  onChange?: (value: T) => void
) => {
  const [uncontrolled, setUncontrolled] = useState(fallback);
  const isControlled = controlled !== undefined;
  const value = isControlled ? controlled : uncontrolled;

  const setValue = useCallback(
    (next: T) => {
      if (!isControlled) {
        setUncontrolled(next);
      }
      onChange?.(next);
    },
    [isControlled, onChange]
  );

  return [value, setValue] as const;
};

// ─── Controls ──────────────────────────────────────────────────────────────────

const NAV_BUTTON = cx(
  'tw:flex tw:h-10 tw:w-full tw:shrink-0 tw:items-center tw:justify-center tw:px-3',
  'tw:text-tertiary tw:transition-colors tw:duration-200',
  'tw:hover:bg-shell-nav-item_hover tw:hover:text-secondary',
  'tw:focus-visible:outline-2 tw:focus-visible:-outline-offset-2 tw:focus-visible:outline-shell-accent'
);

/**
 * The chevron points the way the column will move, so the icon names the
 * action rather than the current state.
 */
const CollapseToggle = ({
  isExpanded,
  label,
  isFocusable = true,
  onPress,
}: {
  isExpanded: boolean;
  label: string;
  isFocusable?: boolean;
  onPress: () => void;
}) => {
  const Icon = isExpanded ? ChevronLeftDouble : ChevronRightDouble;

  return (
    <button
      aria-expanded={isExpanded}
      aria-label={label}
      className={cx(NAV_BUTTON, 'tw:border-b tw:border-shell-nav')}
      tabIndex={isFocusable ? undefined : -1}
      type="button"
      onClick={onPress}>
      <Icon aria-hidden className="tw:size-4" />
    </button>
  );
};

// ─── Root ──────────────────────────────────────────────────────────────────────

/**
 * Application shell: a nav card and a page canvas floating on the viewport
 * ground, each region on its own surface token so the depth hierarchy reads in
 * light and dark without per-theme markup.
 *
 * @example
 * <PageShell labels={shellLabels} pageTitle="Explore">
 *   <PageShell.Nav aria-label={navLabel}>
 *     <PageShell.MainNav>{primaryNav}</PageShell.MainNav>
 *     <PageShell.SubNav>{secondaryNav}</PageShell.SubNav>
 *   </PageShell.Nav>
 *   <PageShell.Canvas>
 *     <PageShell.CanvasHeader>{toolbar}</PageShell.CanvasHeader>
 *     <PageShell.CanvasBody>{page}</PageShell.CanvasBody>
 *   </PageShell.Canvas>
 * </PageShell>
 */
const PageShellRoot = forwardRef<HTMLDivElement, PageShellProps>(
  function PageShell(
    {
      labels,
      pageTitle,
      isMainNavCollapsed: mainNavProp,
      defaultMainNavCollapsed = false,
      onMainNavCollapsedChange,
      subNav: subNavProp,
      defaultSubNav = 'expanded',
      onSubNavChange,
      navWidth = DEFAULT_NAV_WIDTH,
      railWidth = DEFAULT_RAIL_WIDTH,
      className,
      children,
      ...props
    },
    ref
  ) {
    const [isMainNavCollapsed, setMainNavCollapsed] = useSemiControlled(
      mainNavProp,
      defaultMainNavCollapsed,
      onMainNavCollapsedChange
    );
    const [subNav, setSubNav] = useSemiControlled(
      subNavProp,
      defaultSubNav,
      onSubNavChange
    );

    // Restoring the sub nav returns it to the width it had when hidden, rather
    // than always snapping back to expanded.
    const lastVisibleSubNav = useRef<SubNavState>(
      defaultSubNav === 'hidden' ? 'expanded' : defaultSubNav
    );

    const contextValue = useMemo<PageShellContextValue>(() => {
      const toggleSubNavWidth = () => {
        const next = subNav === 'expanded' ? 'collapsed' : 'expanded';
        lastVisibleSubNav.current = next;
        setSubNav(next);
      };

      const toggleSubNavVisibility = () => {
        if (subNav === 'hidden') {
          setSubNav(lastVisibleSubNav.current);

          return;
        }
        lastVisibleSubNav.current = subNav;
        setSubNav('hidden');
      };

      return {
        labels,
        isMainNavCollapsed,
        subNav,
        navWidth,
        railWidth,
        toggleMainNav: () => setMainNavCollapsed(!isMainNavCollapsed),
        toggleSubNavWidth,
        toggleSubNavVisibility,
      };
    }, [
      labels,
      isMainNavCollapsed,
      subNav,
      navWidth,
      railWidth,
      setMainNavCollapsed,
      setSubNav,
    ]);

    return (
      <PageShellContext.Provider value={contextValue}>
        {pageTitle ? <DocumentTitle title={pageTitle} /> : null}
        <div
          ref={ref}
          {...props}
          className={cx(
            'tw:flex tw:h-full tw:w-full tw:overflow-hidden',
            'tw:bg-shell-page tw:transition-colors tw:duration-300',
            SPACING.viewport,
            SPACING.shellGap,
            className
          )}
          data-region="viewport">
          {children}
        </div>
      </PageShellContext.Provider>
    );
  }
);

// ─── Nav card ──────────────────────────────────────────────────────────────────

/**
 * The lifted card holding both nav columns. It is the surface the main nav
 * insets itself from, which is what separates the two columns visually.
 */
const PageShellNav = ({
  className,
  children,
  ...props
}: PageShellRegionProps) => (
  <aside
    {...props}
    className={cx(
      'tw:flex tw:shrink-0 tw:flex-row tw:overflow-hidden tw:rounded-2xl',
      'tw:bg-shell-nav-card tw:transition-colors tw:duration-300',
      EDGE,
      'tw:outline-shell-nav',
      className
    )}
    data-region="nav">
    {children}
  </aside>
);
PageShellNav.displayName = 'PageShell.Nav';

// ─── Main nav ──────────────────────────────────────────────────────────────────

const PageShellMainNav = ({
  footer,
  className,
  children,
  ...props
}: PageShellNavColumnProps) => {
  const {
    labels,
    isMainNavCollapsed,
    navWidth,
    railWidth,
    subNav,
    toggleMainNav,
    toggleSubNavVisibility,
  } = usePageShell('PageShell.MainNav');
  const isSubNavVisible = subNav !== 'hidden';
  const mainNavColumn = useMemo(
    () => ({ isCollapsed: isMainNavCollapsed }),
    [isMainNavCollapsed]
  );

  return (
    <div className="tw:flex tw:h-full tw:flex-col tw:p-1">
      <div
        {...props}
        className={cx(
          'tw:flex tw:h-full tw:flex-col tw:overflow-hidden tw:rounded-xl',
          'tw:bg-shell-nav tw:transition-colors tw:duration-300',
          TRANSITION,
          className
        )}
        data-region="main-nav"
        style={{ width: isMainNavCollapsed ? railWidth : navWidth }}>
        <CollapseToggle
          isExpanded={!isMainNavCollapsed}
          label={
            isMainNavCollapsed ? labels.expandMainNav : labels.collapseMainNav
          }
          onPress={toggleMainNav}
        />
        <PageShellColumnContext.Provider value={mainNavColumn}>
          <div className="tw:min-h-0 tw:flex-1 tw:overflow-x-hidden tw:overflow-y-auto">
            {children}
          </div>
        </PageShellColumnContext.Provider>
        {footer ?? (
          <button
            aria-label={isSubNavVisible ? labels.hideSubNav : labels.showSubNav}
            aria-pressed={isSubNavVisible}
            className={cx(
              NAV_BUTTON,
              'tw:mt-auto tw:border-t tw:border-shell-nav',
              isSubNavVisible && 'tw:text-brand-secondary'
            )}
            type="button"
            onClick={toggleSubNavVisibility}>
            <LayoutLeft aria-hidden className="tw:size-4" />
          </button>
        )}
      </div>
    </div>
  );
};
PageShellMainNav.displayName = 'PageShell.MainNav';

// ─── Sub nav ───────────────────────────────────────────────────────────────────

/**
 * Stays mounted in every state and animates its own width, so `hidden` is a
 * transition rather than an unmount. While hidden it is taken out of the tab
 * order and hidden from assistive tech — a zero-width column is still
 * focusable otherwise, which strands keyboard users in an invisible region.
 */
const PageShellSubNav = ({
  className,
  children,
  ...props
}: PageShellRegionProps) => {
  const { labels, subNav, navWidth, railWidth, toggleSubNavWidth } =
    usePageShell('PageShell.SubNav');
  const isHidden = subNav === 'hidden';
  const isExpanded = subNav === 'expanded';
  const width = isHidden ? 0 : isExpanded ? navWidth : railWidth;
  const subNavColumn = useMemo(
    () => ({ isCollapsed: !isExpanded }),
    [isExpanded]
  );

  return (
    <div
      {...props}
      aria-hidden={isHidden}
      className={cx(
        'tw:flex tw:h-full tw:shrink-0 tw:flex-col tw:overflow-hidden',
        TRANSITION,
        className
      )}
      data-region="sub-nav"
      data-state={subNav}
      style={{ width }}>
      <CollapseToggle
        isExpanded={isExpanded}
        isFocusable={!isHidden}
        label={isExpanded ? labels.collapseSubNav : labels.expandSubNav}
        onPress={toggleSubNavWidth}
      />
      <PageShellColumnContext.Provider value={subNavColumn}>
        <div className="tw:min-h-0 tw:flex-1 tw:overflow-x-hidden tw:overflow-y-auto">
          {children}
        </div>
      </PageShellColumnContext.Provider>
    </div>
  );
};
PageShellSubNav.displayName = 'PageShell.SubNav';

// ─── Nav item ──────────────────────────────────────────────────────────────────

/**
 * A nav row that becomes icon-only when its column collapses. The label is
 * removed from the layout rather than truncated — a 44px rail cannot show
 * enough of a word to be worth reading — and stays the item's accessible name,
 * with a native tooltip so a rail is still identifiable by pointer.
 */
const PageShellNavItem = ({
  icon,
  label,
  isActive = false,
  href,
  className,
  ...props
}: PageShellNavItemProps) => {
  const { isCollapsed } = useContext(PageShellColumnContext);
  const IconComponent = isReactComponent(icon)
    ? (icon as FC<{ className?: string }>)
    : null;
  const iconNode = IconComponent ? (
    <IconComponent className="tw:size-4" />
  ) : (
    (icon as ReactNode)
  );

  const content = (
    <>
      <span
        aria-hidden
        className="tw:flex tw:size-5 tw:shrink-0 tw:items-center tw:justify-center">
        {iconNode}
      </span>
      {!isCollapsed && <span className="tw:truncate">{label}</span>}
    </>
  );

  const shared = {
    'aria-current': isActive ? ('page' as const) : undefined,
    // The label leaves the layout when collapsed, so it has to come back as the
    // accessible name — and as a tooltip, so a rail stays identifiable.
    'aria-label': isCollapsed ? label : undefined,
    className: cx(
      'tw:flex tw:h-9 tw:w-full tw:shrink-0 tw:items-center tw:gap-2 tw:rounded-md',
      'tw:text-sm tw:transition-colors tw:duration-200',
      'tw:focus-visible:outline-2 tw:focus-visible:-outline-offset-2 tw:focus-visible:outline-shell-accent',
      isCollapsed ? 'tw:justify-center tw:px-0' : 'tw:px-2',
      isActive
        ? 'tw:bg-shell-nav-item_active tw:font-medium tw:text-secondary'
        : 'tw:text-tertiary tw:hover:bg-shell-nav-item_hover tw:hover:text-secondary',
      className
    ),
    title: isCollapsed ? label : undefined,
  };

  if (href) {
    return (
      <a {...props} {...shared} href={href}>
        {content}
      </a>
    );
  }

  return (
    <button {...props} {...shared} type="button">
      {content}
    </button>
  );
};
PageShellNavItem.displayName = 'PageShell.NavItem';

// ─── Canvas ────────────────────────────────────────────────────────────────────

const PageShellCanvas = ({
  className,
  children,
  ...props
}: PageShellRegionProps) => (
  <div
    {...props}
    className={cx(
      'tw:flex tw:min-h-0 tw:min-w-0 tw:flex-1 tw:flex-col tw:overflow-hidden tw:rounded-2xl',
      'tw:bg-shell-canvas tw:transition-colors tw:duration-300',
      SPACING.canvas,
      SPACING.canvasGap,
      EDGE,
      'tw:outline-shell-canvas',
      className
    )}
    data-region="canvas">
    {children}
  </div>
);
PageShellCanvas.displayName = 'PageShell.Canvas';

/**
 * `shell-header-tint` layers the light theme's brand gradient over the header
 * surface and is inert in dark, where the header flattens to the body colour.
 */
const PageShellCanvasHeader = ({
  className,
  children,
  ...props
}: PageShellRegionProps) => (
  <div
    {...props}
    className={cx(
      'tw:flex tw:shrink-0 tw:items-center tw:rounded-xl',
      'tw:bg-shell-header tw:transition-all tw:duration-300',
      'shell-header-tint',
      SPACING.canvasHeader,
      EDGE,
      'tw:outline-shell-header',
      className
    )}
    data-region="canvas-header">
    {children}
  </div>
);
PageShellCanvasHeader.displayName = 'PageShell.CanvasHeader';

const PageShellCanvasBody = ({
  className,
  children,
  ...props
}: PageShellRegionProps) => (
  <main
    {...props}
    className={cx(
      'tw:min-h-0 tw:flex-1 tw:overflow-auto tw:rounded-xl',
      'tw:bg-shell-card tw:transition-colors tw:duration-300',
      EDGE,
      'tw:outline-shell-card',
      className
    )}
    data-region="canvas-body">
    {children}
  </main>
);
PageShellCanvasBody.displayName = 'PageShell.CanvasBody';

// ─── Compound export ───────────────────────────────────────────────────────────

type PageShellComponent = typeof PageShellRoot & {
  Nav: typeof PageShellNav;
  MainNav: typeof PageShellMainNav;
  SubNav: typeof PageShellSubNav;
  NavItem: typeof PageShellNavItem;
  Canvas: typeof PageShellCanvas;
  CanvasHeader: typeof PageShellCanvasHeader;
  CanvasBody: typeof PageShellCanvasBody;
};

export const PageShell = PageShellRoot as PageShellComponent;
PageShell.Nav = PageShellNav;
PageShell.MainNav = PageShellMainNav;
PageShell.SubNav = PageShellSubNav;
PageShell.NavItem = PageShellNavItem;
PageShell.Canvas = PageShellCanvas;
PageShell.CanvasHeader = PageShellCanvasHeader;
PageShell.CanvasBody = PageShellCanvasBody;
