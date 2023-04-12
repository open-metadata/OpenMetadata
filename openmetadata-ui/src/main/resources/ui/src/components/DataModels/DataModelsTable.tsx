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

import { Table } from 'antd';
import { ColumnsType } from 'antd/lib/table';
import ErrorPlaceHolder from 'components/common/error-with-placeholder/ErrorPlaceHolder';
import RichTextEditorPreviewer from 'components/common/rich-text-editor/RichTextEditorPreviewer';
import Loader from 'components/Loader/Loader';
import { getDataModelDetailsPath } from 'constants/constants';
import { CONNECTORS_DOCS } from 'constants/docs.constants';
import { servicesDisplayName } from 'constants/Services.constant';
import { isEmpty, isUndefined } from 'lodash';
import { DataModelTableProps } from 'pages/DataModelPage/DataModelsInterface';
import { ServicePageData } from 'pages/service';
import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { getEntityName } from 'utils/EntityUtils';

const DataModelTable = ({ data, isLoading }: DataModelTableProps) => {
  const { t } = useTranslation();

  const tableColumn: ColumnsType<ServicePageData> = useMemo(
    () => [
      {
        title: t('label.name'),
        dataIndex: 'displayName',
        key: 'displayName',
        width: 350,
        render: (_, record: ServicePageData) => {
          return (
            <Link to={getDataModelDetailsPath(record.fullyQualifiedName || '')}>
              {getEntityName(record)}
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

  return isEmpty(data) ? (
    <ErrorPlaceHolder
      doc={CONNECTORS_DOCS}
      heading={servicesDisplayName.dashboardDataModel}
    />
  ) : (
    <div data-testid="table-container">
      <Table
        bordered
        className="mt-4 table-shadow"
        columns={tableColumn}
        data-testid="data-models-table"
        dataSource={data}
        loading={{
          spinning: isLoading,
          indicator: <Loader size="small" />,
        }}
        pagination={false}
        rowKey="id"
        size="small"
      />
    </div>
  );
};

export default DataModelTable;
