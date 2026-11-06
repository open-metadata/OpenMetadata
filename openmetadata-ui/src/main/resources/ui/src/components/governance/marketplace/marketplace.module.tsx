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
  DataProduct,
  DataProductFilled,
  DomainsFilled,
  Globe01,
  Grid01,
  GridFilled,
  Marketplace,
  MarketplaceFilled,
} from '@openmetadata/ui-core-components/icons';
import { lazy } from 'react';
import { ROUTES } from '../../../constants/constants';
import { ResourceEntity } from '../../../enums/permissions.enum';
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
 * section (Overview, Domains, Data Products).
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
  icon: Marketplace,
  activeIcon: MarketplaceFilled,
  prefix: ROUTES.DATA_MARKETPLACE,
  additionalPrefixes: [ROUTES.DOMAIN, ROUTES.DATA_PRODUCT],
  defaultPath: ROUTES.DATA_MARKETPLACE,
  routes: [
    {
      // Marketplace overview — the header is swapped for the shared PageHeader
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
            icon: Grid01,
            activeIcon: GridFilled,
            labelKey: 'label.overview',
            path: ROUTES.DATA_MARKETPLACE,
          },
          {
            key: 'domains',
            icon: Globe01,
            activeIcon: DomainsFilled,
            labelKey: 'label.domain-plural',
            path: ROUTES.DOMAIN,
          },
          {
            key: 'data-products',
            icon: DataProduct,
            activeIcon: DataProductFilled,
            labelKey: 'label.data-product-plural',
            path: ROUTES.DATA_PRODUCT,
          },
        ],
      },
    ],
  },
};
