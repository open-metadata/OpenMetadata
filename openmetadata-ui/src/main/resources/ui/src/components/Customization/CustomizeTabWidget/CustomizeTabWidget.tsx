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
    Box,
    Button,
    Card,
    Dropdown,
    Grid,
    Input,
    SimpleModal
} from '@openmetadata/ui-core-components';
import {
    DotsVertical,
    EyeFilled,
    Plus
} from '@openmetadata/ui-core-components/icons';
import classNames from 'classnames';
import { cloneDeep, isEmpty, isNil, isUndefined, uniqueId } from 'lodash';
import { lazy, useCallback, useMemo, useState } from 'react';
import RGL, { Layout, WidthProvider } from 'react-grid-layout';
import { useTranslation } from 'react-i18next';
import {
    CommonWidgetType,
    TAB_GRID_MAX_COLUMNS
} from '../../../constants/CustomizeWidgets.constants';
import { LandingPageWidgetKeys } from '../../../enums/CustomizablePage.enum';
import { DetailPageWidgetKeys } from '../../../enums/CustomizeDetailPage.enum';
import { EntityTabs } from '../../../enums/entity.enum';
import { Page, Tab } from '../../../generated/system/ui/page';
import { PageType } from '../../../generated/system/ui/uiCustomization';
import { useLeftPanelCrossDrop } from '../../../hooks/platform/useLeftPanelCrossDrop';
import { useGridLayoutDirection } from '../../../hooks/useGridLayoutDirection';
import {
    WidgetCommonProps,
    WidgetConfig
} from '../../../interface/customization.interface';
import { useCustomizeStore } from '../../../pages/CustomizablePage/CustomizeStore';
import { getEntityTypeFromPageType } from '../../../pages/CustomizeDetailsPage/CustomizeDetailPage.interface';
import {
    getLayoutWithEmptyWidgetPlaceholder,
    getUniqueFilteredLayout
} from '../../../utils/CustomizableLandingPagePureUtils';
import {
    getCustomizableWidgetByPage,
    getDefaultTabs,
    getDefaultWidgetForTab
} from '../../../utils/CustomizePage/CustomizePageDispatchUtils';
import { getTabDisplayName } from '../../../utils/CustomizePage/CustomizePageEntityTabUtils';
import {
    getAddWidgetHandler,
    mergeGridLayout
} from '../../../utils/CustomizePage/CustomizePageWidgetUtils';
import {
    getLeftPanelHeight,
    placeWidgetBesideLeftPanel,
    placeWidgetInLeftPanel
} from '../../../utils/CustomizePage/GridLayoutDragUtils';
import { getEntityName } from '../../../utils/EntityNameUtils';
import { showInfoToast } from '../../../utils/ToastUtils';
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

  const leftPanelWidget = useMemo(() => {
    return tabLayouts.find((layout) =>
      layout.i.startsWith(DetailPageWidgetKeys.LEFT_PANEL)
    );
  }, [tabLayouts]);

  const handleLastPanelWidgetKept = useCallback(
    () => showInfoToast(t('message.at-least-one-widget-in-panel')),
    [t]
  );

  const {
    panelRef,
    dropTarget,
    takeDrop,
    handleTabDrag,
    handleTabDragStop,
    handlePanelDrag,
    handlePanelDragStop,
  } = useLeftPanelCrossDrop({
    leftPanelWidget,
    tabLayout: tabLayouts,
    onLastPanelWidgetKept: handleLastPanelWidgetKept,
  });

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

  const handleChange = (displayName: string) => {
    editableItem && setEditableItem({ ...editableItem, displayName });
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
      const drop = takeDrop();
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
    [tabLayouts, takeDrop, currentPage, items, activeKey, updateCurrentPage]
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
          <div
            className={classNames('tw:rounded-xl', {
              'tw:outline-2 tw:-outline-offset-2 tw:outline-brand-solid':
                dropTarget === 'panel',
              // Dropped here the widget leaves the panel, so the panel's grid
              // shows no slot for it.
              'tw:[&_.react-grid-placeholder]:invisible':
                dropTarget === 'beside',
            })}
            data-drop-target={dropTarget ?? undefined}
            data-testid="left-panel-drop-target"
            ref={panelRef}>
            <LeftPanelContainer
              isEditView
              editColumns={widget.w}
              key={widget.i}
              layout={widget.children ?? ([] as WidgetConfig[])}
              type={currentPageType as PageType}
              onDrag={handlePanelDrag}
              onDragStop={handlePanelDragStop}
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

      // The panel's height comes from the widgets inside it, for the grid only,
      // so it is not saved over the stored one.
      const gridItem = widget.i.startsWith(DetailPageWidgetKeys.LEFT_PANEL)
        ? { ...widget, h: getLeftPanelHeight(widget.children) }
        : widget;

      return (
        <div data-grid={gridItem} id={widget.i} key={widget.i}>
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
    () => getWidgetFromLayout(tabLayouts),
    [
      tabLayouts,
      dropTarget,
      handlePanelDrag,
      handlePanelDragStop,
      handleSideLayoutUpdate,
    ]
  );

  /**
   * Layout update handler for drag and drop operations
   * Updates the current page with the new layout while preserving left panel widget children
   */
  const handleLayoutUpdate = useCallback(
    (updatedLayout: Layout[]) => {
      const drop = takeDrop();
      if (!isEmpty(tabLayouts) && !isEmpty(updatedLayout)) {
        // The grid sizes the panel to its widgets; keep the stored height.
        const layout = mergeGridLayout(
          getUniqueFilteredLayout(updatedLayout),
          tabLayouts
        ).map((widget) =>
          widget.i === leftPanelWidget?.i
            ? { ...widget, h: leftPanelWidget.h }
            : widget
        );

        updateCurrentPage({
          ...currentPage,
          tabs: items.map((item) =>
            item.id === activeKey
              ? {
                  ...item,
                  layout:
                    drop?.kind === 'in'
                      ? placeWidgetInLeftPanel(layout, drop.widget, drop)
                      : layout,
                }
              : item
          ),
        } as Page);
      }
    },
    [
      tabLayouts,
      leftPanelWidget,
      takeDrop,
      currentPage,
      items,
      activeKey,
      updateCurrentPage,
    ]
  );

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
    [
      tabLayouts,
      currentPageType,
      currentPage,
      items,
      activeKey,
      updateCurrentPage,
    ]
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
      <Grid.Item className="layout-column" span={24}>
        <Card className="tw:w-full" data-testid="customize-tab-card">
          <Card.Header
            className="tw:items-center tw:border-b-0 tw:pt-5"
            extra={
              <Button
                color="primary"
                iconLeading={Plus}
                onPress={() => setShowAddTabModal(true)}>
                {t('label.add-entity', {
                  entity: t('label.tab'),
                })}
              </Button>
            }
            title={t('label.customize-tab-plural')}
          />
          <Card.Content className="tw:pb-6">
            <Box gap={4} wrap="wrap">
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
                  <Button
                    className="draggable-hidden-tab-item bg-grey"
                    color="secondary"
                    data-testid={`tab-${item.name}`}
                    iconTrailing={DotsVertical}>
                    {getTabDisplayName(item)}
                  </Button>
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
            </Box>
          </Card.Content>
        </Card>
      </Grid.Item>
      <Grid.Item className="layout-column" span={24}>
        <Card className="tw:w-full">
          <Card.Header
            className="tw:items-center tw:border-b-0 tw:pt-5"
            extra={
              activeKey === EntityTabs.CUSTOM_PROPERTIES ? undefined : (
                <Button
                  color="primary"
                  iconLeading={Plus}
                  onPress={handleOpenAddWidgetModal}>
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
            })}
          />
          <div className="tw:pb-5">
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
                onDrag={handleTabDrag}
                onDragStop={handleTabDragStop}
                onLayoutChange={handleLayoutUpdate}>
                {widgets}
              </ReactGridLayout>
            )}
          </div>
        </Card>
      </Grid.Item>

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
      <SimpleModal
        cancelText={t('label.cancel')}
        isOpen={showAddTabModal}
        okText={t('label.add')}
        title={t('label.add-entity', {
          entity: t('label.tab'),
        })}
        onCancel={() => setShowAddTabModal(false)}
        onOk={() => add()}>
        <Input
          // eslint-disable-next-line jsx-a11y/no-autofocus -- focus the input when the add-tab modal opens
          autoFocus
          aria-label={t('label.tab')}
          inputDataTestId="add-tab-input"
          value={newTabName}
          onChange={setNewTabName}
        />
      </SimpleModal>
      <SimpleModal
        cancelText={t('label.cancel')}
        isOpen={!isNil(editableItem)}
        okText={t('label.ok')}
        title={t('label.rename-entity', { entity: t('label.tab') })}
        onCancel={() => setEditableItem(null)}
        onOk={handleRenameSave}>
        <Input
          // eslint-disable-next-line jsx-a11y/no-autofocus -- focus the input when the rename-tab modal opens
          autoFocus
          aria-label={t('label.tab')}
          value={editableItem ? getTabDisplayName(editableItem) : ''}
          onChange={handleChange}
        />
      </SimpleModal>
    </>
  );
};
