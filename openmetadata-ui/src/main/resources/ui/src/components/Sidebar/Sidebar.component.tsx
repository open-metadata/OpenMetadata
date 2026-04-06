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

import {
  NavItemDividerType,
  NavItemType,
  NavList,
} from '@openmetadata/ui-core-components';
import classNames from 'classnames';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useLocation } from 'react-router-dom';
import { getMarketplaceSidebarConfig } from '../../constants/CustomSidebar.constants';
import { useCurrentUserPreferences } from '../../hooks/currentUserStore/useCurrentUserStore';
import { isNewLayoutRoute } from '../../utils/LayoutUtils';
import BrandImage from '../common/BrandImage/BrandImage';
import './app-sidebar.less';

const getActiveUrl = (
  pathname: string,
  items: (NavItemType | NavItemDividerType)[]
): string => {
  const hrefs = items
    .filter((item): item is NavItemType => !('divider' in item && item.divider))
    .map((item) => item.href)
    .filter(Boolean) as string[];

  return (
    hrefs
      .filter((href) => pathname.startsWith(href))
      .sort((a, b) => b.length - a.length)[0] ?? pathname
  );
};

export interface SidebarProps {
  className?: string;
}

const COLLAPSED_WIDTH = 72;
const EXPANDED_WIDTH = 197;

const Sidebar = ({ className }: SidebarProps) => {
  const { t } = useTranslation();
  const { pathname } = useLocation();
  const {
    preferences: { isSidebarCollapsed: collapsed },
  } = useCurrentUserPreferences();

  const config = useMemo(() => getMarketplaceSidebarConfig(t), [t]);

  const allItems = useMemo(
    () => [...config.items, ...(config.bottomItems ?? [])],
    [config]
  );
  const activeUrl = useMemo(
    () => getActiveUrl(pathname, allItems),
    [pathname, allItems]
  );

  if (!isNewLayoutRoute(pathname)) {
    return null;
  }

  return (
    <aside
      className={classNames(
        'tw:flex tw:h-full tw:flex-col tw:bg-[var(--color-bg-secondary)] tw:overflow-hidden',
        'tw:transition-[width] tw:duration-300 tw:ease-in-out',
        className
      )}
      data-testid="app-sidebar"
      style={{ width: collapsed ? COLLAPSED_WIDTH : EXPANDED_WIDTH }}>
      <div
        className={classNames(
          'tw:flex tw:items-center tw:my-5',
          collapsed ? 'tw:justify-center' : 'tw:pl-6'
        )}>
        <Link
          className="flex-shrink-0 tw:bg-transparent"
          id="openmetadata_logo"
          to="/">
          {collapsed ? (
            <BrandImage
              isMonoGram
              className="tw:h-10 tw:w-auto"
              dataTestId="image"
              height={40}
              width="auto"
            />
          ) : (
            <BrandImage
              className="tw:h-10 tw:w-auto"
              dataTestId="image"
              height={40}
              width="auto"
            />
          )}
        </Link>
      </div>

      <div className="app-sidebar-link tw:flex tw:flex-col tw:flex-1 tw:overflow-y-auto">
        <NavList activeUrl={activeUrl} items={config.items} />

        {config.bottomItems && (
          <>
            <div className="tw:flex-1" />
            <NavList
              activeUrl={activeUrl}
              className="tw:pb-4"
              items={config.bottomItems}
            />
          </>
        )}
      </div>
    </aside>
  );
};

export default Sidebar;
