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

import { Col } from 'antd';
import { ColumnsType } from 'antd/lib/table';
import { isUndefined } from 'lodash';
import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import ErrorPlaceHolder from '../../components/common/ErrorWithPlaceholder/ErrorPlaceHolder';
import RichTextEditorPreviewer from '../../components/common/RichTextEditor/RichTextEditorPreviewer';
import Table from '../../components/common/Table/Table';
import { getDataModelDetailsPath, PAGE_SIZE } from '../../constants/constants';
import { DataModelTableProps } from '../../pages/DataModelPage/DataModelsInterface';
import { ServicePageData } from '../../pages/ServiceDetailsPage/ServiceDetailsPage';
import { getEntityName } from '../../utils/EntityUtils';
import NextPrevious from '../common/NextPrevious/NextPrevious';

const DataModelTable = ({
  data,
  isLoading,
  paging,
  pagingHandler,
  currentPage,
}: DataModelTableProps) => {
  const { t } = useTranslation();

  const tableColumn: ColumnsType<ServicePageData> = useMemo(
    () => [
      {
        title: t('label.name'),
        dataIndex: 'displayName',
        key: 'displayName',
        width: 350,
        render: (_, record: ServicePageData) => {
          const dataModelDisplayName = getEntityName(record);

          return (
            <Link
              data-testid={`data-model-${dataModelDisplayName}`}
              to={getDataModelDetailsPath(record.fullyQualifiedName || '')}>
              {dataModelDisplayName}
            </Link>
          );
        },
      },
      {
        title: t('label.description'),
        dataIndex: 'description',
        key: 'description',
        render: (description: ServicePageData['description']) =>
          !isUndefined(description) && description.trim() ? (
            <RichTextEditorPreviewer markdown={description} />
          ) : (
            <span className="text-grey-muted">
              {t('label.no-entity', {
                entity: t('label.description'),
              })}
            </span>
          ),
      },
    ],
    []
  );

  return (
    <>
      <Col className="p-x-lg" data-testid="table-container" span={24}>
        <Table
          bordered
          className="mt-4 table-shadow"
          columns={tableColumn}
          data-testid="data-models-table"
          dataSource={data}
          loading={isLoading}
          locale={{
            emptyText: <ErrorPlaceHolder className="m-y-md" />,
          }}
          pagination={false}
          rowKey="id"
          size="small"
        />
      </Col>
      <Col span={24}>
        {paging && paging.total > PAGE_SIZE && (
          <NextPrevious
            currentPage={currentPage}
            pageSize={PAGE_SIZE}
            paging={paging}
            pagingHandler={pagingHandler}
          />
        )}
      </Col>
    </>
  );
};

export default DataModelTable;
