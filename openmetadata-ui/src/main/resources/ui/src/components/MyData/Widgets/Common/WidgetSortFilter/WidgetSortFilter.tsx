/*
 *  Copyright 2025 Collate.
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

import { Button, Dropdown } from 'antd';
import { MenuInfo } from 'rc-menu/lib/interface';
import { ReactNode } from 'react';
import './widget-sort-filter.less';

export interface SortOption {
  key: string;
  label: string;
}

export interface WidgetSortFilterProps {
  sortOptions: SortOption[];
  selectedSortBy: string;
  onSortChange: (key: string) => void;
  isEditView?: boolean;
  icon?: ReactNode;
  className?: string;
  dataTestId?: string;
}

const WidgetSortFilter = ({
  sortOptions,
  selectedSortBy,
  onSortChange,
  isEditView = false,
  icon,
  className = '',
  dataTestId = 'widget-sort-filter',
}: WidgetSortFilterProps) => {
  const handleSortByClick = (e: MenuInfo) => {
    if (!isEditView) {
      onSortChange(e.key);
    }
  };

  if (isEditView) {
    return null;
  }

  return (
    <Dropdown
      className={`widget-sort-filter ${className}`}
      data-testid={dataTestId}
      menu={{
        items: sortOptions,
        selectable: true,
        multiple: false,
        activeKey: selectedSortBy,
        onClick: handleSortByClick,
        className: 'widget-sort-filter-menu',
      }}
      trigger={['click']}>
      <Button data-testid="sort-filter-button">
        {icon}
        {sortOptions.find((option) => option.key === selectedSortBy)?.label}
      </Button>
    </Dropdown>
  );
};

export default WidgetSortFilter;
