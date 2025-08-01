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

import { DownOutlined, UpOutlined } from '@ant-design/icons';
import { Button, Dropdown } from 'antd';
import { MenuInfo } from 'rc-menu/lib/interface';
import { useState } from 'react';
import './widget-sort-filter.less';

export interface SortOption {
  key: string;
  label: string;
}

export interface WidgetSortFilterProps {
  sortOptions: SortOption[];
  selectedSortBy: string;
  onSortChange: (e: MenuInfo) => void;
  isEditView?: boolean;
}

const WidgetSortFilter = ({
  sortOptions,
  selectedSortBy,
  onSortChange,
  isEditView = false,
}: WidgetSortFilterProps) => {
  const [isOpen, setIsOpen] = useState<boolean>(false);

  const handleSortByClick = (e: MenuInfo) => {
    if (!isEditView) {
      onSortChange(e);
      setIsOpen(false);
    }
  };

  if (isEditView) {
    return null;
  }

  return (
    <Dropdown
      className="widget-header-options"
      getPopupContainer={(triggerNode: HTMLElement) => triggerNode}
      menu={{
        items: sortOptions,
        selectable: true,
        multiple: false,
        activeKey: selectedSortBy,
        onClick: handleSortByClick,
        className: 'widget-sort-filter-menu',
      }}
      open={isOpen}
      trigger={['click']}
      onOpenChange={(open) => setIsOpen(open)}>
      <Button
        className="widget-sort-by-dropdown"
        data-testid="widget-sort-by-dropdown">
        {sortOptions.find((option) => option.key === selectedSortBy)?.label}
        {isOpen ? (
          <UpOutlined className="widget-sort-filter-icon" />
        ) : (
          <DownOutlined className="widget-sort-filter-icon" />
        )}
      </Button>
    </Dropdown>
  );
};

export default WidgetSortFilter;
