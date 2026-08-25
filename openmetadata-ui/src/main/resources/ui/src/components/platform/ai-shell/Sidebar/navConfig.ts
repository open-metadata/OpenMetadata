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

import { AppModule, IconComponent, SubNavConfig, SubNavItem } from '../AppModule.types';

export { Intent } from '../AppModule.types';
export type {
    IconComponent,
    IntentName,
    SubNavConfig,
    SubNavItem,
    SubNavSection
} from '../AppModule.types';

export type NavAction = { kind: 'navigate'; path: string };

/**
 * Synthetic key for the "More" overflow node in a customized nav. Never a real
 * module id, so it can't collide with one; the customize editor and the
 * runtime split both address the overflow group by this key.
 */
export const MORE_NAV_KEY = 'more';

/** i18n key for the "More" overflow node's label. */
export const MORE_NAV_LABEL_KEY = 'label.more';

/**
 * Destination URL for a nav item. Navigable items render as real anchors
 * (`<a href>`) so cmd/ctrl-click, middle-click, and the native right-click
 * "open in new tab" menu all work.
 */
export const resolveNavHref = (action: NavAction): string | undefined =>
  action.kind === 'navigate' ? action.path : undefined;

export interface MainNavItem {
  key: string;
  icon: IconComponent;
  /** Optional alternate icon for the collapsed Rail (falls back to `icon`) */
  collapsedIcon?: IconComponent;
  /** Icon shown when this item is active */
  activeIcon?: IconComponent;
  /** Icon shown while the collapsed Rail button is hovered */
  hoverIcon?: IconComponent;
  /** Icon shown while the collapsed Rail button is pressed */
  pressedIcon?: IconComponent;
  /** i18n key (e.g. 'label.connection-plural') */
  labelKey: string;
  action: NavAction;
  /** i18n key for a trailing pill badge (e.g. 'label.beta') */
  badgeKey?: string;
  /** Points to a sub-nav config key if this section has a sub-navigation */
  subNav?: string;
}

const moduleToNavItem = (m: AppModule): MainNavItem => {
  if (!m.icon) {
    throw new Error(
      `App module '${m.id}' is surfaced in the sidebar but has no icon`
    );
  }

  return {
    key: m.id,
    icon: m.icon,
    activeIcon: m.activeIcon,
    labelKey: m.labelKey,
    action: { kind: 'navigate', path: m.defaultPath },
    subNav: m.subNav?.key,
  };
};

/**
 * Derive the ordered top-level nav items from the merged module list. Only
 * modules that carry an `icon` are surfaced; the caller passes the list from
 * `useAllAppModules()` (already sorted by `navOrder`).
 */
export const buildMainNavItems = (modules: AppModule[]): MainNavItem[] =>
  modules.filter((m) => Boolean(m.icon)).map(moduleToNavItem);

/**
 * The sub-nav configs owned by the merged module list, keyed by
 * `subNav.key`.
 */
export const buildSubNavs = (
  modules: AppModule[]
): Record<string, SubNavConfig> =>
  Object.fromEntries(
    modules
      .filter(
        (m): m is AppModule & { subNav: SubNavConfig } =>
          m.subNav !== undefined
      )
      .map((m) => [m.subNav.key, m.subNav])
  );

const isPathMatch = (path: string, pathname: string): boolean =>
  pathname === path || pathname.startsWith(`${path}/`);

interface BreadcrumbLocationState {
  breadcrumbData?: Array<{ url?: unknown }>;
}

const getNavigationPathname = (
  pathname: string,
  locationState: unknown
): string => {
  const originUrl = (locationState as BreadcrumbLocationState | null)
    ?.breadcrumbData?.[0]?.url;

  return typeof originUrl === 'string' ? originUrl : pathname;
};

/**
 * Resolves which `SubNavItem.key` (across all sections) should render as
 * active for the given `pathname`, checking each item's `path` and
 * `activePaths`. When multiple items match, the longest matching path wins
 * so a more specific item beats a broader one. Shared by `SubPanel`
 * (expanded) and the collapsed sub-rail so both surfaces stay in lockstep.
 */
export const resolveActiveSubNavKey = (
  sections: SubNavConfig['sections'],
  pathname: string,
  locationState?: unknown
): string | undefined => {
  const navigationPathname = getNavigationPathname(pathname, locationState);
  let activeKey: string | undefined;
  let bestPathLength = -1;

  sections.forEach((section) => {
    section.items.forEach((item: SubNavItem) => {
      const candidatePaths = [item.path, ...(item.activePaths ?? [])].filter(
        (path): path is string => Boolean(path)
      );

      candidatePaths.forEach((path) => {
        if (
          isPathMatch(path, navigationPathname) &&
          path.length > bestPathLength
        ) {
          activeKey = item.key;
          bestPathLength = path.length;
        }
      });
    });
  });

  return activeKey;
};

interface HandleNavItemClickArgs {
  item: MainNavItem;
  navigate: (path: string) => void;
}

/**
 * Click handler for a nav item. Shared by both the expanded sidebar
 * (`MainPanel`) and the collapsed rail so behaviour stays in lockstep. Plain
 * `navigate(path)` — staying in the current app mode keeps the sidebar
 * visible.
 */
export const handleNavItemClick = ({
  item,
  navigate,
}: HandleNavItemClickArgs): void => {
  navigate(item.action.path);
};
