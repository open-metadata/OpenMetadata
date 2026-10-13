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
import { QUERY_BUILDER_POPOVER_CLASS } from '../queryBuilder/types';

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

  // Label cache for picked values, not the option list: an id the current search
  // no longer returns still has to render as its name.
  const ASYNC_ITEM_CAP = 500;
  const [asyncItemMap, setAsyncItemMap] = useState<Map<string, SelectItemType>>(
    () => new Map()
  );

  // Offer only the latest fetch: keeping every option ever fetched left the whole
  // catalogue on screen while the search narrowed server-side.
  const [asyncResultIds, setAsyncResultIds] = useState<string[]>([]);
  const asyncItems = useMemo(
    () =>
      asyncResultIds
        .map((id) => asyncItemMap.get(id))
        .filter((item): item is SelectItemType => Boolean(item)),

    [asyncResultIds, asyncItemMap]
  );
  const allItems = isAsync ? asyncItems : staticItems;

  const selectedItems = useMemo(
    () =>
      valueArray.map(
        (id) =>
          (isAsync
            ? asyncItemMap.get(id)
            : staticItems.find((item) => item.id === id)) ?? { id, label: id }
      ),

    [valueArray.join(','), isAsync, asyncItemMap, staticItems]
  );

  // A slower earlier fetch must not overwrite the newest results.
  const latestRequestRef = useRef(0);

  const loadAsync = useCallback(
    async (search: string) => {
      if (!asyncFetch) {
        return;
      }
      const requestId = ++latestRequestRef.current;
      const result = await asyncFetch(search);
      if (requestId !== latestRequestRef.current) {
        return;
      }
      const fetched = (result.values as ListItem[]).map((item) => ({
        id: String(item.value),
        label: String(item.title ?? item.value),
      }));
      if (fetched.length > 0) {
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
      }
      setAsyncResultIds(fetched.map((item) => item.id));
    },
    [asyncFetch]
  );

  // Seed the default catalogue once when async search activates so the list has options before the user types.
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
      // Picking clears the input without reporting a search, so restore the
      // unfiltered catalogue — otherwise a second value means typing again.
      if (isAsync) {
        loadAsync('');
      }
    },

    [valueArray.join(','), setValue, isAsync, loadAsync]
  );

  const handleItemCleared = useCallback(
    (key: Key) => {
      const next = valueArray.filter((v) => v !== String(key));
      setValue(next.length > 0 ? next : null);
    },

    [valueArray.join(','), setValue]
  );

  return (
    // `tw:contents` keeps the wrapper out of layout: it is a test handle and nothing else.
    <div
      className="tw:contents"
      data-testid="advanced-search-value-multiselect">
      <Autocomplete
        isDisabled={readonly}
        items={allItems}
        placeholder={placeholder ?? 'Select'}
        popoverClassName={QUERY_BUILDER_POPOVER_CLASS}
        selectedItems={selectedItems}
        onItemCleared={handleItemCleared}
        onItemInserted={handleItemInserted}
        // Filtered server-side, so keep the client filter off: a label need not contain the raw query (an owner's
        // display name vs the typed value), and client-filtering would hide valid server matches.
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
