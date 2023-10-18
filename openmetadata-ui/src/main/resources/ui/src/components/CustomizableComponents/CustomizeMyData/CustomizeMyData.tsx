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

import { Button, Col, Modal, Space, Typography } from 'antd';
import { AxiosError } from 'axios';
import { isEmpty, isNil, uniqBy } from 'lodash';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import RGL, { Layout, WidthProvider } from 'react-grid-layout';
import { useTranslation } from 'react-i18next';
import { Link, useHistory, useLocation, useParams } from 'react-router-dom';
import AppState from '../../../AppState';
import gridBgImg from '../../../assets/img/grid-bg-img.png';
import {
  GlobalSettingOptions,
  GlobalSettingsMenuCategory,
} from '../../../constants/GlobalSettings.constants';
import { LandingPageWidgetKeys } from '../../../enums/CustomizablePage.enum';
import { AssetsType } from '../../../enums/entity.enum';
import { Document } from '../../../generated/entity/docStore/document';
import { Thread } from '../../../generated/entity/feed/thread';
import { EntityReference } from '../../../generated/entity/type';
import { PageType } from '../../../generated/system/ui/page';
import { useAuth } from '../../../hooks/authHooks';
import { WidgetConfig } from '../../../pages/CustomizablePage/CustomizablePage.interface';
import '../../../pages/MyDataPage/my-data.less';
import { getActiveAnnouncement } from '../../../rest/feedsAPI';
import { getUserById } from '../../../rest/userAPI';
import { Transi18next } from '../../../utils/CommonUtils';
import {
  getAddWidgetHandler,
  getLayoutUpdateHandler,
  getLayoutWithEmptyWidgetPlaceholder,
  getRemoveWidgetHandler,
  getWidgetFromKey,
} from '../../../utils/CustomizableLandingPageUtils';
import customizePageClassBase from '../../../utils/CustomizePageClassBase';
import {
  getPersonaDetailsPath,
  getSettingPath,
} from '../../../utils/RouterUtils';
import { getDecodedFqn } from '../../../utils/StringsUtils';
import { showErrorToast } from '../../../utils/ToastUtils';
import ActivityFeedProvider from '../../ActivityFeed/ActivityFeedProvider/ActivityFeedProvider';
import PageLayoutV1 from '../../containers/PageLayoutV1';
import AddWidgetModal from '../AddWidgetModal/AddWidgetModal';
import { CustomizeMyDataProps } from './CustomizeMyData.interface';

const ReactGridLayout = WidthProvider(RGL);

function CustomizeMyData({
  initialPageData,
  onSaveLayout,
  handlePageDataChange,
  handleSaveCurrentPageLayout,
}: Readonly<CustomizeMyDataProps>) {
  const { t } = useTranslation();
  const history = useHistory();
  const { fqn: personaFQN } = useParams<{ fqn: string; pageFqn: PageType }>();
  const location = useLocation();
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
  const { isAuthDisabled } = useAuth(location.pathname);
  const [followedData, setFollowedData] = useState<Array<EntityReference>>();
  const [followedDataCount, setFollowedDataCount] = useState(0);
  const [isLoadingOwnedData, setIsLoadingOwnedData] = useState<boolean>(false);
  const [isAnnouncementLoading, setIsAnnouncementLoading] =
    useState<boolean>(true);
  const [announcements, setAnnouncements] = useState<Thread[]>([]);

  const decodedPersonaFQN = useMemo(
    () => getDecodedFqn(personaFQN),
    [personaFQN]
  );

  const currentUser = useMemo(
    () => AppState.getCurrentUserDetails(),
    [AppState.userDetails, AppState.nonSecureUserDetails]
  );

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

  const fetchMyData = async () => {
    if (!currentUser?.id) {
      return;
    }
    setIsLoadingOwnedData(true);
    try {
      const userData = await getUserById(currentUser?.id, 'follows, owns');

      if (userData) {
        const includeData = Object.values(AssetsType);
        const follows: EntityReference[] = userData.follows ?? [];
        const includedFollowsData = follows.filter((data) =>
          includeData.includes(data.type as AssetsType)
        );
        setFollowedDataCount(includedFollowsData.length);
        setFollowedData(includedFollowsData.slice(0, 8));
      }
    } catch (err) {
      setFollowedData([]);
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
            announcements: announcements,
            followedData: followedData ?? [],
            followedDataCount: followedDataCount,
            isLoadingOwnedData: isLoadingOwnedData,
            widgetConfig: widget,
            handleOpenAddWidgetModal: handleOpenAddWidgetModal,
            handlePlaceholderWidgetKey: handlePlaceholderWidgetKey,
            handleRemoveWidget: handleRemoveWidget,
            isEditView: true,
            isAnnouncementLoading: isAnnouncementLoading,
          })}
        </div>
      )),
    [
      layout,
      announcements,
      followedData,
      followedDataCount,
      isLoadingOwnedData,
      handleOpenAddWidgetModal,
      handlePlaceholderWidgetKey,
      handleRemoveWidget,
      isAnnouncementLoading,
    ]
  );

  const fetchAnnouncements = useCallback(async () => {
    try {
      setIsAnnouncementLoading(true);
      const response = await getActiveAnnouncement();

      setAnnouncements(response.data);
    } catch (error) {
      showErrorToast(error as AxiosError);
    } finally {
      setIsAnnouncementLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAnnouncements();
  }, []);

  useEffect(() => {
    handlePageDataChange({
      ...initialPageData,
      data: {
        page: {
          layout: uniqBy(
            layout.filter(
              (widget) =>
                widget.i.startsWith('KnowledgePanel') &&
                !widget.i.endsWith('.EmptyWidgetPlaceholder')
            ),
            'i'
          ),
        },
      },
    });
  }, [layout]);

  const handleCancel = useCallback(() => {
    history.push(
      getSettingPath(
        GlobalSettingsMenuCategory.OPEN_METADATA,
        GlobalSettingOptions.CUSTOMIZE_LANDING_PAGE
      )
    );
  }, []);

  const handleReset = useCallback(() => {
    const newMainPanelLayout = customizePageClassBase.defaultLayout;
    setLayout(newMainPanelLayout);
    handlePageDataChange({
      ...initialPageData,
      data: {
        page: {
          layout: uniqBy(newMainPanelLayout, 'i'),
        },
      },
    });
    handleSaveCurrentPageLayout(true);
    setIsResetModalOpen(false);
  }, []);

  useEffect(() => {
    if (
      ((isAuthDisabled && AppState.users.length) ||
        !isEmpty(AppState.userDetails)) &&
      isNil(followedData)
    ) {
      fetchMyData();
    }
  }, [AppState.userDetails, AppState.users, isAuthDisabled]);

  return (
    <ActivityFeedProvider>
      <PageLayoutV1
        header={
          <Col
            className="bg-white d-flex justify-between border-bottom p-sm"
            span={24}>
            <div className="d-flex gap-2 items-center">
              <Typography.Title className="m-0" level={5}>
                <Transi18next
                  i18nKey="message.customize-landing-page-header"
                  renderElement={
                    <Link
                      style={{ color: '#1890ff', fontSize: '16px' }}
                      to={getPersonaDetailsPath(decodedPersonaFQN)}
                    />
                  }
                  values={{
                    persona: decodedPersonaFQN,
                  }}
                />
              </Typography.Title>
            </div>
            <Space>
              <Button size="small" onClick={handleCancel}>
                {t('label.cancel')}
              </Button>
              <Button size="small" onClick={handleOpenResetModal}>
                {t('label.reset')}
              </Button>
              <Button size="small" type="primary" onClick={onSaveLayout}>
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
      {isResetModalOpen && (
        <Modal
          centered
          cancelText={t('label.no')}
          okText={t('label.yes')}
          open={isResetModalOpen}
          title={t('label.reset-default-layout')}
          onCancel={handleCloseResetModal}
          onOk={handleReset}>
          {t('message.reset-layout-confirmation')}
        </Modal>
      )}
    </ActivityFeedProvider>
  );
}

export default CustomizeMyData;
