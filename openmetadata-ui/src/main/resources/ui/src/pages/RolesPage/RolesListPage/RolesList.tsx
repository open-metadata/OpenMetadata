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

import { Table } from 'antd';
import { ColumnsType } from 'antd/lib/table';
import React, { FC, useMemo } from 'react';
import { Link } from 'react-router-dom';
import RichTextEditorPreviewer from '../../../components/common/rich-text-editor/RichTextEditorPreviewer';
import { Role } from '../../../generated/entity/teams/role';
import { getRoleWithFqnPath } from '../../../utils/RouterUtils';
import SVGIcons, { Icons } from '../../../utils/SvgUtils';

interface RolesListProps {
  roles: Role[];
}

const RolesList: FC<RolesListProps> = ({ roles }) => {
  const columns: ColumnsType<Role> = useMemo(() => {
    return [
      {
        title: 'Name',
        dataIndex: 'name',
        width: 100,
        key: 'name',
        render: (_, record) => (
          <Link
            className="hover:tw-underline tw-cursor-pointer"
            to={getRoleWithFqnPath(record.fullyQualifiedName || '')}>
            {record?.displayName || record?.name}
          </Link>
        ),
      },
      {
        title: 'Description',
        dataIndex: 'description',
        width: '300px',
        key: 'description',
        render: (_, record) => (
          <RichTextEditorPreviewer markdown={record?.description || ''} />
        ),
      },
      {
        title: 'Policies',
        dataIndex: 'policies',
        width: 100,
        key: 'policies',
        render: (_, record) => {
          return record.policies?.length
            ? record.policies
                .map((policy) => policy?.displayName || policy?.name)
                .join(', ')
            : '-- ';
        },
      },
      {
        title: 'Actions',
        dataIndex: 'actions',
        width: 100,
        key: 'actions',
        render: () => {
          return <SVGIcons alt="delete" icon={Icons.DELETE} width="18px" />;
        },
      },
    ];
  }, []);

  return (
    <Table
      className="roles-list-table"
      columns={columns}
      dataSource={roles}
      pagination={false}
      size="middle"
    />
  );
};

export default RolesList;
