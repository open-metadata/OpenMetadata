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
import { FormSelectItem, Select } from '@openmetadata/ui-core-components';
import { useState } from 'react';

interface ProfilerColumnSelectProps {
  items: FormSelectItem[];
  selectedKey: string | null;
  label: string;
  placeholder: string;
  testId: string;
  isDisabled: boolean;
  isInvalid: boolean;
  onBlur: () => void;
  onSelectionChange: (key: string | number | null) => void;
}

export const ProfilerColumnSelect = ({
  items,
  selectedKey,
  label,
  placeholder,
  testId,
  isDisabled,
  isInvalid,
  onBlur,
  onSelectionChange,
}: ProfilerColumnSelectProps) => {
  const [search, setSearch] = useState('');
  const filteredItems = items.filter((item) =>
    (item.label ?? String(item.id))
      .toLocaleLowerCase()
      .includes(search.toLocaleLowerCase())
  );

  return (
    <Select.ComboBox
      aria-label={label}
      className="tw:min-w-0 tw:flex-1"
      data-testid={testId}
      fontSize="sm"
      isDisabled={isDisabled}
      isInvalid={isInvalid}
      items={filteredItems}
      placeholder={placeholder}
      selectedKey={selectedKey}
      shortcut={false}
      showSearchIcon={false}
      onBlur={onBlur}
      onInputChange={setSearch}
      onOpenChange={(isOpen) => {
        if (isOpen) {
          setSearch('');
        }
      }}
      onSelectionChange={onSelectionChange}>
      {(item) => (
        <Select.Item id={item.id} isDisabled={item.isDisabled}>
          {item.label}
        </Select.Item>
      )}
    </Select.ComboBox>
  );
};
