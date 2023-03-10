/*
 *  Copyright 2023 Collate.
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
import { Typography } from 'antd';
import Table, { ColumnsType } from 'antd/lib/table';
import RichTextEditorPreviewer from 'components/common/rich-text-editor/RichTextEditorPreviewer';
import { Container } from 'generated/entity/data/container';
import { EntityReference } from 'generated/type/entityReference';
import React, { FC, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { getEntityName } from 'utils/CommonUtils';
import { getContainerDetailPath } from 'utils/ContainerDetailUtils';

interface ContainerChildrenProps {
  childrenList: Container['children'];
}

const ContainerChildren: FC<ContainerChildrenProps> = ({ childrenList }) => {
  const { t } = useTranslation();

  const columns: ColumnsType<EntityReference> = useMemo(
    () => [
      {
        title: t('label.name'),
        dataIndex: 'name',
        width: '200px',
        key: 'name',
        render: (_, record) => (
          <Link
            className="link-hover"
            data-testid="container-name"
            to={getContainerDetailPath(record.fullyQualifiedName || '')}>
            {getEntityName(record)}
          </Link>
        ),
      },
      {
        title: t('label.description'),
        dataIndex: 'description',
        key: 'description',
        render: (description: EntityReference['description']) => (
          <>
            {description ? (
              <RichTextEditorPreviewer markdown={description} />
            ) : (
              <Typography.Text className="tw-no-description">
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
      bordered
      columns={columns}
      data-testid="container-list-table"
      dataSource={childrenList}
      pagination={false}
      rowKey="id"
      size="small"
    />
  );
};

export default ContainerChildren;
