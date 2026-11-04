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
import { Box, Button, Dropdown, Input } from '@openmetadata/ui-core-components';
import {
  ChevronDown,
  FilterLines,
  Search,
} from '@openmetadata/ui-core-components/icons';
import { useTranslation } from 'react-i18next';

export interface CustomPropertySortOption<T extends string> {
  id: T;
  labelKey: string;
}

export interface CustomPropertySearchSortBarProps<T extends string> {
  searchText: string;
  sortMode: T;
  sortOptions: readonly CustomPropertySortOption<T>[];
  onSearchChange: (searchText: string) => void;
  onSortChange: (sortMode: T) => void;
}

/** Search on the left, the sort menu on the right, above a custom property list. */
export const CustomPropertySearchSortBar = <T extends string>({
  searchText,
  sortMode,
  sortOptions,
  onSearchChange,
  onSortChange,
}: CustomPropertySearchSortBarProps<T>) => {
  const { t } = useTranslation();
  const searchLabel = t('label.search-entity', {
    entity: t('label.property-plural'),
  });
  const activeSort: CustomPropertySortOption<T> | undefined =
    sortOptions.find((option) => option.id === sortMode) ?? sortOptions[0];

  return (
    <Box align="center" gap={3} justify="between" wrap="wrap">
      <Input
        aria-label={searchLabel}
        className="tw:w-full tw:max-w-80"
        icon={Search}
        inputDataTestId="custom-property-search"
        placeholder={searchLabel}
        type="search"
        value={searchText}
        onChange={onSearchChange}
      />
      {activeSort && (
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
                const [key] = Array.from(keys as Set<T>);
                if (key) {
                  onSortChange(key);
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
      )}
    </Box>
  );
};
