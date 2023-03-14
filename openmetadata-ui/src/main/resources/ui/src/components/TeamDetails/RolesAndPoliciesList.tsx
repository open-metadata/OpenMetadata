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

import { Button, Tooltip } from 'antd';
import Table, { ColumnsType } from 'antd/lib/table';
import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { getEntityName } from 'utils/EntityUtils';
import { NO_PERMISSION_FOR_ACTION } from '../../constants/HelperTextUtil';
import { EntityType } from '../../enums/entity.enum';
import { EntityReference } from '../../generated/type/entityReference';
import {
  getPolicyWithFqnPath,
  getRoleWithFqnPath,
} from '../../utils/RouterUtils';
import SVGIcons, { Icons } from '../../utils/SvgUtils';
import RichTextEditorPreviewer from '../common/rich-text-editor/RichTextEditorPreviewer';

const ListEntities = ({
  list,
  type,
  onDelete,
  hasAccess,
}: {
  list: EntityReference[];
  type: EntityType;
  onDelete: (record: EntityReference) => void;
  hasAccess: boolean;
}) => {
  const { t } = useTranslation();
  const columns: ColumnsType<EntityReference> = useMemo(() => {
    return [
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
              className="hover:tw-underline tw-cursor-pointer"
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
              placement="bottomRight"
              title={hasAccess ? t('label.remove') : NO_PERMISSION_FOR_ACTION}>
              <Button
                data-testid={`remove-action-${getEntityName(record)}`}
                disabled={!hasAccess}
                type="text"
                onClick={() => onDelete(record)}>
                <SVGIcons
                  alt="remove"
                  icon={Icons.ICON_REMOVE}
                  title="Remove"
                />
              </Button>
            </Tooltip>
          );
        },
      },
    ];
  }, []);

  return (
    <Table
      bordered
      className="list-table"
      columns={columns}
      dataSource={list}
      pagination={false}
      size="small"
    />
  );
};

export default ListEntities;
