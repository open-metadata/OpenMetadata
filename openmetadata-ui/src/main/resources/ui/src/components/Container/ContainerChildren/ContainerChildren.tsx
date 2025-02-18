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
import { ColumnsType } from 'antd/lib/table';
import { AxiosError } from 'axios';
import React, { FC, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { getEntityDetailsPath } from '../../../constants/constants';
import { EntityType, TabSpecificField } from '../../../enums/entity.enum';
import { EntityReference } from '../../../generated/type/entityReference';
import { useFqn } from '../../../hooks/useFqn';
import { getContainerByName } from '../../../rest/storageAPI';
import { getColumnSorter, getEntityName } from '../../../utils/EntityUtils';
import { showErrorToast } from '../../../utils/ToastUtils';
import ErrorPlaceHolder from '../../common/ErrorWithPlaceholder/ErrorPlaceHolder';
import RichTextEditorPreviewerV1 from '../../common/RichTextEditor/RichTextEditorPreviewerV1';
import Table from '../../common/Table/Table';

const ContainerChildren: FC = () => {
  const { t } = useTranslation();

  const { fqn: decodedContainerName } = useFqn();
  const [isChildrenLoading, setIsChildrenLoading] = useState(false);
  const [containerChildrenData, setContainerChildrenData] = useState<
    EntityReference[]
  >([]);

  const columns: ColumnsType<EntityReference> = useMemo(
    () => [
      {
        title: t('label.name'),
        dataIndex: 'name',
        width: 400,
        key: 'name',
        sorter: getColumnSorter<EntityReference, 'name'>('name'),
        render: (_, record) => (
          <div className="d-inline-flex w-max-90">
            <Link
              className="break-word"
              data-testid="container-name"
              to={getEntityDetailsPath(
                EntityType.CONTAINER,
                record.fullyQualifiedName ?? ''
              )}>
              {getEntityName(record)}
            </Link>
          </div>
        ),
      },
      {
        title: t('label.description'),
        dataIndex: 'description',
        key: 'description',
        render: (description: EntityReference['description']) => (
          <>
            {description ? (
              <RichTextEditorPreviewerV1 markdown={description} />
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

  const fetchChildren = async () => {
    setIsChildrenLoading(true);
    try {
      const { children } = await getContainerByName(decodedContainerName, {
        fields: TabSpecificField.CHILDREN,
      });
      setContainerChildrenData(children ?? []);
    } catch (error) {
      showErrorToast(error as AxiosError);
    } finally {
      setIsChildrenLoading(false);
    }
  };

  useEffect(() => {
    fetchChildren();
  }, []);

  return (
    <Table
      bordered
      columns={columns}
      data-testid="container-list-table"
      dataSource={containerChildrenData}
      loading={isChildrenLoading}
      locale={{
        emptyText: <ErrorPlaceHolder className="p-y-md" />,
      }}
      pagination={false}
      rowKey="id"
      size="small"
    />
  );
};

export default ContainerChildren;
