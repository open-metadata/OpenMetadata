/*
 *  Copyright 2024 Collate.
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
import { MultiSelect, SelectItemType } from '@openmetadata/ui-core-components';
import type {
  ListItem,
  MultiSelectWidgetProps,
} from '@react-awesome-query-builder/ui';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { Key } from 'react-aria-components';
import { useListData } from 'react-stately';

const toSelectItems = (
  listValues: MultiSelectWidgetProps['listValues']
): SelectItemType[] => {
  if (!listValues) {
    return [];
  }
  if (Array.isArray(listValues)) {
    return (listValues as ListItem[]).map((item) => ({
      id: String(item.value),
      label: String(item.title ?? item.value),
    }));
  }

  return Object.entries(listValues).map(([k, v]) => ({
    id: k,
    label: v as string,
  }));
};

const OMMultiSelectWidget = ({
  value,
  setValue,
  placeholder,
  readonly,
  listValues,
  asyncFetch,
  useAsyncSearch,
}: MultiSelectWidgetProps) => {
  const valueArray = Array.isArray(value) ? value.map(String) : [];
  const staticItems = toSelectItems(listValues);
  const [allItems, setAllItems] = useState<SelectItemType[]>(staticItems);

  const selectedItems = useListData<SelectItemType>({
    initialItems: staticItems.filter((i) => valueArray.includes(i.id)),
  });

  useEffect(() => {
    const currentIds = new Set(selectedItems.items.map((i) => i.id));
    const targetIds = new Set(valueArray);

    for (const id of targetIds) {
      if (!currentIds.has(id)) {
        const item = allItems.find((i) => i.id === id);
        if (item) {
          selectedItems.append(item);
        }
      }
    }
    for (const item of selectedItems.items) {
      if (!targetIds.has(item.id)) {
        selectedItems.remove(item.id);
      }
    }
  }, [valueArray.join(',')]);

  const requestIdRef = useRef(0);

  const loadAsync = useCallback(
    async (search: string) => {
      if (!asyncFetch) {
        return;
      }
      // Guard against out-of-order responses: only the latest request may
      // set items, otherwise a slow earlier fetch overwrites newer results.
      const requestId = ++requestIdRef.current;
      const result = await asyncFetch(search);
      if (requestId === requestIdRef.current) {
        setAllItems(
          (result.values as ListItem[]).map((item) => ({
            id: String(item.value),
            label: String(item.title ?? item.value),
          }))
        );
      }
    },
    [asyncFetch]
  );

  useEffect(() => {
    if (useAsyncSearch && asyncFetch) {
      loadAsync('');
    }
  }, [useAsyncSearch, loadAsync]);

  const handleItemInserted = useCallback(
    (key: Key) => {
      setValue([...valueArray, String(key)]);
    },
    [valueArray, setValue]
  );

  const handleItemCleared = useCallback(
    (key: Key) => {
      const next = valueArray.filter((v) => v !== String(key));
      setValue(next.length > 0 ? next : null);
    },
    [valueArray, setValue]
  );

  return (
    <MultiSelect
      isDisabled={readonly}
      items={allItems}
      placeholder={placeholder ?? 'Select'}
      selectedItems={selectedItems}
      size="sm"
      onInputChange={(search: string) => loadAsync(search)}
      onItemCleared={handleItemCleared}
      onItemInserted={handleItemInserted}>
      {(item) => (
        <MultiSelect.Item id={item.id} key={item.id}>
          {item.label}
        </MultiSelect.Item>
      )}
    </MultiSelect>
  );
};

export default OMMultiSelectWidget;
