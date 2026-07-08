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

const OMFieldSelect: FC<FieldProps> = ({
  items,
  selectedKey,
  setField,
  readonly,
  placeholder,
}) => {
  const selectItems: SelectItemType[] = items.map((item) => ({
    id: item.key,
    label: item.label,
    supportingText: item.grouplabel,
  }));

  return (
    <Select
      isDisabled={readonly}
      items={selectItems}
      placeholder={placeholder ?? 'Select field'}
      selectedKey={selectedKey ?? null}
      size="sm"
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
    </Select>
  );
};

export default OMFieldSelect;
