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
import {
  Button as CoreButton,
  Dropdown,
} from '@openmetadata/ui-core-components';
import { Button, Card, Col, Input, Modal } from 'antd';
import { cloneDeep, isEmpty, isNil, isUndefined, uniqueId } from 'lodash';
import { lazy, useCallback, useMemo, useRef, useState } from 'react';
import RGL, { ItemCallback, Layout, WidthProvider } from 'react-grid-layout';
import { useTranslation } from 'react-i18next';
import {
  CommonWidgetType,
  GRID_VERTICAL_MARGIN,
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
import { getEntityTypeFromPageType } from '../../../pages/CustomizeDetailsPage/CustomizeDetailPage.interface';
import {
  getLayoutWithEmptyWidgetPlaceholder,
  getUniqueFilteredLayout,
} from '../../../utils/CustomizableLandingPagePureUtils';
import {
  getCustomizableWidgetByPage,
  getDefaultTabs,
  getDefaultWidgetForTab,
} from '../../../utils/CustomizePage/CustomizePageDispatchUtils';
import { getTabDisplayName } from '../../../utils/CustomizePage/CustomizePageEntityTabUtils';
import {
  getAddWidgetHandler,
  mergeGridLayout,
} from '../../../utils/CustomizePage/CustomizePageWidgetUtils';
import {
  getColumnLockedDragHandlers,
  getGridRowAt,
  getLeftPanelHeight,
  placeWidgetBesideLeftPanel,
  placeWidgetInLeftPanel,
} from '../../../utils/CustomizePage/GridLayoutDragUtils';
import { getEntityName } from '../../../utils/EntityNameUtils';
import withSuspenseFallback from '../../AppRouter/withSuspenseFallback';
import { CustomPropertiesTabLayoutSection } from '../../common/CustomPropertyTable/CustomPropertiesWidget/CustomPropertiesTabLayoutSection';
import { CustomPropertyLayoutItem } from '../../common/CustomPropertyTable/CustomPropertiesWidget/CustomPropertiesWidget.interface';
import { parsePropertyLayout } from '../../common/CustomPropertyTable/CustomPropertiesWidget/CustomPropertiesWidget.utils';
import { TabItem } from '../../common/DraggableTabs/DraggableTabs';
import { resolveWidgetKey } from '../../DataAssets/CommonWidgets/CommonWidgets.utils';

const EmptyWidgetPlaceholder = withSuspenseFallback(
  lazy(
    () =>
      import(
        '../../MyData/CustomizableComponents/EmptyWidgetPlaceholder/EmptyWidgetPlaceholder'
      )
  )
);

const LeftPanelContainer = withSuspenseFallback(
  lazy(() =>
    import('../GenericTab/LeftPanelContainer').then((module) => ({
      default: module.LeftPanelContainer,
    }))
  )
);

const GenericWidget = withSuspenseFallback(
  lazy(() =>
    import('../GenericWidget/GenericWidget').then((module) => ({
      default: module.GenericWidget,
    }))
  )
);

const AddDetailsPageWidgetModal = withSuspenseFallback(
  lazy(
    () =>
      import(
        '../../MyData/CustomizableComponents/AddDetailsPageWidgetModal/AddDetailsPageWidgetModal'
      )
  )
);

// Create a properly typed ReactGridLayout component
const ReactGridLayout = WidthProvider(RGL) as React.ComponentType<
  ReactGridLayout.ReactGridLayoutProps & { children?: React.ReactNode }
>;

// Side-panel widgets stay in their column and only reorder vertically.
const COLUMN_LOCKED_DRAG_HANDLERS =
  getColumnLockedDragHandlers(TAB_GRID_MAX_COLUMNS);

const isPointerInRect = ({ clientX, clientY }: MouseEvent, rect: DOMRect) =>
  clientX >= rect.left &&
  clientX <= rect.right &&
  clientY >= rect.top &&
  clientY <= rect.bottom;

// react-grid-layout applies the layout it hands to onDragStop, so taking a
// widget out of it keeps the widget out of the grid it was dragged from.
const removeFromLayout = (layout: Layout[], widgetId: string) =>
  layout.splice(
    layout.findIndex(({ i }) => i === widgetId),
    1
  );

export type CustomizeTabWidgetProps = WidgetCommonProps;

type TargetKey = React.MouseEvent | React.KeyboardEvent | string;

type CrossPanelDrop =
  // Into the left panel, in its left (0) or right (0.5) half.
  | { kind: 'in'; widget: WidgetConfig; row: number; x: number }
  // Out of the left panel, into the column beside it.
  | { kind: 'out'; widget: WidgetConfig; row: number };

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
  const leftPanelRef = useRef<HTMLDivElement>(null);
  // react-grid-layout calls onLayoutChange right after onDragStop, before React
  // re-renders, with the dropped widget already removed from its grid. A widget
  // dropped across the left panel edge is handed to that call so it commits in
  // the same update, instead of the call overwriting it with the stale layout.
  // Both handlers take it before anything else, so a call that does not apply
  // it cannot leave it behind for a later, unrelated layout change.
  const crossPanelDropRef = useRef<CrossPanelDrop | null>(null);

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

    const layoutWithPlaceholder = hasEmptyWidgetPlaceholder
      ? layout
      : getLayoutWithEmptyWidgetPlaceholder(layout, 2, 3);

    return layoutWithPlaceholder.map((widget) =>
      widget.i.startsWith(DetailPageWidgetKeys.LEFT_PANEL)
        ? { ...widget, h: getLeftPanelHeight(widget.children) }
        : widget
    );
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
      const drop = crossPanelDropRef.current;
      crossPanelDropRef.current = null;
      if (!isEmpty(tabLayouts) && !isEmpty(updatedLayout)) {
        const newLayout = cloneDeep(tabLayouts);
        const sidePanelLayout = newLayout.find((layout) =>
          layout.i.startsWith(DetailPageWidgetKeys.LEFT_PANEL)
        );
        if (sidePanelLayout) {
          sidePanelLayout.children = mergeGridLayout(
            updatedLayout,
            sidePanelLayout.children
          );
        }

        updateCurrentPage({
          ...currentPage,
          tabs: items.map((item) =>
            item.id === activeKey
              ? {
                  ...item,
                  layout:
                    drop?.kind === 'out'
                      ? placeWidgetBesideLeftPanel(
                          newLayout,
                          drop.widget,
                          drop.row,
                          TAB_GRID_MAX_COLUMNS
                        )
                      : newLayout,
                }
              : item
          ),
        } as Page);
      }
    },
    [tabLayouts]
  );

  const handleWidgetConfigChange = (
    widgetKey: string,
    config: WidgetConfig['config'],
    width?: number
  ) => {
    updateCurrentPage({
      ...currentPage,
      tabs: items.map((item) =>
        item.id === activeKey
          ? {
              ...item,
              layout: tabLayouts.map((widget) =>
                widget.i === widgetKey
                  ? { ...widget, config, w: width ?? widget.w }
                  : widget
              ),
            }
          : item
      ),
    } as Page);
  };

  const customPropertiesTabLayout = useMemo(
    () =>
      parsePropertyLayout(
        tabLayouts.find((widget) =>
          resolveWidgetKey(widget.i, [DetailPageWidgetKeys.CUSTOM_PROPERTIES])
        )?.config?.propertyLayout
      ),
    [tabLayouts]
  );

  // The tab stores its arrangement as a single full-width Custom Properties
  // layout item, so the persona document needs no new shape.
  const handleCustomPropertiesTabLayoutChange = (
    propertyLayout: CustomPropertyLayoutItem[]
  ) => {
    updateCurrentPage({
      ...currentPage,
      tabs: items.map((item) =>
        item.id === EntityTabs.CUSTOM_PROPERTIES
          ? {
              ...item,
              layout: [
                {
                  i: DetailPageWidgetKeys.CUSTOM_PROPERTIES,
                  x: 0,
                  y: 0,
                  w: TAB_GRID_MAX_COLUMNS,
                  h: 1,
                  config: { propertyLayout },
                },
              ],
            }
          : item
      ),
    } as Page);
  };

  const leftPanelWidget = useMemo(() => {
    return tabLayouts.find((layout) =>
      layout.i.startsWith(DetailPageWidgetKeys.LEFT_PANEL)
    );
  }, [tabLayouts]);

  // A panel widget dropped right of the panel moves into the side column. The
  // last one stays: handleSideLayoutUpdate ignores an empty panel layout.
  const handleLeftPanelDragStop: ItemCallback = (
    layout,
    _oldItem,
    newItem,
    _placeholder,
    event
  ) => {
    const panelRect = leftPanelRef.current?.getBoundingClientRect();
    const widget = leftPanelWidget?.children?.find(({ i }) => i === newItem.i);
    if (!panelRect || !leftPanelWidget || !widget) {
      return;
    }
    if (layout.length === 1 || event.clientX <= panelRect.right) {
      return;
    }

    removeFromLayout(layout, newItem.i);
    crossPanelDropRef.current = {
      kind: 'out',
      widget,
      // Unlike the panel's grid, the tab grid has no padding to take off.
      row: leftPanelWidget.y + getGridRowAt(event.clientY - panelRect.top),
    };
  };

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
          <div ref={leftPanelRef}>
            <LeftPanelContainer
              isEditView
              key={widget.i}
              layout={leftPanelWidget?.children ?? ([] as WidgetConfig[])}
              type={currentPageType as PageType}
              onDragStop={handleLeftPanelDragStop}
              onUpdate={handleSideLayoutUpdate}
            />
          </div>
        );
      } else {
        widgetComponent = (
          <GenericWidget
            isEditView
            handleRemoveWidget={handleRemoveWidget}
            handleWidgetConfigChange={handleWidgetConfigChange}
            selectedGridSize={widget.w}
            widgetConfig={widget}
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
      const drop = crossPanelDropRef.current;
      crossPanelDropRef.current = null;
      if (!isEmpty(tabLayouts) && !isEmpty(updatedLayout)) {
        const layout = mergeGridLayout(
          getUniqueFilteredLayout(updatedLayout),
          tabLayouts
        );

        updateCurrentPage({
          ...currentPage,
          tabs: items.map((item) =>
            item.id === activeKey
              ? {
                  ...item,
                  layout:
                    drop?.kind === 'in'
                      ? placeWidgetInLeftPanel(
                          layout,
                          drop.widget,
                          drop.row,
                          drop.x,
                          TAB_GRID_MAX_COLUMNS
                        )
                      : layout,
                }
              : item
          ),
        } as Page);
      }
    },
    [tabLayouts]
  );

  // A side widget dropped over the left panel moves into the panel at the row
  // under the pointer.
  const handleDragStop: ItemCallback = (
    layout,
    oldItem,
    newItem,
    placeholder,
    event,
    element
  ) => {
    const panelRect = leftPanelRef.current?.getBoundingClientRect();
    const widget = tabLayouts.find(({ i }) => i === newItem.i);
    if (!panelRect || !widget || !isPointerInRect(event, panelRect)) {
      COLUMN_LOCKED_DRAG_HANDLERS.onDragStop(
        layout,
        oldItem,
        newItem,
        placeholder,
        event,
        element
      );

      return;
    }

    removeFromLayout(layout, newItem.i);
    crossPanelDropRef.current = {
      kind: 'in',
      widget,
      // The panel's grid starts one margin of padding below its top.
      row: getGridRowAt(event.clientY - panelRect.top - GRID_VERTICAL_MARGIN),
      x: event.clientX < panelRect.left + panelRect.width / 2 ? 0 : 0.5,
    };
  };

  const handleMainPanelAddWidget = useCallback(
    (
      newWidgetData: CommonWidgetType,
      placeholderWidgetKey: string,
      widgetSize: number,
      extraConfig?: WidgetConfig['config']
    ) => {
      const newLayout = getAddWidgetHandler(
        newWidgetData,
        placeholderWidgetKey,
        widgetSize,
        currentPageType as PageType,
        extraConfig
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
                // The Custom Properties tab has no widgets but its card layout
                // is arranged here.
                isEditable={
                  item.editable || item.id === EntityTabs.CUSTOM_PROPERTIES
                }
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
              <Dropdown.Root key={item.id}>
                <CoreButton
                  className="draggable-hidden-tab-item bg-grey"
                  color="secondary"
                  data-testid={`tab-${item.name}`}
                  iconTrailing={MoreOutlined}>
                  {getTabDisplayName(item)}
                </CoreButton>
                <Dropdown.Popover
                  className="tw:w-auto"
                  placement="bottom start">
                  <Dropdown.Menu
                    aria-label={getTabDisplayName(item)}
                    selectionMode="none"
                    onAction={() => add(item)}>
                    <Dropdown.Item
                      icon={EyeFilled}
                      id="show"
                      label={t('label.show')}
                    />
                  </Dropdown.Menu>
                </Dropdown.Popover>
              </Dropdown.Root>
            ))}
          </div>
        </Card>
      </Col>
      <Col span={24}>
        <Card
          bodyStyle={{ padding: 0, paddingBottom: '20px' }}
          bordered={false}
          extra={
            activeKey === EntityTabs.CUSTOM_PROPERTIES ? undefined : (
              <Button
                icon={<PlusOutlined />}
                type="primary"
                onClick={handleOpenAddWidgetModal}>
                {t('label.add-entity', {
                  entity: t('label.widget'),
                })}
              </Button>
            )
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
          {activeKey === EntityTabs.CUSTOM_PROPERTIES ? (
            <CustomPropertiesTabLayoutSection
              entityType={getEntityTypeFromPageType(currentPageType)}
              propertyLayout={customPropertiesTabLayout}
              onChange={handleCustomPropertiesTabLayoutChange}
            />
          ) : (
            <ReactGridLayout
              useCSSTransforms
              verticalCompact
              className="grid-container"
              cols={TAB_GRID_MAX_COLUMNS}
              draggableHandle=".drag-widget-icon"
              margin={[16, 16]}
              preventCollision={false}
              rowHeight={100}
              onDrag={COLUMN_LOCKED_DRAG_HANDLERS.onDrag}
              onDragStop={handleDragStop}
              onLayoutChange={handleLayoutUpdate}>
              {widgets}
            </ReactGridLayout>
          )}
        </Card>
      </Col>

      {currentPageType && (
        <AddDetailsPageWidgetModal
          entityType={getEntityTypeFromPageType(currentPageType)}
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
            // eslint-disable-next-line jsx-a11y/no-autofocus -- focus the input when the add-tab modal opens
            autoFocus
            data-testid="add-tab-input"
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
            // eslint-disable-next-line jsx-a11y/no-autofocus -- focus the input when the rename-tab modal opens
            autoFocus
            value={getTabDisplayName(editableItem)}
            onChange={handleChange}
          />
        </Modal>
      )}
    </>
  );
};
