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

import type { BreadcrumbItemType } from '@openmetadata/ui-core-components';
import type { FC } from 'react';
import { ENTITY_TYPE_ICON_URL_MAP } from '../components/OntologyExplorer/utils/entityIconUrls';
import { EntityType } from '../enums/entity.enum';
import type { SearchSourceAlias } from '../interface/search.interface';
import {
  getBreadcrumbEntityTypeFromHref,
  getEntityBreadcrumbs,
  isServiceBreadcrumbHref,
} from './EntityBreadcrumbPureUtils';
import { getEntityName } from './EntityNameUtils';
import serviceUtilClassBase from './ServiceUtilClassBase';

type BreadcrumbIconFC = FC<{ className?: string }>;

const getBreadcrumbHref = (url: string | { pathname?: string }): string =>
  typeof url === 'string' ? url : url.pathname ?? '';

// Build stable module-level icon FCs for every entity type that has an icon
// URL so React reconciles in place rather than remounting on every render.
const ENTITY_BREADCRUMB_ICONS: Partial<Record<string, BreadcrumbIconFC>> =
  Object.fromEntries(
    Object.entries(ENTITY_TYPE_ICON_URL_MAP).map(([entityType, iconUrl]) => {
      const Icon: BreadcrumbIconFC = ({ className }) => (
        <img alt={entityType} className={className} src={iconUrl} />
      );
      Icon.displayName = `${entityType}BreadcrumbIcon`;

      return [entityType, Icon];
    })
  );

export const getEntityBreadcrumbItems = (
  source: SearchSourceAlias
): BreadcrumbItemType[] => {
  const entityType = source.entityType as EntityType;
  const breadcrumbs = getEntityBreadcrumbs(source, entityType, false);

  // Identify the service crumb by href shape rather than index so category
  // crumbs (e.g. /settings/services/databaseServices) are skipped.
  const serviceBreadcrumbIndex = breadcrumbs.findIndex((b) =>
    isServiceBreadcrumbHref(getBreadcrumbHref(b.url))
  );

  // Service icon is dynamic (Snowflake, BigQuery…) resolved from the source's
  // serviceType. Created inline since it changes with the source.
  const serviceLogoUrl =
    serviceBreadcrumbIndex >= 0
      ? serviceUtilClassBase.getServiceTypeLogo(source)
      : undefined;

  const ServiceBreadcrumbIcon: BreadcrumbIconFC | undefined = serviceLogoUrl
    ? ({ className }) => (
        <img alt="service-icon" className={className} src={serviceLogoUrl} />
      )
    : undefined;

  return breadcrumbs.map((b, index) => {
    const href = getBreadcrumbHref(b.url);
    const breadcrumbEntityType = getBreadcrumbEntityTypeFromHref(href);

    return {
      id: b.name,
      label: getEntityName(b),
      href,
      icon:
        index === serviceBreadcrumbIndex
          ? ServiceBreadcrumbIcon
          : ENTITY_BREADCRUMB_ICONS[breadcrumbEntityType ?? ''],
    };
  });
};
