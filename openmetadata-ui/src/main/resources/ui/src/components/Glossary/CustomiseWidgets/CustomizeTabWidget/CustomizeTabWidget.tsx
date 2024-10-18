/*
 *  Copyright 2024 Collate.
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
import { CloseOutlined, DragOutlined } from '@ant-design/icons';
import { Card, Space, Tabs, TabsProps } from 'antd';
import React, { useRef, useState } from 'react';
import { WidgetCommonProps } from '../../../../pages/CustomizablePage/CustomizablePage.interface';

interface Props extends WidgetCommonProps {
  tabs: NonNullable<TabsProps['items']>;
}

type TargetKey = React.MouseEvent | React.KeyboardEvent | string;

export const CustomizeTabWidget = (props: Props) => {
  const [activeKey, setActiveKey] = useState(props.tabs[0].key);
  const [items, setItems] = useState(props.tabs);
  const newTabIndex = useRef(0);

  const onChange = (newActiveKey: string) => {
    setActiveKey(newActiveKey);
  };
  const handleRemoveClick = () => {
    if (props.handleRemoveWidget) {
      props.handleRemoveWidget(props.widgetKey);
    }
  };

  const add = () => {
    const newActiveKey = `newTab${newTabIndex.current++}`;
    const newPanes = [...items];
    newPanes.push({
      label: 'New Tab',
      children: 'Content of new Tab',
      key: newActiveKey,
    });
    setItems(newPanes);
    setActiveKey(newActiveKey);
  };

  const remove = (targetKey: TargetKey) => {
    let newActiveKey = activeKey;
    let lastIndex = -1;
    items.forEach((item, i) => {
      if (item.key === targetKey) {
        lastIndex = i - 1;
      }
    });
    const newPanes = items.filter((item) => item.key !== targetKey);
    if (newPanes.length && newActiveKey === targetKey) {
      if (lastIndex >= 0) {
        newActiveKey = newPanes[lastIndex].key;
      } else {
        newActiveKey = newPanes[0].key;
      }
    }
    setItems(newPanes);
    setActiveKey(newActiveKey);
  };

  const onEdit = (
    targetKey: React.MouseEvent | React.KeyboardEvent | string,
    action: 'add' | 'remove'
  ) => {
    if (action === 'add') {
      add();
    } else {
      remove(targetKey);
    }
  };

  return (
    <Card
      bodyStyle={{ height: '100%' }}
      className="h-full"
      title={
        <div className="d-flex justify-between align-center">
          <span>{props.widgetKey}</span>
          {props.isEditView && (
            <Space size={8}>
              <DragOutlined
                className="drag-widget-icon cursor-pointer"
                data-testid="drag-widget-button"
                size={14}
              />
              <CloseOutlined
                data-testid="remove-widget-button"
                size={14}
                onClick={handleRemoveClick}
              />
            </Space>
          )}
        </div>
      }>
      <Tabs
        activeKey={activeKey}
        items={items}
        onChange={onChange}
        onEdit={onEdit}
      />
    </Card>
  );
};
