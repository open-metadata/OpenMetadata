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
import { Select, SelectItemType } from '@openmetadata/ui-core-components';
import type {
  ListItem,
  SelectWidgetProps,
} from '@react-awesome-query-builder/ui';
import type { FC } from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';

const toSelectItems = (
  listValues: SelectWidgetProps['listValues']
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

const OMSelectWidget: FC<SelectWidgetProps> = ({
  value,
  setValue,
  placeholder,
  readonly,
  listValues,
  asyncFetch,
  useAsyncSearch,
  field,
}) => {
  const staticItems = toSelectItems(listValues);
  // Seed with the current value as a placeholder so the widget shows
  // something while the async fetch is in-flight. The real items replace
  // this when loadAsync completes.
  const [items, setItems] = useState<SelectItemType[]>(() => {
    if (staticItems.length > 0) {
      return staticItems;
    }
    if (value !== null && value !== undefined) {
      return [{ id: String(value), label: String(value) }];
    }

    return [];
  });
  const requestIdRef = useRef(0);
  const defaultOptionsRef = useRef<SelectItemType[]>(staticItems);
  const fieldKey = typeof field === 'string' ? field : JSON.stringify(field);

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
        const mapped = (result.values as ListItem[]).map((item) => ({
          id: String(item.value),
          label: String(item.title ?? item.value),
        }));
        if (search === '') {
          defaultOptionsRef.current = mapped;
        }
        setItems(mapped);
      }
    },
    [asyncFetch]
  );

  useEffect(() => {
    if (useAsyncSearch && asyncFetch) {
      loadAsync('');
    }
  }, [fieldKey, useAsyncSearch]);

  // The label React Aria puts in the input while a value is selected.
  const selectedLabel =
    value === null || value === undefined
      ? undefined
      : items.find((item) => item.id === String(value))?.label;

  if (useAsyncSearch && asyncFetch) {
    return (
      <div
        className={VALUE_TEST_ID_WRAPPER}
        data-testid="advanced-search-value-select">
        <Select.ComboBox
          // While the async fetch is in flight the typed text transiently
          // filters the previous results to zero matches; without this flag
          // React Aria closes the popup at that moment and it stays closed
          // when the real results arrive.
          allowsEmptyCollection
          isDisabled={readonly}
          items={items}
          placeholder={placeholder}
          selectedKey={
            value !== null && value !== undefined ? String(value) : undefined
          }
          shortcut={false}
          showSearchIcon={false}
          size="sm"
          onInputChange={(v) => {
            // React Aria echoes the selected item's label back through
            // `onInputChange` when the popup reopens. Refetching on that echo
            // searches for the value already chosen, so the list collapses to
            // the single option the user picked and they cannot switch to
            // another one. Only a genuinely different search term refetches.
            if (v === selectedLabel) {
              return;
            }
            loadAsync(v);
          }}
          onOpenChange={(isOpen) => {
            if (isOpen && defaultOptionsRef.current.length > 0) {
              // Restore cached defaults immediately so the popup is not empty
              // while the user types. Do NOT call loadAsync('') here — doing so
              // sets pendingResolve in the shared autocomplete closure. If the
              // 300 ms debounce for the default fetch fires before the user's
              // typed-search fill() completes, the default API response will
              // steal resolve_searchData and call it with default buckets,
              // clobbering the search result even though the search API fires
              // and responds correctly afterward.
              setItems(defaultOptionsRef.current);
            }
          }}
          onSelectionChange={(key) =>
            setValue(key !== null ? String(key) : null)
          }>
          {(item) => (
            <Select.Item id={item.id} key={item.id}>
              {item.label}
            </Select.Item>
          )}
        </Select.ComboBox>
      </div>
    );
  }

  return (
    <div
      className={VALUE_TEST_ID_WRAPPER}
      data-testid="advanced-search-value-select">
      <Select
        isDisabled={readonly}
        items={items}
        placeholder={placeholder}
        selectedKey={
          value !== null && value !== undefined ? String(value) : null
        }
        size="sm"
        onSelectionChange={(key) =>
          setValue(key !== null ? String(key) : null)
        }>
        {(item) => (
          <Select.Item id={item.id} key={item.id}>
            {item.label}
          </Select.Item>
        )}
      </Select>
    </div>
  );
};

export default OMSelectWidget;
