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
import { Input, Modal, TabsProps } from 'antd';
import { isNil, toString } from 'lodash';
import React, { useRef, useState } from 'react';
import { WidgetCommonProps } from '../../../../pages/CustomizablePage/CustomizablePage.interface';
import { DraggableTabs } from '../../../common/DraggableTabs/DraggableTabs';

export interface CustomizeTabWidgetProps extends WidgetCommonProps {
  tabs: NonNullable<TabsProps['items']>;
}

type TargetKey = React.MouseEvent | React.KeyboardEvent | string;

export const CustomizeTabWidget = (props: CustomizeTabWidgetProps) => {
  const [activeKey, setActiveKey] = useState(props.tabs[0].key);
  const [items, setItems] = useState(props.tabs);
  const newTabIndex = useRef(0);
  const [editableItem, setEditableItem] = useState<typeof items[number] | null>(
    null
  );

  const onChange = (newActiveKey: string) => {
    setActiveKey(newActiveKey);
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

  const handleTabClick = (key: string) => {
    setEditableItem(items.find((item) => item.key === key) || null);
  };

  const handleRenameSave = () => {
    if (editableItem) {
      const newItems = items.map((item) =>
        item.key === editableItem.key ? editableItem : item
      );
      setItems(newItems);
      setEditableItem(null);
    }
  };

  const handleChange: React.ChangeEventHandler<HTMLInputElement> = (event) => {
    editableItem &&
      setEditableItem({
        ...editableItem,
        label: event.target.value ?? '',
      });
  };

  return (
    <div className="bg-white">
      <DraggableTabs
        activeKey={activeKey}
        items={items}
        type="editable-card"
        onChange={onChange}
        onEdit={onEdit}
        onTabClick={handleTabClick}
      />
      <Modal
        maskClosable
        open={!isNil(editableItem)}
        title="Rename tab"
        onCancel={() => setEditableItem(null)}
        onOk={handleRenameSave}>
        <Input value={toString(editableItem?.label)} onChange={handleChange} />
      </Modal>
    </div>
  );
};
