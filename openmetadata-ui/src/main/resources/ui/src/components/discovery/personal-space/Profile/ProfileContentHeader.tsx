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
    Typography
} from '@openmetadata/ui-core-components';
import React, { FC, useMemo } from 'react';

interface ProfileContentHeaderProps {
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
  onBreadcrumbAction?: (id: string | number) => void;
  /** Action buttons rendered on the right of the title row. */
  actions?: React.ReactNode;
  /** When set, renders in place of the title text (e.g. an inline rename input). */
  titleInput?: React.ReactNode;
  /** Node rendered inline right after the title text (e.g. a rename/edit icon button). */
  titleSuffix?: React.ReactNode;
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
  actions,
  titleInput,
  titleSuffix,
}) => {
  const defaultBreadcrumbs = useMemo<BreadcrumbItemType[]>(
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
        onAction={
          onBreadcrumbAction
            ? (id) => onBreadcrumbAction(id as string | number)
            : undefined
        }
      />
      <Box align="center" direction="row" gap={3}>
        <FeaturedIcon
          className="tw:rounded-xl"
          color="brand"
          icon={icon}
          shape="square"
          size="md"
          theme="dark"
        />
        <Box className="tw:flex-1" direction="col">
          <Box align="center" direction="row" gap={1}>
            {titleInput ?? (
              <Typography
                className="tw:text-primary-900"
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
        </Box>
        {actions && (
          <Box className="tw:ml-auto tw:flex tw:items-center tw:gap-2" direction="row">
            {actions}
          </Box>
        )}
      </Box>
    </Box>
  );
};

export default ProfileContentHeader;
