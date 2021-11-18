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

import classNames from 'classnames';
import { observer } from 'mobx-react';
import { EntityCounts } from 'Models';
import React, { FunctionComponent, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import AppState from '../../AppState';
import SVGIcons, { Icons } from '../../utils/SvgUtils';

type Props = {
  countServices: number;
  ingestionCount: number;
  entityCounts: EntityCounts;
};
type Summary = {
  icon: string;
  data: string;
  link?: string;
  dataTestId?: string;
};

const MyDataHeader: FunctionComponent<Props> = ({
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
        data: `${entityCounts.tableCount} Tables`,
        link: `/explore/tables`,
        dataTestId: 'tables',
      },
      topics: {
        icon: Icons.TOPIC_GREY,
        data: `${entityCounts.topicCount} Topics`,
        link: `/explore/topics`,
        dataTestId: 'topics',
      },
      dashboards: {
        icon: Icons.DASHBOARD_GREY,
        data: `${entityCounts.dashboardCount} Dashboards`,
        link: `/explore/dashboards`,
        dataTestId: 'dashboards',
      },
      pipelines: {
        icon: Icons.PIPELINE_GREY,
        data: `${entityCounts.pipelineCount} Pipelines`,
        link: `/explore/pipelines`,
        dataTestId: 'pipelines',
      },
      service: {
        icon: Icons.SERVICE,
        data: `${countServices} Services`,
        link: `/services`,
        dataTestId: 'service',
      },
      ingestion: {
        icon: Icons.INGESTION,
        data: `${ingestionCount} Ingestion`,
        link: `/ingestion`,
        dataTestId: 'ingestion',
      },
      user: {
        icon: Icons.USERS,
        data: `${users.length} Users`,
        link: `/teams`,
        dataTestId: 'user',
      },
      terms: {
        icon: Icons.TERMS,
        data: `${userTeams.length} Teams`,
        link: `/teams`,
        dataTestId: 'terms',
      },
    };
  };

  useEffect(() => {
    setdataSummary(getSummarydata());
  }, [userTeams, users, countServices]);

  return (
    <section
      className="tw-flex tw-flex-col tw-items-center tw-py-7"
      data-testid="data-header-container">
      <h3 className="tw-mb-7 tw-font-semibold" data-testid="main-title">
        <span className="tw-text-primary-II">Open</span>
        <span className="tw-text-primary">Metadata</span>
      </h3>
      <div className="tw-flex tw-mb-4" data-testid="data-summary-container">
        {Object.values(dataSummary).map((data, index) => (
          <div
            className={classNames('tw-flex tw-items-center', {
              'tw-pl-5': Boolean(index),
            })}
            key={index}>
            <SVGIcons alt="icon" className="tw-h-4 tw-w-4" icon={data.icon} />
            {data.link ? (
              <Link
                className="tw-font-medium tw-pl-2"
                data-testid={data.dataTestId}
                to={data.link}>
                <button className="tw-text-grey-body hover:tw-text-primary-hover hover:tw-underline">
                  {data.data}
                </button>
              </Link>
            ) : (
              <p className="tw-font-medium tw-pl-2">{data.data}</p>
            )}
          </div>
        ))}
      </div>
    </section>
  );
};

export default observer(MyDataHeader);
