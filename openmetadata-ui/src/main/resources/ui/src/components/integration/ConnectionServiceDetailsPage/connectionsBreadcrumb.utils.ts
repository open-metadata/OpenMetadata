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
import { BreadcrumbItemType } from '@openmetadata/ui-core-components';
import { TFunction } from 'i18next';
import { FC } from 'react';
import { ReactComponent as ConnectionsIcon } from '../../../assets/svg/ask-collate-nav-bar/connections-default.svg';
import {
  CATEGORY_CONFIGS,
  CATEGORY_PARAM,
  ConnectionsServiceCategory,
} from '../ConnectionsPage/ConnectionsPage.constants';

// The Connections listing's own route. Inlined rather than imported from a shared route-constants
// module because that module (CONNECTIONS_ROUTES, owned by the connections app-mode module) is
// registered by a later migration step; this value must match it exactly once that module lands.
const CONNECTIONS_ROUTE = '/connections';

/**
 * Icon-only module crumb that heads the connection service detail breadcrumb,
 * mirroring the Observability / AI dashboard pattern: the module icon replaces
 * the generic home crumb and links back to the Connections listing.
 */
export const getConnectionsRootBreadcrumb = (
  t: TFunction
): Omit<BreadcrumbItemType, 'id'> => ({
  label: null,
  ariaLabel: t('label.connection-plural'),
  icon: ConnectionsIcon as FC<{ className?: string }>,
  href: CONNECTIONS_ROUTE,
});

/**
 * The service's category, linking back to its tab on the Connections listing.
 *
 * Replaces a crumb that showed the connector ("Mysql") and went nowhere. A breadcrumb's job is to
 * walk back up the hierarchy, and the level above a service is its category — which is also a real
 * destination, since the listing tabs by exactly this. Returns null for a category the listing does
 * not tab (llm/mcp services), so the crumb is dropped rather than pointing at a tab that isn't there.
 */
export const getServiceCategoryBreadcrumb = (
  t: TFunction,
  serviceCategory?: string
): Omit<BreadcrumbItemType, 'id'> | null => {
  const config = CATEGORY_CONFIGS.find(
    (category) =>
      category.key === (serviceCategory as ConnectionsServiceCategory)
  );

  const label = config ? String(t(config.titleKey)) : '';

  return config
    ? {
        label,
        ariaLabel: label,
        href: `${CONNECTIONS_ROUTE}?${CATEGORY_PARAM}=${config.key}`,
      }
    : null;
};
