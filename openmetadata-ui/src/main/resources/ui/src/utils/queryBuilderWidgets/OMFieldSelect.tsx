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
import { Autocomplete, SelectItemType } from '@openmetadata/ui-core-components';
import type { FieldProps } from '@react-awesome-query-builder/ui';
import type { FC, ReactNode } from 'react';
import { useMemo } from 'react';

const OMFieldSelect: FC<FieldProps> = ({
  items,
  selectedKey,
  setField,
  readonly,
  placeholder,
}) => {
  const selectItems: SelectItemType[] = useMemo(
    () => items.map((item) => ({ id: item.key, label: item.label })),
    [items]
  );

  const selectedLabel = selectedKey
    ? selectItems.find((i) => i.id === selectedKey)?.label ?? selectedKey
    : undefined;

  const selectedItemsValue = useMemo(
    () =>
      selectedKey
        ? [{ id: selectedKey, label: selectedLabel ?? selectedKey }]
        : [],
    [selectedKey, selectedLabel]
  );

  return (
    <Autocomplete
      icon={null}
      isDisabled={readonly}
      items={selectItems}
      placeholder={selectedLabel ?? placeholder ?? 'Select field'}
      renderTag={(): ReactNode => null}
      selectedItems={selectedItemsValue}
      onItemInserted={(key) => setField(String(key))}>
      {(item) => (
        <Autocomplete.Item id={item.id} key={item.id} label={item.label} />
      )}
    </Autocomplete>
  );
};

export default OMFieldSelect;
