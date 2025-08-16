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
import {
  CheckCircleOutlined,
  CloseCircleOutlined,
  EditOutlined,
  MoreOutlined,
} from '@ant-design/icons';
import { Button, Dropdown, MenuProps, Space } from 'antd';
import { MenuInfo } from 'rc-menu/lib/interface';
import React from 'react';
import { useDrag, useDrop } from 'react-dnd';
import { useTranslation } from 'react-i18next';
import { Tab } from '../../../generated/system/ui/tab';
import { getTabDisplayName } from '../../../utils/CustomizePage/CustomizePageUtils';
import './draggable-tabs.less';

type TargetKey = React.MouseEvent | React.KeyboardEvent | string;

interface TabItemProps {
  item: Tab;
  index: number;
  moveTab?: (fromIndex: number, toIndex: number) => void;
  onEdit?: (key: string) => void;
  onRename?: (key: string) => void;
  onRemove?: (targetKey: TargetKey) => void;
  onItemClick?: (key: string) => void;
  shouldHide?: boolean;
}

export const TabItem = ({
  item,
  index,
  moveTab,
  onEdit,
  onRename,
  onRemove,
  onItemClick,
  shouldHide,
}: TabItemProps) => {
  const { t } = useTranslation();
  const [{ isDragging }, drag] = useDrag({
    type: 'TAB',
    item: { index },
    collect: (monitor) => ({
      isDragging: monitor.isDragging(),
    }),
  });

  const tabMenuItems: MenuProps['items'] = [
    ...(item.editable
      ? [
          {
            label: t('label.edit-widget-plural'),
            key: 'edit',
            icon: <CheckCircleOutlined />,
          },
        ]
      : []),
    {
      label: t('label.rename'),
      key: 'rename',
      icon: <EditOutlined />,
    },
    {
      label: shouldHide ? t('label.hide') : t('label.delete'),
      key: 'delete',
      icon: <CloseCircleOutlined />,
    },
  ];

  const handleMenuClick = (menuInfo: MenuInfo, itemId: string) => {
    switch (menuInfo.key) {
      case 'edit':
        onEdit?.(itemId);

        break;
      case 'rename':
        onRename?.(itemId);

        break;
      case 'delete':
        onRemove?.(itemId);

        break;
    }
  };

  const [, drop] = useDrop({
    accept: 'TAB',
    hover: (draggedItem: { index: number }) => {
      if (draggedItem.index !== index) {
        moveTab?.(draggedItem.index, index);
        draggedItem.index = index;
      }
    },
  });

  return (
    <div
      ref={(node) => drag(drop(node))}
      style={{ opacity: isDragging ? 0.5 : 1 }}>
      <Dropdown
        menu={{
          items: tabMenuItems,
          onClick: (menuInfo) => handleMenuClick(menuInfo, item.id),
        }}
        trigger={['click']}>
        <Button
          className="draggable-tab-item"
          data-testid={`tab-${item.name}`}
          onClick={() => onItemClick?.(item.id)}>
          <Space>
            {getTabDisplayName(item)}
            <MoreOutlined />
          </Space>
        </Button>
      </Dropdown>
    </div>
  );
};
