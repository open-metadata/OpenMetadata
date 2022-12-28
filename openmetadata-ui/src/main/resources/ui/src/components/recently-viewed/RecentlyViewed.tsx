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

import React, { Fragment, FunctionComponent, useEffect, useState } from 'react';
import { EntityReference } from '../../generated/type/entityReference';
import { getRecentlyViewedData, prepareLabel } from '../../utils/CommonUtils';
import { EntityListWithAntd } from '../EntityList/EntityList';
import Loader from '../Loader/Loader';

const RecentlyViewed: FunctionComponent = () => {
  const recentlyViewedData = getRecentlyViewedData();
  const [data, setData] = useState<Array<EntityReference>>([]);
  const [isLoading, setIsloading] = useState<boolean>(false);

  const prepareData = () => {
    if (recentlyViewedData.length) {
      setIsloading(true);
      const formattedData = recentlyViewedData
        .map((item) => {
          return {
            serviceType: item.serviceType,
            name: item.displayName || prepareLabel(item.entityType, item.fqn),
            fullyQualifiedName: item.fqn,
            type: item.entityType,
          };
        })
        .filter((item) => item.name);
      setData(formattedData as unknown as EntityReference[]);
      setIsloading(false);
    }
  };

  useEffect(() => {
    prepareData();
  }, []);

  return (
    <Fragment>
      {isLoading ? (
        <Loader />
      ) : (
        <EntityListWithAntd
          entityList={data}
          headerTextLabel="Recent Views"
          noDataPlaceholder={<>No recently viewed data.</>}
          testIDText="Recently Viewed"
        />
      )}
    </Fragment>
  );
};

export default RecentlyViewed;
