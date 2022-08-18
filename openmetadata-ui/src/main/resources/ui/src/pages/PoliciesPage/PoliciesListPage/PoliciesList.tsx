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

import { Button, Space, Table } from 'antd';
import { ColumnsType } from 'antd/lib/table';
import { isUndefined, uniqueId } from 'lodash';
import React, { FC, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import DeleteWidgetModal from '../../../components/common/DeleteWidget/DeleteWidgetModal';
import RichTextEditorPreviewer from '../../../components/common/rich-text-editor/RichTextEditorPreviewer';
import { EntityType } from '../../../enums/entity.enum';
import { Policy } from '../../../generated/entity/policies/policy';
import { Paging } from '../../../generated/type/paging';
import { getEntityName } from '../../../utils/CommonUtils';
import {
  getPolicyWithFqnPath,
  getRoleWithFqnPath,
} from '../../../utils/RouterUtils';
import SVGIcons, { Icons } from '../../../utils/SvgUtils';

interface PolicyListProps {
  policies: Policy[];
  fetchPolicies: (paging?: Paging) => void;
}

const PoliciesList: FC<PolicyListProps> = ({ policies, fetchPolicies }) => {
  const [selectedPolicy, setSelectedPolicy] = useState<Policy>();
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
        render: (_, record) => {
          return (
            <Button type="text" onClick={() => setSelectedPolicy(record)}>
              <SVGIcons alt="delete" icon={Icons.DELETE} width="18px" />
            </Button>
          );
        },
      },
    ];
  }, []);

  return (
    <>
      <Table
        className="policies-list-table"
        columns={columns}
        dataSource={policies}
        pagination={false}
        size="middle"
      />
      {selectedPolicy && (
        <DeleteWidgetModal
          afterDeleteAction={fetchPolicies}
          allowSoftDelete={false}
          deleteMessage={`Are you sure you want to delete ${getEntityName(
            selectedPolicy
          )}`}
          entityId={selectedPolicy.id}
          entityName={getEntityName(selectedPolicy)}
          entityType={EntityType.POLICY}
          visible={!isUndefined(selectedPolicy)}
          onCancel={() => setSelectedPolicy(undefined)}
        />
      )}
    </>
  );
};

export default PoliciesList;
