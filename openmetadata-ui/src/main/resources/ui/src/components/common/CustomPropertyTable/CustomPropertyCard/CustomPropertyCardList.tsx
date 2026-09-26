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
  Button,
  Card,
  Dropdown,
  Input,
  Typography,
} from '@openmetadata/ui-core-components';
import {
  ChevronDown,
  FilterLines,
  SearchLg,
} from '@openmetadata/ui-core-components/icons';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CustomPropertyCard } from './CustomPropertyCard';
import { SORT_OPTIONS } from './CustomPropertyCard.constants';
import {
  CustomPropertyCardListProps,
  CustomPropertySortMode,
} from './CustomPropertyCard.types';
import {
  filterAndSortProperties,
  getPropertyTypeMeta,
} from './CustomPropertyCard.utils';

export const CustomPropertyCardList = ({
  properties,
  extension,
  hasEditPermissions,
  onValueSave,
}: CustomPropertyCardListProps) => {
  const { t } = useTranslation();
  const [searchText, setSearchText] = useState('');
  const [sortMode, setSortMode] = useState<CustomPropertySortMode>('name');

  const activeSort =
    SORT_OPTIONS.find((option) => option.id === sortMode) ?? SORT_OPTIONS[0];

  const visibleProperties = useMemo(
    () => filterAndSortProperties(properties, extension, searchText, sortMode),
    [properties, extension, searchText, sortMode]
  );

  return (
    <Card className="tw:p-4" data-testid="custom-properties-card">
      <Box direction="col" gap={4}>
        <Box align="center" gap={3} justify="between" wrap="wrap">
          <Input
            aria-label={t('label.search-entity', {
              entity: t('label.property-plural'),
            })}
            className="tw:w-full tw:max-w-80"
            icon={SearchLg}
            inputDataTestId="custom-property-search"
            placeholder={t('label.search-entity', {
              entity: t('label.property-plural'),
            })}
            type="search"
            value={searchText}
            onChange={setSearchText}
          />
          <Dropdown.Root>
            <Button
              color="secondary"
              data-testid="custom-property-sort"
              iconLeading={<FilterLines className="tw:size-4" />}
              iconTrailing={<ChevronDown className="tw:size-4" />}
              size="sm">
              {t('label.sort-colon-value', { value: t(activeSort.labelKey) })}
            </Button>
            <Dropdown.Popover className="tw:w-48">
              <Dropdown.Menu
                disallowEmptySelection
                aria-label={t('label.sort-by')}
                selectedKeys={[sortMode]}
                selectionMode="single"
                onSelectionChange={(keys) => {
                  const [key] = Array.from(keys as Set<CustomPropertySortMode>);
                  if (key) {
                    setSortMode(key);
                  }
                }}>
                {SORT_OPTIONS.map((option) => (
                  <Dropdown.Item
                    id={option.id}
                    key={option.id}
                    label={t(option.labelKey)}
                  />
                ))}
              </Dropdown.Menu>
            </Dropdown.Popover>
          </Dropdown.Root>
        </Box>

        {visibleProperties.length ? (
          // Raw grid instead of core Grid: Grid.Item spans are inline styles and
          // cannot collapse to one column on narrow screens. Dense flow backfills
          // the gap a full-width card would otherwise leave beside a half card.
          <div className="tw:grid tw:grid-flow-row-dense tw:grid-cols-1 tw:gap-4 tw:lg:grid-cols-2">
            {visibleProperties.map((property) => (
              <div
                className={
                  getPropertyTypeMeta(property.propertyType.name).isWide
                    ? 'tw:min-w-0 tw:lg:col-span-2'
                    : 'tw:min-w-0'
                }
                key={property.name}>
                <CustomPropertyCard
                  hasEditPermissions={hasEditPermissions}
                  property={property}
                  value={extension?.[property.name]}
                  onValueSave={onValueSave}
                />
              </div>
            ))}
          </div>
        ) : (
          <Typography
            className="tw:py-8 tw:text-center tw:text-tertiary"
            data-testid="no-matching-custom-properties"
            size="text-sm">
            {t('message.no-entity-found-for-name', {
              entity: t('label.property-plural'),
              name: searchText,
            })}
          </Typography>
        )}
      </Box>
    </Card>
  );
};
