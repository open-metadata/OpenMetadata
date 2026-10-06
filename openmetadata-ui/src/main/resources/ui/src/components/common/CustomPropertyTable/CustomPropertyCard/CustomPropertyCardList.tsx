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
  Search,
} from '@openmetadata/ui-core-components/icons';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CustomPropertyLayoutItem } from '../CustomPropertiesWidget/CustomPropertiesWidget.interface';
import {
  applyPropertyLayout,
  getTabDefaultWidth,
} from '../CustomPropertiesWidget/CustomPropertiesWidget.utils';
import { CustomPropertyCard } from './CustomPropertyCard';
import { SORT_OPTIONS } from './CustomPropertyCard.constants';
import { CustomPropertyCardListProps } from './CustomPropertyCard.interface';
import { filterAndSortProperties } from './CustomPropertyCard.utils';
import { CardListSortMode } from './CustomPropertyCardList.interface';

const EMPTY_LAYOUT: CustomPropertyLayoutItem[] = [];

const LAYOUT_SORT_OPTION = { id: 'layout', labelKey: 'label.default' } as const;

export const CustomPropertyCardList = ({
  properties,
  propertyLayout = EMPTY_LAYOUT,
  extension,
  hasEditPermissions,
  onValueSave,
}: CustomPropertyCardListProps) => {
  const { t } = useTranslation();
  const [searchText, setSearchText] = useState('');
  const hasLayout = propertyLayout.length > 0;
  const [sortMode, setSortMode] = useState<CardListSortMode>(
    hasLayout ? 'layout' : 'name'
  );
  const sortOptions = hasLayout
    ? [LAYOUT_SORT_OPTION, ...SORT_OPTIONS]
    : SORT_OPTIONS;

  const activeSort =
    sortOptions.find((option) => option.id === sortMode) ?? sortOptions[0];

  const visibleProperties = useMemo(() => {
    if (sortMode === 'layout') {
      return applyPropertyLayout(
        filterAndSortProperties(properties, extension, searchText, 'name'),
        propertyLayout,
        getTabDefaultWidth
      );
    }

    return filterAndSortProperties(
      properties,
      extension,
      searchText,
      sortMode
    ).map((property) => ({ property, width: getTabDefaultWidth(property) }));
  }, [properties, extension, searchText, sortMode, propertyLayout]);

  return (
    <Card className="tw:p-4" data-testid="custom-properties-card">
      <Box direction="col" gap={4}>
        <Box align="center" gap={3} justify="between" wrap="wrap">
          <Input
            aria-label={t('label.search-entity', {
              entity: t('label.property-plural'),
            })}
            className="tw:w-full tw:max-w-80"
            icon={Search}
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
                  const [key] = Array.from(keys as Set<CardListSortMode>);
                  if (key) {
                    setSortMode(key);
                  }
                }}>
                {sortOptions.map((option) => (
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
          // cannot collapse to one column on narrow screens. No dense flow: cards
          // keep their order, so a half card between two full ones leaves its
          // row half empty instead of pulling a later card up beside it.
          // items-start: expanding one card grows only that card, not its row.
          <div className="tw:grid tw:grid-cols-1 tw:items-start tw:gap-4 tw:lg:grid-cols-2">
            {visibleProperties.map(({ property, width }) => (
              <div
                className={
                  width === 'full'
                    ? 'tw:min-w-0 tw:lg:col-span-2'
                    : 'tw:min-w-0'
                }
                key={property.name}>
                <CustomPropertyCard
                  hasEditPermissions={hasEditPermissions}
                  isCompact={width === 'half'}
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
