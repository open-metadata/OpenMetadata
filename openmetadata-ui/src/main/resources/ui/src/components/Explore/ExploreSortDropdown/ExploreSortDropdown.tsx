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
import {
  Check,
  ChevronDown,
  Search,
  SortAscending,
  SortDescending,
  SortLinesAscending,
  SortLinesDescending,
} from '@openmetadata/ui-core-components/icons';
import { FC, Fragment, Key } from 'react';
import { useTranslation } from 'react-i18next';
import {
  SortOrderIcon,
  SortOrderOption,
  SORT_ORDER_OPTIONS,
} from '../../../constants/explore.constants';
import { SORT_ORDER } from '../../../enums/common.enum';
import { SortingField } from '../SortingDropDown';

type IconComponent = FC<{ className?: string }>;

const SORT_ICONS: Record<SortOrderIcon, IconComponent> = {
  barsDesc: SortLinesDescending,
  barsAsc: SortLinesAscending,
  az: SortAscending,
  za: SortDescending,
  search: Search,
};

const FALLBACK_ORDER_OPTIONS: SortOrderOption[] = [
  { order: SORT_ORDER.DESC, label: 'label.sort-descending', icon: 'barsDesc' },
  { order: SORT_ORDER.ASC, label: 'label.sort-ascending', icon: 'barsAsc' },
];

const KEY_SEPARATOR = '|';

const getOrderOptions = (field: string) =>
  SORT_ORDER_OPTIONS[field] ?? FALLBACK_ORDER_OPTIONS;

export interface ExploreSortDropdownProps {
  fieldList: SortingField[];
  sortField: string;
  sortOrder: string;
  onChange: (sortField: string, sortOrder: SORT_ORDER) => void;
}

const ExploreSortDropdown = ({
  fieldList,
  sortField,
  sortOrder,
  onChange,
}: ExploreSortDropdownProps) => {
  const { t } = useTranslation();

  // A stale URL can carry a field or order the active tab does not offer; fall back to
  // the first one so the trigger never renders blank.
  const selectedField =
    fieldList.find((field) => field.value === sortField) ?? fieldList[0];
  const selectedOrderOptions = getOrderOptions(selectedField?.value ?? '');
  const selectedOrder =
    selectedOrderOptions.find((option) => option.order === sortOrder) ??
    selectedOrderOptions[0];
  const selectedKey = selectedField
    ? `${selectedField.value}${KEY_SEPARATOR}${selectedOrder.order}`
    : null;
  const sortTitle = t('message.sorted-by-field-order', {
    field: selectedField?.name,
    order: t(selectedOrder.label),
  });

  const handleAction = (key: Key) => {
    const [field, order] = String(key).split(KEY_SEPARATOR);
    onChange(field, order as SORT_ORDER);
  };

  return (
    <Dropdown.Root>
      <Button
        hideFocusOutline
        aria-label={sortTitle}
        color="tertiary"
        data-testid="sorting-dropdown-label"
        iconLeading={SORT_ICONS[selectedOrder.icon]}
        iconTrailing={ChevronDown}
        size="sm"
        tooltip={sortTitle}>
        {/* Icon-only when the filter card is narrow; the tooltip and aria-label still name the sort. */}
        <span className="tw:@max-[1100px]:sr-only">{selectedField?.name}</span>
      </Button>

      <Dropdown.Popover className="tw:w-64">
        <Dropdown.Menu
          aria-label={t('label.sort-by')}
          selectedKeys={selectedKey ? [selectedKey] : []}
          onAction={handleAction}>
          {fieldList.map((field, index) => (
            <Fragment key={field.value}>
              {index > 0 && <Dropdown.Separator />}
              <Dropdown.Section aria-label={field.name}>
                <Dropdown.SectionHeader className="tw:px-4 tw:pt-1.5 tw:pb-1 tw:text-xs tw:font-semibold tw:text-quaternary">
                  {field.name}
                </Dropdown.SectionHeader>
                {getOrderOptions(field.value).map((option) => (
                  <Dropdown.Item
                    data-testid={`sort-option-${field.value}-${option.order}`}
                    icon={SORT_ICONS[option.icon]}
                    id={`${field.value}${KEY_SEPARATOR}${option.order}`}
                    key={option.order}
                    textValue={t(option.label)}>
                    {({ isSelected }) => (
                      <Box align="center" justify="between">
                        {t(option.label)}
                        {isSelected && (
                          <Check aria-hidden="true" className="tw:size-4" />
                        )}
                      </Box>
                    )}
                  </Dropdown.Item>
                ))}
              </Dropdown.Section>
            </Fragment>
          ))}
        </Dropdown.Menu>
      </Dropdown.Popover>
    </Dropdown.Root>
  );
};

export default ExploreSortDropdown;
