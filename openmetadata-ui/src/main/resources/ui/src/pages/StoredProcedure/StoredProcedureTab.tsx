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
import { isEmpty } from 'lodash';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useParams } from 'react-router-dom';
import ErrorPlaceHolder from '../../components/common/ErrorWithPlaceholder/ErrorPlaceHolder';
import NextPrevious from '../../components/common/NextPrevious/NextPrevious';
import { PagingHandlerParams } from '../../components/common/NextPrevious/NextPrevious.interface';
import RichTextEditorPreviewer from '../../components/common/RichTextEditor/RichTextEditorPreviewer';
import Table from '../../components/common/Table/Table';
import { EntityType } from '../../enums/entity.enum';
import { Include } from '../../generated/type/include';
import { Paging } from '../../generated/type/paging';
import { usePaging } from '../../hooks/paging/usePaging';
import { ServicePageData } from '../../pages/ServiceDetailsPage/ServiceDetailsPage';
import { getStoredProceduresList } from '../../rest/storedProceduresAPI';
import { getEntityName } from '../../utils/EntityUtils';
import { getEntityLink } from '../../utils/TableUtils';
import { showErrorToast } from '../../utils/ToastUtils';

const StoredProcedureTab = () => {
  const { t } = useTranslation();
  const {
    currentPage,
    handlePageChange,
    pageSize,
    handlePageSizeChange,
    paging,
    handlePagingChange,
    showPagination,
  } = usePaging();

  const [storedProcedure, setStoredProcedure] = useState<ServicePageData[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const { fqn } = useParams<{ fqn: string }>();
  const [showDeleted, setShowDeleted] = useState(false);

  const fetchStoreProcedureDetails = useCallback(
    async (params?: Partial<Paging>) => {
      try {
        setIsLoading(true);
        const { data, paging } = await getStoredProceduresList({
          databaseSchema: fqn,
          include: showDeleted ? Include.Deleted : Include.NonDeleted,
          ...params,
          limit: pageSize,
        });
        setStoredProcedure(data);
        handlePagingChange(paging);
      } catch (error) {
        showErrorToast(error as AxiosError);
      } finally {
        setIsLoading(false);
      }
    },
    [fqn, pageSize]
  );

  const storedProcedurePagingHandler = useCallback(
    async ({ cursorType, currentPage }: PagingHandlerParams) => {
      if (cursorType) {
        const pagingString = {
          [cursorType]: paging[cursorType],
        };

        await fetchStoreProcedureDetails(pagingString);
      }
      handlePageChange(currentPage);
    },
    [paging, handlePageChange]
  );

  const tableColumn: ColumnsType<ServicePageData> = useMemo(
    () => [
      {
        title: t('label.name'),
        dataIndex: 'name',
        key: 'name',
        width: 350,
        render: (_, record) => (
          <Link
            to={getEntityLink(
              EntityType.STORED_PROCEDURE,
              record.fullyQualifiedName ?? ''
            )}>
            {getEntityName(record)}
          </Link>
        ),
      },
      {
        title: t('label.description'),
        dataIndex: 'description',
        key: 'description',
        render: (text: string) =>
          isEmpty(text) ? (
            <Typography.Text className="text-grey-muted">
              {t('label.no-description')}
            </Typography.Text>
          ) : (
            <RichTextEditorPreviewer markdown={text} />
          ),
      },
    ],
    []
  );

  useEffect(() => {
    fetchStoreProcedureDetails();
  }, [showDeleted, pageSize]);

  return (
    <Row className="p-lg" data-testid="stored-procedure-table" gutter={[0, 16]}>
      <Col className="d-flex justify-end" span={24}>
        <Switch
          checked={showDeleted}
          data-testid="show-deleted-stored-procedure"
          onClick={(checked) => setShowDeleted(checked)}
        />
        <Typography.Text className="m-l-xs">
          {t('label.deleted')}
        </Typography.Text>{' '}
      </Col>
      <Col span={24}>
        <Table
          bordered
          columns={tableColumn}
          dataSource={storedProcedure}
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
            pagingHandler={storedProcedurePagingHandler}
            onShowSizeChange={handlePageSizeChange}
          />
        )}
      </Col>
    </Row>
  );
};

export default StoredProcedureTab;
