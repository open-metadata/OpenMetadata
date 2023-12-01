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
import { isEmpty, isNil } from 'lodash';
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import RGL, { WidthProvider } from 'react-grid-layout';
import { useTranslation } from 'react-i18next';
import { useLocation } from 'react-router-dom';
import AppState from '../../AppState';
import ActivityFeedProvider from '../../components/ActivityFeed/ActivityFeedProvider/ActivityFeedProvider';
import { useApplicationConfigContext } from '../../components/ApplicationConfigProvider/ApplicationConfigProvider';
import { useAuthContext } from '../../components/Auth/AuthProviders/AuthProvider';
import Loader from '../../components/Loader/Loader';
import PageLayoutV1 from '../../components/PageLayoutV1/PageLayoutV1';
import WelcomeScreen from '../../components/WelcomeScreen/WelcomeScreen.component';
import { LOGGED_IN_USER_STORAGE_KEY } from '../../constants/constants';
import { LandingPageWidgetKeys } from '../../enums/CustomizablePage.enum';
import { AssetsType, EntityType } from '../../enums/entity.enum';
import { Thread } from '../../generated/entity/feed/thread';
import { PageType } from '../../generated/system/ui/page';
import { EntityReference } from '../../generated/type/entityReference';
import { useAuth } from '../../hooks/authHooks';
import { getDocumentByFQN } from '../../rest/DocStoreAPI';
import { getActiveAnnouncement } from '../../rest/feedsAPI';
import { getUserById } from '../../rest/userAPI';
import { getWidgetFromKey } from '../../utils/CustomizableLandingPageUtils';
import customizePageClassBase from '../../utils/CustomizePageClassBase';
import { showErrorToast } from '../../utils/ToastUtils';
import { WidgetConfig } from '../CustomizablePage/CustomizablePage.interface';
import './my-data.less';

const ReactGridLayout = WidthProvider(RGL);

const MyDataPageV1 = () => {
  const location = useLocation();
  const { t } = useTranslation();
  const { isAuthDisabled } = useAuth(location.pathname);
  const { currentUser } = useAuthContext();
  const { selectedPersona } = useApplicationConfigContext();
  const [followedData, setFollowedData] = useState<Array<EntityReference>>();
  const [followedDataCount, setFollowedDataCount] = useState(0);
  const [isLoadingOwnedData, setIsLoadingOwnedData] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState(true);
  const [layout, setLayout] = useState<Array<WidgetConfig>>([]);
  const isMounted = useRef(false);
  const [showWelcomeScreen, setShowWelcomeScreen] = useState(false);
  const [isAnnouncementLoading, setIsAnnouncementLoading] =
    useState<boolean>(true);
  const [announcements, setAnnouncements] = useState<Thread[]>([]);
  const storageData = localStorage.getItem(LOGGED_IN_USER_STORAGE_KEY);

  const loggedInUserName = useMemo(() => {
    return currentUser?.name ?? '';
  }, [currentUser]);

  const usernameExistsInCookie = useMemo(() => {
    return storageData
      ? storageData.split(',').includes(loggedInUserName)
      : false;
  }, [storageData, loggedInUserName]);

  const fetchDocument = async () => {
    try {
      setIsLoading(true);
      if (!isEmpty(selectedPersona)) {
        const pageFQN = `${EntityType.PERSONA}.${selectedPersona.fullyQualifiedName}.${EntityType.PAGE}.${PageType.LandingPage}`;
        const pageData = await getDocumentByFQN(pageFQN);
        setLayout(pageData.data.page.layout);
      } else {
        setLayout(customizePageClassBase.defaultLayout);
      }
    } catch {
      setLayout(customizePageClassBase.defaultLayout);
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
  }, [selectedPersona]);

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
      fetchMyData();
    }
  }, [AppState.userDetails, AppState.users, isAuthDisabled]);

  const widgets = useMemo(
    () =>
      // Adding announcement widget to the layout
      // Since the widget wont be in the layout config of the page
      [customizePageClassBase.announcementWidget, ...layout]
        .filter((widget) =>
          widget.i.startsWith(LandingPageWidgetKeys.ANNOUNCEMENTS)
            ? !isEmpty(announcements) // Display announcement widget only when announcements are present
            : true
        )
        .map((widget) => (
          <div data-grid={widget} key={widget.i}>
            {getWidgetFromKey({
              announcements: announcements,
              followedData: followedData ?? [],
              followedDataCount: followedDataCount,
              isLoadingOwnedData: isLoadingOwnedData,
              widgetConfig: widget,
            })}
          </div>
        )),
    [
      layout,
      isAnnouncementLoading,
      announcements,
      followedData,
      followedDataCount,
      isLoadingOwnedData,
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
        mainContainerClassName="p-t-0"
        pageTitle={t('label.my-data')}>
        {isLoading ? (
          <Loader />
        ) : (
          <ReactGridLayout
            className="bg-white"
            cols={4}
            isDraggable={false}
            isResizable={false}
            margin={[
              customizePageClassBase.landingPageWidgetMargin,
              customizePageClassBase.landingPageWidgetMargin,
            ]}
            rowHeight={100}>
            {widgets}
          </ReactGridLayout>
        )}
      </PageLayoutV1>
    </ActivityFeedProvider>
  );
};

export default MyDataPageV1;
