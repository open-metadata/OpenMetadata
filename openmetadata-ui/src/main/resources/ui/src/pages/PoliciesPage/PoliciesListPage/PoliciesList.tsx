/*
 *  Copyright 2022 Collate.
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

import { Button, Popover, Space, Table, Tag, Tooltip } from 'antd';
import { ColumnsType } from 'antd/lib/table';
import DeleteWidgetModal from 'components/common/DeleteWidget/DeleteWidgetModal';
import RichTextEditorPreviewer from 'components/common/rich-text-editor/RichTextEditorPreviewer';
import { usePermissionProvider } from 'components/PermissionProvider/PermissionProvider';
import { ResourceEntity } from 'components/PermissionProvider/PermissionProvider.interface';
import { isEmpty, isUndefined, uniqueId } from 'lodash';
import React, { FC, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { getEntityName } from 'utils/EntityUtils';
import { ReactComponent as IconDelete } from '../../../assets/svg/ic-delete.svg';
import {
  NO_PERMISSION_FOR_ACTION,
  NO_PERMISSION_TO_VIEW,
} from '../../../constants/HelperTextUtil';
import { EntityType } from '../../../enums/entity.enum';
import { Operation, Policy } from '../../../generated/entity/policies/policy';
import { Paging } from '../../../generated/type/paging';
import {
  checkPermission,
  LIST_CAP,
  userPermissions,
} from '../../../utils/PermissionsUtils';
import {
  getPolicyWithFqnPath,
  getRoleWithFqnPath,
} from '../../../utils/RouterUtils';

interface PolicyListProps {
  policies: Policy[];
  fetchPolicies: (paging?: Paging) => void;
}

const PoliciesList: FC<PolicyListProps> = ({ policies, fetchPolicies }) => {
  const { t } = useTranslation();
  const [selectedPolicy, setSelectedPolicy] = useState<Policy>();

  const { permissions } = usePermissionProvider();

  const deletePolicyPermission = useMemo(() => {
    return (
      !isEmpty(permissions) &&
      checkPermission(Operation.Delete, ResourceEntity.POLICY, permissions)
    );
  }, [permissions]);

  const viewRolePermission = useMemo(() => {
    return (
      !isEmpty(permissions) &&
      userPermissions.hasViewPermissions(ResourceEntity.ROLE, permissions)
    );
  }, [permissions]);

  const columns: ColumnsType<Policy> = useMemo(() => {
    return [
      {
        title: t('label.name'),
        dataIndex: 'name',
        width: '200px',
        key: 'name',
        render: (_, record) => (
          <Link
            className="link-hover"
            data-testid="policy-name"
            to={getPolicyWithFqnPath(record.fullyQualifiedName || '')}>
            {getEntityName(record)}
          </Link>
        ),
      },
      {
        title: t('label.description'),
        dataIndex: 'description',
        key: 'description',
        render: (_, record) => (
          <RichTextEditorPreviewer markdown={record?.description || ''} />
        ),
      },
      {
        title: t('label.role-plural'),
        dataIndex: 'roles',
        width: '250px',
        key: 'roles',
        render: (_, record) => {
          const listLength = record.roles?.length ?? 0;
          const hasMore = listLength > LIST_CAP;

          return record.roles?.length ? (
            <Space wrap data-testid="role-link" size={4}>
              {record.roles.slice(0, LIST_CAP).map((role) =>
                viewRolePermission ? (
                  <Link
                    key={uniqueId()}
                    to={getRoleWithFqnPath(role.fullyQualifiedName || '')}>
                    {getEntityName(role)}
                  </Link>
                ) : (
                  <Tooltip key={uniqueId()} title={NO_PERMISSION_TO_VIEW}>
                    {getEntityName(role)}
                  </Tooltip>
                )
              )}
              {hasMore && (
                <Popover
                  className="cursor-pointer"
                  content={
                    <Space wrap size={4}>
                      {record.roles.slice(LIST_CAP).map((role) =>
                        viewRolePermission ? (
                          <Link
                            key={uniqueId()}
                            to={getRoleWithFqnPath(
                              role.fullyQualifiedName || ''
                            )}>
                            {getEntityName(role)}
                          </Link>
                        ) : (
                          <Tooltip
                            key={uniqueId()}
                            title={NO_PERMISSION_TO_VIEW}>
                            {getEntityName(role)}
                          </Tooltip>
                        )
                      )}
                    </Space>
                  }
                  overlayClassName="w-40 text-center"
                  trigger="click">
                  <Tag className="m-l-xss" data-testid="plus-more-count">{`+${
                    listLength - LIST_CAP
                  } more`}</Tag>
                </Popover>
              )}
            </Space>
          ) : (
            '-- '
          );
        },
      },
      {
        title: t('label.action-plural'),
        dataIndex: 'actions',
        width: '80px',
        align: 'center',
        key: 'actions',
        render: (_, record) => {
          return (
            <Tooltip
              placement="left"
              title={!deletePolicyPermission && NO_PERMISSION_FOR_ACTION}>
              <Button
                data-testid={`delete-action-${getEntityName(record)}`}
                disabled={!deletePolicyPermission}
                icon={<IconDelete name={t('label.delete')} width="16px" />}
                type="text"
                onClick={() => setSelectedPolicy(record)}
              />
            </Tooltip>
          );
        },
      },
    ];
  }, []);

  return (
    <>
      <Table
        bordered
        className="policies-list-table"
        columns={columns}
        data-testid="policies-list-table"
        dataSource={policies}
        pagination={false}
        rowKey="id"
        size="small"
      />
      {selectedPolicy && deletePolicyPermission && (
        <DeleteWidgetModal
          afterDeleteAction={fetchPolicies}
          allowSoftDelete={false}
          deleteMessage={t('message.are-you-sure-delete-entity', {
            entity: getEntityName(selectedPolicy),
          })}
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
