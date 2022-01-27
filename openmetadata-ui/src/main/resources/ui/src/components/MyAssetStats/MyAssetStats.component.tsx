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

import { isNil } from 'lodash';
import { observer } from 'mobx-react';
import { EntityCounts } from 'Models';
import React, { FunctionComponent, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import AppState from '../../AppState';
import {
  getExplorePathWithSearch,
  ROUTES,
  TITLE_FOR_NON_ADMIN_ACTION,
} from '../../constants/constants';
import { getCountBadge } from '../../utils/CommonUtils';
import SVGIcons, { Icons } from '../../utils/SvgUtils';
import NonAdminAction from '../common/non-admin-action/NonAdminAction';

type Props = {
  countServices: number;
  ingestionCount: number;
  entityCounts: EntityCounts;
};
type Summary = {
  icon: string;
  data: string;
  count?: number;
  link?: string;
  dataTestId?: string;
  adminOnly?: boolean;
};

const MyAssetStats: FunctionComponent<Props> = ({
  countServices,
  entityCounts,
  ingestionCount,
}: Props) => {
  const { users, userTeams } = AppState;
  const [dataSummary, setdataSummary] = useState<Record<string, Summary>>({});

  const getSummarydata = () => {
    return {
      tables: {
        icon: Icons.TABLE_GREY,
        data: 'Tables',
        count: entityCounts.tableCount,
        link: getExplorePathWithSearch(undefined, 'tables'),
        dataTestId: 'tables',
      },
      topics: {
        icon: Icons.TOPIC_GREY,
        data: 'Topics',
        count: entityCounts.topicCount,
        link: getExplorePathWithSearch(undefined, 'topics'),
        dataTestId: 'topics',
      },
      dashboards: {
        icon: Icons.DASHBOARD_GREY,
        data: 'Dashboards',
        count: entityCounts.dashboardCount,
        link: getExplorePathWithSearch(undefined, 'dashboards'),
        dataTestId: 'dashboards',
      },
      pipelines: {
        icon: Icons.PIPELINE_GREY,
        data: 'Pipelines',
        count: entityCounts.pipelineCount,
        link: getExplorePathWithSearch(undefined, 'pipelines'),
        dataTestId: 'pipelines',
      },
      service: {
        icon: Icons.SERVICE,
        data: 'Services',
        count: countServices,
        link: ROUTES.SERVICES,
        dataTestId: 'service',
      },
      ingestion: {
        icon: Icons.INGESTION,
        data: 'Ingestion',
        count: ingestionCount,
        dataTestId: 'ingestion',
      },
      user: {
        icon: Icons.USERS,
        data: 'Users',
        count: users.length,
        link: ROUTES.USER_LIST,
        dataTestId: 'user',
        adminOnly: true,
      },
      teams: {
        icon: Icons.TEAMS_GREY,
        data: 'Teams',
        count: userTeams.length,
        link: ROUTES.TEAMS,
        dataTestId: 'terms',
      },
    };
  };

  useEffect(() => {
    setdataSummary(getSummarydata());
  }, [userTeams, users, countServices]);

  return (
    <div
      className="tw-mb-3"
      data-testid="data-summary-container"
      id="assetStatsCount">
      {Object.values(dataSummary).map((data, index) => (
        <div
          className="tw-flex tw-items-center tw-justify-between tw-mb-2"
          data-testid={`${data.dataTestId}-summary`}
          key={index}>
          <div className="tw-flex">
            <SVGIcons
              alt="icon"
              className="tw-h-4 tw-w-4 tw-self-center"
              icon={data.icon}
            />
            {data.link ? (
              data.adminOnly ? (
                <NonAdminAction
                  position="bottom"
                  title={TITLE_FOR_NON_ADMIN_ACTION}>
                  <Link
                    className="tw-font-medium tw-pl-2"
                    data-testid={data.dataTestId}
                    to={data.link}>
                    <button className="tw-text-grey-body hover:tw-text-primary-hover hover:tw-underline">
                      {data.data}
                    </button>
                  </Link>
                </NonAdminAction>
              ) : (
                <Link
                  className="tw-font-medium tw-pl-2"
                  data-testid={data.dataTestId}
                  to={data.link}>
                  <button className="tw-text-grey-body hover:tw-text-primary-hover hover:tw-underline">
                    {data.data}
                  </button>
                </Link>
              )
            ) : (
              <p className="tw-text-grey-body tw-pl-2">{data.data}</p>
            )}
          </div>
          {!isNil(data.count) && getCountBadge(data.count, '', false)}
        </div>
      ))}
    </div>
  );
};

export default observer(MyAssetStats);
