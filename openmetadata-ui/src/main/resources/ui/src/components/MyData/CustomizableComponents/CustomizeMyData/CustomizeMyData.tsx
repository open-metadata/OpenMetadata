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

import { Button, Col, Space, Typography } from 'antd';
import { AxiosError } from 'axios';
import { isEmpty, isNil } from 'lodash';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import RGL, { Layout, WidthProvider } from 'react-grid-layout';
import { useTranslation } from 'react-i18next';
import { Link, useHistory } from 'react-router-dom';
import gridBgImg from '../../../../assets/img/grid-bg-img.png';
import { KNOWLEDGE_LIST_LENGTH } from '../../../../constants/constants';
import {
  GlobalSettingOptions,
  GlobalSettingsMenuCategory,
} from '../../../../constants/GlobalSettings.constants';
import { LandingPageWidgetKeys } from '../../../../enums/CustomizablePage.enum';
import { SearchIndex } from '../../../../enums/search.enum';
import { Document } from '../../../../generated/entity/docStore/document';
import { EntityReference } from '../../../../generated/entity/type';
import { useApplicationStore } from '../../../../hooks/useApplicationStore';
import { useFqn } from '../../../../hooks/useFqn';
import { useGridLayoutDirection } from '../../../../hooks/useGridLayoutDirection';
import { WidgetConfig } from '../../../../pages/CustomizablePage/CustomizablePage.interface';
import '../../../../pages/MyDataPage/my-data.less';
import { searchQuery } from '../../../../rest/searchAPI';
import { Transi18next } from '../../../../utils/CommonUtils';
import {
  getAddWidgetHandler,
  getLayoutUpdateHandler,
  getLayoutWithEmptyWidgetPlaceholder,
  getRemoveWidgetHandler,
  getUniqueFilteredLayout,
  getWidgetFromKey,
} from '../../../../utils/CustomizableLandingPageUtils';
import customizePageClassBase from '../../../../utils/CustomizePageClassBase';
import { getEntityName } from '../../../../utils/EntityUtils';
import {
  getPersonaDetailsPath,
  getSettingPath,
} from '../../../../utils/RouterUtils';
import { showErrorToast } from '../../../../utils/ToastUtils';
import { withActivityFeed } from '../../../AppRouter/withActivityFeed';
import PageLayoutV1 from '../../../PageLayoutV1/PageLayoutV1';
import AddWidgetModal from '../AddWidgetModal/AddWidgetModal';
import './customize-my-data.less';
import { CustomizeMyDataProps } from './CustomizeMyData.interface';

const ReactGridLayout = WidthProvider(RGL);

function CustomizeMyData({
  personaDetails,
  initialPageData,
  onSaveLayout,
  handlePageDataChange,
  handleSaveCurrentPageLayout,
}: Readonly<CustomizeMyDataProps>) {
  const { t } = useTranslation();
  const { currentUser, theme } = useApplicationStore();
  const history = useHistory();
  const { fqn: decodedPersonaFQN } = useFqn();
  const [layout, setLayout] = useState<Array<WidgetConfig>>(
    getLayoutWithEmptyWidgetPlaceholder(
      initialPageData.data?.page?.layout ??
        customizePageClassBase.defaultLayout,
      2,
      4
    )
  );

  const [placeholderWidgetKey, setPlaceholderWidgetKey] = useState<string>(
    LandingPageWidgetKeys.EMPTY_WIDGET_PLACEHOLDER
  );
  const [isWidgetModalOpen, setIsWidgetModalOpen] = useState<boolean>(false);
  const [isResetModalOpen, setIsResetModalOpen] = useState<boolean>(false);
  const [followedData, setFollowedData] = useState<Array<EntityReference>>([]);
  const [followedDataCount, setFollowedDataCount] = useState(0);
  const [isLoadingOwnedData, setIsLoadingOwnedData] = useState<boolean>(false);
  const [saving, setSaving] = useState<boolean>(false);

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
          customizePageClassBase.landingPageMaxGridSize
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

  const handleOpenResetModal = useCallback(() => {
    setIsResetModalOpen(true);
  }, []);

  const handleCloseResetModal = useCallback(() => {
    setIsResetModalOpen(false);
  }, []);

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

  useEffect(() => {
    handlePageDataChange({
      ...initialPageData,
      data: {
        page: {
          layout: getUniqueFilteredLayout(layout),
        },
      },
    });
  }, [layout]);

  const handleCancel = useCallback(() => {
    history.push(
      getSettingPath(
        GlobalSettingsMenuCategory.PREFERENCES,
        GlobalSettingOptions.CUSTOMIZE_LANDING_PAGE
      )
    );
  }, []);

  const handleReset = useCallback(() => {
    // Get default layout with the empty widget added at the end
    const newMainPanelLayout = getLayoutWithEmptyWidgetPlaceholder(
      customizePageClassBase.defaultLayout,
      2,
      4
    );
    setLayout(newMainPanelLayout);
    handlePageDataChange({
      ...initialPageData,
      data: {
        page: {
          layout: getUniqueFilteredLayout(newMainPanelLayout),
        },
      },
    });
    handleSaveCurrentPageLayout(true);
    setIsResetModalOpen(false);
  }, []);

  useEffect(() => {
    fetchUserFollowedData();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    await onSaveLayout();

    setSaving(false);
  };

  // call the hook to set the direction of the grid layout
  useGridLayoutDirection();

  return (
    <>
      <PageLayoutV1
        header={
          <Col
            className="bg-white d-flex justify-between border-bottom p-sm"
            data-testid="customize-landing-page-header"
            span={24}>
            <div className="d-flex gap-2 items-center">
              <Typography.Title
                className="m-0"
                data-testid="customize-page-title"
                level={5}>
                <Transi18next
                  i18nKey="message.customize-landing-page-header"
                  renderElement={
                    <Link
                      style={{ color: theme.primaryColor, fontSize: '16px' }}
                      to={getPersonaDetailsPath(decodedPersonaFQN)}
                    />
                  }
                  values={{
                    persona: isNil(personaDetails)
                      ? decodedPersonaFQN
                      : getEntityName(personaDetails),
                  }}
                />
              </Typography.Title>
            </div>
            <Space>
              <Button
                data-testid="cancel-button"
                disabled={saving}
                size="small"
                onClick={handleCancel}>
                {t('label.cancel')}
              </Button>
              <Button
                data-testid="reset-button"
                disabled={saving}
                size="small"
                onClick={handleOpenResetModal}>
                {t('label.reset')}
              </Button>
              <Button
                data-testid="save-button"
                loading={saving}
                size="small"
                type="primary"
                onClick={handleSave}>
                {t('label.save')}
              </Button>
            </Space>
          </Col>
        }
        headerClassName="m-0 p-0"
        mainContainerClassName="p-t-0"
        pageContainerStyle={{
          backgroundImage: `url(${gridBgImg})`,
        }}
        pageTitle={t('label.customize-entity', {
          entity: t('label.landing-page'),
        })}>
        <ReactGridLayout
          className="grid-container"
          cols={4}
          draggableHandle=".drag-widget-icon"
          isResizable={false}
          margin={[
            customizePageClassBase.landingPageWidgetMargin,
            customizePageClassBase.landingPageWidgetMargin,
          ]}
          rowHeight={customizePageClassBase.landingPageRowHeight}
          onLayoutChange={handleLayoutUpdate}>
          {widgets}
        </ReactGridLayout>
      </PageLayoutV1>

      {isWidgetModalOpen && (
        <AddWidgetModal
          addedWidgetsList={addedWidgetsList}
          handleAddWidget={handleMainPanelAddWidget}
          handleCloseAddWidgetModal={handleCloseAddWidgetModal}
          maxGridSizeSupport={customizePageClassBase.landingPageMaxGridSize}
          open={isWidgetModalOpen}
          placeholderWidgetKey={placeholderWidgetKey}
        />
      )}
    </>
  );
}

export default withActivityFeed(CustomizeMyData);
