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

import { Tooltip, Typography } from 'antd';
import { ColumnsType } from 'antd/lib/table';
import { toLower } from 'lodash';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { EntityType } from '../../../../enums/entity.enum';
import {
  Directory,
  EntityReference,
} from '../../../../generated/entity/data/directory';
import { getColumnSorter, getEntityName } from '../../../../utils/EntityUtils';
import { getEntityDetailsPath } from '../../../../utils/RouterUtils';
import ErrorPlaceHolder from '../../../common/ErrorWithPlaceholder/ErrorPlaceHolder';
import RichTextEditorPreviewerNew from '../../../common/RichTextEditor/RichTextEditorPreviewNew';
import Table from '../../../common/Table/Table';
import { useGenericContext } from '../../../Customization/GenericProvider/GenericProvider';

function DirectoryChildrenTable() {
  const { t } = useTranslation();
  const { data: containerData } = useGenericContext<Directory>();

  const columns: ColumnsType<EntityReference> = useMemo(
    () => [
      {
        title: t('label.name'),
        dataIndex: 'name',
        width: 300,
        key: 'name',
        sorter: getColumnSorter<EntityReference, 'name'>('name'),
        render: (_, record) => (
          <div className="d-inline-flex w-max-90">
            <Link
              className="break-word"
              data-testid="container-name"
              to={getEntityDetailsPath(
                record.type as EntityType,
                record.fullyQualifiedName ?? ''
              )}>
              {getEntityName(record)}
            </Link>
          </div>
        ),
      },
      {
        title: t('label.type'),
        dataIndex: 'type',
        width: 200,
        key: 'type',
        sorter: getColumnSorter<EntityReference, 'type'>('type'),
        render: (type, record) => (
          <Tooltip
            destroyTooltipOnHide
            overlayInnerStyle={{
              maxWidth: '420px',
              overflowWrap: 'break-word',
              textAlign: 'center',
            }}
            title={toLower(type)}>
            <Typography.Text ellipsis className="cursor-pointer">
              {type ?? record.type}
            </Typography.Text>
          </Tooltip>
        ),
      },
      {
        title: t('label.description'),
        dataIndex: 'description',
        key: 'description',
        render: (description: EntityReference['description']) => (
          <>
            {description ? (
              <RichTextEditorPreviewerNew markdown={description} />
            ) : (
              <Typography.Text className="text-grey-muted">
                {t('label.no-entity', {
                  entity: t('label.description'),
                })}
              </Typography.Text>
            )}
          </>
        ),
      },
    ],
    []
  );

  return (
    <Table
      columns={columns}
      data-testid="container-list-table"
      dataSource={containerData.children}
      locale={{
        emptyText: <ErrorPlaceHolder className="p-y-md" />,
      }}
      pagination={false}
      rowKey="id"
      size="small"
    />
  );
}

export default DirectoryChildrenTable;
