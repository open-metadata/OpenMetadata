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

import { Badge, Divider, Dropdown, Menu, Space } from 'antd';
import { isEmpty, isNil, uniqueId } from 'lodash';
import React, { FC, useCallback, useEffect, useMemo } from 'react';
import { SearchIndex } from '../../enums/search.enum';
import { getDropDownItems } from '../../utils/AdvancedSearchUtils';
import SVGIcons, { Icons } from '../../utils/SvgUtils';
import { ExploreQuickFilterField } from './explore.interface';
import AdvancedField from './ExploreQuickFilter';

interface Props {
  index: SearchIndex;
  fields: Array<ExploreQuickFilterField>;
  onFieldRemove: (value: string) => void;
  onClear: () => void;
  onFieldValueSelect: (field: ExploreQuickFilterField) => void;
  onFieldSelect: (value: string) => void;
  onAdvanceSearch: () => void;
}

const ExploreQuickFilters: FC<Props> = ({
  fields,
  onFieldRemove,
  onClear,
  onAdvanceSearch,
  index,
  onFieldValueSelect,
  onFieldSelect,
}) => {
  const handleMenuItemClick = useCallback((menuInfo) => {
    onFieldSelect(menuInfo.key);
  }, []);

  const menuItems = useMemo(() => getDropDownItems(index), [index]);

  const menu = useMemo(() => {
    return (
      <Menu
        items={menuItems.map((option) => ({
          ...option,
          disabled: Boolean(fields.find((f) => f.key === option.key)),
          onClick: handleMenuItemClick,
          'data-testid': 'dropdown-menu-item',
        }))}
      />
    );
  }, [onFieldSelect, fields, menuItems]);

  useEffect(() => {
    onClear();
    handleMenuItemClick(menuItems[0]);
    handleMenuItemClick(menuItems[1]);
  }, [menuItems]);

  const filterCount = useMemo(
    () => fields.filter((field) => !isNil(field.value)).length,
    [fields]
  );

  return (
    <Space wrap size={[16, 16]}>
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
        className="cursor-pointer"
        data-testid="quick-filter-dropdown"
        overlay={menu}
        trigger={['click']}>
        <Badge count={filterCount} size="small">
          <SVGIcons alt="filter" icon={Icons.FILTER_PRIMARY} />
        </Badge>
      </Dropdown>
      <Divider type="vertical" />
      {!isEmpty(fields) && (
        <span
          className="tw-text-primary tw-self-center tw-cursor-pointer"
          data-testid="clear-all-button"
          onClick={onClear}>
          Clear All
        </span>
      )}
      <span
        className="tw-text-primary tw-self-center tw-cursor-pointer"
        data-testid="advance-search-button"
        onClick={onAdvanceSearch}>
        Advance Search
      </span>
    </Space>
  );
};

export default ExploreQuickFilters;
