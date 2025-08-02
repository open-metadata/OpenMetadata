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
import { ArrowLeftOutlined, ArrowRightOutlined } from '@ant-design/icons';
import { Button, Card, Tag, Typography } from 'antd';
import { ColumnsType } from 'antd/lib/table';
import { isEmpty } from 'lodash';
import { Key, useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  NO_DATA_PLACEHOLDER,
  PAGE_SIZE_MEDIUM,
} from '../../../constants/constants';
import { TABLE_COLUMNS_KEYS } from '../../../constants/TableKeys.constants';
import { EntityType } from '../../../enums/entity.enum';
import { DataContract } from '../../../generated/entity/data/dataContract';
import { Column } from '../../../generated/entity/data/table';
import { TagSource } from '../../../generated/tests/testCase';
import { TagLabel } from '../../../generated/type/tagLabel';
import { usePaging } from '../../../hooks/paging/usePaging';
import { useFqn } from '../../../hooks/useFqn';
import { getTableColumnsByFQN } from '../../../rest/tableAPI';
import {
  getEntityName,
  highlightSearchArrayElement,
} from '../../../utils/EntityUtils';
import { pruneEmptyChildren } from '../../../utils/TableUtils';
import { NextPreviousProps } from '../../common/NextPrevious/NextPrevious.interface';
import Table from '../../common/Table/Table';
import { TableCellRendered } from '../../Database/SchemaTable/SchemaTable.interface';
import TableTags from '../../Database/TableTags/TableTags.component';

export const ContractSchemaFormTab: React.FC<{
  selectedSchema: string[];
  onNext: () => void;
  onChange: (data: Partial<DataContract>) => void;
  onPrev: () => void;
  nextLabel?: string;
  prevLabel?: string;
}> = ({ selectedSchema, onNext, onChange, onPrev, nextLabel, prevLabel }) => {
  const { t } = useTranslation();
  const { fqn } = useFqn();
  const [schema, setSchema] = useState<Column[]>([]);
  const [allColumns, setAllColumns] = useState<Column[]>([]);
  const [selectedKeys, setSelectedKeys] = useState<string[]>(selectedSchema);
  const [isLoading, setIsLoading] = useState(false);

  const {
    currentPage,
    pageSize,
    paging,
    handlePageChange,
    handlePageSizeChange,
    handlePagingChange,
    showPagination,
  } = usePaging(PAGE_SIZE_MEDIUM);
  const handleChangeTable = useCallback(
    (selectedRowKeys: Key[]) => {
      setSelectedKeys(selectedRowKeys as string[]);
      onChange({
        schema: allColumns.filter((column) =>
          selectedRowKeys.includes(column.name)
        ),
      });
    },
    [allColumns, onChange]
  );

  const fetchTableColumns = useCallback(async () => {
    try {
      setIsLoading(true);
      const response = await getTableColumnsByFQN(fqn);
      const prunedColumns = pruneEmptyChildren(response.data);
      setAllColumns(prunedColumns);

      // Handle pagination logic
      const startIndex = (currentPage - 1) * pageSize;
      const endIndex = startIndex + pageSize;
      const paginatedColumns = prunedColumns.slice(startIndex, endIndex);
      setSchema(paginatedColumns);

      // Update paging info
      handlePagingChange({
        total: prunedColumns.length,
      });
    } finally {
      setIsLoading(false);
    }
  }, [fqn, currentPage, pageSize, handlePagingChange]);

  useEffect(() => {
    fetchTableColumns();
  }, [fetchTableColumns]);

  const renderDataTypeDisplay: TableCellRendered<Column, 'dataTypeDisplay'> = (
    dataTypeDisplay,
    record
  ) => {
    const displayValue = isEmpty(dataTypeDisplay)
      ? record.dataType
      : dataTypeDisplay;

    if (isEmpty(displayValue)) {
      return NO_DATA_PLACEHOLDER;
    }

    return (
      <Tag
        className="cursor-pointer custom-tag"
        color="purple"
        title={displayValue}>
        {highlightSearchArrayElement(dataTypeDisplay, '')}
      </Tag>
    );
  };

  const renderConstraint: TableCellRendered<Column, 'constraint'> = (
    constraint
  ) => {
    if (isEmpty(constraint)) {
      return NO_DATA_PLACEHOLDER;
    }

    return (
      <Tag
        className="cursor-pointer custom-tag"
        color="blue"
        title={constraint}>
        {constraint}
      </Tag>
    );
  };

  const columns: ColumnsType<Column> = useMemo(
    () => [
      {
        title: t('label.name'),
        dataIndex: TABLE_COLUMNS_KEYS.NAME,
        key: TABLE_COLUMNS_KEYS.NAME,
        render: (_, record: Column) => (
          <Typography.Text className="schema-table-name">
            {getEntityName(record)}
          </Typography.Text>
        ),
      },
      {
        title: t('label.type'),
        dataIndex: TABLE_COLUMNS_KEYS.DATA_TYPE_DISPLAY,
        key: TABLE_COLUMNS_KEYS.DATA_TYPE_DISPLAY,
        render: renderDataTypeDisplay,
      },
      {
        title: t('label.tag-plural'),
        dataIndex: TABLE_COLUMNS_KEYS.TAGS,
        key: TABLE_COLUMNS_KEYS.TAGS,
        render: (tags: TagLabel[], record: Column, index: number) => (
          <TableTags<Column>
            isReadOnly
            entityFqn={fqn}
            entityType={EntityType.TABLE}
            handleTagSelection={() => Promise.resolve()}
            hasTagEditAccess={false}
            index={index}
            record={record}
            tags={tags}
            type={TagSource.Classification}
          />
        ),
      },
      {
        title: t('label.glossary-term-plural'),
        dataIndex: TABLE_COLUMNS_KEYS.TAGS,
        key: TABLE_COLUMNS_KEYS.GLOSSARY,
        render: (tags: TagLabel[], record: Column, index: number) => (
          <TableTags<Column>
            isReadOnly
            entityFqn={fqn}
            entityType={EntityType.TABLE}
            handleTagSelection={() => Promise.resolve()}
            hasTagEditAccess={false}
            index={index}
            record={record}
            tags={tags}
            type={TagSource.Glossary}
          />
        ),
      },
      {
        title: t('label.constraint-plural'),
        dataIndex: 'constraint',
        key: 'constraint',
        render: renderConstraint,
      },
    ],
    [t]
  );

  return (
    <>
      <Card className="container bg-grey p-box">
        <div className="m-b-sm">
          <Typography.Text className="contract-detail-form-tab-title">
            {t('label.schema')}
          </Typography.Text>
          <Typography.Paragraph className="contract-detail-form-tab-description">
            {t('message.data-contract-schema-description')}
          </Typography.Paragraph>
        </div>
        <Table
          columns={columns}
          customPaginationProps={{
            currentPage,
            pageSize,
            paging,
            pagingHandler: ({
              currentPage: newPage,
            }: Pick<NextPreviousProps, 'currentPage'>) => {
              handlePageChange(newPage);
            },
            onShowSizeChange: handlePageSizeChange,
            showPagination,
            isLoading,
          }}
          dataSource={schema}
          loading={isLoading}
          pagination={false}
          rowKey="name"
          rowSelection={{
            selectedRowKeys: selectedKeys,
            onChange: handleChangeTable,
          }}
        />
      </Card>
      <div className="d-flex justify-between m-t-md">
        <Button icon={<ArrowLeftOutlined />} type="default" onClick={onPrev}>
          {prevLabel ?? t('label.previous')}
        </Button>
        <Button type="primary" onClick={onNext}>
          {nextLabel ?? t('label.next')}
          <ArrowRightOutlined />
        </Button>
      </div>
    </>
  );
};
