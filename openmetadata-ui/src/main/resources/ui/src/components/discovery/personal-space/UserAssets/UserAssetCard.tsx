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
  Owner,
  Typography,
} from '@openmetadata/ui-core-components';
import classNames from 'classnames';
import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { EntityReference } from '../../../../generated/entity/type';
import { SearchSourceAlias } from '../../../../interface/search.interface';
import { getEntityName } from '../../../../utils/EntityNameUtils';
import { stripMarkdown } from '../../../../utils/RichTextStringUtils';
import searchClassBase from '../../../../utils/SearchClassBase';
import { CRUMB_MAX_WIDTH } from './UserAssets.constants';

interface UserAssetCardProps {
  source: SearchSourceAlias;
  isSelected: boolean;
  onSelect: (source: SearchSourceAlias) => void;
}

const UserAssetCard: React.FC<UserAssetCardProps> = ({
  source,
  isSelected,
  onSelect,
}) => {
  const { t } = useTranslation();
  const breadcrumbItems = useMemo(
    () => searchClassBase.getEntityBreadcrumbItems(source),
    [source]
  );
  const parent = breadcrumbItems.at(-1);
  const description = source.description
    ? stripMarkdown(source.description)
    : '';
  const owners = (source.owners as EntityReference[] | undefined) ?? [];

  return (
    <Box
      className={classNames(
        'tw:relative tw:min-w-0 tw:rounded-xl tw:border tw:px-4 tw:py-3',
        isSelected
          ? 'tw:border-utility-brand-300 tw:bg-utility-brand-50'
          : 'tw:border-secondary tw:bg-surface tw:hover:border-utility-brand-200'
      )}
      data-selected={isSelected}
      data-testid={`user-asset-card-${source.fullyQualifiedName}`}
      direction="col"
      gap={1}>
      {breadcrumbItems.length > 0 && (
        <Breadcrumbs
          autoCollapse
          className="tw:relative tw:z-10 tw:min-w-0"
          divider="chevron"
          items={breadcrumbItems}
          maxItemWidth={CRUMB_MAX_WIDTH}
        />
      )}
      <Box align="center" className="tw:min-w-0" gap={2}>
        <span className="tw:flex tw:shrink-0 tw:text-fg-tertiary">
          {searchClassBase.getEntityIcon(
            source.entityType ?? '',
            'tw:size-4.5'
          )}
        </span>
        {/* The button's ::after stretches over the card, so a click anywhere
            on it selects while the links inside stay reachable above it. */}
        <button
          aria-pressed={isSelected}
          className={classNames(
            'tw:min-w-0 tw:truncate tw:text-left tw:text-sm tw:font-medium tw:text-link tw:outline-none',
            'tw:after:absolute tw:after:inset-0 tw:after:rounded-xl tw:focus-visible:after:outline-2 tw:focus-visible:after:outline-focus-ring'
          )}
          data-testid="user-asset-card-name"
          type="button"
          onClick={() => onSelect(source)}>
          {getEntityName(source)}
        </button>
      </Box>
      <Typography
        className={classNames(
          'tw:truncate',
          description ? 'tw:text-primary' : 'tw:text-tertiary'
        )}
        size="text-sm">
        {description || t('label.no-description')}
      </Typography>
      <Box
        align="center"
        className="tw:relative tw:z-10 tw:min-w-0 tw:max-w-full tw:self-start"
        gap={2}>
        {parent && (
          <>
            {parent.href ? (
              <Link
                className="tw:truncate tw:text-xs tw:font-medium tw:text-link"
                to={parent.href}>
                {parent.label}
              </Link>
            ) : (
              <Typography className="tw:truncate" size="text-xs">
                {parent.label}
              </Typography>
            )}
            <span
              aria-hidden
              className="tw:inline-block tw:size-1 tw:shrink-0 tw:rounded-full tw:bg-fg-quaternary"
            />
          </>
        )}
        <Owner
          avatarSize={24}
          isCompactView={false}
          owners={owners}
          placeHolder={t('label.no-entity', {
            entity: t('label.owner-plural'),
          })}
          showLabel={false}
        />
      </Box>
    </Box>
  );
};

export default UserAssetCard;
