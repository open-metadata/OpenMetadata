/*
 *  Copyright 2022 Collate.
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

import { Space, Typography } from 'antd';
import React from 'react';
import { ReactComponent as DropDownIcon } from '../../assets/svg/bottom-arrow.svg';
import { Dropdown } from '../common/AntdCompat';
;

export interface SortingField {
  name: string;
  value: string;
}

export interface SortingDropdownProps {
  sortField: string;
  fieldList: SortingField[];
  handleFieldDropDown: (value: string) => void;
}

const SortingDropDown: React.FC<SortingDropdownProps> = ({
  fieldList,
  handleFieldDropDown,
  sortField,
}) => {
  const items = fieldList.map((field) => ({
    label: field.name,
    key: field.value,
    onClick: () => handleFieldDropDown(field.value),
    'data-testid': 'dropdown-menu-item',
  }));

  const label = fieldList.find((field) => field.value === sortField)?.name;

  return (
    <Dropdown
      className="self-end m-r-xs cursor-pointer sorting-dropdown"
      data-testid="dropdown"
      menu={{
        items,
      }}
      trigger={['click']}>
      <Space align="baseline" data-testid="sorting-dropdown-label" size={4}>
        <Typography.Text>{label}</Typography.Text>
        <DropDownIcon className="align-middle" height={16} width={16} />
      </Space>
    </Dropdown>
  );
};

export default SortingDropDown;
