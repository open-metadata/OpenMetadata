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
import classNames from 'classnames';
import type { FC } from 'react';
import type { TitleLink } from '../components/common/TitleBreadcrumb/TitleBreadcrumb.interface';
import { EntityType } from '../enums/entity.enum';
import { ServiceCategory } from '../enums/service.enum';
import type { SearchSourceAlias } from '../interface/search.interface';
import {
  getBreadcrumbHref,
  getEntityBreadcrumbs,
  getEntityTypeForIcon,
  isServiceBreadcrumbHref,
} from './EntityBreadcrumbPureUtils';
import { getEntityName } from './EntityNameUtils';
import { getEntityTypeFromServiceCategory } from './ServicePureUtils';
import serviceUtilClassBase from './ServiceUtilClassBase';
import { getEntityIcon } from './TableUtils';

type BreadcrumbIconFC = FC<{ className?: string }>;

/** Wraps a getEntityIcon call into a stable FC shape expected by BreadcrumbItemType.icon. */
export const getBreadcrumbIcon = (
  entityType?: EntityType | string
): BreadcrumbIconFC | undefined =>
  entityType
    ? ({ className }) => (
        <>{getEntityIcon(entityType, classNames(className, 'text-grey-500'))}</>
      )
    : undefined;

/**
 * Returns the icon for the service instance breadcrumb.
 * Service instance URL shape: /service/<category>/<name>
 *
 * Prefers the connector-specific logo (e.g. Snowflake, Glue) from
 * serviceUtilClassBase.getServiceTypeLogo — these are URL assets rendered via
 * <img> because they are not available as React SVG components. Falls back to
 * the generic service entity type SVG icon when no specific logo exists.
 */
const getServiceBreadcrumbIcon = (
  breadcrumbs: TitleLink[],
  serviceBreadcrumbIndex: number,
  source: SearchSourceAlias
): BreadcrumbIconFC | undefined => {
  if (serviceBreadcrumbIndex < 0) {
    return undefined;
  }
  const specificLogoUrl = serviceUtilClassBase.getServiceTypeLogo(source);
  if (specificLogoUrl) {
    return ({ className }) => (
      <img alt="service-icon" className={className} src={specificLogoUrl} />
    );
  }
  const href = getBreadcrumbHref(breadcrumbs[serviceBreadcrumbIndex].url);
  const serviceCategory = href.split('/').filter(Boolean)[1] as ServiceCategory;

  return getBreadcrumbIcon(getEntityTypeFromServiceCategory(serviceCategory));
};

export const getEntityBreadcrumbItems = (
  source: SearchSourceAlias
): BreadcrumbItemType[] => {
  const entityType = source.entityType as EntityType;
  const breadcrumbs = getEntityBreadcrumbs(source, entityType, false);

  // Find the service instance crumb by URL shape. isServiceBreadcrumbHref excludes
  // both entity detail pages and category listing pages (/settings/services/<category>),
  // so only the actual service entry (e.g. /service/databaseServices/Snowflake) matches.
  const serviceBreadcrumbIndex = breadcrumbs.findIndex((b) =>
    isServiceBreadcrumbHref(getBreadcrumbHref(b.url))
  );

  // Resolve the service icon once before mapping; it requires the full source object
  // to look up the connector-specific logo (e.g. Snowflake, Glue).
  const ServiceBreadcrumbIcon = getServiceBreadcrumbIcon(
    breadcrumbs,
    serviceBreadcrumbIndex,
    source
  );

  return breadcrumbs.map((b, index) => {
    const href = getBreadcrumbHref(b.url);

    return {
      id: b.name,
      label: getEntityName(b),
      href,
      // Service crumb gets a connector-specific (or generic service) icon;
      // all other crumbs get their entity type icon derived from the href.
      icon:
        index === serviceBreadcrumbIndex
          ? ServiceBreadcrumbIcon
          : getBreadcrumbIcon(getEntityTypeForIcon(href)),
    };
  });
};
