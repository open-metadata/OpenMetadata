/*
 *  Copyright 2022 Collate
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

import { DownOutlined } from '@ant-design/icons';
import { Button, Card, Dropdown, Input, MenuProps, Space } from 'antd';
import React, { FC, useState } from 'react';
import './SearchDropdown.less';

export interface SearchDropdownProps {
  label: string;
  options: MenuProps['items'];
  key: string;
  showClear?: boolean;
  onSearch?: (searchText: string, key: string) => void;
  onChange?: (values: string[], key: string) => void;
}

const SearchDropdown: FC<SearchDropdownProps> = ({ label, options, key }) => {
  const [isDropDownOpen, setIsDropDownOpen] = useState<boolean>(false);

  return (
    <Dropdown
      data-testid={key}
      dropdownRender={(menuNode) => {
        return (
          <Card className="custom-dropdown-render">
            <Space direction="vertical" size={8}>
              <Input />
              {menuNode}
            </Space>
          </Card>
        );
      }}
      key={key}
      menu={{ items: options }}
      trigger={['click']}
      visible={isDropDownOpen}
      onVisibleChange={(visible) => setIsDropDownOpen(visible)}>
      <Button>
        <Space>
          {label}
          <DownOutlined />
        </Space>
      </Button>
    </Dropdown>
  );
};

export default SearchDropdown;
