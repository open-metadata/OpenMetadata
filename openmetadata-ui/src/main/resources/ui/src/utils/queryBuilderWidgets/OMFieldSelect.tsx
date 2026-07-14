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
import type { FieldProps } from '@react-awesome-query-builder/ui';
import type { FC } from 'react';
import { useMemo, useRef, useState } from 'react';

const OMFieldSelect: FC<FieldProps> = ({
  items,
  selectedKey,
  setField,
  readonly,
  placeholder,
}) => {
  // RAQB recreates `items` on every render. Keep the mapped array's identity
  // stable across content-equal renders: react-aria rebuilds the ComboBox
  // collection when the items identity changes, which resets an uncontrolled
  // input back to the selected item's label and closes the open popup.
  const itemsKey = items
    .map((item) => `${item.path ?? item.key} ${item.label}`)
    .join('');
  const selectItems: SelectItemType[] = useMemo(
    () =>
      items.map((item) => ({
        // For nested fields (e.g. custom properties) `key` is only the leaf
        // segment — setField needs the full dotted path or the selection is
        // silently ignored and the cascade never advances to the next level.
        id: item.path ?? item.key,
        label: item.label,
      })),

    [itemsKey]
  );

  // Control inputValue explicitly: RAQB re-renders (triggered by parent forms
  // and query actions) race the open popup, and react-aria's uncontrolled
  // input resets to the selected label on every collection rebuild — wiping
  // the user's in-progress filter text. A controlled value can't be clobbered.
  const selectedLabel = useMemo(
    () => selectItems.find((item) => item.id === selectedKey)?.label ?? '',
    [selectItems, selectedKey]
  );
  const [inputValue, setInputValue] = useState(selectedLabel);
  const lastSelectedKeyRef = useRef(selectedKey);
  if (lastSelectedKeyRef.current !== selectedKey) {
    lastSelectedKeyRef.current = selectedKey;
    setInputValue(selectedLabel);
  }

  return (
    <Select.ComboBox
      // Keep the popup open on transiently-empty filter results — React Aria
      // otherwise closes it and the interaction dead-ends.
      allowsEmptyCollection
      inputValue={inputValue}
      isDisabled={readonly}
      items={selectItems}
      placeholder={placeholder ?? 'Select field'}
      selectedKey={selectedKey ?? undefined}
      shortcut={false}
      showSearchIcon={false}
      size="sm"
      onInputChange={setInputValue}
      onSelectionChange={(key) => {
        if (key) {
          setField(String(key));
        }
      }}>
      {(item) => (
        <Select.Item id={item.id} key={item.id}>
          {item.label}
        </Select.Item>
      )}
    </Select.ComboBox>
  );
};

export default OMFieldSelect;
