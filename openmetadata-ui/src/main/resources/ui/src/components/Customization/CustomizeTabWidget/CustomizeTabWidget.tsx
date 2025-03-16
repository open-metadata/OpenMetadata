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

import {
  CheckCircleOutlined,
  CloseCircleOutlined,
  EditOutlined,
  MoreOutlined,
  PlusOutlined,
} from '@ant-design/icons';
import {
  Button,
  Card,
  Col,
  Dropdown,
  Input,
  MenuProps,
  Modal,
  Space,
} from 'antd';
import { isEmpty, isNil, isUndefined, toString, uniqueId } from 'lodash';
import { MenuInfo } from 'rc-menu/lib/interface';
import React, { useCallback, useMemo, useState } from 'react';
import RGL, { Layout, WidthProvider } from 'react-grid-layout';
import { useTranslation } from 'react-i18next';
import {
  CommonWidgetType,
  TAB_GRID_MAX_COLUMNS,
} from '../../../constants/CustomizeWidgets.constants';
import { EntityTabs } from '../../../enums/entity.enum';
import { Page, Tab } from '../../../generated/system/ui/page';
import { PageType } from '../../../generated/system/ui/uiCustomization';
import { useGridLayoutDirection } from '../../../hooks/useGridLayoutDirection';
import {
  WidgetCommonProps,
  WidgetConfig,
} from '../../../pages/CustomizablePage/CustomizablePage.interface';
import { useCustomizeStore } from '../../../pages/CustomizablePage/CustomizeStore';
import {
  getLayoutUpdateHandler,
  getLayoutWithEmptyWidgetPlaceholder,
  getRemoveWidgetHandler,
  getUniqueFilteredLayout,
} from '../../../utils/CustomizableLandingPageUtils';
import {
  getAddWidgetHandler,
  getCustomizableWidgetByPage,
  getDefaultTabs,
  getDefaultWidgetForTab,
} from '../../../utils/CustomizePage/CustomizePageUtils';
import { getEntityName } from '../../../utils/EntityUtils';
import AddDetailsPageWidgetModal from '../../MyData/CustomizableComponents/AddDetailsPageWidgetModal/AddDetailsPageWidgetModal';
import EmptyWidgetPlaceholder from '../../MyData/CustomizableComponents/EmptyWidgetPlaceholder/EmptyWidgetPlaceholder';
import { GenericWidget } from '../GenericWidget/GenericWidget';

const ReactGridLayout = WidthProvider(RGL);

export type CustomizeTabWidgetProps = WidgetCommonProps;

type TargetKey = React.MouseEvent | React.KeyboardEvent | string;

export const CustomizeTabWidget = () => {
  const { currentPage, currentPageType, updateCurrentPage } =
    useCustomizeStore();
  const items = useMemo(() => {
    return currentPage?.tabs ?? getDefaultTabs(currentPageType as PageType);
  }, [currentPage, currentPageType, currentPage?.tabs]);

  const [activeKey, setActiveKey] = useState<string | null>(
    items.find((i) => i.editable)?.id ?? null
  );
  const { t } = useTranslation();

  const [editableItem, setEditableItem] = useState<Tab | null>(null);
  const [tabLayouts, setTabLayouts] = useState<WidgetConfig[]>(
    getLayoutWithEmptyWidgetPlaceholder(
      (items.find((item) => item.id === activeKey)?.layout as WidgetConfig[]) ??
        getDefaultWidgetForTab(
          currentPageType as PageType,
          (activeKey as EntityTabs) ?? EntityTabs.OVERVIEW
        ),
      2,
      3
    )
  );
  const [isWidgetModalOpen, setIsWidgetModalOpen] = useState<boolean>(false);
  const [placeholderWidgetKey, setPlaceholderWidgetKey] = useState<string>('');

  const onChange = (tabKey: string, updatePage = true) => {
    const key = tabKey as EntityTabs;
    setActiveKey(key);
    const newTab = currentPage?.tabs?.find((item) => item.id === key);

    // Save current tab layout before changing
    if (updatePage) {
      updateCurrentPage({
        ...currentPage,
        tabs: items,
      } as Page);
    }

    // Update tabLayout with new tab selection
    setTabLayouts(
      getLayoutWithEmptyWidgetPlaceholder(
        isEmpty(newTab?.layout)
          ? getDefaultWidgetForTab(currentPageType as PageType, key)
          : (newTab?.layout as WidgetConfig[]),
        2,
        3
      )
    );
  };

  const add = () => {
    const newActiveKey = uniqueId(`custom`);

    updateCurrentPage({
      ...currentPage,
      tabs: [
        ...items,
        {
          name: t('label.new-tab'),
          layout: [],
          id: newActiveKey,
          editable: true,
        } as Tab,
      ],
    } as Page);

    onChange(newActiveKey, false);
  };

  const remove = (targetKey: TargetKey) => {
    let newActiveKey = activeKey;
    let lastIndex = -1;
    items.forEach((item, i) => {
      if (item.id === targetKey) {
        lastIndex = i - 1;
      }
    });
    const newPanes = items.filter((item) => item.id !== targetKey);
    if (newPanes.length && newActiveKey === targetKey) {
      if (lastIndex >= 0) {
        newActiveKey = newPanes[lastIndex].id as EntityTabs;
      } else {
        newActiveKey = newPanes[0].id as EntityTabs;
      }
    }

    updateCurrentPage({
      ...currentPage,
      tabs: newPanes,
    } as Page);

    newActiveKey !== activeKey && onChange(newActiveKey ?? EntityTabs.OVERVIEW);
  };

  const handleTabEditClick = (key: string) => {
    setEditableItem(items.find((item) => item.id === key) || null);
  };

  const handleRenameSave = () => {
    if (editableItem) {
      const newItems = items.map((item) =>
        item.id === editableItem.id ? editableItem : item
      );
      updateCurrentPage({
        ...currentPage,
        tabs: newItems,
      } as Page);
      setEditableItem(null);
    }
  };

  const handleChange: React.ChangeEventHandler<HTMLInputElement> = (event) => {
    editableItem &&
      setEditableItem({
        ...editableItem,
        displayName: event.target.value ?? '',
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
      tabLayouts.map((widget) => {
        let widgetComponent = null;

        if (
          widget.i.endsWith('.EmptyWidgetPlaceholder') &&
          !isUndefined(handleOpenAddWidgetModal) &&
          !isUndefined(handlePlaceholderWidgetKey) &&
          !isUndefined(handleRemoveWidget)
        ) {
          widgetComponent = (
            <EmptyWidgetPlaceholder
              handleOpenAddWidgetModal={handleOpenAddWidgetModal}
              handlePlaceholderWidgetKey={handlePlaceholderWidgetKey}
              handleRemoveWidget={handleRemoveWidget}
              isEditable={widget.isDraggable}
              widgetKey={widget.i}
            />
          );
        } else {
          widgetComponent = (
            <GenericWidget
              isEditView
              handleRemoveWidget={handleRemoveWidget}
              selectedGridSize={widget.w}
              widgetKey={widget.i}
            />
          );
        }

        return (
          <div data-grid={widget} id={widget.i} key={widget.i}>
            {widgetComponent}
          </div>
        );
      }),
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
      newWidgetData: CommonWidgetType,
      placeholderWidgetKey: string,
      widgetSize: number
    ) => {
      setTabLayouts(
        getAddWidgetHandler(
          newWidgetData,
          placeholderWidgetKey,
          widgetSize,
          TAB_GRID_MAX_COLUMNS,
          currentPageType as PageType
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
    updateCurrentPage({
      ...currentPage,
      tabs: newItems,
    } as Page);

    updateCurrentPage({
      ...currentPage,
      tabs: newItems,
    } as Page);
  };

  // call the hook to set the direction of the grid layout
  useGridLayoutDirection();

  const handleMenuClick = (menuInfo: MenuInfo, itemId: string) => {
    switch (menuInfo.key) {
      case 'edit':
        setActiveKey(itemId);

        break;
      case 'rename':
        handleTabEditClick(itemId);

        break;
      case 'delete':
        remove(itemId);

        break;
    }
  };

  const tabMenuItems: MenuProps['items'] = [
    {
      label: 'Edit Widgets',
      key: 'edit',
      icon: <CheckCircleOutlined />,
    },
    {
      label: 'Rename',
      key: 'rename',
      icon: <EditOutlined />,
    },
    {
      label: 'Delete',
      key: 'delete',
      icon: <CloseCircleOutlined />,
    },
  ];

  return (
    <>
      <Col span={24}>
        <Card bordered={false} className="m-x-lg" title="Customize Tabs">
          <Space wrap size={16}>
            {items.map((item) => (
              <Dropdown
                key={item.id}
                menu={{
                  items: tabMenuItems,
                  onClick: (menuInfo) => handleMenuClick(menuInfo, item.id),
                }}>
                <Button onClick={() => onChange(item.id)}>
                  <Space>
                    {getEntityName(item)}
                    <MoreOutlined />
                  </Space>
                </Button>
              </Dropdown>
            ))}
            <Button icon={<PlusOutlined />} type="primary" onClick={add}>
              {t('label.add-entity', {
                entity: t('label.tab'),
              })}
            </Button>
          </Space>

          {/* <DraggableTabs
            activeKey={activeKey ?? undefined}
            items={items.map((item) => ({
              key: item.id,
              label: (
                <Button
                  type="text"
                  onClick={(event) => {
                    event.stopPropagation();
                    item.editable && onChange(item.id);
                  }}>
                  <Tooltip
                    title={
                      item.editable
                        ? ''
                        : t('message.no-customization-available')
                    }>
                    {getEntityName(item)}
                    <Icon
                      className="m-l-xs "
                      component={EditIcon}
                      onClick={(event) => {
                        event.stopPropagation();
                        handleTabEditClick(item.id);
                      }}
                    />
                  </Tooltip>
                </Button>
              ),
              closable: true,
            }))}
            size="small"
            tabBarGutter={2}
            type="editable-card"
            onChange={onChange}
            onEdit={onEdit}
            onTabChange={onTabPositionChange}
          /> */}
        </Card>
      </Col>
      <Col span={24}>
        <Card
          bodyStyle={{ padding: 0, paddingBottom: '20px' }}
          bordered={false}
          className="m-x-lg"
          extra={
            <Button
              icon={<PlusOutlined />}
              type="primary"
              onClick={handleOpenAddWidgetModal}>
              {t('label.add-entity', {
                entity: t('label.widget'),
              })}
            </Button>
          }
          title={`Customize ${getEntityName(
            items.find((item) => item.id === activeKey) as Tab
          )} Tabs`}>
          <ReactGridLayout
            className="grid-container"
            cols={TAB_GRID_MAX_COLUMNS}
            draggableHandle=".drag-widget-icon"
            margin={[16, 16]}
            rowHeight={100}
            onLayoutChange={handleLayoutUpdate}>
            {widgets}
          </ReactGridLayout>
        </Card>
      </Col>

      {currentPageType && (
        <AddDetailsPageWidgetModal
          handleAddWidget={handleMainPanelAddWidget}
          handleCloseAddWidgetModal={() => setIsWidgetModalOpen(false)}
          maxGridSizeSupport={TAB_GRID_MAX_COLUMNS}
          open={isWidgetModalOpen}
          placeholderWidgetKey={placeholderWidgetKey}
          widgetsList={getCustomizableWidgetByPage(currentPageType)}
        />
      )}
      {editableItem && (
        <Modal
          maskClosable
          open={!isNil(editableItem)}
          title="Rename tab"
          onCancel={() => setEditableItem(null)}
          onOk={handleRenameSave}>
          <Input
            value={toString(getEntityName(editableItem))}
            onChange={handleChange}
          />
        </Modal>
      )}
    </>
  );
};
