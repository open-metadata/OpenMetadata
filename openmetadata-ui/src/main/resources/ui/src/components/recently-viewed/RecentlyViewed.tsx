/*
 *  Copyright 2021 Collate
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

import React, { FunctionComponent, useMemo } from 'react';
import { getRecentlyViewedData, prepareLabel } from '../../utils/CommonUtils';
import { EntityListWithAntd } from '../EntityList/EntityList';

const RecentlyViewed: FunctionComponent = () => {
  const data = useMemo(() => {
    const recentlyViewedData = getRecentlyViewedData();
    if (recentlyViewedData.length) {
      return recentlyViewedData
        .map((item) => {
          return {
            serviceType: item.serviceType,
            name: item.displayName || prepareLabel(item.entityType, item.fqn),
            fullyQualifiedName: item.fqn,
            index: item.entityType,
          };
        })
        .filter((item) => item.name);
    }

    return [];
  }, []);

  return (
    <EntityListWithAntd
      entityList={data}
      headerTextLabel="Recent Views"
      noDataPlaceholder={<>No recently viewed data.</>}
      testIDText="Recently Viewed"
    />
  );
};

export default RecentlyViewed;
