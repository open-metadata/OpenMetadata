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

/**
 * `tw:contents` keeps this wrapper out of layout entirely, so it is a test
 * handle and nothing else. Without it a value control can only be reached
 * through RAQB's internal `.rule--widget--*` classes.
 */
const VALUE_TEST_ID_WRAPPER = 'tw:contents';

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

  // Accumulate every fetched option in a bounded, id-keyed map. Async results
  // are additive: a later fetch — the eager default ('') seed, or a transient
  // empty value react-aria emits on focus/blur — can only ADD entries, never
  // drop the option the user just searched for. That makes the widget immune to
  // the order in which react-aria fires searches, which under load caused the
  // list to snap back to the unfiltered default catalogue mid-selection (the
  // server did return the typed option; the default reload simply overwrote it).
  // The list is shown unfiltered (see filterOption below), so once the typed
  // option has been fetched it stays selectable regardless of later fetches.
  const ASYNC_ITEM_CAP = 500;
  const [asyncItemMap, setAsyncItemMap] = useState<Map<string, SelectItemType>>(
    () => new Map()
  );
  const asyncItems = useMemo(
    () => Array.from(asyncItemMap.values()),
    [asyncItemMap]
  );
  const allItems = isAsync ? asyncItems : staticItems;

  const selectedItems = useMemo(
    () =>
      valueArray.map(
        (id) => allItems.find((item) => item.id === id) ?? { id, label: id }
      ),

    [valueArray.join(','), allItems]
  );

  const loadAsync = useCallback(
    async (search: string) => {
      if (!asyncFetch) {
        return;
      }
      const result = await asyncFetch(search);
      const fetched = (result.values as ListItem[]).map((item) => ({
        id: String(item.value),
        label: String(item.title ?? item.value),
      }));
      if (fetched.length === 0) {
        return;
      }
      setAsyncItemMap((prev) => {
        const next = new Map(prev);
        fetched.forEach((item) => {
          // Re-insert so the entry counts as most-recently-seen for eviction.
          next.delete(item.id);
          next.set(item.id, item);
        });
        while (next.size > ASYNC_ITEM_CAP) {
          const oldest = next.keys().next().value;
          if (oldest === undefined) {
            break;
          }
          next.delete(oldest);
        }

        return next;
      });
    },
    [asyncFetch]
  );

  // Seed the default catalogue once when async search activates so the list has
  // options before the user types. Results accumulate, so this can never
  // clobber a query already in progress.
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
    <div
      className={VALUE_TEST_ID_WRAPPER}
      data-testid="advanced-search-value-multiselect">
      <Autocomplete
        isDisabled={readonly}
        items={allItems}
        placeholder={placeholder ?? 'Select'}
        selectedItems={selectedItems}
        onItemCleared={handleItemCleared}
        onItemInserted={handleItemInserted}
        // Results are filtered server-side, so keep the built-in client filter
        // off (filterOption: () => true) — the option label need not literally
        // contain the raw query (e.g. an owner's display name vs the typed value),
        // and client-filtering it would wrongly hide valid server matches. The
        // accumulated result set keeps the typed option present regardless of any
        // later default ('') fetch, so the list always still contains it.
        {...(isAsync
          ? { filterOption: () => true, onSearchChange: loadAsync }
          : {})}>
        {(item) => (
          <Autocomplete.Item id={item.id} key={item.id}>
            {item.label}
          </Autocomplete.Item>
        )}
      </Autocomplete>
    </div>
  );
};

export default OMMultiSelectWidget;
