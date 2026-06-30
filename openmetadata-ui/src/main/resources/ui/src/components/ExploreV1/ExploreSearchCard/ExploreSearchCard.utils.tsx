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

import { startCase } from 'lodash';
import type { FC, ReactNode } from 'react';
import { EntityType } from '../../../enums/entity.enum';

export const TYPE_BADGE_KEY = 'Type';

const TYPE_BADGE_CLASS_NAME = [
  'tw:inline-flex',
  'tw:h-5.5',
  'tw:items-center',
  'tw:rounded-md',
  'tw:border',
  'tw:border-utility-gray-blue-200',
  'tw:bg-utility-gray-blue-50',
  'tw:px-1.5',
  'tw:py-0.5',
  'tw:text-xs',
  'tw:font-medium',
  'tw:text-utility-gray-blue-700',
].join(' ');

const BREADCRUMB_ICON_CLASS_NAME = [
  'tw:inline-flex',
  'tw:size-2.5',
  'tw:shrink-0',
  'tw:items-center',
  'tw:justify-center',
  'tw:align-middle',
  'tw:leading-none',
  'tw:[&>*]:size-2.5',
].join(' ');

export const getTypeBadge = (label?: string) =>
  label ? (
    <span className={TYPE_BADGE_CLASS_NAME}>
      {startCase(label).toUpperCase()}
    </span>
  ) : null;

const BREADCRUMB_ENTITY_TYPES = [
  EntityType.DATABASE_SCHEMA,
  EntityType.DATABASE,
  EntityType.TABLE,
] as const;

export const getBreadcrumbEntityTypeFromHref = (href?: string) =>
  BREADCRUMB_ENTITY_TYPES.find((entityType) =>
    href?.includes(`/${entityType}/`)
  );

export const createBreadcrumbIcon = (
  icon: ReactNode
): FC<{ className?: string }> | undefined => {
  if (!icon) {
    return undefined;
  }

  const BreadcrumbIcon: FC<{ className?: string }> = () => (
    <span className={BREADCRUMB_ICON_CLASS_NAME}>{icon}</span>
  );

  BreadcrumbIcon.displayName = 'ExploreSearchCardBreadcrumbIcon';

  return BreadcrumbIcon;
};
