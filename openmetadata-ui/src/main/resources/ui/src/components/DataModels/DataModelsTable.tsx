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
import { AxiosError } from 'axios';
import { isUndefined } from 'lodash';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useParams } from 'react-router-dom';
import ErrorPlaceHolder from '../../components/common/ErrorWithPlaceholder/ErrorPlaceHolder';
import RichTextEditorPreviewer from '../../components/common/RichTextEditor/RichTextEditorPreviewer';
import Table from '../../components/common/Table/Table';
import {
  getDataModelDetailsPath,
  pagingObject,
} from '../../constants/constants';
import { Paging } from '../../generated/type/paging';
import { usePaging } from '../../hooks/paging/usePaging';
import { ServicePageData } from '../../pages/ServiceDetailsPage/ServiceDetailsPage';
import { getDataModels } from '../../rest/dashboardAPI';
import { getEntityName } from '../../utils/EntityUtils';
import { showErrorToast } from '../../utils/ToastUtils';
import NextPrevious from '../common/NextPrevious/NextPrevious';
import { NextPreviousProps } from '../common/NextPrevious/NextPrevious.interface';

const DataModelTable = () => {
  const { t } = useTranslation();
  const { fqn } = useParams<{ fqn: string }>();
  const [dataModels, setDataModels] = useState<Array<ServicePageData>>();
  const {
    currentPage,
    pageSize,
    paging,
    handlePageChange,
    handlePageSizeChange,
    handlePagingChange,
    showPagination,
  } = usePaging();
  const [isLoading, setIsLoading] = useState(true);

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

  const fetchDashboardsDataModel = useCallback(
    async (pagingData?: Partial<Paging>) => {
      try {
        setIsLoading(true);
        const { data, paging: resPaging } = await getDataModels({
          service: fqn,
          fields: 'owner,tags,followers',
          limit: pageSize,
          ...pagingData,
        });
        setDataModels(data);
        handlePagingChange(resPaging);
      } catch (error) {
        showErrorToast(error as AxiosError);
        setDataModels([]);
        handlePagingChange(pagingObject);
      } finally {
        setIsLoading(false);
      }
    },
    [fqn, pageSize]
  );

  const handleDataModelPageChange: NextPreviousProps['pagingHandler'] = ({
    cursorType,
    currentPage,
  }) => {
    if (cursorType) {
      fetchDashboardsDataModel({ [cursorType]: paging[cursorType] });
    }
    handlePageChange(currentPage);
  };

  useEffect(() => {
    fetchDashboardsDataModel();
  }, [pageSize]);

  return (
    <>
      <Col className="p-x-lg" data-testid="table-container" span={24}>
        <Table
          bordered
          className="mt-4 table-shadow"
          columns={tableColumn}
          data-testid="data-models-table"
          dataSource={dataModels}
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
        {showPagination && (
          <NextPrevious
            currentPage={currentPage}
            pageSize={pageSize}
            paging={paging}
            pagingHandler={handleDataModelPageChange}
            onShowSizeChange={handlePageSizeChange}
          />
        )}
      </Col>
    </>
  );
};

export default DataModelTable;
