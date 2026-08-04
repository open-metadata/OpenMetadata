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

  // The search string of the most recent fetch request. A response may only
  // publish its results if the user is still searching for that exact string,
  // so a slower or later request — in particular the eager default ('') load
  // or a transient empty value emitted by react-aria — can never overwrite the
  // options for what the user has actually typed. Keying on the search string
  // (rather than a monotonic counter) is what makes this safe: with a counter,
  // a late '' request has the highest id and wins, repopulating the list with
  // the unfiltered default catalogue while the input still holds the query.
  const latestSearchRef = useRef<string | null>(null);

  const loadAsync = useCallback(
    async (search: string) => {
      if (!asyncFetch) {
        return;
      }
      latestSearchRef.current = search;
      const result = await asyncFetch(search);
      if (latestSearchRef.current !== search) {
        return;
      }
      setAsyncItems(
        (result.values as ListItem[]).map((item) => ({
          id: String(item.value),
          label: String(item.title ?? item.value),
        }))
      );
    },
    [asyncFetch]
  );

  // Seed the default catalogue exactly once when async search activates. Keying
  // this on the field config (which react-awesome-query-builder rebuilds on
  // every rule re-render) re-ran the effect mid-interaction, and its
  // setAsyncItems([]) + loadAsync('') wiped the options the user had just
  // narrowed to. The value widget remounts when the field itself changes, so a
  // once-per-mount seed still refreshes for a new field.
  const didSeedRef = useRef(false);

  useEffect(() => {
    if (isAsync && !didSeedRef.current) {
      didSeedRef.current = true;
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
