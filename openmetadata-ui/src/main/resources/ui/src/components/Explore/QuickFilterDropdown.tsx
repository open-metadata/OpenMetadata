/*
 *  Copyright 2025 Collate.
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
import { Button, Dropdown } from '@openmetadata/ui-core-components';
import { ChevronDown } from '@untitledui/icons';
import { isUndefined } from 'lodash';
import { FC, useMemo } from 'react';
import { getSelectedOptionLabelString } from '../../utils/AdvancedSearchPureUtils';
import { QuickFilterDropdownProps } from './QuickFilterDropdown.interface';

/**
 * Untitled-UI (react-aria) variant of {@link SearchDropdown}, built on the
 * core `Dropdown` primitive. Its popover renders in the react-aria top layer,
 * so it stays interactive inside a SlideoutMenu drawer where an Ant Design
 * popup (portaled to document.body) would become inert.
 */
const QuickFilterDropdown: FC<QuickFilterDropdownProps> = ({
  label,
  searchKey,
  options,
  selectedKeys,
  hideCounts = false,
  singleSelect = false,
  showSelectedCounts = false,
  onChange,
  onGetInitialOptions,
}) => {
  const selectedIds = useMemo(
    () => new Set(selectedKeys.map((option) => option.key)),
    [selectedKeys]
  );

  const selectedLabel = showSelectedCounts
    ? `(${selectedKeys.length})`
    : getSelectedOptionLabelString(selectedKeys);

  return (
    <Dropdown.Root
      onOpenChange={(open) => open && onGetInitialOptions?.(searchKey)}>
      <Button
        color="secondary"
        data-testid={searchKey}
        iconTrailing={<ChevronDown className="tw:size-4" />}
        size="sm">
        <span data-testid={`search-dropdown-${label}`}>
          {label}
          {selectedKeys.length > 0 && (
            <span className="tw:text-brand-secondary">{`: ${selectedLabel}`}</span>
          )}
        </span>
      </Button>
      <Dropdown.Popover>
        <Dropdown.Menu
          aria-label={label}
          disallowEmptySelection={false}
          selectedKeys={selectedIds}
          selectionMode={singleSelect ? 'single' : 'multiple'}
          onSelectionChange={(keys) =>
            onChange(
              options.filter(
                (option) => keys === 'all' || keys.has(option.key)
              ),
              searchKey
            )
          }>
          {options.map((option) => (
            <Dropdown.Item
              showCheckbox
              addon={
                hideCounts || isUndefined(option.count)
                  ? undefined
                  : String(option.count)
              }
              id={option.key}
              key={option.key}>
              {option.label}
            </Dropdown.Item>
          ))}
        </Dropdown.Menu>
      </Dropdown.Popover>
    </Dropdown.Root>
  );
};

export default QuickFilterDropdown;
