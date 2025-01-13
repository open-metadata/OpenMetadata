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
import { compare } from 'fast-json-patch';
import { isEmpty, isUndefined } from 'lodash';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import DisplayName from '../../components/common/DisplayName/DisplayName';
import DescriptionV1 from '../../components/common/EntityDescription/DescriptionV1';
import ErrorPlaceHolder from '../../components/common/ErrorWithPlaceholder/ErrorPlaceHolder';
import NextPrevious from '../../components/common/NextPrevious/NextPrevious';
import { NextPreviousProps } from '../../components/common/NextPrevious/NextPrevious.interface';
import RichTextEditorPreviewerV1 from '../../components/common/RichTextEditor/RichTextEditorPreviewerV1';
import TableAntd from '../../components/common/Table/Table';
import { EntityName } from '../../components/Modals/EntityNameModal/EntityNameModal.interface';
import { usePermissionProvider } from '../../context/PermissionProvider/PermissionProvider';
import { ERROR_PLACEHOLDER_TYPE } from '../../enums/common.enum';
import { EntityType } from '../../enums/entity.enum';
import { DatabaseSchema } from '../../generated/entity/data/databaseSchema';
import { Table } from '../../generated/entity/data/table';
import { UsePagingInterface } from '../../hooks/paging/usePaging';
import { patchTableDetails } from '../../rest/tableAPI';
import entityUtilClassBase from '../../utils/EntityUtilClassBase';
import { getEntityName } from '../../utils/EntityUtils';
import { showErrorToast } from '../../utils/ToastUtils';

interface SchemaTablesTabProps {
  databaseSchemaDetails: DatabaseSchema;
  tableDataLoading: boolean;
  description: string;
  editDescriptionPermission?: boolean;
  isEdit?: boolean;
  showDeletedTables?: boolean;
  tableData: Table[];
  currentTablesPage: number;
  tablePaginationHandler: NextPreviousProps['pagingHandler'];
  onCancel?: () => void;
  onDescriptionEdit?: () => void;
  onDescriptionUpdate?: (updatedHTML: string) => Promise<void>;
  onThreadLinkSelect?: (link: string) => void;
  onShowDeletedTablesChange?: (value: boolean) => void;
  isVersionView?: boolean;
  pagingInfo: UsePagingInterface;
}

function SchemaTablesTab({
  databaseSchemaDetails,
  tableDataLoading,
  description,
  editDescriptionPermission = false,
  isEdit = false,
  tableData,
  currentTablesPage,
  tablePaginationHandler,
  onCancel,
  onDescriptionEdit,
  onDescriptionUpdate,
  onThreadLinkSelect,
  showDeletedTables = false,
  onShowDeletedTablesChange,
  isVersionView = false,
  pagingInfo,
}: Readonly<SchemaTablesTabProps>) {
  const { t } = useTranslation();
  const [localTableData, setLocalTableData] = useState<Table[]>([]);

  const { permissions } = usePermissionProvider();

  const allowEditDisplayNamePermission = useMemo(() => {
    return (
      !isVersionView &&
      (permissions.table.EditAll || permissions.table.EditDisplayName)
    );
  }, [permissions, isVersionView]);

  const handleDisplayNameUpdate = useCallback(
    async (data: EntityName, id?: string) => {
      try {
        const tableDetails = localTableData.find((table) => table.id === id);
        if (!tableDetails) {
          return;
        }
        const updatedData = {
          ...tableDetails,
          displayName: data.displayName || undefined,
        };
        const jsonPatch = compare(tableDetails, updatedData);
        const response = await patchTableDetails(tableDetails.id, jsonPatch);

        setLocalTableData((prevData) =>
          prevData.map((table) => (table.id === id ? response : table))
        );
      } catch (error) {
        showErrorToast(error as AxiosError);
      }
    },
    [localTableData]
  );

  useEffect(() => {
    setLocalTableData(tableData);
  }, [tableData]);

  const tableColumn: ColumnsType<Table> = useMemo(
    () => [
      {
        title: t('label.name'),
        dataIndex: 'name',
        key: 'name',
        width: 500,
        render: (_, record: Table) => {
          return (
            <DisplayName
              allowRename={allowEditDisplayNamePermission}
              displayName={record.displayName}
              id={record.id}
              key={record.id}
              link={entityUtilClassBase.getEntityLink(
                EntityType.TABLE,
                record.fullyQualifiedName as string
              )}
              name={record.name}
              onEditDisplayName={handleDisplayNameUpdate}
            />
          );
        },
      },
      {
        title: t('label.description'),
        dataIndex: 'description',
        key: 'description',
        render: (text: string) =>
          text?.trim() ? (
            <RichTextEditorPreviewerV1 markdown={text} />
          ) : (
            <span className="text-grey-muted">{t('label.no-description')}</span>
          ),
      },
    ],
    [handleDisplayNameUpdate, allowEditDisplayNamePermission]
  );

  return (
    <Row gutter={[16, 16]}>
      <Col data-testid="description-container" span={24}>
        {isVersionView ? (
          <DescriptionV1
            description={description}
            entityFqn={databaseSchemaDetails.fullyQualifiedName}
            entityType={EntityType.DATABASE_SCHEMA}
            isDescriptionExpanded={isEmpty(tableData)}
            showActions={false}
          />
        ) : (
          <DescriptionV1
            description={description}
            entityFqn={databaseSchemaDetails.fullyQualifiedName}
            entityName={getEntityName(databaseSchemaDetails)}
            entityType={EntityType.DATABASE_SCHEMA}
            hasEditAccess={editDescriptionPermission}
            isDescriptionExpanded={isEmpty(tableData)}
            isEdit={isEdit}
            showActions={!databaseSchemaDetails.deleted}
            onCancel={onCancel}
            onDescriptionEdit={onDescriptionEdit}
            onDescriptionUpdate={onDescriptionUpdate}
            onThreadLinkSelect={onThreadLinkSelect}
          />
        )}
      </Col>
      {!isVersionView && (
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
      )}

      <Col span={24}>
        <TableAntd
          bordered
          columns={tableColumn}
          data-testid="databaseSchema-tables"
          dataSource={localTableData}
          loading={tableDataLoading}
          locale={{
            emptyText: (
              <ErrorPlaceHolder
                className="mt-0-important"
                type={ERROR_PLACEHOLDER_TYPE.NO_DATA}
              />
            ),
          }}
          pagination={false}
          rowKey="id"
          size="small"
        />
      </Col>
      {!isUndefined(pagingInfo) && pagingInfo.showPagination && (
        <Col span={24}>
          <NextPrevious
            currentPage={currentTablesPage}
            isLoading={tableDataLoading}
            pageSize={pagingInfo.pageSize}
            paging={pagingInfo.paging}
            pagingHandler={tablePaginationHandler}
            onShowSizeChange={pagingInfo.handlePageSizeChange}
          />
        </Col>
      )}
    </Row>
  );
}

export default SchemaTablesTab;
