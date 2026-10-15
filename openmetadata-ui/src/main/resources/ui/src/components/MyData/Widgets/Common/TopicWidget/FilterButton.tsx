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

import { Select } from '@openmetadata/ui-core-components';
import React from 'react';

export interface FilterButtonOption {
  value: string;
  label: string;
}

export interface FilterButtonProps {
  /** Names the control for assistive tech; the trigger shows the selection. */
  label: string;
  options: FilterButtonOption[];
  value: string;
  onChange: (value: string) => void;
  iconLeading?: React.FC<{ className?: string }>;
  testId?: string;
}

/**
 * A topic card's filter: the core `Select` at its small size, as the Audit
 * Hub's filters use it — a neutral trigger showing the current choice, and a
 * check on the selected option. Every card filter is single-choice and always
 * holds a value, so the trigger does not need a "something is selected" state.
 * The trigger fits its choice rather than a fixed width, so a label with a
 * leading icon ("Last 7 days") is never cut short.
 */
export const FilterButton: React.FC<FilterButtonProps> = ({
  label,
  options,
  value,
  onChange,
  iconLeading,
  testId,
}) => (
  <Select
    aria-label={label}
    className="tw:w-fit tw:min-w-36"
    data-testid={testId}
    icon={iconLeading}
    items={options.map((option) => ({ id: option.value, label: option.label }))}
    selectedKey={value}
    size="sm"
    onSelectionChange={(key) => {
      if (key !== null) {
        onChange(String(key));
      }
    }}>
    {(item) => (
      <Select.Item data-testid={item.id} id={item.id}>
        {item.label}
      </Select.Item>
    )}
  </Select>
);

export default FilterButton;
