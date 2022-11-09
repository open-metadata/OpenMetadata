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

import { Card, Space, Table, Typography } from 'antd';
import { ColumnsType } from 'antd/lib/table';
import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { TOP_ACTIVE_USER } from '../../pages/DataInsightPage/DataInsight.mock';
import { getDateTimeFromMilliSeconds } from '../../utils/TimeUtils';
import ProfilePicture from '../common/ProfilePicture/ProfilePicture';
import './DataInsightDetail.less';
interface ActiveUserView {
  userName: string;
  Team: string;
  mostRecentSession: number;
  totalSessions: number;
  avgSessionDuration: number;
}

const TopActiveUsers = () => {
  const { t } = useTranslation();

  const columns: ColumnsType<ActiveUserView> = useMemo(
    () => [
      {
        title: t('label.user'),
        dataIndex: 'userName',
        key: 'userName',
        render: (userName: string) => (
          <Space>
            <ProfilePicture id="" name={userName} type="circle" width="24" />
            <Typography.Text>{userName}</Typography.Text>
          </Space>
        ),
      },
      {
        title: t('label.team'),
        dataIndex: 'Team',
        key: 'Team',
        render: (Team: string) => (
          <Typography.Text>{Team ?? '--'}</Typography.Text>
        ),
      },
      {
        title: t('label.most-recent-session'),
        dataIndex: 'mostRecentSession',
        key: 'mostRecentSession',
        render: (mostRecentSession: number) => (
          <Typography.Text>
            {getDateTimeFromMilliSeconds(mostRecentSession)}
          </Typography.Text>
        ),
      },
      {
        title: t('label.total-session'),
        dataIndex: 'totalSessions',
        key: 'totalSessions',
        render: (totalSessions: number) => (
          <Typography.Text>{totalSessions}</Typography.Text>
        ),
      },
      {
        title: t('label.average-session'),
        dataIndex: 'avgSessionDuration',
        key: 'avgSessionDuration',
        render: (avgSessionDuration: number) => (
          <Typography.Text>{avgSessionDuration}</Typography.Text>
        ),
      },
    ],
    []
  );

  return (
    <Card
      className="data-insight-card"
      data-testid="entity-summary-card-percentage"
      title={
        <Typography.Title level={5}>
          {t('label.data-insight-active-user-summary')}
        </Typography.Title>
      }>
      <Table
        className="data-insight-table-wrapper"
        columns={columns}
        dataSource={TOP_ACTIVE_USER}
        pagination={false}
        size="small"
      />
    </Card>
  );
};

export default TopActiveUsers;
