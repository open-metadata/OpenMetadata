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

import { Box, Card, Typography } from '@openmetadata/ui-core-components';
import type { FC } from 'react';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { usePermissionProvider } from '../../../../../../../context/PermissionProvider/PermissionProvider';
import { useAuth } from '../../../../../../../hooks/authHooks';
import { getSearchSettingCategories } from '../../../../../../../utils/SearchSettingsUtils';
import type { PlatformSettingsPageProps } from '../PlatformSettings.types';
import { SearchSectionTitle } from './SearchSection';

/** One card per entity type, opening that entity's search settings. */
const SearchEntityCards = ({
  onNavigate,
}: Pick<PlatformSettingsPageProps, 'onNavigate'>) => {
  const { t } = useTranslation();
  const { permissions } = usePermissionProvider();
  const { isAdminUser } = useAuth();
  const entityCategories = useMemo(
    () => getSearchSettingCategories(permissions, Boolean(isAdminUser)) ?? [],
    [permissions, isAdminUser]
  );

  return (
    <Box direction="col" gap={3}>
      <SearchSectionTitle>{t('label.entity-plural')}</SearchSectionTitle>
      <div
        className="tw:grid tw:grid-cols-1 tw:gap-4 tw:sm:grid-cols-2 tw:lg:grid-cols-3"
        data-testid="search-entity-cards">
        {entityCategories.map((category) => {
          const itemId = category.key.split('.')[2];
          const Icon = category.icon as FC<{ className?: string }>;
          const open = () =>
            onNavigate({
              type: 'page',
              page: 'search',
              isEditing: false,
              itemId,
            });

          return (
            <Card
              isClickable
              data-testid={`search-entity-card-${itemId}`}
              key={category.key}
              role="button"
              size="md"
              tabIndex={0}
              onClick={open}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  open();
                }
              }}>
              <Card.Content>
                <Box align="start" direction="row" gap={3}>
                  {Icon && (
                    <Icon className="tw:size-5 tw:shrink-0 tw:text-secondary" />
                  )}
                  <Box className="tw:min-w-0" direction="col" gap={1}>
                    <Typography size="text-sm" weight="semibold">
                      {category.label}
                    </Typography>
                    <Typography
                      className="tw:line-clamp-2 tw:text-tertiary"
                      size="text-xs">
                      {category.description}
                    </Typography>
                  </Box>
                </Box>
              </Card.Content>
            </Card>
          );
        })}
      </div>
    </Box>
  );
};

export default SearchEntityCards;
