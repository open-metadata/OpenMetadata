/*
  * Licensed to the Apache Software Foundation (ASF) under one or more
  * contributor license agreements. See the NOTICE file distributed with
  * this work for additional information regarding copyright ownership.
  * The ASF licenses this file to You under the Apache License, Version 2.0
  * (the "License"); you may not use this file except in compliance with
  * the License. You may obtain a copy of the License at

  * http://www.apache.org/licenses/LICENSE-2.0

  * Unless required by applicable law or agreed to in writing, software
  * distributed under the License is distributed on an "AS IS" BASIS,
  * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
  * See the License for the specific language governing permissions and
  * limitations under the License.
*/

import { ColumnTags, FormatedTableData } from 'Models';
import React, { FunctionComponent, useEffect, useState } from 'react';
import { getDashboardByFqn } from '../../axiosAPIs/dashboardAPI';
import { getTableDetailsByFQN } from '../../axiosAPIs/tableAPI';
import { getTopicByFqn } from '../../axiosAPIs/topicsAPI';
import { EntityType } from '../../enums/entity.enum';
import { SearchIndex } from '../../enums/search.enum';
import { getRecentlyViewedData } from '../../utils/CommonUtils';
import { getOwnerFromId, getTierFromTableTags } from '../../utils/TableUtils';
import { getTableTags } from '../../utils/TagsUtils';
import TableDataCard from '../common/table-data-card/TableDataCard';
import Onboarding from '../onboarding/Onboarding';

const RecentlyViewed: FunctionComponent = () => {
  const recentlyViewedData = getRecentlyViewedData();
  const [data, setData] = useState<Array<FormatedTableData>>([]);

  const fetchRecentlyViewedEntity = async () => {
    const arrData: Array<FormatedTableData> = [];

    for (const oData of recentlyViewedData) {
      // for (let i = 0; i < recentlyViewedData.length; i++) {
      // const oData = recentlyViewedData[i];
      switch (oData.entityType) {
        case EntityType.DATASET: {
          const res = await getTableDetailsByFQN(
            oData.fqn,
            'database, usageSummary, tags, owner'
          );

          const {
            description,
            id,
            name,
            columns,
            owner,
            usageSummary,
            fullyQualifiedName,
          } = res.data;
          const tableTags = getTableTags(columns || []);
          arrData.push({
            description,
            fullyQualifiedName,
            id,
            index: SearchIndex.TABLE,
            name,
            owner: getOwnerFromId(owner?.id)?.name || '--',
            serviceType: oData.serviceType,
            tags: tableTags.map((tag) => tag.tagFQN),
            tier: getTierFromTableTags(tableTags),
            weeklyPercentileRank: usageSummary?.weeklyStats.percentileRank || 0,
          });

          break;
        }
        case EntityType.TOPIC: {
          const res = await getTopicByFqn(oData.fqn, 'owner, service, tags');

          const { description, id, name, tags, owner, fullyQualifiedName } =
            res.data;
          arrData.push({
            description,
            fullyQualifiedName,
            id,
            index: SearchIndex.TOPIC,
            name,
            owner: getOwnerFromId(owner?.id)?.name || '--',
            serviceType: oData.serviceType,
            tags: (tags as Array<ColumnTags>).map((tag) => tag.tagFQN),
            tier: getTierFromTableTags(tags as Array<ColumnTags>),
          });

          break;
        }
        case EntityType.DASHBOARD: {
          const res = await getDashboardByFqn(
            oData.fqn,
            'owner, service, tags, usageSummary'
          );

          const {
            description,
            id,
            displayName,
            tags,
            owner,
            fullyQualifiedName,
          } = res.data;
          arrData.push({
            description,
            fullyQualifiedName,
            id,
            index: SearchIndex.DASHBOARD,
            name: displayName,
            owner: getOwnerFromId(owner?.id)?.name || '--',
            serviceType: oData.serviceType,
            tags: (tags as Array<ColumnTags>).map((tag) => tag.tagFQN),
            tier: getTierFromTableTags(tags as Array<ColumnTags>),
          });

          break;
        }
        default:
          break;
      }
    }
    setData(arrData);
  };

  useEffect(() => {
    if (recentlyViewedData.length) {
      fetchRecentlyViewedEntity();
    }
  }, []);

  return (
    <>
      {data.length ? (
        data.map((item, index) => {
          return (
            <div className="tw-mb-3" key={index}>
              <TableDataCard
                description={item.description}
                fullyQualifiedName={item.fullyQualifiedName}
                indexType={item.index}
                name={item.name}
                owner={item.owner}
                serviceType={item.serviceType || '--'}
                tableType={item.tableType}
                tags={item.tags}
                tier={item.tier?.split('.')[1]}
                usage={item.weeklyPercentileRank}
              />
            </div>
          );
        })
      ) : (
        <Onboarding />
      )}
    </>
  );
};

export default RecentlyViewed;
