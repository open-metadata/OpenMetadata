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
import { FormSelectItem } from '@openmetadata/ui-core-components';
import { FilterDescriptor, FilterValue } from './FilterChip.interface';

const getSelectedValues = (value: FilterValue): string[] => {
  if (Array.isArray(value)) {
    return value;
  }

  return typeof value === 'string' ? [value] : [];
};

export const getClassicFilterItems = (filter: FilterDescriptor) => {
  const selectedValues = getSelectedValues(filter.value);
  const items: FormSelectItem[] = filter.options.map(
    ({ value, label, subLabel }) => ({
      id: value,
      label,
      supportingText: subLabel,
    })
  );
  const selectedItems = selectedValues.map(
    (value) =>
      items.find((item) => item.id === value) ?? { id: value, label: value }
  );

  return {
    selectedValues,
    selectedItems,
    items: [
      ...items,
      ...selectedItems.filter(
        (item) => !items.some((option) => option.id === item.id)
      ),
    ],
  };
};
