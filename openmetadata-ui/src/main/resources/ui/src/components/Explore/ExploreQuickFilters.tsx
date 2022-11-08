/*
 *  Copyright 2021 Collate
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
import { Button, Dropdown, Menu, Space } from 'antd';
import { uniqueId } from 'lodash';
import React, { FC, useCallback, useMemo } from 'react';
import { getDropDownItems } from '../../utils/AdvancedSearchUtils';
import { ExploreQuickFilterField } from './explore.interface';
import AdvancedField from './ExploreQuickFilter';

interface Props {
  index: string;
  fields: Array<ExploreQuickFilterField>;
  onFieldRemove: (value: string) => void;
  onClear: () => void;
  onFieldValueSelect: (field: ExploreQuickFilterField) => void;
  onFieldSelect: (value: string) => void;
}

const AdvancedFields: FC<Props> = ({
  fields,
  onFieldRemove,
  onClear,
  index,
  onFieldValueSelect,
  onFieldSelect,
}) => {
  const handleMenuItemClick = useCallback((menuInfo) => {
    onFieldSelect(menuInfo.key);
  }, []);

  const menu = useMemo(() => {
    return (
      <Menu
        items={getDropDownItems(index).map((option) => ({
          ...option,
          disabled: Boolean(fields.find((f) => f.key === option.key)),
          onClick: handleMenuItemClick,
          'data-testid': 'dropdown-menu-item',
        }))}
      />
    );
  }, [onFieldSelect, fields, index]);

  //   useEffect(() => {
  //     fields.length < 2 ?
  //   })

  return (
    <Space wrap>
      {fields.map((field) => (
        <AdvancedField
          field={field}
          index={index}
          key={uniqueId()}
          onFieldRemove={onFieldRemove}
          onFieldValueSelect={onFieldValueSelect}
        />
      ))}
      <Dropdown
        data-testid="quick-filter-dropdown"
        overlay={menu}
        trigger={['click']}>
        <Button ghost type="primary">
          <Space>
            Quick Filters
            <DownOutlined />
          </Space>
        </Button>
      </Dropdown>
      {Boolean(fields.length) && (
        <span
          className="tw-text-primary tw-self-center tw-cursor-pointer"
          data-testid="clear-all-button"
          onClick={onClear}>
          Clear All
        </span>
      )}
    </Space>
  );
};

export default AdvancedFields;
