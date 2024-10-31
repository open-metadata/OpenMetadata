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
import Icon from '@ant-design/icons';
import { Input, Modal } from 'antd';
import { isEmpty, isNil, toString, uniqueId } from 'lodash';
import React, { useCallback, useMemo, useState } from 'react';
import RGL, { Layout, WidthProvider } from 'react-grid-layout';
import { ReactComponent as EditIcon } from '../../../../assets/svg/edit-new.svg';
import { Document } from '../../../../generated/entity/docStore/document';
import { Page, Tab } from '../../../../generated/system/ui/page';
import { PageType } from '../../../../generated/system/ui/uiCustomization';
import { useGridLayoutDirection } from '../../../../hooks/useGridLayoutDirection';
import {
  WidgetCommonProps,
  WidgetConfig,
} from '../../../../pages/CustomizablePage/CustomizablePage.interface';
import { useCustomizeStore } from '../../../../pages/CustomizablePage/CustomizeStore';
import customizeGlossaryTermPageClassBase from '../../../../utils/CustomiseGlossaryTermPage/CustomizeGlossaryTermPage';
import {
  getAddWidgetHandler,
  getLayoutUpdateHandler,
  getLayoutWithEmptyWidgetPlaceholder,
  getRemoveWidgetHandler,
  getUniqueFilteredLayout,
} from '../../../../utils/CustomizableLandingPageUtils';
import { getDefaultTabs } from '../../../../utils/CustomizePage/CustomizePageUtils';
import { getWidgetFromKey } from '../../../../utils/GlossaryTerm/GlossaryTermUtil';
import { DraggableTabs } from '../../../common/DraggableTabs/DraggableTabs';
import AddWidgetModal from '../../../MyData/CustomizableComponents/AddWidgetModal/AddWidgetModal';

const ReactGridLayout = WidthProvider(RGL);

export type CustomizeTabWidgetProps = WidgetCommonProps;

type TargetKey = React.MouseEvent | React.KeyboardEvent | string;

export const CustomizeTabWidget = () => {
  const { currentPage, currentPageType, updateCurrentPage } =
    useCustomizeStore();
  const [items, setItems] = useState<Tab[]>(
    currentPage?.tabs ?? getDefaultTabs(currentPageType as PageType)
  );
  const [activeKey, setActiveKey] = useState<string | null>(
    items[0]?.id ?? null
  );

  const [editableItem, setEditableItem] = useState<Tab | null>(null);
  const [tabLayouts, setTabLayouts] = useState<WidgetConfig[]>(
    getLayoutWithEmptyWidgetPlaceholder(
      (items.find((item) => item.id === activeKey)?.layout as WidgetConfig[]) ??
        customizeGlossaryTermPageClassBase.getDefaultWidgetForTab(
          activeKey ?? 'overview'
        ),
      2,
      3
    )
  );
  const [isWidgetModalOpen, setIsWidgetModalOpen] = useState<boolean>(false);
  const [placeholderWidgetKey, setPlaceholderWidgetKey] = useState<string>('');

  const onChange = (tabKey: string) => {
    setActiveKey(tabKey);
    const newTab = items.find((item) => item.id === tabKey);
    setTabLayouts(
      getLayoutWithEmptyWidgetPlaceholder(
        (newTab?.layout as WidgetConfig[]) ??
          customizeGlossaryTermPageClassBase.getDefaultWidgetForTab(tabKey),
        2,
        3
      )
    );
  };

  const add = () => {
    const newActiveKey = uniqueId(`newTab`);
    const newPanes = [...items];
    newPanes.push({
      name: 'New Tab',
      layout: [],
      id: newActiveKey,
      removable: true,
    } as Tab);
    setItems(newPanes);
    onChange(newActiveKey);
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
    onChange(newActiveKey ?? 'overview');
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

  const handleTabEditClick = (key: string) => {
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

  const handleOpenAddWidgetModal = () => {
    setIsWidgetModalOpen(true);
  };

  const handlePlaceholderWidgetKey = (value: string) => {
    setPlaceholderWidgetKey(value);
  };

  const handleRemoveWidget = (widgetKey: string) => {
    setTabLayouts(getRemoveWidgetHandler(widgetKey, 3, 3.5));
  };

  const widgets = useMemo(
    () =>
      tabLayouts.map((widget) => (
        <div data-grid={widget} id={widget.i} key={widget.i}>
          {getWidgetFromKey({
            widgetConfig: widget,
            handleOpenAddWidgetModal: handleOpenAddWidgetModal,
            handlePlaceholderWidgetKey: handlePlaceholderWidgetKey,
            handleRemoveWidget: handleRemoveWidget,
            isEditView: true,
          })}
        </div>
      )),
    [tabLayouts]
  );

  const handleLayoutUpdate = useCallback(
    (updatedLayout: Layout[]) => {
      if (!isEmpty(tabLayouts) && !isEmpty(updatedLayout)) {
        setTabLayouts(getLayoutUpdateHandler(updatedLayout));
        updateCurrentPage({
          ...currentPage,
          tabs: items.map((item) =>
            item.id === activeKey
              ? { ...item, layout: getUniqueFilteredLayout(updatedLayout) }
              : item
          ),
        } as Page);
      }
    },
    [tabLayouts]
  );

  const handleMainPanelAddWidget = useCallback(
    (
      newWidgetData: Document,
      placeholderWidgetKey: string,
      widgetSize: number
    ) => {
      setTabLayouts(
        getAddWidgetHandler(
          newWidgetData,
          placeholderWidgetKey,
          widgetSize,
          customizeGlossaryTermPageClassBase.detailPageMaxGridSize
        )
      );
      setIsWidgetModalOpen(false);
    },
    []
  );

  const onTabPositionChange = (newOrder: React.Key[]) => {
    const newItems = newOrder.map(
      (key) => items.find((item) => item.id === key) as Tab
    );
    setItems(newItems);

    updateCurrentPage({
      ...currentPage,
      tabs: newItems,
    } as Page);
  };

  // eslint-disable-next-line no-console
  console.log('widgets', tabLayouts, currentPage);

  // call the hook to set the direction of the grid layout
  useGridLayoutDirection();

  return (
    <div className="bg-white">
      <DraggableTabs
        activeKey={activeKey ?? undefined}
        items={items.map((item) => ({
          key: item.id,
          label: (
            <>
              {item.name}
              <Icon
                component={EditIcon}
                onClick={(event) => {
                  event.stopPropagation();
                  handleTabEditClick(item.name);
                }}
              />
            </>
          ),

          closable: item.removable ?? false,
        }))}
        type="editable-card"
        onChange={onChange}
        onEdit={onEdit}
        onTabChange={onTabPositionChange}
        // onTabClick={handleTabClick}
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
      <AddWidgetModal
        addedWidgetsList={[]}
        handleAddWidget={handleMainPanelAddWidget}
        handleCloseAddWidgetModal={() => setIsWidgetModalOpen(false)}
        maxGridSizeSupport={8}
        open={isWidgetModalOpen}
        placeholderWidgetKey={placeholderWidgetKey}
      />
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
