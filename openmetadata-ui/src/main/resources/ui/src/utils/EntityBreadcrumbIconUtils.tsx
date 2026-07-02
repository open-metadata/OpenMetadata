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
import { EntityType } from '../enums/entity.enum';
import { ServiceCategoryPlural } from '../enums/service.enum';
import type { SearchSourceAlias } from '../interface/search.interface';
import {
  getBreadcrumbEntityTypeFromHref,
  getEntityBreadcrumbs,
  isServiceBreadcrumbHref,
} from './EntityBreadcrumbPureUtils';
import { getEntityName } from './EntityNameUtils';
import { getEntityTypeFromServiceCategory } from './ServicePureUtils';
import { getEntityIcon } from './TableUtils';

type BreadcrumbIconFC = FC<{ className?: string }>;

const getBreadcrumbHref = (url: string | { pathname?: string }): string =>
  typeof url === 'string' ? url : url.pathname ?? '';

const getBreadcrumbIcon = (
  entityType?: EntityType | string
): BreadcrumbIconFC | undefined =>
  entityType
    ? ({ className }) => (
        <>{getEntityIcon(entityType, classNames(className, 'text-grey-500'))}</>
      )
    : undefined;

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

  const serviceType = 'service' in source ? source.service?.type : undefined;
  const serviceCategory =
    serviceType && serviceType in ServiceCategoryPlural
      ? ServiceCategoryPlural[serviceType as keyof typeof ServiceCategoryPlural]
      : undefined;

  const ServiceBreadcrumbIcon =
    serviceBreadcrumbIndex >= 0 && serviceCategory
      ? getBreadcrumbIcon(getEntityTypeFromServiceCategory(serviceCategory))
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
          : getBreadcrumbIcon(breadcrumbEntityType),
    };
  });
};
