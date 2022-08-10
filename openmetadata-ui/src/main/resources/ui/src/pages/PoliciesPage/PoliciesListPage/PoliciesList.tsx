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

import { Space, Table } from 'antd';
import { ColumnsType } from 'antd/lib/table';
import { uniqueId } from 'lodash';
import React, { FC, useMemo } from 'react';
import { Link } from 'react-router-dom';
import RichTextEditorPreviewer from '../../../components/common/rich-text-editor/RichTextEditorPreviewer';
import { Policy } from '../../../generated/entity/policies/policy';
import { getEntityName } from '../../../utils/CommonUtils';
import {
  getPolicyWithFqnPath,
  getRoleWithFqnPath,
} from '../../../utils/RouterUtils';
import SVGIcons, { Icons } from '../../../utils/SvgUtils';

interface PolicyListProps {
  policies: Policy[];
}

const PoliciesList: FC<PolicyListProps> = ({ policies }) => {
  const columns: ColumnsType<Policy> = useMemo(() => {
    return [
      {
        title: 'Name',
        dataIndex: 'name',
        width: '200px',
        key: 'name',
        render: (_, record) => (
          <Link
            className="hover:tw-underline tw-cursor-pointer"
            to={getPolicyWithFqnPath(record.fullyQualifiedName || '')}>
            {getEntityName(record)}
          </Link>
        ),
      },
      {
        title: 'Description',
        dataIndex: 'description',
        key: 'description',
        render: (_, record) => (
          <RichTextEditorPreviewer markdown={record?.description || ''} />
        ),
      },
      {
        title: 'Roles',
        dataIndex: 'roles',
        width: '200px',
        key: 'roles',
        render: (_, record) => {
          return record.roles?.length ? (
            <Space wrap size={4}>
              {record.roles.map((role) => (
                <Link
                  key={uniqueId()}
                  to={getRoleWithFqnPath(role.fullyQualifiedName || '')}>
                  {getEntityName(role)}
                </Link>
              ))}
            </Space>
          ) : (
            '-- '
          );
        },
      },
      {
        title: 'Actions',
        dataIndex: 'actions',
        width: '80px',
        key: 'actions',
        render: () => {
          return <SVGIcons alt="delete" icon={Icons.DELETE} width="18px" />;
        },
      },
    ];
  }, []);

  return (
    <Table
      className="policies-list-table"
      columns={columns}
      dataSource={policies}
      pagination={false}
      size="middle"
    />
  );
};

export default PoliciesList;
