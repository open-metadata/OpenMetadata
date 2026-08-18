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
import type { SelectItemType } from '@openmetadata/ui-core-components';
import { useEffect } from 'react';
import { useListData } from 'react-stately';

// MultiSelect owns mutable ListData, while navigation can change its external
// value independently, so reconcile the two only when that value changes.
export const useSyncedListData = (
  selectedValues: string[],
  availableItems: SelectItemType[]
) => {
  const selectedItems = useListData<SelectItemType>({ initialItems: [] });
  const selectedValueKey = selectedValues.join(',');

  useEffect(() => {
    const selectedValueSet = new Set(selectedValues);
    selectedItems.items.forEach(({ id }) => {
      if (!selectedValueSet.has(String(id))) {
        selectedItems.remove(id);
      }
    });

    const renderedValueSet = new Set(
      selectedItems.items.map(({ id }) => String(id))
    );
    selectedValues.forEach((value) => {
      if (!renderedValueSet.has(value)) {
        const item = availableItems.find(({ id }) => String(id) === value);
        if (item) {
          selectedItems.append(item);
        }
      }
    });
    // useListData returns a new facade on every render and must not trigger
    // synchronization when the external selection itself is unchanged.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [availableItems, selectedValueKey]);

  return selectedItems;
};
