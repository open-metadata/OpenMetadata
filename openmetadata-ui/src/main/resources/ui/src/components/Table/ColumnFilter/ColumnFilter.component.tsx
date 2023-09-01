/*
 *  Copyright 2023 Collate.
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
import { Menu } from 'antd';
import Checkbox, { CheckboxChangeEvent } from 'antd/lib/checkbox/Checkbox';
import { FilterDropdownProps } from 'antd/lib/table/interface';
import { startCase } from 'lodash';
import React from 'react';

export const ColumnFilter = ({
  setSelectedKeys,
  selectedKeys,
  confirm,
  filters,
}: FilterDropdownProps) => {
  const handleClick = (e: CheckboxChangeEvent) => {
    const checkedKey = e.target.value;
    if (selectedKeys.indexOf(checkedKey) > -1) {
      setSelectedKeys(selectedKeys.filter((key) => key !== checkedKey));
    } else {
      setSelectedKeys([...selectedKeys, checkedKey]);
    }
    confirm();
  };

  return (
    <Menu
      items={filters?.map((f) => ({
        key: f.value as string,
        label: (
          <Checkbox
            checked={selectedKeys.indexOf(f.value as React.Key) > -1}
            value={f.value}
            onChange={handleClick}>
            {startCase(f.text as string)}
          </Checkbox>
        ),
      }))}
    />
  );
};
