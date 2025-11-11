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
import { Switch, Typography } from 'antd';
import { ColumnsType } from 'antd/lib/table';
import { AxiosError } from 'axios';
import { isEmpty } from 'lodash';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import ErrorPlaceHolder from '../../components/common/ErrorWithPlaceholder/ErrorPlaceHolder';
import { PagingHandlerParams } from '../../components/common/NextPrevious/NextPrevious.interface';
import RichTextEditorPreviewerNew from '../../components/common/RichTextEditor/RichTextEditorPreviewNew';
import Table from '../../components/common/Table/Table';
import { EntityType } from '../../enums/entity.enum';
import { Include } from '../../generated/type/include';
import { Paging } from '../../generated/type/paging';
import { usePaging } from '../../hooks/paging/usePaging';
import { useFqn } from '../../hooks/useFqn';
import { ServicePageData } from '../../pages/ServiceDetailsPage/ServiceDetailsPage.interface';
import { getStoredProceduresList } from '../../rest/storedProceduresAPI';
import entityUtilClassBase from '../../utils/EntityUtilClassBase';
import { getEntityName } from '../../utils/EntityUtils';
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
  const { fqn: decodedDatabaseSchemaFQN } = useFqn();
  const [showDeleted, setShowDeleted] = useState(false);

  const fetchStoreProcedureDetails = useCallback(
    async (params?: Partial<Paging>) => {
      try {
        setIsLoading(true);
        const { data, paging } = await getStoredProceduresList({
          databaseSchema: decodedDatabaseSchemaFQN,
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
    [decodedDatabaseSchemaFQN, pageSize, showDeleted, handlePagingChange]
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
    [paging, handlePageChange, fetchStoreProcedureDetails]
  );

  const tableColumn: ColumnsType<ServicePageData> = useMemo(
    () => [
      {
        title: t('label.name'),
        dataIndex: 'name',
        key: 'name',
        width: 350,
        render: (_, record) => (
          <div className="d-inline-flex w-max-90">
            <Link
              className="break-word"
              to={entityUtilClassBase.getEntityLink(
                EntityType.STORED_PROCEDURE,
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
        render: (text: string) =>
          isEmpty(text) ? (
            <Typography.Text className="text-grey-muted">
              {t('label.no-description')}
            </Typography.Text>
          ) : (
            <RichTextEditorPreviewerNew markdown={text} />
          ),
      },
    ],
    []
  );

  useEffect(() => {
    fetchStoreProcedureDetails();
  }, [showDeleted, pageSize]);

  const paginationProps = useMemo(
    () => ({
      currentPage,
      isLoading,
      showPagination,
      pageSize,
      paging,
      pagingHandler: storedProcedurePagingHandler,
      onShowSizeChange: handlePageSizeChange,
    }),
    [
      currentPage,
      isLoading,
      showPagination,
      pageSize,
      paging,
      storedProcedurePagingHandler,
      handlePageSizeChange,
    ]
  );

  return (
    <Table
      columns={tableColumn}
      containerClassName="m-md"
      customPaginationProps={paginationProps}
      data-testid="stored-procedure-table"
      dataSource={storedProcedure}
      extraTableFilters={
        <span>
          <Switch
            checked={showDeleted}
            data-testid="show-deleted-stored-procedure"
            onClick={(checked) => setShowDeleted(checked)}
          />
          <Typography.Text className="m-l-xs">
            {t('label.deleted')}
          </Typography.Text>
        </span>
      }
      loading={isLoading}
      locale={{
        emptyText: <ErrorPlaceHolder className="m-y-md" />,
      }}
      pagination={false}
      rowKey="id"
      size="small"
    />
  );
};

export default StoredProcedureTab;
