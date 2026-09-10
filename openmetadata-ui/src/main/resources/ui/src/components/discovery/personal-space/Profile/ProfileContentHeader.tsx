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
  Box,
  Breadcrumbs,
  FeaturedIcon,
  Typography,
} from '@openmetadata/ui-core-components';
import type { BreadcrumbItemType } from '@openmetadata/ui-core-components';
import type { Key } from 'react';
import React, { FC, useMemo } from 'react';

export interface ProfileContentHeaderProps {
  icon: FC<{ className?: string }>;
  title: string;
  description: string;
  /** Breadcrumb root crumb — the current item's group label (Account / Credentials). */
  breadcrumbRoot: string;
  /**
   * When provided, overrides the default `[breadcrumbRoot, title]` pair. Use
   * for panels that need dynamic multi-level breadcrumbs (e.g. CustomPropertiesPanel).
   */
  breadcrumbs?: BreadcrumbItemType[];
  /** Called when the user clicks a breadcrumb item. Only used with `breadcrumbs`. */
  onBreadcrumbAction?: (id: Key) => void;
  /**
   * When provided, renders this node instead of the default `<FeaturedIcon>`.
   * Use when the icon is dynamic (e.g. an entity-specific icon).
   */
  iconNode?: React.ReactNode;
  /** Optional right-side slot in the title row (e.g. a toggle or action buttons). */
  actions?: React.ReactNode;
}

/**
 * The header shown at the top of the right content panel for the selected
 * nav item: a "<group> / <item>" breadcrumb, a featured icon, and the item
 * title + description.
 */
const ProfileContentHeader: React.FC<ProfileContentHeaderProps> = ({
  icon,
  title,
  description,
  breadcrumbRoot,
  breadcrumbs,
  onBreadcrumbAction,
  iconNode,
  actions,
}) => {
  const defaultBreadcrumbs = useMemo(
    () => [
      { id: 'root', label: breadcrumbRoot },
      { id: 'current', label: title },
    ],
    [breadcrumbRoot, title]
  );

  const resolvedBreadcrumbs = breadcrumbs ?? defaultBreadcrumbs;

  return (
    <Box
      className="ai-profile-page__content-header tw:shrink-0 tw:border-b tw:border-utility-gray-200 tw:px-6 tw:py-4 tw:mb-7"
      data-testid="profile-content-header"
      direction="col"
      gap={3}>
      <Breadcrumbs
        divider="chevron"
        items={resolvedBreadcrumbs}
        size="xs"
        type="text"
        onAction={onBreadcrumbAction}
      />
      <Box
        align="center"
        direction="row"
        justify={actions ? 'between' : undefined}>
        <Box align="center" direction="row" gap={3}>
          {iconNode ?? (
            <FeaturedIcon
              className="tw:rounded-xl"
              color="brand"
              icon={icon}
              shape="square"
              size="md"
              theme="dark"
            />
          )}
          <Box direction="col">
            <Typography
              className="tw:text-primary-900"
              size="text-lg"
              weight="bold">
              {title}
            </Typography>
            <Typography
              className="tw:text-tertiary"
              size="text-sm"
              weight="regular">
              {description}
            </Typography>
          </Box>
        </Box>
        {actions}
      </Box>
    </Box>
  );
};

export default ProfileContentHeader;
