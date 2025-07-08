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

import { DragOutlined, MoreOutlined } from '@ant-design/icons';
import { Button, Col, Row, Typography } from 'antd';
import { MenuInfo } from 'rc-menu/lib/interface';
import { ReactNode } from 'react';
import { Layout } from 'react-grid-layout';
import { WidgetConfig } from '../../../../../pages/CustomizablePage/CustomizablePage.interface';
import WidgetMoreOptions from '../WidgetMoreOptions/WidgetMoreOptions';
import WidgetSortFilter from '../WidgetSortFilter/WidgetSortFilter';
import './widget-header.less';
import { WIDGET_MORE_MENU_ITEMS } from './WidgetHeader.constants';

export interface WidgetHeaderProps {
  badge?: ReactNode;
  className?: string;
  currentLayout?: Layout[];
  handleLayoutUpdate?: (layout: Layout[]) => void;
  handleRemoveWidget?: (widgetKey: string) => void;
  icon?: ReactNode;
  isEditView?: boolean;
  onEditClick?: () => void;
  onSortChange?: (key: string) => void;
  selectedSortBy?: string;
  sortOptions?: Array<{
    key: string;
    label: string;
  }>;
  title: string;
  widgetKey: string;
  widgetWidth?: number;
}

const WidgetHeader = ({
  title,
  icon,
  badge,
  isEditView = false,
  widgetWidth = 2,
  sortOptions,
  selectedSortBy,
  onSortChange,
  onEditClick,
  className = '',
  handleLayoutUpdate,
  handleRemoveWidget,
  widgetKey,
  currentLayout,
}: WidgetHeaderProps) => {
  const handleSortByClick = (e: MenuInfo) => {
    onSortChange?.(e.key);
  };

  const handleSizeChange = (value: number) => {
    if (handleLayoutUpdate) {
      const updatedLayout = currentLayout?.map((layout: WidgetConfig) =>
        layout.i === widgetKey ? { ...layout, w: value } : layout
      );

      handleLayoutUpdate(updatedLayout as Layout[]);
    }
  };

  const handleMoreClick = (e: MenuInfo) => {
    if (e.key === 'remove') {
      handleRemoveWidget?.(widgetKey);
    } else if (e.key === 'half_size') {
      handleSizeChange(1);
    } else if (e.key === 'full_size') {
      handleSizeChange(2);
    }
  };

  return (
    <Row
      className={`widget-header ${className}`}
      data-testid="widget-header"
      justify="space-between">
      <Col className="d-flex items-center h-full min-h-8">
        {icon && <div className="d-flex h-6 w-6 m-r-xs">{icon}</div>}

        <Typography.Paragraph
          className="widget-title"
          ellipsis={{ tooltip: true }}
          style={{
            maxWidth: widgetWidth === 1 ? '200px' : '525px',
          }}>
          {title} {badge}
        </Typography.Paragraph>
      </Col>

      <Col>
        <div style={{ display: 'flex', gap: '8px' }}>
          {isEditView ? (
            <>
              <DragOutlined
                className="drag-widget-icon cursor-pointer widget-header-options"
                data-testid="drag-widget-button"
                size={20}
              />
              {onEditClick && (
                <Button
                  className="widget-header-options"
                  data-testid="edit-widget-button"
                  icon={<MoreOutlined size={20} />}
                  onClick={onEditClick}
                />
              )}

              <WidgetMoreOptions
                menuItems={WIDGET_MORE_MENU_ITEMS}
                onMenuClick={handleMoreClick}
              />
            </>
          ) : (
            sortOptions &&
            selectedSortBy && (
              <WidgetSortFilter
                selectedSortBy={selectedSortBy}
                sortOptions={sortOptions}
                onSortChange={handleSortByClick}
              />
            )
          )}
        </div>
      </Col>
    </Row>
  );
};

export default WidgetHeader;
