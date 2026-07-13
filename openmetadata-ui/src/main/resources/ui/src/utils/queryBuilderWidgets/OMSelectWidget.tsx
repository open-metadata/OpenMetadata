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

const OMSelectWidget: FC<SelectWidgetProps> = ({
  value,
  setValue,
  placeholder,
  readonly,
  listValues,
  asyncFetch,
  useAsyncSearch,
}) => {
  const staticItems = toSelectItems(listValues);
  const [items, setItems] = useState<SelectItemType[]>(staticItems);
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
        setItems(
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

  if (useAsyncSearch && asyncFetch) {
    return (
      <Select.ComboBox
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
          loadAsync(v);
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
    );
  }

  return (
    <Select
      isDisabled={readonly}
      items={items}
      placeholder={placeholder}
      selectedKey={value !== null && value !== undefined ? String(value) : null}
      size="sm"
      onSelectionChange={(key) => setValue(key !== null ? String(key) : null)}>
      {(item) => (
        <Select.Item id={item.id} key={item.id}>
          {item.label}
        </Select.Item>
      )}
    </Select>
  );
};

export default OMSelectWidget;
