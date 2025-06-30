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

import { AxiosError } from 'axios';
import { isEmpty } from 'lodash';
import { useCallback, useEffect, useMemo, useState } from 'react';
import RGL, {
  Layout,
  ReactGridLayoutProps,
  WidthProvider,
} from 'react-grid-layout';
import { useTranslation } from 'react-i18next';
import { KNOWLEDGE_LIST_LENGTH } from '../../../../constants/constants';
import { LandingPageWidgetKeys } from '../../../../enums/CustomizablePage.enum';
import { SearchIndex } from '../../../../enums/search.enum';
import { Document } from '../../../../generated/entity/docStore/document';
import { EntityReference } from '../../../../generated/entity/type';
import { Page } from '../../../../generated/system/ui/page';
import { PageType } from '../../../../generated/system/ui/uiCustomization';
import { useApplicationStore } from '../../../../hooks/useApplicationStore';
import { useGridLayoutDirection } from '../../../../hooks/useGridLayoutDirection';
import { WidgetConfig } from '../../../../pages/CustomizablePage/CustomizablePage.interface';
import '../../../../pages/MyDataPage/my-data.less';
import { searchQuery } from '../../../../rest/searchAPI';
import {
  getAddWidgetHandler,
  getLayoutUpdateHandler,
  getLayoutWithEmptyWidgetPlaceholder,
  getRemoveWidgetHandler,
  getUniqueFilteredLayout,
  getWidgetFromKey,
} from '../../../../utils/CustomizableLandingPageUtils';
import customizeMyDataPageClassBase from '../../../../utils/CustomizeMyDataPageClassBase';
import { getEntityName } from '../../../../utils/EntityUtils';
import { showErrorToast } from '../../../../utils/ToastUtils';
import { withActivityFeed } from '../../../AppRouter/withActivityFeed';
import PageLayoutV1 from '../../../PageLayoutV1/PageLayoutV1';
import AddWidgetModal from '../AddWidgetModal/AddWidgetModal';
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
  onSaveLayout,
}: Readonly<CustomizeMyDataProps>) {
  const { t } = useTranslation();
  const { currentUser } = useApplicationStore();

  const [layout, setLayout] = useState<Array<WidgetConfig>>(
    getLayoutWithEmptyWidgetPlaceholder(
      (initialPageData?.layout as WidgetConfig[]) ??
        customizeMyDataPageClassBase.defaultLayout,
      2,
      4
    )
  );

  const [placeholderWidgetKey, setPlaceholderWidgetKey] = useState<string>(
    LandingPageWidgetKeys.EMPTY_WIDGET_PLACEHOLDER
  );
  const [isWidgetModalOpen, setIsWidgetModalOpen] = useState<boolean>(false);

  const [followedData, setFollowedData] = useState<Array<EntityReference>>([]);
  const [followedDataCount, setFollowedDataCount] = useState(0);
  const [isLoadingOwnedData, setIsLoadingOwnedData] = useState<boolean>(false);

  const handlePlaceholderWidgetKey = useCallback((value: string) => {
    setPlaceholderWidgetKey(value);
  }, []);

  const handleRemoveWidget = useCallback((widgetKey: string) => {
    setLayout(getRemoveWidgetHandler(widgetKey, 3, 3.5));
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

  const handleLayoutUpdate = useCallback(
    (updatedLayout: Layout[]) => {
      if (!isEmpty(layout) && !isEmpty(updatedLayout)) {
        setLayout(getLayoutUpdateHandler(updatedLayout));
      }
    },
    [layout]
  );

  const handleOpenAddWidgetModal = useCallback(() => {
    setIsWidgetModalOpen(true);
  }, []);

  const handleCloseAddWidgetModal = useCallback(() => {
    setIsWidgetModalOpen(false);
  }, []);

  const fetchUserFollowedData = async () => {
    if (!currentUser?.id) {
      return;
    }
    setIsLoadingOwnedData(true);
    try {
      const res = await searchQuery({
        pageSize: KNOWLEDGE_LIST_LENGTH,
        searchIndex: SearchIndex.ALL,
        query: '*',
        filters: `followers:${currentUser.id}`,
      });

      setFollowedDataCount(res?.hits?.total.value ?? 0);
      setFollowedData(res.hits.hits.map((hit) => hit._source));
    } catch (err) {
      showErrorToast(err as AxiosError);
    } finally {
      setIsLoadingOwnedData(false);
    }
  };

  const addedWidgetsList = useMemo(
    () =>
      layout
        .filter((widget) => widget.i.startsWith('KnowledgePanel'))
        .map((widget) => widget.i),
    [layout]
  );

  const widgets = useMemo(
    () =>
      layout.map((widget) => (
        <div data-grid={widget} id={widget.i} key={widget.i}>
          {getWidgetFromKey({
            followedData,
            followedDataCount,
            isLoadingOwnedData: isLoadingOwnedData,
            widgetConfig: widget,
            handleOpenAddWidgetModal: handleOpenAddWidgetModal,
            handlePlaceholderWidgetKey: handlePlaceholderWidgetKey,
            handleRemoveWidget: handleRemoveWidget,
            isEditView: true,
          })}
        </div>
      )),
    [
      layout,
      followedData,
      followedDataCount,
      isLoadingOwnedData,
      handleOpenAddWidgetModal,
      handlePlaceholderWidgetKey,
      handleRemoveWidget,
    ]
  );

  const handleReset = useCallback(() => {
    // Get default layout with the empty widget added at the end
    const newMainPanelLayout = getLayoutWithEmptyWidgetPlaceholder(
      customizeMyDataPageClassBase.defaultLayout,
      2,
      4
    );
    setLayout(newMainPanelLayout);
    onSaveLayout();
  }, []);

  useEffect(() => {
    fetchUserFollowedData();
  }, []);

  const handleSave = async () => {
    await onSaveLayout({
      ...(initialPageData ??
        ({
          pageType: PageType.LandingPage,
        } as Page)),
      layout: getUniqueFilteredLayout(layout),
    });
  };

  const handleBackgroundColorUpdate = async (color: string) => {
    await onSaveLayout({
      ...(initialPageData ??
        ({
          pageType: PageType.LandingPage,
        } as Page)),
      layout: getUniqueFilteredLayout(layout),
      homePageBannerBackgroundColor: color,
    } as Page);
  };

  // call the hook to set the direction of the grid layout
  useGridLayoutDirection();

  return (
    <>
      <PageLayoutV1
        className="p-t-box customise-my-data"
        pageTitle={t('label.customize-entity', {
          entity: t('label.landing-page'),
        })}>
        <CustomizablePageHeader
          personaName={getEntityName(personaDetails)}
          onReset={handleReset}
          onSave={handleSave}
        />
        <div className="grid-wrapper">
          <CustomiseLandingPageHeader
            overlappedContainer
            addedWidgetsList={addedWidgetsList}
            handleAddWidget={handleMainPanelAddWidget}
            onBackgroundColorUpdate={handleBackgroundColorUpdate} // TODO: We need to update this background color updation api call when we get the api
          />
          <ReactGridLayout
            className="grid-container"
            cols={3}
            draggableHandle=".drag-widget-icon"
            isResizable={false}
            margin={[
              customizeMyDataPageClassBase.landingPageWidgetMargin,
              customizeMyDataPageClassBase.landingPageWidgetMargin,
            ]}
            rowHeight={customizeMyDataPageClassBase.landingPageRowHeight}
            onLayoutChange={handleLayoutUpdate}>
            {widgets}
          </ReactGridLayout>
        </div>
      </PageLayoutV1>

      {isWidgetModalOpen && (
        <AddWidgetModal
          addedWidgetsList={addedWidgetsList}
          handleAddWidget={handleMainPanelAddWidget}
          handleCloseAddWidgetModal={handleCloseAddWidgetModal}
          maxGridSizeSupport={
            customizeMyDataPageClassBase.landingPageMaxGridSize
          }
          open={isWidgetModalOpen}
          placeholderWidgetKey={placeholderWidgetKey}
        />
      )}
    </>
  );
}

export default withActivityFeed(CustomizeMyData);
