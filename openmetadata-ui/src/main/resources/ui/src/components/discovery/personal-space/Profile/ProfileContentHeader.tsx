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
import {
  Box,
  Breadcrumbs,
  FeaturedIcon,
  Typography,
} from '@openmetadata/ui-core-components';
import classNames from 'classnames';
import type { Key } from 'react';
import React, { FC, useMemo } from 'react';

export interface ProfileContentHeaderProps {
  icon: FC<{ className?: string }>;
  title: string;
  description: string;
  /** Breadcrumb root crumb — the current item's group label (Account / Credentials). */
  breadcrumbRoot: string;
  /**
   * When provided, replaces the auto-computed two-level breadcrumb.
   * Use for panels with deeper internal navigation (e.g. Access Control).
   */
  breadcrumbs?: BreadcrumbItemType[];
  /** Called when the user clicks an interactive breadcrumb item. */
  onBreadcrumbAction?: (id: Key) => void;
  /**
   * When provided, renders this node instead of the default `<FeaturedIcon>`.
   * Use when the icon is dynamic (e.g. an entity-specific icon).
   */
  iconNode?: React.ReactNode;
  /** Action buttons rendered on the right of the title row. */
  actions?: React.ReactNode;
  /** When set, renders in place of the title text (e.g. an inline rename input). */
  titleInput?: React.ReactNode;
  /** Node rendered inline right after the title text (e.g. a rename/edit icon button). */
  titleSuffix?: React.ReactNode;
  /** Extra row rendered under the description (e.g. installed / developer details). */
  meta?: React.ReactNode;
  /** Tab strip rendered flush with the header's bottom border. */
  tabs?: React.ReactNode;
  /** Render only the breadcrumb row (a full-page detail that draws its own title). */
  compact?: boolean;
}

/**
 * The header shown at the top of the right content panel for the selected
 * nav item: a breadcrumb, a featured icon, and the item title + description.
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
  titleInput,
  titleSuffix,
  meta,
  tabs,
  compact,
}) => {
  const defaultBreadcrumbs = useMemo<BreadcrumbItemType[]>(
    () => [
      { id: 'root', label: breadcrumbRoot },
      { id: 'current', label: title },
    ],
    [breadcrumbRoot, title]
  );

  const resolvedBreadcrumbs = breadcrumbs ?? defaultBreadcrumbs;

  const breadcrumbRow = (
    <Breadcrumbs
      autoCollapse
      divider="chevron"
      items={resolvedBreadcrumbs}
      maxItemWidth={256}
      size="xs"
      type="text"
      onAction={onBreadcrumbAction}
    />
  );

  if (compact) {
    return (
      <Box
        className="ai-profile-page__content-header tw:shrink-0 tw:px-6 tw:py-4"
        data-testid="profile-content-header"
        direction="col">
        {breadcrumbRow}
      </Box>
    );
  }

  return (
    <Box
      className={classNames(
        'ai-profile-page__content-header tw:shrink-0 tw:border-b tw:border-utility-gray-200 tw:px-6 tw:pt-4 tw:mb-7',
        tabs ? 'tw:pb-0' : 'tw:pb-4'
      )}
      data-testid="profile-content-header"
      direction="col"
      gap={5}>
      {breadcrumbRow}
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
        <Box className="tw:min-w-0 tw:flex-1" direction="col">
          <Box align="center" className="tw:min-w-0" direction="row" gap={1}>
            {titleInput ?? (
              <Typography
                className="tw:min-w-0 tw:text-primary"
                data-testid="profile-content-header-title"
                ellipsis={{ tooltip: true }}
                size="text-lg"
                weight="bold">
                {title}
              </Typography>
            )}
            {!titleInput && titleSuffix}
          </Box>
          <Typography
            className="tw:text-tertiary"
            size="text-sm"
            weight="regular">
            {description}
          </Typography>
          {meta}
        </Box>
        {actions && (
          <Box
            className="tw:ml-auto tw:flex tw:shrink-0 tw:items-center tw:gap-2"
            direction="row">
            {actions}
          </Box>
        )}
      </Box>
      {/* -mb-px lays the tab strip's own baseline over the header border. */}
      {tabs && <div className="tw:-mb-px">{tabs}</div>}
    </Box>
  );
};

export default ProfileContentHeader;
