/*
 *  Copyright 2022 Collate.
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
import React from 'react';

export interface SortingField {
  name: string;
  value: string;
}

export interface SortingDropdownProps {
  sortField: string;
  fieldList: SortingField[];
  handleFieldDropDown: (value: string) => void;
}

const SortingDropDown: React.FC<SortingDropdownProps> = ({
  fieldList,
  handleFieldDropDown,
  sortField,
}) => {
  const items = fieldList.map((field) => ({
    label: field.name,
    key: field.value,
    onClick: () => handleFieldDropDown(field.value),
    'data-testid': 'dropdown-menu-item',
  }));

  const label = fieldList.find((field) => field.value === sortField)?.name;

  return (
    <Dropdown.Root data-testid="dropdown">
      <Button
        className="tw:p-0"
        color="tertiary"
        data-testid="sorting-dropdown-label"
        iconTrailing={<ChevronDown size={14} />}>
        {label}
      </Button>

      <Dropdown.Popover>
        <Dropdown.Menu aria-label="Sorting Options">
          {items.map((item) => (
            <Dropdown.Item key={item.key} onClick={item.onClick}>
              {item.label}
            </Dropdown.Item>
          ))}
        </Dropdown.Menu>
      </Dropdown.Popover>
    </Dropdown.Root>
  );
};

export default SortingDropDown;
