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

import { EyeFilled, MoreOutlined, PlusOutlined } from '@ant-design/icons';
import { Button, Card, Col, Dropdown, Input, Modal, Space } from 'antd';
import { cloneDeep, isEmpty, isNil, isUndefined, uniqueId } from 'lodash';
import { useCallback, useMemo, useState } from 'react';
import RGL, { Layout, WidthProvider } from 'react-grid-layout';
import { useTranslation } from 'react-i18next';
import {
  CommonWidgetType,
  TAB_GRID_MAX_COLUMNS,
} from '../../../constants/CustomizeWidgets.constants';
import { LandingPageWidgetKeys } from '../../../enums/CustomizablePage.enum';
import { DetailPageWidgetKeys } from '../../../enums/CustomizeDetailPage.enum';
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
  getLayoutWithEmptyWidgetPlaceholder,
  getUniqueFilteredLayout,
} from '../../../utils/CustomizableLandingPageUtils';
import {
  getAddWidgetHandler,
  getCustomizableWidgetByPage,
  getDefaultTabs,
  getDefaultWidgetForTab,
  getTabDisplayName,
} from '../../../utils/CustomizePage/CustomizePageUtils';
import { getEntityName } from '../../../utils/EntityUtils';
import { TabItem } from '../../common/DraggableTabs/DraggableTabs';
import AddDetailsPageWidgetModal from '../../MyData/CustomizableComponents/AddDetailsPageWidgetModal/AddDetailsPageWidgetModal';
import EmptyWidgetPlaceholder from '../../MyData/CustomizableComponents/EmptyWidgetPlaceholder/EmptyWidgetPlaceholder';
import { LeftPanelContainer } from '../GenericTab/LeftPanelContainer';
import { GenericWidget } from '../GenericWidget/GenericWidget';

// Create a properly typed ReactGridLayout component
const ReactGridLayout = WidthProvider(RGL) as React.ComponentType<
  ReactGridLayout.ReactGridLayoutProps & { children?: React.ReactNode }
>;

export type CustomizeTabWidgetProps = WidgetCommonProps;

type TargetKey = React.MouseEvent | React.KeyboardEvent | string;

export const CustomizeTabWidget = () => {
  const { currentPage, currentPageType, updateCurrentPage } =
    useCustomizeStore();
  const systemTabs = useMemo(
    () => getDefaultTabs(currentPageType as PageType),
    [currentPageType]
  );

  const items = useMemo(() => {
    return currentPage?.tabs ?? systemTabs;
  }, [systemTabs, currentPage?.tabs]);
  const [showAddTabModal, setShowAddTabModal] = useState<boolean>(false);
  const { t } = useTranslation();
  const [newTabName, setNewTabName] = useState<string>(t('label.new-tab'));
  const [activeKey, setActiveKey] = useState<string | null>(
    items.find((i) => i.editable)?.id ?? null
  );
  const [editableItem, setEditableItem] = useState<Tab | null>(null);

  const tabLayouts = useMemo(() => {
    const layout =
      (items.find((item) => item.id === activeKey)?.layout as WidgetConfig[]) ??
      getDefaultWidgetForTab(
        currentPageType as PageType,
        (activeKey as EntityTabs) ?? EntityTabs.OVERVIEW
      );

    const hasEmptyWidgetPlaceholder = layout.some(
      (widget) => widget.i === LandingPageWidgetKeys.EMPTY_WIDGET_PLACEHOLDER
    );

    return hasEmptyWidgetPlaceholder
      ? layout
      : getLayoutWithEmptyWidgetPlaceholder(layout, 2, 3);
  }, [items, activeKey]);

  const [isWidgetModalOpen, setIsWidgetModalOpen] = useState<boolean>(false);
  const [placeholderWidgetKey, setPlaceholderWidgetKey] = useState<string>('');

  const onChange = (tabKey: string) => {
    const key = tabKey as EntityTabs;
    setActiveKey(key);
  };

  const add = (item?: Tab) => {
    const newActiveKey = uniqueId(`custom`);
    const newTab =
      item ??
      ({
        name: newTabName,
        layout: [],
        id: newActiveKey,
        editable: true,
      } as Tab);

    updateCurrentPage({
      ...currentPage,
      tabs: [...items, newTab],
    } as Page);

    onChange(newActiveKey);
    setShowAddTabModal(false);
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

    newActiveKey && newActiveKey !== activeKey && onChange(newActiveKey);
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
    updateCurrentPage({
      ...currentPage,
      tabs: items.map((item) =>
        item.id === activeKey
          ? {
              ...item,
              layout: tabLayouts.filter((widget) => widget.i !== widgetKey),
            }
          : item
      ),
    } as Page);
  };

  const handleSideLayoutUpdate = useCallback(
    (updatedLayout: Layout[]) => {
      if (!isEmpty(tabLayouts) && !isEmpty(updatedLayout)) {
        const newLayout = cloneDeep(tabLayouts);
        const sidePanelLayout = newLayout.find((layout) =>
          layout.i.startsWith(DetailPageWidgetKeys.LEFT_PANEL)
        );
        if (sidePanelLayout) {
          sidePanelLayout.children = updatedLayout;
        }

        updateCurrentPage({
          ...currentPage,
          tabs: items.map((item) =>
            item.id === activeKey ? { ...item, layout: newLayout } : item
          ),
        } as Page);
      }
    },
    [tabLayouts]
  );

  const leftPanelWidget = useMemo(() => {
    return tabLayouts.find((layout) =>
      layout.i.startsWith(DetailPageWidgetKeys.LEFT_PANEL)
    );
  }, [tabLayouts]);

  const getWidgetFromLayout = (layout: WidgetConfig[]) => {
    return layout.map((widget) => {
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
      } else if (widget.i.startsWith(DetailPageWidgetKeys.LEFT_PANEL)) {
        widgetComponent = (
          <LeftPanelContainer
            isEditView
            key={widget.i}
            layout={leftPanelWidget?.children ?? ([] as WidgetConfig[])}
            type={currentPageType as PageType}
            onUpdate={handleSideLayoutUpdate}
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
    });
  };

  /**
   * Memoized widgets array optimized for drag and drop performance
   * Re-renders only when tabLayouts or leftPanelWidget changes, preventing unnecessary updates
   * during drag operations
   */
  const widgets = useMemo(
    // Re-render upon leftPanelWidget change
    () => getWidgetFromLayout(tabLayouts),
    [tabLayouts, leftPanelWidget]
  );

  /**
   * Layout update handler for drag and drop operations
   * Updates the current page with the new layout while preserving left panel widget children
   */
  const handleLayoutUpdate = useCallback(
    (updatedLayout: Layout[]) => {
      if (!isEmpty(tabLayouts) && !isEmpty(updatedLayout)) {
        updateCurrentPage({
          ...currentPage,
          tabs: items.map((item) =>
            item.id === activeKey
              ? {
                  ...item,
                  layout: getUniqueFilteredLayout(updatedLayout).map(
                    (widget) => ({
                      ...widget,
                      ...(widget.i === DetailPageWidgetKeys.LEFT_PANEL
                        ? // left panel widget will be updated separately
                          { children: leftPanelWidget?.children }
                        : {}),
                    })
                  ),
                }
              : item
          ),
        } as Page);
      }
    },
    [tabLayouts, leftPanelWidget]
  );

  const handleMainPanelAddWidget = useCallback(
    (
      newWidgetData: CommonWidgetType,
      placeholderWidgetKey: string,
      widgetSize: number
    ) => {
      const newLayout = getAddWidgetHandler(
        newWidgetData,
        placeholderWidgetKey,
        widgetSize,
        currentPageType as PageType
      )(tabLayouts);

      updateCurrentPage({
        ...currentPage,
        tabs: items.map((item) =>
          item.id === activeKey ? { ...item, layout: newLayout } : item
        ),
      } as Page);

      setIsWidgetModalOpen(false);
    },
    [tabLayouts]
  );

  // call the hook to set the direction of the grid layout
  useGridLayoutDirection();

  const moveTab = (fromIndex: number, toIndex: number) => {
    const newItems = [...items];
    const [movedItem] = newItems.splice(fromIndex, 1);
    newItems.splice(toIndex, 0, movedItem);

    updateCurrentPage({
      ...currentPage,
      tabs: newItems,
    } as Page);
  };

  const { tabs: hiddenTabs, systemTabIds } = useMemo(() => {
    const systemTabIds = systemTabs.map((item) => item.id);

    return {
      tabs: systemTabs.filter(
        (systemTab) => !items.some((item) => item.id === systemTab.id)
      ),
      systemTabIds,
    };
  }, [items, systemTabs]);

  return (
    <>
      <Col span={24}>
        <Card
          bordered={false}
          data-testid="customize-tab-card"
          extra={
            <Button
              icon={<PlusOutlined />}
              type="primary"
              onClick={() => setShowAddTabModal(true)}>
              {t('label.add-entity', {
                entity: t('label.tab'),
              })}
            </Button>
          }
          title={t('label.customize-tab-plural')}>
          <div className="d-flex flex-wrap gap-4">
            {items.map((item, index) => (
              <TabItem
                index={index}
                item={item}
                key={item.id}
                moveTab={moveTab}
                shouldHide={systemTabIds.includes(item.id)}
                onEdit={onChange}
                onRemove={remove}
                onRename={handleTabEditClick}
              />
            ))}
            {hiddenTabs.map((item) => (
              <Dropdown
                key={item.id}
                menu={{
                  items: [
                    {
                      label: t('label.show'),
                      key: 'show',
                      icon: <EyeFilled />,
                    },
                  ],
                  onClick: () => add(item),
                }}
                trigger={['click']}>
                <Button
                  className="draggable-hidden-tab-item bg-grey"
                  data-testid={`tab-${item.name}`}>
                  <Space>
                    {getTabDisplayName(item)}
                    <MoreOutlined />
                  </Space>
                </Button>
              </Dropdown>
            ))}
          </div>
        </Card>
      </Col>
      <Col span={24}>
        <Card
          bodyStyle={{ padding: 0, paddingBottom: '20px' }}
          bordered={false}
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
          title={t('label.customize-entity-widget-plural', {
            entity: getEntityName(
              items.find((item) => item.id === activeKey) as Tab
            ),
          })}>
          {/* 
            ReactGridLayout with optimized drag and drop behavior for tab customization
            - verticalCompact: Packs widgets tightly without gaps
            - preventCollision={false}: Enables automatic widget repositioning on collision
            - useCSSTransforms: Uses CSS transforms for better performance during drag
          */}
          <ReactGridLayout
            useCSSTransforms
            verticalCompact
            className="grid-container"
            cols={TAB_GRID_MAX_COLUMNS}
            draggableHandle=".drag-widget-icon"
            margin={[16, 16]}
            preventCollision={false}
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
      {showAddTabModal && (
        <Modal
          closable
          cancelText={t('label.cancel')}
          closeIcon={null}
          okText={t('label.add')}
          open={showAddTabModal}
          title={t('label.add-entity', {
            entity: t('label.tab'),
          })}
          onCancel={() => setShowAddTabModal(false)}
          onOk={() => add()}>
          <Input
            autoFocus
            value={newTabName}
            onChange={(e) => setNewTabName(e.target.value)}
          />
        </Modal>
      )}
      {editableItem && (
        <Modal
          maskClosable
          open={!isNil(editableItem)}
          title="Rename tab"
          onCancel={() => setEditableItem(null)}
          onOk={handleRenameSave}>
          <Input
            autoFocus
            value={getTabDisplayName(editableItem)}
            onChange={handleChange}
          />
        </Modal>
      )}
    </>
  );
};
