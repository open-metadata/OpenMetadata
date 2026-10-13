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
import { ChevronDown, ChevronUp } from '@openmetadata/ui-core-components/icons';
import { Key, useState } from 'react';

export interface SortOption {
  key: string;
  label: string;
}

export interface WidgetSortFilterProps {
  sortOptions: SortOption[];
  selectedSortBy: string;
  onSortChange: (key: string) => void;
  isEditView?: boolean;
}

const WidgetSortFilter = ({
  sortOptions,
  selectedSortBy,
  onSortChange,
  isEditView = false,
}: WidgetSortFilterProps) => {
  const [isOpen, setIsOpen] = useState<boolean>(false);

  if (isEditView) {
    return null;
  }

  const selectedLabel = sortOptions.find(
    (option) => option.key === selectedSortBy
  )?.label;

  return (
    <Dropdown.Root isOpen={isOpen} onOpenChange={setIsOpen}>
      <Button
        className="widget-header-options"
        color="secondary"
        data-testid="widget-sort-by-dropdown"
        iconTrailing={
          isOpen ? <ChevronUp size={12} /> : <ChevronDown size={12} />
        }
        size="sm">
        {selectedLabel}
      </Button>
      <Dropdown.Popover className="tw:w-auto" placement="bottom end">
        <Dropdown.Menu
          aria-label={selectedLabel}
          selectionMode="none"
          onAction={(key: Key) => onSortChange(String(key))}>
          {sortOptions.map((option) => (
            <Dropdown.Item
              className={
                option.key === selectedSortBy
                  ? 'tw:[&>div]:bg-active'
                  : undefined
              }
              id={option.key}
              key={option.key}
              label={option.label}
            />
          ))}
        </Dropdown.Menu>
      </Dropdown.Popover>
    </Dropdown.Root>
  );
};

export default WidgetSortFilter;
