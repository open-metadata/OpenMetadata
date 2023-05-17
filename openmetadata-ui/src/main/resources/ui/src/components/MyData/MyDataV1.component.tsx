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

import FeedsWidget from 'components/Widgets/FeedsWidget/FeedsWidget.component';
import { EntityReference } from 'generated/entity/type';
import { observer } from 'mobx-react';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import AppState from '../../AppState';
import { LOGGED_IN_USER_STORAGE_KEY } from '../../constants/constants';
import PageLayoutV1 from '../containers/PageLayoutV1';
import LeftSidebar from './LeftSidebar/LeftSidebar.component';
import './myData.less';
import RightSidebar from './RightSidebar/RightSidebar.component';

interface props {
  followedDataCount: number;
  followedData: Array<EntityReference>;
  isLoadingOwnedData: boolean;
}

const MyDataV1 = ({
  followedData,
  followedDataCount,
  isLoadingOwnedData,
}: props): React.ReactElement => {
  const { t } = useTranslation();
  const isMounted = useRef(false);
  const [_, setShowWelcomeScreen] = useState(false);
  const storageData = localStorage.getItem(LOGGED_IN_USER_STORAGE_KEY);

  const loggedInUserName = useMemo(() => {
    return AppState.getCurrentUserDetails()?.name || '';
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

  return (
    <PageLayoutV1
      className="my-data-page p-0"
      leftPanel={<LeftSidebar />}
      leftPanelWidth={90}
      pageTitle={t('label.my-data')}
      rightPanel={
        <RightSidebar
          followedData={followedData}
          followedDataCount={followedDataCount}
          isLoadingOwnedData={isLoadingOwnedData}
        />
      }
      rightPanelWidth={380}>
      <FeedsWidget />
    </PageLayoutV1>
  );
};

export default observer(MyDataV1);
