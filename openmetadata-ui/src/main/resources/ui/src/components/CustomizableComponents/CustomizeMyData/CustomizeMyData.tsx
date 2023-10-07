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

import { PlusOutlined } from '@ant-design/icons';
import { Button, Col, Row } from 'antd';
import { AxiosError } from 'axios';
import classNames from 'classnames';
import { t } from 'i18next';
import { isEmpty, isNil } from 'lodash';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Responsive, WidthProvider } from 'react-grid-layout';
import { useLocation } from 'react-router-dom';
import AppState from '../../../AppState';
import { LANDING_PAGE_LAYOUT } from '../../../constants/CustomisePage.constants';
import { AssetsType } from '../../../enums/entity.enum';
import { EntityReference } from '../../../generated/entity/type';
import { useAuth } from '../../../hooks/authHooks';
import { WidgetConfig } from '../../../pages/CustomisablePages/CustomisablePage.interface';
import { getUserById } from '../../../rest/userAPI';
import { showErrorToast } from '../../../utils/ToastUtils';
import ActivityFeedProvider from '../../ActivityFeed/ActivityFeedProvider/ActivityFeedProvider';
import KPIWidget from '../../KPIWidget/KPIWidget.component';
import { MyDataWidget } from '../../MyData/MyDataWidget/MyDataWidget.component';
import RightSidebar from '../../MyData/RightSidebar/RightSidebar.component';
import TotalDataAssetsWidget from '../../TotalDataAssetsWidget/TotalDataAssetsWidget.component';
import FeedsWidget from '../../Widgets/FeedsWidget/FeedsWidget.component';
import EmptyWidgetPlaceholder from '../EmptyWidgetPlaceholder/EmptyWidgetPlaceholder';
import { CustomizeMyDataProps } from './CustomizeMyData.interface';

const ResponsiveGridLayout = WidthProvider(Responsive);

function CustomizeMyData({
  layoutData,
  handleRemoveWidget,
  handleOpenAddWidgetModal,
  handleLayoutUpdate,
  handleLayoutChange,
}: CustomizeMyDataProps) {
  const location = useLocation();
  const { isAuthDisabled } = useAuth(location.pathname);
  const [followedData, setFollowedData] = useState<Array<EntityReference>>();
  const [followedDataCount, setFollowedDataCount] = useState(0);
  const [isLoadingOwnedData, setIsLoadingOwnedData] = useState<boolean>(false);

  const currentUser = useMemo(
    () => AppState.getCurrentUserDetails(),
    [AppState.userDetails, AppState.nonSecureUserDetails]
  );

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
            handleRemoveWidget={handleRemoveWidget}
            widgetKey={widgetConfig.i}
          />
        );
      }

      switch (widgetConfig.i) {
        case 'KnowledgePanel.ActivityFeed':
          return (
            <FeedsWidget isEditView handleRemoveWidget={handleRemoveWidget} />
          );

        case 'KnowledgePanel.MyData':
          return (
            <MyDataWidget isEditView handleRemoveWidget={handleRemoveWidget} />
          );

        case 'KnowledgePanel.KPI':
          return (
            <KPIWidget isEditView handleRemoveWidget={handleRemoveWidget} />
          );

        case 'KnowledgePanel.TotalDataAssets':
          return (
            <TotalDataAssetsWidget
              isEditView
              handleRemoveWidget={handleRemoveWidget}
            />
          );

        case 'Container.RightSidebar':
          return (
            <div className="h-full border-left">
              <RightSidebar
                isEditView
                followedData={followedData ?? []}
                followedDataCount={followedDataCount}
                isLoadingOwnedData={isLoadingOwnedData}
                layoutConfigData={widgetConfig.data}
                parentLayoutData={layoutData}
                updateParentLayout={handleLayoutChange}
              />
            </div>
          );

        case 'ExtraWidget.AddWidgetButton':
          return (
            <Row justify="end">
              <Col>
                <Button
                  ghost
                  className="shadow-none"
                  data-testid="add-widget-placeholder-button"
                  icon={<PlusOutlined />}
                  size="small"
                  type="primary"
                  onClick={handleOpenAddWidgetModal}>
                  {t('label.add')}
                </Button>
              </Col>
            </Row>
          );

        default:
          return;
      }
    },
    [
      handleOpenAddWidgetModal,
      handleRemoveWidget,
      followedData,
      followedDataCount,
      isLoadingOwnedData,
    ]
  );

  const widgets = useMemo(
    () =>
      (isEmpty(layoutData) ? LANDING_PAGE_LAYOUT : layoutData).map((widget) => (
        <div
          className={classNames({
            'mt--0.625': widget.i === 'Container.RightSidebar',
          })}
          data-grid={widget}
          key={widget.i}>
          {getWidgetFromKey(widget)}
        </div>
      )),
    [layoutData, getWidgetFromKey]
  );

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
      <ResponsiveGridLayout
        autoSize
        breakpoints={{ lg: 1200, md: 996, sm: 768, xs: 480, xxs: 0 }}
        className="bg-white"
        cols={{ lg: 4, md: 4, sm: 4, xs: 4, xxs: 4 }}
        draggableHandle=".drag-widget-icon"
        isResizable={false}
        rowHeight={100}
        onLayoutChange={handleLayoutUpdate}>
        {widgets}
      </ResponsiveGridLayout>
    </ActivityFeedProvider>
  );
}

export default CustomizeMyData;
