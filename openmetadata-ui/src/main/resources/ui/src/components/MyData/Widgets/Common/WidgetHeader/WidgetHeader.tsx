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
import { Button, Col, Dropdown, Row, Typography } from 'antd';
import { MenuInfo } from 'rc-menu/lib/interface';
import { ReactNode } from 'react';
import './widget-header.less';

export interface WidgetHeaderProps {
  title: string;
  icon?: ReactNode;
  badge?: ReactNode;
  isEditView?: boolean;
  widgetWidth?: number;
  sortOptions?: Array<{
    key: string;
    label: string;
  }>;
  selectedSortBy?: string;
  onSortChange?: (key: string) => void;
  moreMenuItems?: Array<{
    key: string;
    label: string;
  }>;
  onMoreMenuClick?: (e: MenuInfo) => void;
  onEditClick?: () => void;
  className?: string;
  dataTestId?: string;
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
  moreMenuItems,
  onMoreMenuClick,
  onEditClick,
  className = '',
  dataTestId = 'widget-header',
}: WidgetHeaderProps) => {
  const handleSortByClick = (e: MenuInfo) => {
    if (!isEditView && onSortChange) {
      onSortChange(e.key);
    }
  };

  return (
    <Row
      className={`widget-header ${className}`}
      data-testid={dataTestId}
      justify="space-between">
      <Col className="d-flex items-center h-full min-h-8">
        <div className="d-flex h-6 w-6 m-r-xs">{icon}</div>

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
              {moreMenuItems && onMoreMenuClick && (
                <Dropdown
                  className="widget-header-options"
                  data-testid="more-button"
                  menu={{
                    items: moreMenuItems,
                    selectable: true,
                    multiple: false,
                    onClick: onMoreMenuClick,
                    className: 'widget-header-menu',
                  }}
                  placement="bottomLeft"
                  trigger={['click']}>
                  <Button
                    className=""
                    data-testid="more-button"
                    icon={
                      <MoreOutlined
                        data-testid="more-widget-button"
                        size={20}
                      />
                    }
                  />
                </Dropdown>
              )}
            </>
          ) : (
            sortOptions &&
            selectedSortBy && (
              <Dropdown
                className="widget-header-options"
                data-testid="sort-by-button"
                menu={{
                  items: sortOptions,
                  selectable: true,
                  multiple: false,
                  activeKey: selectedSortBy,
                  onClick: handleSortByClick,
                  className: 'widget-header-menu',
                }}
                trigger={['click']}>
                <Button data-testid="filter-button">
                  {
                    sortOptions.find((option) => option.key === selectedSortBy)
                      ?.label
                  }
                </Button>
              </Dropdown>
            )
          )}
        </div>
      </Col>
    </Row>
  );
};

export default WidgetHeader;
