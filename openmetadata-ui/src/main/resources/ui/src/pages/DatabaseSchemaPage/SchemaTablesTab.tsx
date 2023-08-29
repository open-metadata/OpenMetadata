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

import { Col, Row, Switch, Table as TableAntd, Typography } from 'antd';
import { ColumnsType } from 'antd/lib/table';
import DescriptionV1 from 'components/common/description/DescriptionV1';
import ErrorPlaceHolder from 'components/common/error-with-placeholder/ErrorPlaceHolder';
import NextPrevious from 'components/common/next-previous/NextPrevious';
import RichTextEditorPreviewer from 'components/common/rich-text-editor/RichTextEditorPreviewer';
import Loader from 'components/Loader/Loader';
import { PAGE_SIZE } from 'constants/constants';
import { ERROR_PLACEHOLDER_TYPE } from 'enums/common.enum';
import { EntityType } from 'enums/entity.enum';
import { EntityLinkThreadCount } from 'generated/api/feed/threadCount';
import { DatabaseSchema } from 'generated/entity/data/databaseSchema';
import { Table } from 'generated/entity/data/table';
import { isEmpty } from 'lodash';
import { PagingResponse } from 'Models';
import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { getEntityName } from 'utils/EntityUtils';
import { getEntityLink } from 'utils/TableUtils';

interface SchemaTablesTabProps {
  databaseSchemaDetails: DatabaseSchema;
  tableDataLoading: boolean;
  description: string;
  entityFieldThreadCount: EntityLinkThreadCount[];
  editDescriptionPermission: boolean;
  isEdit: boolean;
  showDeletedTables: boolean;
  tableData: PagingResponse<Table[]>;
  currentTablesPage: number;
  tablePaginationHandler: (
    cursorValue: string | number,
    activePage?: number
  ) => void;
  onCancel: () => void;
  onDescriptionEdit: () => void;
  onDescriptionUpdate: (updatedHTML: string) => Promise<void>;
  onThreadLinkSelect: (link: string) => void;
  onShowDeletedTablesChange: (value: boolean) => void;
}

function SchemaTablesTab({
  databaseSchemaDetails,
  tableDataLoading,
  description,
  editDescriptionPermission,
  isEdit,
  tableData,
  currentTablesPage,
  tablePaginationHandler,
  onCancel,
  onDescriptionEdit,
  onDescriptionUpdate,
  onThreadLinkSelect,
  showDeletedTables,
  onShowDeletedTablesChange,
}: SchemaTablesTabProps) {
  const { t } = useTranslation();

  const tableColumn: ColumnsType<Table> = useMemo(
    () => [
      {
        title: t('label.name'),
        dataIndex: 'name',
        key: 'name',
        render: (_, record: Table) => {
          return (
            <Link
              to={getEntityLink(
                EntityType.TABLE,
                record.fullyQualifiedName as string
              )}>
              {getEntityName(record)}
            </Link>
          );
        },
        className: 'truncate w-max-500',
      },
      {
        title: t('label.description'),
        dataIndex: 'description',
        key: 'description',
        render: (text: string) =>
          text?.trim() ? (
            <RichTextEditorPreviewer markdown={text} />
          ) : (
            <span className="text-grey-muted">{t('label.no-description')}</span>
          ),
      },
    ],
    []
  );

  return (
    <Row gutter={[16, 16]}>
      <Col data-testid="description-container" span={24}>
        <DescriptionV1
          description={description}
          entityFqn={databaseSchemaDetails.fullyQualifiedName}
          entityName={getEntityName(databaseSchemaDetails)}
          entityType={EntityType.DATABASE_SCHEMA}
          hasEditAccess={editDescriptionPermission}
          isEdit={isEdit}
          isReadOnly={databaseSchemaDetails.deleted}
          onCancel={onCancel}
          onDescriptionEdit={onDescriptionEdit}
          onDescriptionUpdate={onDescriptionUpdate}
          onThreadLinkSelect={onThreadLinkSelect}
        />
      </Col>
      <Col span={24}>
        <Row justify="end">
          <Col>
            <Switch
              checked={showDeletedTables}
              data-testid="show-deleted"
              onClick={onShowDeletedTablesChange}
            />
            <Typography.Text className="m-l-xs">
              {t('label.deleted')}
            </Typography.Text>{' '}
          </Col>
        </Row>
      </Col>
      <Col span={24}>
        {tableDataLoading ? (
          <Loader />
        ) : isEmpty(tableData) && !showDeletedTables ? (
          <ErrorPlaceHolder
            className="mt-0-important"
            type={ERROR_PLACEHOLDER_TYPE.NO_DATA}
          />
        ) : (
          <TableAntd
            bordered
            columns={tableColumn}
            data-testid="databaseSchema-tables"
            dataSource={tableData.data}
            locale={{
              emptyText: <ErrorPlaceHolder />,
            }}
            pagination={false}
            rowKey="id"
            size="small"
          />
        )}

        {tableData.paging.total > PAGE_SIZE && tableData.data.length > 0 && (
          <NextPrevious
            currentPage={currentTablesPage}
            pageSize={PAGE_SIZE}
            paging={tableData.paging}
            pagingHandler={tablePaginationHandler}
            totalCount={tableData.paging.total}
          />
        )}
      </Col>
    </Row>
  );
}

export default SchemaTablesTab;
