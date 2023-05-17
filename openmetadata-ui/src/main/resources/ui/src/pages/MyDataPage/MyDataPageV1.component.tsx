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

import PageContainerV1 from 'components/containers/PageContainerV1';
import MyDataV1 from 'components/MyData/MyDataV1.component';
import { isEmpty, isNil } from 'lodash';
import React, { useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { getUserById } from 'rest/userAPI';
import AppState from '../../AppState';
import { AssetsType } from '../../enums/entity.enum';
import { EntityReference } from '../../generated/type/entityReference';
import { useAuth } from '../../hooks/authHooks';

const MyDataPageV1 = () => {
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
    if (!currentUser || !currentUser.id) {
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

  return (
    <PageContainerV1>
      <MyDataV1
        followedData={followedData || []}
        followedDataCount={followedDataCount}
        isLoadingOwnedData={isLoadingOwnedData}
      />
    </PageContainerV1>
  );
};

export default MyDataPageV1;
