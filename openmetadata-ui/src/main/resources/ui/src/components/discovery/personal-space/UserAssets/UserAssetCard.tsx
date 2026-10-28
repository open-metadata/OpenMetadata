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
  Button,
  Card,
  Dot,
  Owner,
  Typography,
} from '@openmetadata/ui-core-components';
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
    // shrink-0: the list is a scrolling flex column; without it every card is
    // squeezed to fit the viewport instead of the list scrolling.
    <Card
      isClickable
      className="tw:shrink-0"
      data-selected={isSelected}
      data-testid={`user-asset-card-${source.fullyQualifiedName}`}
      isSelected={isSelected}
      size="sm"
      variant="muted">
      <Card.Content>
        {/* py-1 on top of the sm Card's padding gives the 12px × 16px inset and
            the row rhythm of the Explore result card (ExploreSearchCard). */}
        <Box className="tw:py-1" direction="col" gap={2}>
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
            <Box className="tw:shrink-0 tw:text-fg-tertiary">
              {searchClassBase.getEntityIcon(
                source.entityType ?? '',
                'tw:size-4.5'
              )}
            </Box>
            {/* `static` lets the button's ::after stretch over the whole card,
                so a click anywhere selects while the links inside stay
                reachable above it. */}
            <Button
              ellipsis
              aria-pressed={isSelected}
              className="tw:static tw:after:absolute tw:after:inset-0"
              color="link-color"
              data-testid="user-asset-card-name"
              size="sm"
              onPress={() => onSelect(source)}>
              {getEntityName(source)}
            </Button>
          </Box>
          <Typography
            className="tw:truncate"
            color={description ? undefined : 'secondary'}
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
                <Dot
                  aria-hidden
                  className="tw:shrink-0 tw:text-fg-quaternary"
                  size="tiny"
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
      </Card.Content>
    </Card>
  );
};

export default UserAssetCard;
