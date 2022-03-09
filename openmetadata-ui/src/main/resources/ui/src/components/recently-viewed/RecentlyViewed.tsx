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

import { FormatedTableData } from 'Models';
import React, { FunctionComponent, useEffect, useState } from 'react';
import { getRecentlyViewedData } from '../../utils/CommonUtils';
import EntityList from '../EntityList/EntityList';
import Loader from '../Loader/Loader';

const RecentlyViewed: FunctionComponent = () => {
  const recentlyViewedData = getRecentlyViewedData();
  const [data, setData] = useState<Array<FormatedTableData>>([]);
  const [isLoading, setIsloading] = useState<boolean>(false);

  useEffect(() => {
    if (recentlyViewedData.length) {
      setIsloading(true);
      const formatedData = recentlyViewedData.map((data) => {
        return {
          serviceType: data.serviceType,
          name: data.displayName || data.fqn.split('.').pop(),
          fullyQualifiedName: data.fqn,
          index: data.entityType,
        };
      });
      setData(formatedData as unknown as FormatedTableData[]);
      setIsloading(false);
    }
  }, []);

  return (
    <>
      {isLoading ? (
        <Loader />
      ) : (
        <EntityList
          entityList={data}
          headerText="Recent Views"
          noDataPlaceholder={<>No recently viewed data.</>}
          testIDText="Recently Viewed"
        />
      )}
    </>
  );
};

export default RecentlyViewed;
