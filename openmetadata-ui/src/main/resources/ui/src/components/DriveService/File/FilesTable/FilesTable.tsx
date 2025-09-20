/*
 *  Copyright 2025 Collate.
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
import { isUndefined } from 'lodash';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import {
  INITIAL_PAGING_VALUE,
  PAGE_SIZE_BASE,
} from '../../../../constants/constants';
import { TABLE_SCROLL_VALUE } from '../../../../constants/Table.constants';
import {
  COMMON_STATIC_TABLE_VISIBLE_COLUMNS,
  DEFAULT_SERVICE_TAB_VISIBLE_COLUMNS,
  TABLE_COLUMNS_KEYS,
} from '../../../../constants/TableKeys.constants';
import { EntityType } from '../../../../enums/entity.enum';
import { ServicePageData } from '../../../../pages/ServiceDetailsPage/ServiceDetailsPage.interface';
import { getEntityName } from '../../../../utils/EntityUtils';
import { getEntityDetailsPath } from '../../../../utils/RouterUtils';
import { tagTableObject } from '../../../../utils/TableColumn.util';
import ErrorPlaceHolder from '../../../common/ErrorWithPlaceholder/ErrorPlaceHolder';
import RichTextEditorPreviewerNew from '../../../common/RichTextEditor/RichTextEditorPreviewNew';
import Table from '../../../common/Table/Table';
import { FilesTableProps } from './FilesTable.interface';

function FilesTable({
  showDeleted,
  handleShowDeleted,
  paging,
  handlePageChange,
  files,
  isLoading,
}: Readonly<FilesTableProps>) {
  const { t } = useTranslation();

  const tableColumn: ColumnsType<ServicePageData> = useMemo(
    () => [
      {
        title: t('label.name'),
        dataIndex: TABLE_COLUMNS_KEYS.NAME,
        key: TABLE_COLUMNS_KEYS.NAME,
        width: 300,
        render: (_, record: ServicePageData) => {
          const fileDisplayName = getEntityName(record);

          return (
            <div className="d-inline-flex w-max-90">
              <Link
                className="break-word"
                data-testid={`file-${fileDisplayName}`}
                to={getEntityDetailsPath(
                  EntityType.FILE,
                  record.fullyQualifiedName || ''
                )}>
                {fileDisplayName}
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
      ...tagTableObject<ServicePageData>(),
    ],
    []
  );

  const handleShowDeletedChange = (checked: boolean) => {
    handleShowDeleted(checked);
    paging.handlePageChange(INITIAL_PAGING_VALUE);
    paging.handlePageSizeChange(PAGE_SIZE_BASE);
  };

  return (
    <Table
      columns={tableColumn}
      customPaginationProps={{
        currentPage: paging.currentPage,
        isLoading,
        pageSize: paging.pageSize,
        paging: paging.paging,
        pagingHandler: handlePageChange,
        onShowSizeChange: paging.handlePageSizeChange,
        showPagination: paging.showPagination,
      }}
      data-testid="data-models-table"
      dataSource={files}
      defaultVisibleColumns={DEFAULT_SERVICE_TAB_VISIBLE_COLUMNS}
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
}

export default FilesTable;
