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
import { Role } from '../../../generated/entity/teams/role';
import { Paging } from '../../../generated/type/paging';
import { getEntityName } from '../../../utils/CommonUtils';
import {
  getPolicyWithFqnPath,
  getRoleWithFqnPath,
} from '../../../utils/RouterUtils';
import SVGIcons, { Icons } from '../../../utils/SvgUtils';

interface RolesListProps {
  roles: Role[];
  fetchRoles: (paging?: Paging) => void;
}

const RolesList: FC<RolesListProps> = ({ roles, fetchRoles }) => {
  const [selectedRole, setSelectedRole] = useState<Role>();

  const columns: ColumnsType<Role> = useMemo(() => {
    return [
      {
        title: 'Name',
        dataIndex: 'name',
        width: '200px',
        key: 'name',
        render: (_, record) => (
          <Link
            className="hover:tw-underline tw-cursor-pointer"
            to={getRoleWithFqnPath(record.fullyQualifiedName || '')}>
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
        title: 'Policies',
        dataIndex: 'policies',
        width: '200px',
        key: 'policies',
        render: (_, record) => {
          return record.policies?.length ? (
            <Space wrap size={4}>
              {record.policies.map((policy) => (
                <Link
                  key={uniqueId()}
                  to={getPolicyWithFqnPath(policy.fullyQualifiedName || '')}>
                  {getEntityName(policy)}
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
            <Button type="text" onClick={() => setSelectedRole(record)}>
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
        className="roles-list-table"
        columns={columns}
        dataSource={roles}
        pagination={false}
        size="middle"
      />
      {selectedRole && (
        <DeleteWidgetModal
          afterDeleteAction={fetchRoles}
          allowSoftDelete={false}
          deleteMessage={`Are you sure you want to delete ${getEntityName(
            selectedRole
          )}`}
          entityId={selectedRole.id}
          entityName={getEntityName(selectedRole)}
          entityType={EntityType.ROLE}
          visible={!isUndefined(selectedRole)}
          onCancel={() => setSelectedRole(undefined)}
        />
      )}
    </>
  );
};

export default RolesList;
