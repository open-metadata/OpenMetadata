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
import { Input, Modal } from 'antd';
import { isEmpty, isNil, toString } from 'lodash';
import React, { useCallback, useMemo, useRef, useState } from 'react';
import ReactGridLayout, { Layout } from 'react-grid-layout';
import { Tab } from '../../../../generated/system/ui/page';
import {
  WidgetCommonProps,
  WidgetConfig,
} from '../../../../pages/CustomizablePage/CustomizablePage.interface';
import customizeGlossaryTermPageClassBase from '../../../../utils/CustomiseGlossaryTermPage/CustomizeGlossaryTermPage';
import { getLayoutUpdateHandler } from '../../../../utils/CustomizableLandingPageUtils';
import { getWidgetFromKey } from '../../../../utils/GlossaryTerm/GlossaryTermUtil';
import { DraggableTabs } from '../../../common/DraggableTabs/DraggableTabs';

export interface CustomizeTabWidgetProps extends WidgetCommonProps {
  tabs: Tab[];
}

type TargetKey = React.MouseEvent | React.KeyboardEvent | string;

export const CustomizeTabWidget = (props: CustomizeTabWidgetProps) => {
  const [activeKey, setActiveKey] = useState(props.tabs[0].name);
  const [items, setItems] = useState(props.tabs);
  const newTabIndex = useRef(0);
  const [editableItem, setEditableItem] = useState<typeof items[number] | null>(
    null
  );
  const [tabLayouts, setTabLayouts] = useState<WidgetConfig[]>(
    customizeGlossaryTermPageClassBase.getDefaultWidgetForTab('overview')
  );

  const onChange = (activeTab: string) => {
    setActiveKey(activeTab);
    setTabLayouts(
      customizeGlossaryTermPageClassBase.getDefaultWidgetForTab(activeTab)
    );
  };

  const add = () => {
    const newActiveKey = `newTab${newTabIndex.current++}`;
    const newPanes = [...items];
    newPanes.push({
      name: 'New Tab',
      layout: [],
      id: newActiveKey,
    } as Tab);
    setItems(newPanes);
    setActiveKey(newActiveKey);
  };

  const remove = (targetKey: TargetKey) => {
    let newActiveKey = activeKey;
    let lastIndex = -1;
    items.forEach((item, i) => {
      if (item.name === targetKey) {
        lastIndex = i - 1;
      }
    });
    const newPanes = items.filter((item) => item.name !== targetKey);
    if (newPanes.length && newActiveKey === targetKey) {
      if (lastIndex >= 0) {
        newActiveKey = newPanes[lastIndex].name;
      } else {
        newActiveKey = newPanes[0].name;
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
    setEditableItem(items.find((item) => item.name === key) || null);
  };

  const handleRenameSave = () => {
    if (editableItem) {
      const newItems = items.map((item) =>
        item.name === editableItem.name ? editableItem : item
      );
      setItems(newItems);
      setEditableItem(null);
    }
  };

  const handleChange: React.ChangeEventHandler<HTMLInputElement> = (event) => {
    editableItem &&
      setEditableItem({
        ...editableItem,
        name: event.target.value ?? '',
      });
  };

  const widgets = useMemo(
    () =>
      tabLayouts.map((widget) => (
        <div data-grid={widget} id={widget.i} key={widget.i}>
          {getWidgetFromKey({
            widgetConfig: widget,
            handleOpenAddWidgetModal: () => {}, // handleOpenAddWidgetModal,
            handlePlaceholderWidgetKey: () => {}, // handlePlaceholderWidgetKey,
            handleRemoveWidget: () => {}, // handleRemoveWidget,
            isEditView: true,
          })}
        </div>
      )),
    [
      tabLayouts,
      //   handleOpenAddWidgetModal,
      //   handlePlaceholderWidgetKey,
      //   handleRemoveWidget,
    ]
  );

  const handleLayoutUpdate = useCallback(
    (updatedLayout: Layout[]) => {
      if (!isEmpty(tabLayouts) && !isEmpty(updatedLayout)) {
        setTabLayouts(getLayoutUpdateHandler(updatedLayout));
      }
    },
    [tabLayouts]
  );

  console.log('widgets', tabLayouts);

  return (
    <div className="bg-white">
      <DraggableTabs
        activeKey={activeKey}
        items={items.map((item) => ({
          key: item.name,
          label: item.name,
        }))}
        type="editable-card"
        onChange={onChange}
        onEdit={onEdit}
        onTabClick={handleTabClick}
      />
      <div style={{ position: 'relative' }}>
        <ReactGridLayout
          cols={8}
          draggableHandle=".drag-widget-icon"
          isResizable={false}
          margin={[
            customizeGlossaryTermPageClassBase.detailPageWidgetMargin,
            customizeGlossaryTermPageClassBase.detailPageWidgetMargin,
          ]}
          rowHeight={customizeGlossaryTermPageClassBase.detailPageRowHeight}
          onLayoutChange={handleLayoutUpdate}>
          {widgets}
        </ReactGridLayout>
      </div>
      <Modal
        maskClosable
        open={!isNil(editableItem)}
        title="Rename tab"
        onCancel={() => setEditableItem(null)}
        onOk={handleRenameSave}>
        <Input value={toString(editableItem?.name)} onChange={handleChange} />
      </Modal>
    </div>
  );
};
