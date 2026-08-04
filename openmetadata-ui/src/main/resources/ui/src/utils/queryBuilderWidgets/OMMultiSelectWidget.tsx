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
import { Autocomplete, SelectItemType } from '@openmetadata/ui-core-components';
import type {
  ListItem,
  MultiSelectWidgetProps,
} from '@react-awesome-query-builder/ui';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Key } from 'react-aria-components';

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
  field,
}: MultiSelectWidgetProps) => {
  const valueArray = Array.isArray(value) ? value.map(String) : [];
  const isAsync = Boolean(useAsyncSearch && asyncFetch);
  const fieldKey = typeof field === 'string' ? field : JSON.stringify(field);

  const staticItems = useMemo(
    () => toSelectItems(listValues),

    [JSON.stringify(listValues ?? null)]
  );

  const [asyncItems, setAsyncItems] = useState<SelectItemType[]>([]);
  const allItems = isAsync ? asyncItems : staticItems;

  const selectedItems = useMemo(
    () =>
      valueArray.map(
        (id) => allItems.find((item) => item.id === id) ?? { id, label: id }
      ),

    [valueArray.join(','), allItems]
  );

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
        setAsyncItems(
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
    if (isAsync) {
      setAsyncItems([]);
      loadAsync('');
    }
  }, [fieldKey, isAsync]);

  const handleItemInserted = useCallback(
    (key: Key) => {
      setValue([...valueArray, String(key)]);
    },

    [valueArray.join(','), setValue]
  );

  const handleItemCleared = useCallback(
    (key: Key) => {
      const next = valueArray.filter((v) => v !== String(key));
      setValue(next.length > 0 ? next : null);
    },

    [valueArray.join(','), setValue]
  );

  return (
    <Autocomplete
      isDisabled={readonly}
      items={allItems}
      placeholder={placeholder ?? 'Select'}
      selectedItems={selectedItems}
      onItemCleared={handleItemCleared}
      onItemInserted={handleItemInserted}
      // For async catalogues the results are already filtered server-side, so
      // skip the built-in client filter and drive fetches from the search box.
      {...(isAsync
        ? { filterOption: () => true, onSearchChange: loadAsync }
        : {})}>
      {(item) => (
        <Autocomplete.Item id={item.id} key={item.id}>
          {item.label}
        </Autocomplete.Item>
      )}
    </Autocomplete>
  );
};

export default OMMultiSelectWidget;
