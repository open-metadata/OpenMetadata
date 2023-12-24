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

import { Col, Row, Switch, Typography } from 'antd';
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
  INITIAL_PAGING_VALUE,
  PAGE_SIZE_BASE,
  pagingObject,
} from '../../constants/constants';
import { Include } from '../../generated/type/include';
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
  const [showDeleted, setShowDeleted] = useState(false);
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
            <div className="d-inline-flex w-max-90">
              <Link
                className="break-word"
                data-testid={`data-model-${dataModelDisplayName}`}
                to={getDataModelDetailsPath(record.fullyQualifiedName || '')}>
                {dataModelDisplayName}
              </Link>
            </div>
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
          limit: pageSize,
          include: showDeleted ? Include.Deleted : Include.NonDeleted,
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
    [fqn, pageSize, showDeleted]
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

  const handleShowDeletedChange = (checked: boolean) => {
    setShowDeleted(checked);
    handlePageChange(INITIAL_PAGING_VALUE);
    handlePageSizeChange(PAGE_SIZE_BASE);
  };

  useEffect(() => {
    fetchDashboardsDataModel();
  }, [pageSize, showDeleted]);

  return (
    <Row gutter={[0, 16]}>
      <Col className="p-t-sm p-x-lg" span={24}>
        <Row justify="end">
          <Col>
            <Switch
              checked={showDeleted}
              data-testid="show-deleted"
              onClick={handleShowDeletedChange}
            />
            <Typography.Text className="m-l-xs">
              {t('label.deleted')}
            </Typography.Text>{' '}
          </Col>
        </Row>
      </Col>
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
      <Col className="p-b-sm" span={24}>
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
    </Row>
  );
};

export default DataModelTable;
