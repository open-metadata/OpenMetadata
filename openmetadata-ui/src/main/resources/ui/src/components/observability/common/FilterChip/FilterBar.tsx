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
import { Box, Button, Dropdown } from '@openmetadata/ui-core-components';
import { PlusCircle, XCircle } from '@untitledui/icons';
import { isString } from 'lodash';
import { useCallback, useState } from 'react';
import type { Selection } from 'react-aria-components';
import { useTranslation } from 'react-i18next';
import { FilterDescriptor } from '../../../DataQuality/TestCases/FilterChip.interface';
import FilterChip, { FilterChipVariant } from './FilterChip';

interface AdvancedMenuItem {
  key: string;
  label: string;
}

// Structural shape of the incoming menu entries. Kept loose (optional key,
// unknown label, nullable) so an antd `ItemType[]` — which may include
// dividers, group items, nulls and ReactNode labels — is assignable without
// importing antd; the render below keeps only the real { key, string label }
// entries.
type AdvancedMenuInput = ReadonlyArray<
  { key?: string | number; label?: unknown } | null | undefined
>;

export interface FilterBarProps {
  filters: FilterDescriptor[];
  /** Omit to hide the "Advanced" add/remove-filter dropdown (e.g. incidents). */
  advancedMenu?: AdvancedMenuInput;
  selectedFilter?: string[];
  hasActiveFilters: boolean;
  /** Trigger style for the filter chips. Defaults to `chip`. */
  variant?: FilterChipVariant;
  onToggleFilter?: (info: { key: string }) => void;
  onClearAll: () => void;
}

export const FilterBar = ({
  filters,
  advancedMenu,
  selectedFilter = [],
  hasActiveFilters,
  variant = 'chip',
  onToggleFilter,
  onClearAll,
}: FilterBarProps) => {
  const { t } = useTranslation();

  // Only one filter dropdown open at a time — opening one closes the rest.
  const [openFilterKey, setOpenFilterKey] = useState<string | null>(null);
  const handleFilterOpenChange = useCallback(
    (key: string, open: boolean) =>
      setOpenFilterKey((prev) => {
        if (open) {
          return key;
        }

        return prev === key ? null : prev;
      }),
    []
  );

  // antd ItemType[] may include dividers, nulls, group items and ReactNode
  // labels — keep only the real { key, string label } entries.
  const menuItems: AdvancedMenuItem[] = (advancedMenu ?? []).flatMap(
    (entry) => {
      const item = entry as { key?: string | number; label?: unknown } | null;

      return item?.key != null && isString(item.label)
        ? [{ key: String(item.key), label: item.label }]
        : [];
    }
  );
  const selectedKeySet: Selection = new Set(selectedFilter);

  const handleAdvancedChange = (keys: Selection) => {
    if (keys === 'all') {
      return;
    }
    const next = new Set(Array.from(keys, String));
    menuItems.forEach(({ key }) => {
      if (next.has(key) !== selectedFilter.includes(key)) {
        onToggleFilter?.({ key });
      }
    });
  };

  // Close any open filter dropdown before clearing so it can't linger showing
  // stale locally-staged selections after the filters reset.
  const handleClearAll = useCallback(() => {
    setOpenFilterKey(null);
    onClearAll();
  }, [onClearAll]);

  const clearAllLabel = t('label.clear-entity', { entity: t('label.all') });

  return (
    <Box
      align={variant === 'input' ? 'stretch' : 'center'}
      className="tw:w-full"
      data-testid="filter-bar"
      gap={3}
      wrap="wrap">
      {menuItems.length > 0 && (
        <Dropdown.Root>
          <Button
            color="secondary"
            data-testid="advanced-filter"
            iconLeading={PlusCircle}
            size="md">
            {t('label.advanced')}
          </Button>
          <Dropdown.Popover className="tw:w-56">
            <Dropdown.Menu
              aria-label={t('label.advanced')}
              className="tw:max-h-64 tw:overflow-y-auto"
              disallowEmptySelection={false}
              selectedKeys={selectedKeySet}
              selectionMode="multiple"
              onSelectionChange={handleAdvancedChange}>
              {menuItems.map((item) => (
                <Dropdown.Item
                  showCheckbox
                  id={item.key}
                  key={item.key}
                  label={item.label}
                  textValue={item.label}
                />
              ))}
            </Dropdown.Menu>
          </Dropdown.Popover>
        </Dropdown.Root>
      )}

      {filters.map((descriptor) => (
        <FilterChip
          descriptor={descriptor}
          isOpen={openFilterKey === descriptor.key}
          key={descriptor.key}
          variant={variant}
          onOpenChange={(open) => handleFilterOpenChange(descriptor.key, open)}
        />
      ))}

      {hasActiveFilters &&
        (variant === 'input' ? (
          // Spacer matches the chip label so the flex-1 region equals the input
          // height, centering the button against the inputs (not label+input).
          <div className="tw:ml-auto tw:flex tw:flex-col tw:gap-1.5">
            <span
              aria-hidden="true"
              className="tw:invisible tw:text-sm tw:font-medium">
              &nbsp;
            </span>
            <div className="tw:flex tw:flex-1 tw:items-center">
              <Button
                color="secondary"
                data-testid="clear-all-filter-btn"
                iconLeading={XCircle}
                size="xs"
                onPress={handleClearAll}>
                {clearAllLabel}
              </Button>
            </div>
          </div>
        ) : (
          <Button
            className="tw:ml-auto"
            color="secondary"
            data-testid="clear-all-filter-btn"
            iconLeading={XCircle}
            size="xs"
            onPress={handleClearAll}>
            {clearAllLabel}
          </Button>
        ))}
    </Box>
  );
};

export default FilterBar;
