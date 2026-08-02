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
}: MultiSelectWidgetProps) => {
  const valueArray = Array.isArray(value) ? value.map(String) : [];
  const isAsync = Boolean(useAsyncSearch && asyncFetch);

  // Static options come straight from the current field's `listValues`. RAQB
  // reuses this widget instance when the rule's field changes (Owners -> Tier),
  // so deriving the options from props each render — instead of caching them in
  // state on mount — is what makes the dropdown reflect the newly selected
  // field instead of the previous one. Keyed on serialized content so the
  // memoized reference stays stable across content-equal renders (a new array
  // each render would retrigger Autocomplete's selectedItems effect in a loop).
  const staticItems = useMemo(
    () => toSelectItems(listValues),

    [JSON.stringify(listValues ?? null)]
  );

  // Async fields fetch their catalogue on demand; kept separate from the static
  // list so switching between async and static fields can't cross-contaminate.
  const [asyncItems, setAsyncItems] = useState<SelectItemType[]>([]);
  const allItems = isAsync ? asyncItems : staticItems;

  // Resolve the selected ids into items using the current catalogue; ids not
  // yet present (async results still loading) fall back to the raw id.
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

  // (Re)load whenever the async field changes. Clear the previous field's
  // results first so a stale catalogue never shows while the fetch is in
  // flight; the requestId guard drops any late response from the old field.
  useEffect(() => {
    if (isAsync) {
      setAsyncItems([]);
      loadAsync('');
    }
  }, [isAsync, loadAsync]);

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
