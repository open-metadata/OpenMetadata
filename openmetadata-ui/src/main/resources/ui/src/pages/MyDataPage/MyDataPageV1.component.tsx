/*
 *  Copyright 2022 Collate.
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

import { Col, Row } from 'antd';
import { AxiosError } from 'axios';
import { isEmpty, isNil } from 'lodash';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation } from 'react-router-dom';
import AppState from '../../AppState';
import ActivityFeedProvider from '../../components/ActivityFeed/ActivityFeedProvider/ActivityFeedProvider';
import PageLayoutV1 from '../../components/containers/PageLayoutV1';
import KPIWidget from '../../components/KPIWidget/KPIWidget.component';
import { MyDataWidget } from '../../components/MyData/MyDataWidget/MyDataWidget.component';
import RightSidebar from '../../components/MyData/RightSidebar/RightSidebar.component';
import TotalDataAssetsWidget from '../../components/TotalDataAssetsWidget/TotalDataAssetsWidget.component';
import WelcomeScreen from '../../components/WelcomeScreen/WelcomeScreen.component';
import FeedsWidget from '../../components/Widgets/FeedsWidget/FeedsWidget.component';
import { LOGGED_IN_USER_STORAGE_KEY } from '../../constants/constants';
import { AssetsType } from '../../enums/entity.enum';
import { EntityReference } from '../../generated/type/entityReference';
import { useAuth } from '../../hooks/authHooks';
import { getUserById } from '../../rest/userAPI';
import { showErrorToast } from '../../utils/ToastUtils';
import './my-data.less';

const MyDataPageV1 = () => {
  const { t } = useTranslation();
  const location = useLocation();
  const { isAuthDisabled } = useAuth(location.pathname);
  const [followedData, setFollowedData] = useState<Array<EntityReference>>();
  const [followedDataCount, setFollowedDataCount] = useState(0);
  const [isLoadingOwnedData, setIsLoadingOwnedData] = useState<boolean>(false);
  const isMounted = useRef(false);
  const [showWelcomeScreen, setShowWelcomeScreen] = useState(false);
  const storageData = localStorage.getItem(LOGGED_IN_USER_STORAGE_KEY);

  const loggedInUserName = useMemo(() => {
    return AppState.getCurrentUserDetails()?.name ?? '';
  }, [AppState]);

  const usernameExistsInCookie = useMemo(() => {
    return storageData
      ? storageData.split(',').includes(loggedInUserName)
      : false;
  }, [storageData, loggedInUserName]);

  const updateWelcomeScreen = (show: boolean) => {
    if (loggedInUserName) {
      const arr = storageData ? storageData.split(',') : [];
      if (!arr.includes(loggedInUserName)) {
        arr.push(loggedInUserName);
        localStorage.setItem(LOGGED_IN_USER_STORAGE_KEY, arr.join(','));
      }
    }
    setShowWelcomeScreen(show);
  };

  useEffect(() => {
    isMounted.current = true;
    updateWelcomeScreen(!usernameExistsInCookie);

    return () => updateWelcomeScreen(false);
  }, []);

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

  useEffect(() => {
    if (
      ((isAuthDisabled && AppState.users.length) ||
        !isEmpty(AppState.userDetails)) &&
      isNil(followedData)
    ) {
      fetchMyData().catch(() => {
        // ignore since error is displayed in toast in the parent promise.
        // Added block for sonar code smell
      });
    }
  }, [AppState.userDetails, AppState.users, isAuthDisabled]);

  if (showWelcomeScreen) {
    return (
      <div className="bg-white full-height">
        <WelcomeScreen onClose={() => updateWelcomeScreen(false)} />
      </div>
    );
  }

  return (
    <ActivityFeedProvider>
      <PageLayoutV1
        className="my-data-page p-0 bg-white"
        pageTitle={t('label.my-data')}
        rightPanel={
          <RightSidebar
            followedData={followedData ?? []}
            followedDataCount={followedDataCount}
            isLoadingOwnedData={isLoadingOwnedData}
          />
        }
        rightPanelWidth={380}>
        <div className="p-t-xss p-b-md p-x-md">
          <Row gutter={[16, 16]}>
            <Col span={24}>
              <FeedsWidget />
            </Col>
            <Col span={8}>
              <MyDataWidget />
            </Col>
            <Col span={16}>
              <KPIWidget />
            </Col>
            <Col span={24}>
              <TotalDataAssetsWidget />
            </Col>
          </Row>
        </div>
      </PageLayoutV1>
    </ActivityFeedProvider>
  );
};

export default MyDataPageV1;
