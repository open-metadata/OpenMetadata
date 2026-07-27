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
import { createPath } from 'react-router-dom';
import type { TitleLink } from '../components/common/TitleBreadcrumb/TitleBreadcrumb.interface';
import { EntityType } from '../enums/entity.enum';
import type { SearchSourceAlias } from '../interface/search.interface';
import { getEntityBreadcrumbs } from './EntityBreadcrumbPureUtils';
import { getEntityName } from './EntityNameUtils';
import serviceUtilClassBase from './ServiceUtilClassBase';
import { getEntityIcon } from './TableUtils';

type BreadcrumbIconFC = FC<{ className?: string }>;

const getBreadcrumbPath = (url: TitleLink['url']) =>
  typeof url === 'string' ? url : createPath(url);

/** Wraps a getEntityIcon call into a stable FC shape expected by BreadcrumbItemType.icon. */
export const getBreadcrumbIcon = (
  entityType?: EntityType | string
): BreadcrumbIconFC | undefined =>
  entityType
    ? ({ className }) => (
        <>
          {getEntityIcon(entityType, classNames(className, 'tw:text-gray-500'))}
        </>
      )
    : undefined;

/**
 * Uses connector-specific logos (e.g. Snowflake, Glue) from
 * serviceUtilClassBase.getServiceTypeLogo — these are URL assets rendered via
 * <img> because they are not available as React SVG components.
 */
const getServiceBreadcrumbIcon = (
  serviceBreadcrumbIndex: number,
  source: SearchSourceAlias
): BreadcrumbIconFC | undefined => {
  if (serviceBreadcrumbIndex < 0) {
    return undefined;
  }
  const logoUrl = serviceUtilClassBase.getServiceTypeLogo(source);

  return ({ className }) => (
    <img alt="service-icon" className={className} src={logoUrl} />
  );
};

export const getEntityBreadcrumbItems = (
  source: SearchSourceAlias
): BreadcrumbItemType[] => {
  const entityType = source.entityType as EntityType;
  const breadcrumbs = getEntityBreadcrumbs(
    source,
    entityType,
    false
  ) as TitleLink[];

  // Find the service instance crumb using metadata added by the breadcrumb builder.
  // This avoids parsing hrefs and keeps the icon decision tied to the source entity.
  const serviceBreadcrumbIndex = breadcrumbs.findIndex((breadcrumb) =>
    Boolean(breadcrumb.isServiceBreadcrumb)
  );

  // Resolve the service icon once before mapping; it requires the full source object
  // to look up the connector-specific logo (e.g. Snowflake, Glue).
  const serviceBreadcrumbIcon = getServiceBreadcrumbIcon(
    serviceBreadcrumbIndex,
    source
  );

  return breadcrumbs.map((breadcrumb, index) => {
    const href = getBreadcrumbPath(breadcrumb.url);

    return {
      id: breadcrumb.name,
      label: getEntityName(breadcrumb),
      href,
      // Service crumb gets a connector-specific (or generic service) icon;
      // all other crumbs get the explicit icon type from the breadcrumb builder.
      icon:
        index === serviceBreadcrumbIndex
          ? serviceBreadcrumbIcon
          : getBreadcrumbIcon(breadcrumb.iconType),
    };
  });
};
