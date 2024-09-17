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

import Icon from '@ant-design/icons/lib/components/Icon';
import { Button, Tooltip } from 'antd';
import Table, { ColumnsType } from 'antd/lib/table';
import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { ReactComponent as IconRemove } from '../../../../assets/svg/ic-remove.svg';
import { NO_PERMISSION_FOR_ACTION } from '../../../../constants/HelperTextUtil';
import { EntityType } from '../../../../enums/entity.enum';
import { EntityReference } from '../../../../generated/type/entityReference';
import { getEntityName } from '../../../../utils/EntityUtils';
import {
  getPolicyWithFqnPath,
  getRoleWithFqnPath,
} from '../../../../utils/RouterUtils';
import RichTextEditorPreviewer from '../../../common/RichTextEditor/RichTextEditorPreviewer';

const ListEntities = ({
  list,
  type,
  onDelete,
  hasAccess,
  isTeamDeleted,
}: {
  list: EntityReference[];
  type: EntityType;
  onDelete: (record: EntityReference) => void;
  hasAccess: boolean;
  isTeamDeleted: boolean;
}) => {
  const { t } = useTranslation();
  const columns: ColumnsType<EntityReference> = useMemo(() => {
    const tabColumns: ColumnsType<EntityReference> = [
      {
        title: t('label.name'),
        dataIndex: 'name',
        width: '200px',
        key: 'name',
        render: (_, record) => {
          let link = '';
          switch (type) {
            case EntityType.POLICY:
              link = getPolicyWithFqnPath(record.fullyQualifiedName || '');

              break;
            case EntityType.ROLE:
              link = getRoleWithFqnPath(record.fullyQualifiedName || '');

              break;

            default:
              break;
          }

          return (
            <Link
              className="cursor-pointer"
              data-testid="entity-name"
              to={link}>
              {getEntityName(record)}
            </Link>
          );
        },
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
        title: t('label.action-plural'),
        dataIndex: 'actions',
        width: '80px',
        key: 'actions',
        render: (_, record) => {
          return (
            <Tooltip
              placement="left"
              title={hasAccess ? t('label.remove') : NO_PERMISSION_FOR_ACTION}>
              <Button
                data-testid={`remove-action-${getEntityName(record)}`}
                disabled={!hasAccess}
                type="text"
                onClick={() => onDelete(record)}>
                <Icon
                  className="align-middle"
                  component={IconRemove}
                  style={{ fontSize: '16px' }}
                />
              </Button>
            </Tooltip>
          );
        },
      },
    ];

    return tabColumns.filter((column) =>
      column.key === 'actions' ? !isTeamDeleted : true
    );
  }, [isTeamDeleted]);

  return (
    <Table
      bordered
      className="list-table"
      columns={columns}
      dataSource={list}
      pagination={false}
      rowKey="id"
      size="small"
    />
  );
};

export default ListEntities;
