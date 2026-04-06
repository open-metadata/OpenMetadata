/*
 *  Copyright 2026 Collate.
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

import { DotsGrid } from '@untitledui/icons';
import { compare } from 'fast-json-patch';
import { isEmpty } from 'lodash';
import React, { useCallback, useMemo, useState } from 'react';
import RGL, {
  Layout,
  ReactGridLayoutProps,
  WidthProvider,
} from 'react-grid-layout';
import { useTranslation } from 'react-i18next';
import marketplaceBg from '../../assets/img/widgets/marketplace-bg.png';
import MarketplaceGreetingBanner from '../../components/DataMarketplace/MarketplaceGreetingBanner/MarketplaceGreetingBanner.component';
import MarketplaceSearchBar from '../../components/DataMarketplace/MarketplaceSearchBar/MarketplaceSearchBar.component';
import { CustomizablePageHeader } from '../../components/MyData/CustomizableComponents/CustomizablePageHeader/CustomizablePageHeader';
import { CustomizeMyDataProps } from '../../components/MyData/CustomizableComponents/CustomizeMyData/CustomizeMyData.interface';
import PageLayoutV1 from '../../components/PageLayoutV1/PageLayoutV1';
import { TAB_GRID_MAX_COLUMNS } from '../../constants/CustomizeWidgets.constants';
import { EntityTabs } from '../../enums/entity.enum';
import { Page, PageType } from '../../generated/system/ui/page';
import { useGridLayoutDirection } from '../../hooks/useGridLayoutDirection';
import dataMarketplaceClassBase from '../../utils/DataMarketplace/DataMarketplaceClassBase';
import { getDataMarketplaceWidgetsFromKey } from '../../utils/DataMarketplace/DataMarketplaceUtils';
import { getEntityName } from '../../utils/EntityUtils';
import { WidgetConfig } from '../CustomizablePage/CustomizablePage.interface';
import { useCustomizeStore } from '../CustomizablePage/CustomizeStore';
import '../DataMarketplacePage/data-marketplace-page.less';
import './customizable-data-marketplace-page.less';

const ReactGridLayout = WidthProvider(RGL) as React.ComponentType<
  ReactGridLayoutProps & { children?: React.ReactNode }
>;

const ROW_HEIGHT = 170;

const dragHandle = (
  <div className="marketplace-drag-handle">
    <DotsGrid className="tw:size-4" />
  </div>
);

const CustomizableDataMarketplacePage = ({
  personaDetails,
  onSaveLayout,
}: CustomizeMyDataProps) => {
  const { t } = useTranslation();
  const { currentPage, currentPageType, getPage, updateCurrentPage } =
    useCustomizeStore();

  const defaultLayout = dataMarketplaceClassBase.getDefaultLayout(
    EntityTabs.OVERVIEW
  );

  const [layout, setLayout] = useState<WidgetConfig[]>(() => {
    const savedLayout = currentPage?.tabs?.[0]?.layout as WidgetConfig[];

    if (isEmpty(savedLayout)) {
      return defaultLayout;
    }

    return savedLayout.map((widget) => ({
      ...widget,
      w: TAB_GRID_MAX_COLUMNS,
      x: 0,
    }));
  });

  useGridLayoutDirection();

  const handleReset = useCallback(async () => {
    const resetLayout = defaultLayout.map((widget) => ({
      ...widget,
      w: TAB_GRID_MAX_COLUMNS,
      x: 0,
    }));
    setLayout(resetLayout);

    const tabs = currentPage?.tabs ?? [
      {
        ...dataMarketplaceClassBase.getDataMarketplaceDetailPageTabsIds()[0],
      },
    ];

    updateCurrentPage({
      ...currentPage,
      pageType: currentPageType as PageType,
      tabs: tabs.map((tab, i) =>
        i === 0 ? { ...tab, layout: resetLayout } : tab
      ),
    } as Page);

    await onSaveLayout();
  }, [
    defaultLayout,
    currentPage,
    currentPageType,
    updateCurrentPage,
    onSaveLayout,
  ]);

  const handleSave = async () => {
    await onSaveLayout(currentPage ?? ({ pageType: currentPageType } as Page));
  };

  const disableSave = useMemo(() => {
    if (!currentPageType) {
      return true;
    }

    const originalPage =
      getPage(currentPageType as string) ??
      ({
        pageType: currentPageType,
      } as Page);
    const editedPage =
      currentPage ??
      ({
        pageType: currentPageType,
      } as Page);

    const jsonPatch = compare(originalPage, editedPage);

    return jsonPatch.length === 0;
  }, [currentPage, currentPageType, getPage]);

  const handleLayoutUpdate = useCallback(
    (updatedLayout: Layout[]) => {
      const newLayout = updatedLayout.map((item) => {
        const widgetData = layout.find((w) => w.i === item.i);

        return {
          ...widgetData,
          ...item,
          w: TAB_GRID_MAX_COLUMNS,
          x: 0,
          static: false,
        } as WidgetConfig;
      });

      setLayout(newLayout);

      const tabs = currentPage?.tabs ?? [
        {
          ...dataMarketplaceClassBase.getDataMarketplaceDetailPageTabsIds()[0],
        },
      ];

      const updatedPage = {
        ...currentPage,
        pageType: currentPageType as PageType,
        tabs: tabs.map((tab, i) =>
          i === 0 ? { ...tab, layout: newLayout } : tab
        ),
      } as Page;

      updateCurrentPage(updatedPage);
    },
    [layout, currentPage, currentPageType, updateCurrentPage]
  );

  const widgets = useMemo(
    () =>
      layout.map((widget) => (
        <div data-grid={widget} key={widget.i}>
          {getDataMarketplaceWidgetsFromKey(widget, true, dragHandle)}
        </div>
      )),
    [layout]
  );

  return (
    <PageLayoutV1
      className="bg-grey"
      pageTitle={t('label.customize-entity', {
        entity: t('label.data-marketplace'),
      })}>
      <div className="customize-details-page">
        <CustomizablePageHeader
          disableSave={disableSave}
          personaName={getEntityName(personaDetails)}
          onReset={handleReset}
          onSave={handleSave}
        />
        <div className="customize-marketplace-content">
          <div
            className="customize-marketplace-bg"
            style={
              {
                '--marketplace-bg': `url(${marketplaceBg})`,
              } as React.CSSProperties
            }>
            <div className="marketplace-grid-wrapper">
              <MarketplaceGreetingBanner />
              <MarketplaceSearchBar isEditView />
            </div>
          </div>
          <div className="marketplace-grid-wrapper" dir="ltr">
            <ReactGridLayout
              useCSSTransforms
              verticalCompact
              className="marketplace-customize-widgets"
              cols={TAB_GRID_MAX_COLUMNS}
              compactType="vertical"
              draggableHandle=".marketplace-drag-handle"
              isResizable={false}
              margin={[16, 24]}
              rowHeight={ROW_HEIGHT}
              onLayoutChange={handleLayoutUpdate}>
              {widgets}
            </ReactGridLayout>
          </div>
        </div>
      </div>
    </PageLayoutV1>
  );
};

export default CustomizableDataMarketplacePage;
