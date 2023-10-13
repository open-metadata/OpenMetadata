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

import { Button, Col, Modal, Row, Space, Typography } from 'antd';
import { AxiosError } from 'axios';
import classNames from 'classnames';
import { isEmpty, isNil, uniqBy } from 'lodash';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Layout, Responsive, WidthProvider } from 'react-grid-layout';
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
  getRemoveWidgetHandler,
} from '../../../utils/CustomizableLandingPageUtils';
import customizePageClassBase from '../../../utils/CustomizePageClassBase';
import {
  getPersonaDetailsPath,
  getSettingPath,
} from '../../../utils/RouterUtils';
import { getDecodedFqn } from '../../../utils/StringsUtils';
import { showErrorToast } from '../../../utils/ToastUtils';
import ActivityFeedProvider from '../../ActivityFeed/ActivityFeedProvider/ActivityFeedProvider';
import RightSidebar from '../../MyData/RightSidebar/RightSidebar.component';
import AddWidgetModal from '../AddWidgetModal/AddWidgetModal';
import EmptyWidgetPlaceholder from '../EmptyWidgetPlaceholder/EmptyWidgetPlaceholder';
import { CustomizeMyDataProps } from './CustomizeMyData.interface';

const ResponsiveGridLayout = WidthProvider(Responsive);

function CustomizeMyData({
  initialPageData,
  onSaveLayout,
  handlePageDataChange,
}: Readonly<CustomizeMyDataProps>) {
  const { t } = useTranslation();
  const history = useHistory();
  const { fqn: personaFQN } = useParams<{ fqn: string; pageFqn: PageType }>();
  const location = useLocation();
  const [resetRightPanelLayout, setResetRightPanelLayout] =
    useState<boolean>(false);
  const [layout, setLayout] = useState<Array<WidgetConfig>>([
    ...(initialPageData.data?.page?.layout ??
      customizePageClassBase.landingPageDefaultLayout),
    {
      h: 2,
      i: LandingPageWidgetKeys.EMPTY_WIDGET_PLACEHOLDER,
      w: 3,
      x: 0,
      y: 100,
      isDraggable: false,
    },
  ]);
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

  const handleResetRightPanelLayout = useCallback((value: boolean) => {
    setResetRightPanelLayout(value);
  }, []);

  const handleLayoutChange = useCallback((newLayout: Array<WidgetConfig>) => {
    setLayout(newLayout);
  }, []);

  const handleRemoveWidget = useCallback((widgetKey: string) => {
    setLayout(getRemoveWidgetHandler(widgetKey, 3, 3.5));
  }, []);

  const handleAddWidget = useCallback(
    (newWidgetData: Document, placeholderWidgetKey: string) => {
      setLayout(
        getAddWidgetHandler(
          newWidgetData,
          placeholderWidgetKey,
          customizePageClassBase.landingPageMaxGridSize
        )
      );
      setIsWidgetModalOpen(false);
    },
    [layout]
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

  const getWidgetFromKey = useCallback(
    (widgetConfig: WidgetConfig) => {
      if (widgetConfig.i.endsWith('.EmptyWidgetPlaceholder')) {
        return (
          <EmptyWidgetPlaceholder
            handleOpenAddWidgetModal={handleOpenAddWidgetModal}
            handlePlaceholderWidgetKey={handlePlaceholderWidgetKey}
            handleRemoveWidget={handleRemoveWidget}
            isEditable={widgetConfig.isDraggable}
            widgetKey={widgetConfig.i}
          />
        );
      }
      if (widgetConfig.i.startsWith(LandingPageWidgetKeys.RIGHT_PANEL)) {
        return (
          <div className="h-full border-left p-l-md">
            <RightSidebar
              isEditView
              announcements={announcements}
              followedData={followedData ?? []}
              followedDataCount={followedDataCount}
              handleResetLayout={handleResetRightPanelLayout}
              isAnnouncementLoading={isAnnouncementLoading}
              isLoadingOwnedData={isLoadingOwnedData}
              layoutConfigData={widgetConfig.data}
              parentLayoutData={layout}
              resetLayout={resetRightPanelLayout}
              updateParentLayout={handleLayoutChange}
            />
          </div>
        );
      }

      const Widget = customizePageClassBase.getWidgetsFromKey(widgetConfig.i);

      return (
        <Widget
          isEditView
          announcements={announcements}
          followedData={followedData ?? []}
          followedDataCount={followedDataCount}
          handleRemoveWidget={handleRemoveWidget}
          isLoadingOwnedData={isLoadingOwnedData}
          widgetKey={widgetConfig.i}
        />
      );
    },
    [
      handleOpenAddWidgetModal,
      handleRemoveWidget,
      followedData,
      followedDataCount,
      isLoadingOwnedData,
      layout,
      handleLayoutChange,
      isAnnouncementLoading,
      announcements,
      resetRightPanelLayout,
      handleResetRightPanelLayout,
      handlePlaceholderWidgetKey,
    ]
  );

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
        <div
          className={classNames({
            'mt--1': widget.i === LandingPageWidgetKeys.RIGHT_PANEL,
          })}
          data-grid={widget}
          key={widget.i}>
          {getWidgetFromKey(widget)}
        </div>
      )),
    [layout, getWidgetFromKey]
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
          ...initialPageData.data.page,
          layout: uniqBy(
            layout.filter(
              (widget) => !widget.i.endsWith('.EmptyWidgetPlaceholder')
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

  const handleSave = useCallback(async () => {
    await onSaveLayout();
    handleCancel();
  }, [onSaveLayout]);

  const handleReset = useCallback(() => {
    setLayout([
      ...customizePageClassBase.landingPageDefaultLayout,
      {
        h: 2,
        i: LandingPageWidgetKeys.EMPTY_WIDGET_PLACEHOLDER,
        w: 3,
        x: 0,
        y: 100,
        isDraggable: false,
      },
    ]);
    setResetRightPanelLayout(true);
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
    <Row>
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
          <Button size="small" type="primary" onClick={handleSave}>
            {t('label.save')}
          </Button>
        </Space>
      </Col>
      <Col span={24}>
        <ActivityFeedProvider>
          <ResponsiveGridLayout
            autoSize
            breakpoints={{ lg: 1200, md: 996, sm: 768, xs: 480, xxs: 0 }}
            className="grid-container"
            cols={{ lg: 4, md: 4, sm: 4, xs: 4, xxs: 4 }}
            draggableHandle=".drag-widget-icon"
            isResizable={false}
            margin={[
              customizePageClassBase.landingPageWidgetMargin,
              customizePageClassBase.landingPageWidgetMargin,
            ]}
            rowHeight={customizePageClassBase.landingPageRowHeight}
            style={{
              backgroundImage: `url(${gridBgImg})`,
            }}
            onLayoutChange={handleLayoutUpdate}>
            {widgets}
          </ResponsiveGridLayout>
          {isWidgetModalOpen && (
            <AddWidgetModal
              addedWidgetsList={addedWidgetsList}
              handleAddWidget={handleAddWidget}
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
      </Col>
    </Row>
  );
}

export default CustomizeMyData;
