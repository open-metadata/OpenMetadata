/*
 *  Copyright 2022 Collate
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

import { Table } from 'antd';
import { ColumnsType } from 'antd/lib/table';
import React, { FC, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Team } from '../../generated/entity/teams/team';
import { getEntityName } from '../../utils/CommonUtils';
import { getTeamsWithFqnPath } from '../../utils/RouterUtils';

interface TeamHierarchyProps {
  data: Team[];
}

const TeamHierarchy: FC<TeamHierarchyProps> = ({ data }) => {
  const columns: ColumnsType<Team> = useMemo(() => {
    return [
      {
        title: 'Teams',
        dataIndex: 'teams',
        key: 'teams',
        render: (_, record) => (
          <Link
            className="hover:tw-underline tw-cursor-pointer"
            to={getTeamsWithFqnPath(record.fullyQualifiedName || record.name)}>
            {getEntityName(record)}
          </Link>
        ),
      },
      {
        title: 'Type',
        dataIndex: 'teamType',
        key: 'teamType',
      },
      {
        title: 'Sub Teams',
        dataIndex: 'subTeams',
        key: 'subTeams',
        render: (_, record) => record.children?.length || '--',
      },
      {
        title: 'Users',
        dataIndex: 'users',
        key: 'users',
        render: (users) => users?.length || '--',
      },
      {
        title: 'Description',
        dataIndex: 'description',
        key: 'description',
        render: (description) => description || '--',
      },
    ];
  }, []);

  return (
    <Table
      className="teams-list-table"
      columns={columns}
      dataSource={data}
      pagination={false}
      size="small"
    />
  );
};

export default TeamHierarchy;
