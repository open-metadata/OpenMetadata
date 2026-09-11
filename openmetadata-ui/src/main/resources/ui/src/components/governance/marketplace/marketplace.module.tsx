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

import { lazy } from 'react';
import { ReactComponent as DarActiveIcon } from '../../../assets/svg/dar-active.svg';
import { ReactComponent as DarIcon } from '../../../assets/svg/dar-default.svg';
import { ReactComponent as DataProductsActiveIcon } from '../../../assets/svg/data-products-active.svg';
import { ReactComponent as DataProductsIcon } from '../../../assets/svg/data-products-default.svg';
import { ReactComponent as DomainsActiveIcon } from '../../../assets/svg/domains-active.svg';
import { ReactComponent as DomainsIcon } from '../../../assets/svg/domains-default.svg';
import { ReactComponent as MarketplaceActiveIcon } from '../../../assets/svg/marketplace-active.svg';
import { ReactComponent as MarketplaceIcon } from '../../../assets/svg/marketplace-default.svg';
import { ReactComponent as OverviewActiveIcon } from '../../../assets/svg/overview-active.svg';
import { ReactComponent as OverviewIcon } from '../../../assets/svg/overview-default.svg';
import { ROUTES } from '../../../constants/constants';
import { ResourceEntity } from '../../../context/PermissionProvider/PermissionProvider.interface';
import withSuspenseFallback from '../../AppRouter/withSuspenseFallback';
import { AppModule } from '../../platform/ai-shell/AppModule.types';
import { LiveRefreshBoundary } from '../../platform/ai-shell/LiveRefreshBoundary/LiveRefreshBoundary';
import { PermissionedLiveRoute } from '../../platform/ai-shell/PermissionedLiveRoute/PermissionedLiveRoute';
import { RoutePosition } from '../../Settings/Applications/plugins/AppPlugin';

const MarketplaceOverviewPage = withSuspenseFallback(
  lazy(() => import('./MarketplaceOverviewPage/MarketplaceOverviewPage'))
);

const MarketplaceDomainsPage = withSuspenseFallback(
  lazy(() => import('./MarketplaceDomainsPage/MarketplaceDomainsPage'))
);

const MarketplaceDataProductsPage = withSuspenseFallback(
  lazy(
    () => import('./MarketplaceDataProductsPage/MarketplaceDataProductsPage')
  )
);

/**
 * Marketplace module — mirrors the classic "Data Marketplace" left-sidebar
 * section (Overview, Domains, Data Products, Data Access Requests).
 *
 * The Domains and Data Products list pages are wired as app-mode routes so they
 * keep-alive and live-refresh on a domain/dataProduct change. The remaining
 * targets (Overview's data-access sub-route and every detail route) stay
 * canonical paths handled by the default router catch-all.
 */
export const marketplaceModule: AppModule = {
  id: 'marketplace',
  navOrder: 70,
  labelKey: 'label.data-marketplace',
  icon: MarketplaceIcon,
  activeIcon: MarketplaceActiveIcon,
  prefix: ROUTES.DATA_MARKETPLACE,
  additionalPrefixes: [ROUTES.DOMAIN, ROUTES.DATA_PRODUCT],
  defaultPath: ROUTES.DATA_MARKETPLACE,
  routes: [
    {
      // Marketplace overview — the header is swapped for the shared HeaderShell
      // page header in AI mode. Exact path so it overrides the catch-all for the
      // overview only, leaving the data-access sub-route untouched.
      path: ROUTES.DATA_MARKETPLACE,
      element: <MarketplaceOverviewPage />,
      position: RoutePosition.APP,
    },
    {
      // Domains list — keep-alive + live-refresh on domain change. Detail routes
      // (/domain/:fqn…) stay with the default DomainRouter via the catch-all.
      path: ROUTES.DOMAIN,
      element: (
        <PermissionedLiveRoute resource={ResourceEntity.DOMAIN}>
          <MarketplaceDomainsPage />
        </PermissionedLiveRoute>
      ),
      position: RoutePosition.APP,
    },
    {
      // Data Products list — keep-alive + live-refresh on dataProduct change. The
      // default route mounts this page with no permission gate, so we match that
      // (no PermissionedLiveRoute).
      path: ROUTES.DATA_PRODUCT,
      element: (
        <LiveRefreshBoundary>
          <MarketplaceDataProductsPage />
        </LiveRefreshBoundary>
      ),
      position: RoutePosition.APP,
    },
  ],
  subNav: {
    key: 'marketplace',
    titleKey: 'label.data-marketplace',
    rootPath: ROUTES.DATA_MARKETPLACE,
    sections: [
      {
        items: [
          {
            key: 'overview',
            icon: OverviewIcon,
            activeIcon: OverviewActiveIcon,
            labelKey: 'label.overview',
            path: ROUTES.DATA_MARKETPLACE,
          },
          {
            key: 'domains',
            icon: DomainsIcon,
            activeIcon: DomainsActiveIcon,
            labelKey: 'label.domain-plural',
            path: ROUTES.DOMAIN,
          },
          {
            key: 'data-products',
            icon: DataProductsIcon,
            activeIcon: DataProductsActiveIcon,
            labelKey: 'label.data-product-plural',
            path: ROUTES.DATA_PRODUCT,
          },
          {
            key: 'data-access-requests',
            icon: DarIcon,
            activeIcon: DarActiveIcon,
            labelKey: 'label.data-access-request-plural',
            path: ROUTES.DATA_MARKETPLACE_DATA_ACCESS_REQUESTS,
          },
        ],
      },
    ],
  },
};
