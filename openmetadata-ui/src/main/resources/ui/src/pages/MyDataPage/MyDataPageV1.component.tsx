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

import { AxiosError } from 'axios';
import classNames from 'classnames';
import { isEmpty, isNil } from 'lodash';
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Responsive, WidthProvider } from 'react-grid-layout';
import { useLocation } from 'react-router-dom';
import AppState from '../../AppState';
import ActivityFeedProvider from '../../components/ActivityFeed/ActivityFeedProvider/ActivityFeedProvider';
import { useApplicationConfigContext } from '../../components/ApplicationConfigProvider/ApplicationConfigProvider';
import { useAuthContext } from '../../components/authentication/auth-provider/AuthProvider';
import KPIWidget from '../../components/KPIWidget/KPIWidget.component';
import Loader from '../../components/Loader/Loader';
import { MyDataWidget } from '../../components/MyData/MyDataWidget/MyDataWidget.component';
import RightSidebar from '../../components/MyData/RightSidebar/RightSidebar.component';
import TotalDataAssetsWidget from '../../components/TotalDataAssetsWidget/TotalDataAssetsWidget.component';
import WelcomeScreen from '../../components/WelcomeScreen/WelcomeScreen.component';
import FeedsWidget from '../../components/Widgets/FeedsWidget/FeedsWidget.component';
import { LOGGED_IN_USER_STORAGE_KEY } from '../../constants/constants';
import {
  LANDING_PAGE_LAYOUT,
  LANDING_PAGE_WIDGET_MARGIN,
} from '../../constants/CustomisePage.constants';
import { LandingPageWidgetKeys } from '../../enums/CustomizablePage.enum';
import { AssetsType, EntityType } from '../../enums/entity.enum';
import { PageType } from '../../generated/system/ui/page';
import { EntityReference } from '../../generated/type/entityReference';
import { useAuth } from '../../hooks/authHooks';
import { getDocumentByFQN } from '../../rest/DocStoreAPI';
import { getUserById } from '../../rest/userAPI';
import { showErrorToast } from '../../utils/ToastUtils';
import { WidgetConfig } from '../CustomisablePages/CustomisablePage.interface';
import './my-data.less';

const ResponsiveGridLayout = WidthProvider(Responsive);

const MyDataPageV1 = () => {
  const location = useLocation();
  const { isAuthDisabled } = useAuth(location.pathname);
  const { currentUser } = useAuthContext();
  const { layoutPersona } = useApplicationConfigContext();
  const [followedData, setFollowedData] = useState<Array<EntityReference>>();
  const [followedDataCount, setFollowedDataCount] = useState(0);
  const [isLoadingOwnedData, setIsLoadingOwnedData] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState(true);
  const [layout, setLayout] = useState<Array<WidgetConfig>>([]);
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

  const fetchDocument = async () => {
    try {
      setIsLoading(true);
      if (!isEmpty(layoutPersona)) {
        const pageFQN = `${EntityType.PERSONA}.${layoutPersona.fullyQualifiedName}.${EntityType.PAGE}.${PageType.LandingPage}`;
        const pageData = await getDocumentByFQN(pageFQN);
        setLayout(pageData.data.page.layout);
      } else {
        setLayout(LANDING_PAGE_LAYOUT);
      }
    } catch {
      setLayout(LANDING_PAGE_LAYOUT);
    } finally {
      setIsLoading(false);
    }
  };

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
    fetchDocument();
  }, [layoutPersona]);

  useEffect(() => {
    isMounted.current = true;
    updateWelcomeScreen(!usernameExistsInCookie);

    return () => updateWelcomeScreen(false);
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

  const getWidgetFromKey = useCallback(
    (widgetConfig: WidgetConfig) => {
      switch (widgetConfig.i) {
        case LandingPageWidgetKeys.ACTIVITY_FEED:
          return <FeedsWidget />;

        case LandingPageWidgetKeys.MY_DATA:
          return <MyDataWidget />;

        case LandingPageWidgetKeys.KPI:
          return <KPIWidget />;

        case LandingPageWidgetKeys.TOTAL_DATA_ASSETS:
          return <TotalDataAssetsWidget />;

        case LandingPageWidgetKeys.RIGHT_PANEL:
          return (
            <div className="h-full border-left">
              <RightSidebar
                followedData={followedData ?? []}
                followedDataCount={followedDataCount}
                isLoadingOwnedData={isLoadingOwnedData}
                layoutConfigData={widgetConfig.data}
                parentLayoutData={layout}
              />
            </div>
          );

        default:
          return;
      }
    },
    [followedData, followedDataCount, isLoadingOwnedData, layout]
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

  if (showWelcomeScreen) {
    return (
      <div className="bg-white full-height">
        <WelcomeScreen onClose={() => updateWelcomeScreen(false)} />
      </div>
    );
  }

  return (
    <div className="bg-white h-full">
      <ActivityFeedProvider>
        {isLoading ? (
          <Loader />
        ) : (
          <ResponsiveGridLayout
            autoSize
            breakpoints={{ lg: 1200, md: 996, sm: 768, xs: 480, xxs: 0 }}
            className="bg-white"
            cols={{ lg: 4, md: 4, sm: 4, xs: 4, xxs: 4 }}
            draggableHandle=".drag-widget-icon"
            isResizable={false}
            margin={[LANDING_PAGE_WIDGET_MARGIN, LANDING_PAGE_WIDGET_MARGIN]}
            rowHeight={100}>
            {widgets}
          </ResponsiveGridLayout>
        )}
      </ActivityFeedProvider>
    </div>
  );
};

export default MyDataPageV1;
