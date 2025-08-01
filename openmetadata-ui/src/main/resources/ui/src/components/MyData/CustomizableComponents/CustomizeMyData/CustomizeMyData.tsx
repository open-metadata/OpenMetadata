/*
 *  Copyright 2023 Collate.
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

import { compare } from 'fast-json-patch';
import { cloneDeep, isEmpty } from 'lodash';
import { useCallback, useMemo, useState } from 'react';
import RGL, {
  Layout,
  ReactGridLayoutProps,
  WidthProvider,
} from 'react-grid-layout';
import { useTranslation } from 'react-i18next';
import {
  CustomiseHomeModalSelectedKey,
  LandingPageWidgetKeys,
} from '../../../../enums/CustomizablePage.enum';
import { Document } from '../../../../generated/entity/docStore/document';
import { Page } from '../../../../generated/system/ui/page';
import { PageType } from '../../../../generated/system/ui/uiCustomization';
import { useGridLayoutDirection } from '../../../../hooks/useGridLayoutDirection';
import { WidgetConfig } from '../../../../pages/CustomizablePage/CustomizablePage.interface';
import '../../../../pages/MyDataPage/my-data.less';
import {
  getAddWidgetHandler,
  getLandingPageLayoutWithEmptyWidgetPlaceholder,
  getLayoutUpdateHandler,
  getRemoveWidgetHandler,
  getUniqueFilteredLayout,
  getWidgetFromKey,
} from '../../../../utils/CustomizableLandingPageUtils';
import customizeMyDataPageClassBase from '../../../../utils/CustomizeMyDataPageClassBase';
import { getEntityName } from '../../../../utils/EntityUtils';
import { AdvanceSearchProvider } from '../../../Explore/AdvanceSearchProvider/AdvanceSearchProvider.component';
import PageLayoutV1 from '../../../PageLayoutV1/PageLayoutV1';
import CustomiseHomeModal from '../CustomiseHomeModal/CustomiseHomeModal';
import CustomiseLandingPageHeader from '../CustomiseLandingPageHeader/CustomiseLandingPageHeader';
import { CustomizablePageHeader } from '../CustomizablePageHeader/CustomizablePageHeader';
import './customize-my-data.less';
import { CustomizeMyDataProps } from './CustomizeMyData.interface';

const ReactGridLayout = WidthProvider(RGL) as React.ComponentType<
  ReactGridLayoutProps & { children?: React.ReactNode }
>;

function CustomizeMyData({
  personaDetails,
  initialPageData,
  backgroundColor,
  onSaveLayout,
  onBackgroundColorUpdate,
}: Readonly<CustomizeMyDataProps>) {
  const { t } = useTranslation();

  const [layout, setLayout] = useState<Array<WidgetConfig>>(
    getLandingPageLayoutWithEmptyWidgetPlaceholder(
      (initialPageData?.layout as WidgetConfig[]) ??
        customizeMyDataPageClassBase.defaultLayout
    )
  );

  const [placeholderWidgetKey, setPlaceholderWidgetKey] = useState<string>(
    LandingPageWidgetKeys.EMPTY_WIDGET_PLACEHOLDER
  );
  const [isWidgetModalOpen, setIsWidgetModalOpen] = useState<boolean>(false);

  const emptyWidgetPlaceholder = useMemo(
    () => layout.find((widget) => widget.i.endsWith('.EmptyWidgetPlaceholder')),
    [layout]
  );

  const maxRows = useMemo(() => {
    return (
      (emptyWidgetPlaceholder?.y ?? 0) +
      customizeMyDataPageClassBase.defaultWidgetHeight
    );
  }, [emptyWidgetPlaceholder]);

  const handlePlaceholderWidgetKey = useCallback((value: string) => {
    setPlaceholderWidgetKey(value);
  }, []);

  const handleRemoveWidget = useCallback((widgetKey: string) => {
    setLayout(getRemoveWidgetHandler(widgetKey));
  }, []);

  const handleMainPanelAddWidget = useCallback(
    (
      newWidgetData: Document,
      placeholderWidgetKey: string,
      widgetSize: number
    ) => {
      setLayout(
        getAddWidgetHandler(
          newWidgetData,
          placeholderWidgetKey,
          widgetSize,
          customizeMyDataPageClassBase.landingPageMaxGridSize
        )
      );
      setIsWidgetModalOpen(false);
    },
    []
  );

  /**
   * Optimized layout update handler that prevents unnecessary re-renders during drag and drop
   * Uses functional state updates to avoid stale closures and improve performance
   */
  const handleLayoutUpdate = useCallback((updatedLayout: Layout[]) => {
    if (!isEmpty(updatedLayout)) {
      setLayout((currentLayout) => {
        if (!isEmpty(currentLayout)) {
          return getLayoutUpdateHandler(updatedLayout)(currentLayout);
        }

        return currentLayout;
      });
    }
  }, []);

  const handleOpenCustomiseHomeModal = useCallback(() => {
    setIsWidgetModalOpen(true);
  }, []);

  const handleCloseCustomiseHomeModal = useCallback(() => {
    setIsWidgetModalOpen(false);
  }, []);

  const addedWidgetsList = useMemo(
    () =>
      layout
        .filter((widget) => widget.i.startsWith('KnowledgePanel'))
        .map((widget) => widget.i),
    [layout]
  );

  const disableSave = useMemo(() => {
    const filteredLayout = layout.filter((widget) =>
      widget.i.startsWith('KnowledgePanel')
    );

    const jsonPatch = compare(
      cloneDeep((initialPageData?.layout || []) as WidgetConfig[]),
      cloneDeep(filteredLayout || [])
    );

    return jsonPatch.length === 0;
  }, [initialPageData?.layout, layout]);

  const widgets = useMemo(
    () =>
      layout
        .filter(
          (widget) =>
            widget.i !== LandingPageWidgetKeys.EMPTY_WIDGET_PLACEHOLDER
        )
        .map((widget) => (
          <div data-grid={widget} id={widget.i} key={widget.i}>
            {getWidgetFromKey({
              currentLayout: layout,
              handleLayoutUpdate: handleLayoutUpdate,
              handleOpenAddWidgetModal: handleOpenCustomiseHomeModal,
              handlePlaceholderWidgetKey: handlePlaceholderWidgetKey,
              handleRemoveWidget: handleRemoveWidget,
              isEditView: true,
              personaName: getEntityName(personaDetails),
              widgetConfig: widget,
            })}
          </div>
        )),
    [
      layout,
      handleOpenCustomiseHomeModal,
      handlePlaceholderWidgetKey,
      handleRemoveWidget,
      handleLayoutUpdate,
    ]
  );

  const handleSave = async () => {
    await onSaveLayout({
      ...(initialPageData ??
        ({
          pageType: PageType.LandingPage,
        } as Page)),
      layout: getUniqueFilteredLayout(layout),
    });
  };

  const handleBackgroundColorUpdate = async (color?: string) => {
    await onBackgroundColorUpdate?.(color);
  };

  const handleReset = useCallback(async () => {
    // Get default layout with the empty widget added at the end
    const newMainPanelLayout = getLandingPageLayoutWithEmptyWidgetPlaceholder(
      customizeMyDataPageClassBase.defaultLayout
    );
    setLayout(newMainPanelLayout);
    await handleBackgroundColorUpdate();
    await onSaveLayout();
  }, [handleBackgroundColorUpdate, onSaveLayout]);

  // call the hook to set the direction of the grid layout
  useGridLayoutDirection();

  return (
    <AdvanceSearchProvider isExplorePage={false} updateURL={false}>
      <PageLayoutV1
        className="p-box customise-my-data"
        pageTitle={t('label.customize-entity', {
          entity: t('label.landing-page'),
        })}>
        <CustomizablePageHeader
          disableSave={disableSave}
          personaName={getEntityName(personaDetails)}
          onAddWidget={handleOpenCustomiseHomeModal}
          onReset={handleReset}
          onSave={handleSave}
        />
        <div className="grid-wrapper">
          <CustomiseLandingPageHeader
            overlappedContainer
            addedWidgetsList={addedWidgetsList}
            backgroundColor={backgroundColor}
            handleAddWidget={handleMainPanelAddWidget}
            onBackgroundColorUpdate={handleBackgroundColorUpdate}
          />
          {/* 
            ReactGridLayout with optimized drag and drop behavior
            - verticalCompact: Packs widgets tightly without gaps
            - preventCollision={false}: Enables automatic widget repositioning on collision
            - useCSSTransforms: Uses CSS transforms for better performance during drag
          */}
          <ReactGridLayout
            useCSSTransforms
            verticalCompact
            className="grid-container layout"
            cols={customizeMyDataPageClassBase.landingPageMaxGridSize}
            compactType="horizontal"
            draggableHandle=".drag-widget-icon"
            isResizable={false}
            margin={[
              customizeMyDataPageClassBase.landingPageWidgetMargin,
              customizeMyDataPageClassBase.landingPageWidgetMargin,
            ]}
            maxRows={maxRows}
            preventCollision={false}
            rowHeight={customizeMyDataPageClassBase.landingPageRowHeight}
            onLayoutChange={handleLayoutUpdate}>
            {widgets}
          </ReactGridLayout>
        </div>
      </PageLayoutV1>

      {isWidgetModalOpen && (
        <CustomiseHomeModal
          addedWidgetsList={addedWidgetsList}
          currentBackgroundColor={backgroundColor}
          defaultSelectedKey={CustomiseHomeModalSelectedKey.ALL_WIDGETS}
          handleAddWidget={handleMainPanelAddWidget}
          open={isWidgetModalOpen}
          placeholderWidgetKey={placeholderWidgetKey}
          onBackgroundColorUpdate={onBackgroundColorUpdate}
          onClose={handleCloseCustomiseHomeModal}
          onHomePage={false}
        />
      )}
    </AdvanceSearchProvider>
  );
}

export default CustomizeMyData;
