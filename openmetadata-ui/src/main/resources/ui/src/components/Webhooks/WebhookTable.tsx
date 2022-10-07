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

import { Button, Space, Tooltip } from 'antd';
import Table, { ColumnsType } from 'antd/lib/table';
import classNames from 'classnames';
import { startCase } from 'lodash';
import React, { FC, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { NO_PERMISSION_FOR_ACTION } from '../../constants/HelperTextUtil';
import { Webhook } from '../../generated/entity/events/webhook';
import { Operation } from '../../generated/entity/policies/policy';
import { getEntityName, getHostNameFromURL } from '../../utils/CommonUtils';
import { checkPermission } from '../../utils/PermissionsUtils';
import { stringToHTML } from '../../utils/StringsUtils';
import SVGIcons, { Icons } from '../../utils/SvgUtils';
import RichTextEditorPreviewer from '../common/rich-text-editor/RichTextEditorPreviewer';
import { usePermissionProvider } from '../PermissionProvider/PermissionProvider';
import { ResourceEntity } from '../PermissionProvider/PermissionProvider.interface';

const ICON: { [key: string]: string } = {
  generic: Icons.WEBHOOK,
  msteams: Icons.MSTEAMS_GREY,
  slack: Icons.SLACK_GREY,
};

interface Props {
  webhookList: Webhook[];
  onEdit?: (name: string) => void;
  onDelete?: (name: Webhook) => void;
}

const WebhookTable: FC<Props> = ({ onEdit, webhookList, onDelete }) => {
  const { permissions } = usePermissionProvider();

  const deletePermission = useMemo(
    () =>
      checkPermission(Operation.Delete, ResourceEntity.WEBHOOK, permissions),
    [permissions]
  );

  const editPermission = useMemo(
    () =>
      checkPermission(Operation.EditAll, ResourceEntity.WEBHOOK, permissions),
    [permissions]
  );

  const createPermission = useMemo(
    () =>
      checkPermission(Operation.Create, ResourceEntity.WEBHOOK, permissions),
    [permissions]
  );

  const columns: ColumnsType<Webhook> = useMemo(() => {
    return [
      {
        title: 'Name',
        dataIndex: 'name',
        width: '200px',
        key: 'name',
        render: (_, record) => (
          <div className="tw-flex tw-items-center">
            <SVGIcons
              alt="webhook"
              icon={ICON[record.webhookType as string]}
              width="16"
            />
            <h6 className="tw-flex tw-items-center tw-m-0 tw-heading tw-pl-1">
              <button
                className="tw-font-medium tw-text-primary hover:tw-underline tw-cursor-pointer"
                data-testid="webhook-link"
                onClick={() => onEdit && onEdit(record.name)}>
                {stringToHTML(record.name)}
              </button>
            </h6>
          </div>
        ),
      },
      {
        title: 'Status',
        dataIndex: 'status',
        width: '160px',
        key: 'status',
        render: (_, record) => {
          return (
            <span className="tw-flex tw-items-center">
              <div
                className={classNames(
                  'tw-w-3 tw-h-3 tw-rounded-full tw-mx-0.5',
                  `tw-bg-${record.status}`
                )}
              />
              <span className="tw-ml-1">{startCase(record.status)}</span>
            </span>
          );
        },
      },
      {
        title: 'Url',
        dataIndex: 'url',
        width: '200px',
        key: 'url',
        render: (_, record) => (
          <Link target="_blank" to={record.endpoint}>
            {getHostNameFromURL(record.endpoint)}
            <SVGIcons
              alt="endpoint"
              className="tw-ml-1"
              icon={Icons.EXTERNAL_LINK}
              width="16px"
            />
          </Link>
        ),
      },
      {
        title: 'Description',
        dataIndex: 'description',
        key: 'description',
        render: (value) =>
          value ? (
            <RichTextEditorPreviewer markdown={value || ''} maxLength={100} />
          ) : (
            '--'
          ),
      },
      {
        title: 'Actions',
        dataIndex: 'actions',
        width: '120px',
        key: 'actions',
        render: (_, record) => {
          return (
            <Space size={4}>
              <Tooltip
                title={deletePermission ? 'Delete' : NO_PERMISSION_FOR_ACTION}>
                <Button
                  data-testid={`delete-action-${getEntityName(record)}`}
                  disabled={!deletePermission}
                  icon={
                    <SVGIcons alt="delete" icon={Icons.DELETE} width="18px" />
                  }
                  type="text"
                  onClick={() => onDelete && onDelete(record)}
                />
              </Tooltip>
              <Tooltip
                title={
                  createPermission || editPermission
                    ? 'Edit'
                    : NO_PERMISSION_FOR_ACTION
                }>
                <Button
                  data-testid={`edit-action-${getEntityName(record)}`}
                  disabled={!(createPermission || editPermission)}
                  icon={<SVGIcons alt="edit" icon={Icons.EDIT} width="18px" />}
                  type="text"
                  onClick={() => onEdit && onEdit(record.name)}
                />
              </Tooltip>
            </Space>
          );
        },
      },
    ];
  }, []);

  return (
    <Table
      columns={columns}
      data-testid="webhook-list-table"
      dataSource={webhookList}
      pagination={false}
      rowKey="id"
      size="middle"
    />
  );
};

export default WebhookTable;
