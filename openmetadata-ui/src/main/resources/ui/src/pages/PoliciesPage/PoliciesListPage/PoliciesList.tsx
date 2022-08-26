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

import { Button, Popover, Space, Table, Tag } from 'antd';
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
import { LIST_CAP } from '../../../utils/PermissionsUtils';
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
            data-testid="policy-name"
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
        width: '250px',
        key: 'roles',
        render: (_, record) => {
          const listLength = record.roles?.length ?? 0;
          const hasMore = listLength > LIST_CAP;

          return record.roles?.length ? (
            <Space wrap data-testid="role-link" size={4}>
              {record.roles.slice(0, LIST_CAP).map((role) => (
                <Link
                  key={uniqueId()}
                  to={getRoleWithFqnPath(role.fullyQualifiedName || '')}>
                  {getEntityName(role)}
                </Link>
              ))}
              {hasMore && (
                <Popover
                  className="tw-cursor-pointer"
                  content={
                    <Space wrap size={4}>
                      {record.roles.slice(LIST_CAP).map((role) => (
                        <Link
                          key={uniqueId()}
                          to={getRoleWithFqnPath(
                            role.fullyQualifiedName || ''
                          )}>
                          {getEntityName(role)}
                        </Link>
                      ))}
                    </Space>
                  }
                  overlayClassName="tw-w-40 tw-text-center"
                  trigger="click">
                  <Tag className="tw-ml-1" data-testid="plus-more-count">{`+${
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
        title: 'Actions',
        dataIndex: 'actions',
        width: '80px',
        key: 'actions',
        render: (_, record) => {
          return (
            <Button
              data-testid={`delete-action-${getEntityName(record)}`}
              type="text"
              onClick={() => setSelectedPolicy(record)}>
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
