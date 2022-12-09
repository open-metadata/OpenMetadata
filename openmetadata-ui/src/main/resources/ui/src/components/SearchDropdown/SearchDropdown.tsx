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
import {
  Button,
  Card,
  Checkbox,
  Dropdown,
  Input,
  MenuItemProps,
  MenuProps,
  Space,
} from 'antd';
import React, { ChangeEvent, FC, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import './SearchDropdown.less';

interface DropDownOption {
  key: string;
  label: string;
}
interface SearchDropdownProps {
  label: string;
  options: DropDownOption[];
  searchKey: string;
  selectedKeys: string[];
  showClear?: boolean;
  onChange: (values: string[], searchKey: string) => void;
  onSearch: (searchText: string, searchKey: string) => void;
}

const SearchDropdown: FC<SearchDropdownProps> = ({
  label,
  options,
  searchKey,
  selectedKeys,
  showClear,
  onChange,
  onSearch,
}) => {
  const { t } = useTranslation();

  const [isDropDownOpen, setIsDropDownOpen] = useState<boolean>(false);

  // derive menu props from options and selected keys
  const menuOptions: MenuProps['items'] = useMemo(() => {
    return options.map((option) => {
      const isSelected = selectedKeys.includes(option.key);

      return {
        key: option.key,
        label: (
          <Space size={6}>
            <Checkbox checked={isSelected} />
            {option.label}
          </Space>
        ),
      };
    });
  }, [options, selectedKeys]);

  // handle menu item click
  const handleMenuItemClick: MenuItemProps['onClick'] = (info) => {
    const currentKey = info.key;
    const isSelected = selectedKeys.includes(currentKey);

    const updatedValues = isSelected
      ? selectedKeys.filter((v) => v !== currentKey)
      : [...selectedKeys, currentKey];

    // call on change with updated value
    onChange(updatedValues, searchKey);
  };

  // handle clear all
  const handleClear = () => onChange([], searchKey);

  // handle search
  const handleSearch = (e: ChangeEvent<HTMLInputElement>) => {
    const { value } = e.target;

    onSearch(value, searchKey);
  };

  return (
    <Dropdown
      data-testid={searchKey}
      dropdownRender={(menuNode) => {
        return (
          <Card className="custom-dropdown-render">
            <Space direction="vertical" size={4}>
              <Input
                placeholder={`Search ${label}...`}
                onChange={handleSearch}
              />
              {showClear && (
                <Button className="p-0" type="link" onClick={handleClear}>
                  {t('label.clear-all')}
                </Button>
              )}
              {menuNode}
            </Space>
          </Card>
        );
      }}
      key={searchKey}
      menu={{ items: menuOptions, onClick: handleMenuItemClick }}
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
