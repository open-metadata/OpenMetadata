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
import { isUndefined } from 'lodash';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import {
  INITIAL_PAGING_VALUE,
  PAGE_SIZE_BASE,
  pagingObject,
} from '../../../../constants/constants';
import { TABLE_SCROLL_VALUE } from '../../../../constants/Table.constants';
import {
  COMMON_STATIC_TABLE_VISIBLE_COLUMNS,
  DEFAULT_DATA_MODEL_TYPE_VISIBLE_COLUMNS,
  TABLE_COLUMNS_KEYS,
} from '../../../../constants/TableKeys.constants';
import { EntityType } from '../../../../enums/entity.enum';
import { Include } from '../../../../generated/type/include';
import { Paging } from '../../../../generated/type/paging';
import { usePaging } from '../../../../hooks/paging/usePaging';
import { useFqn } from '../../../../hooks/useFqn';
import { ServicePageData } from '../../../../pages/ServiceDetailsPage/ServiceDetailsPage.interface';
import { getDataModels } from '../../../../rest/dashboardAPI';
import { commonTableFields } from '../../../../utils/DatasetDetailsUtils';
import { getEntityName } from '../../../../utils/EntityUtils';
import { getEntityDetailsPath } from '../../../../utils/RouterUtils';
import {
  dataProductTableObject,
  domainTableObject,
  ownerTableObject,
  tagTableObject,
} from '../../../../utils/TableColumn.util';
import { showErrorToast } from '../../../../utils/ToastUtils';
import ErrorPlaceHolder from '../../../common/ErrorWithPlaceholder/ErrorPlaceHolder';
import { NextPreviousProps } from '../../../common/NextPrevious/NextPrevious.interface';
import RichTextEditorPreviewerNew from '../../../common/RichTextEditor/RichTextEditorPreviewNew';
import Table from '../../../common/Table/Table';
import { DataModelTableProps } from './DataModelDetails.interface';

const DataModelTable = ({
  showDeleted,
  handleShowDeleted,
}: DataModelTableProps) => {
  const { t } = useTranslation();
  const { fqn } = useFqn();
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
        dataIndex: TABLE_COLUMNS_KEYS.NAME,
        key: TABLE_COLUMNS_KEYS.NAME,
        width: 300,
        render: (_, record: ServicePageData) => {
          const dataModelDisplayName = getEntityName(record);

          return (
            <div className="d-inline-flex w-max-90">
              <Link
                className="break-word"
                data-testid={`data-model-${dataModelDisplayName}`}
                to={getEntityDetailsPath(
                  EntityType.DASHBOARD_DATA_MODEL,
                  record.fullyQualifiedName || ''
                )}>
                {dataModelDisplayName}
              </Link>
            </div>
          );
        },
      },
      {
        title: t('label.description'),
        dataIndex: TABLE_COLUMNS_KEYS.DESCRIPTION,
        key: TABLE_COLUMNS_KEYS.DESCRIPTION,
        width: 400,
        render: (description: ServicePageData['description']) =>
          !isUndefined(description) && description.trim() ? (
            <RichTextEditorPreviewerNew markdown={description} />
          ) : (
            <span className="text-grey-muted">
              {t('label.no-entity', {
                entity: t('label.description'),
              })}
            </span>
          ),
      },
      {
        title: t('label.data-model-type'),
        dataIndex: TABLE_COLUMNS_KEYS.DATA_MODEL_TYPE,
        key: TABLE_COLUMNS_KEYS.DATA_MODEL_TYPE,
        width: 200,
      },
      ...ownerTableObject<ServicePageData>(),
      ...domainTableObject<ServicePageData>(),
      ...dataProductTableObject<ServicePageData>(),
      ...tagTableObject<ServicePageData>(),
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
          fields: commonTableFields,
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
    handleShowDeleted(checked);
    handlePageChange(INITIAL_PAGING_VALUE);
    handlePageSizeChange(PAGE_SIZE_BASE);
  };

  useEffect(() => {
    fetchDashboardsDataModel();
  }, [pageSize, showDeleted]);

  return (
    <Table
      columns={tableColumn}
      customPaginationProps={{
        currentPage,
        isLoading,
        pageSize,
        paging,
        pagingHandler: handleDataModelPageChange,
        onShowSizeChange: handlePageSizeChange,
        showPagination,
      }}
      data-testid="data-models-table"
      dataSource={dataModels}
      defaultVisibleColumns={DEFAULT_DATA_MODEL_TYPE_VISIBLE_COLUMNS}
      entityType="dashboardDataModelTable"
      extraTableFilters={
        <span>
          <Switch
            checked={showDeleted}
            data-testid="show-deleted"
            onClick={handleShowDeletedChange}
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
      scroll={TABLE_SCROLL_VALUE}
      size="small"
      staticVisibleColumns={COMMON_STATIC_TABLE_VISIBLE_COLUMNS}
    />
  );
};

export default DataModelTable;
