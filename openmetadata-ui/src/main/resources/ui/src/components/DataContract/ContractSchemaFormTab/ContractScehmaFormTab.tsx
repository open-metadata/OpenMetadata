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
import { LeftOutlined, RightOutlined } from '@ant-design/icons';
import { Button, Card, Tag, Typography } from 'antd';
import { ColumnsType } from 'antd/lib/table';
import { isEmpty, pick } from 'lodash';
import { Key, useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FQN_SEPARATOR_CHAR } from '../../../constants/char.constants';
import {
  NO_DATA_PLACEHOLDER,
  PAGE_SIZE_MEDIUM,
} from '../../../constants/constants';
import { TABLE_COLUMNS_KEYS } from '../../../constants/TableKeys.constants';
import { EntityType, FqnPart } from '../../../enums/entity.enum';
import { DataContract } from '../../../generated/entity/data/dataContract';
import { Column } from '../../../generated/entity/data/table';
import { TagSource } from '../../../generated/tests/testCase';
import { TagLabel } from '../../../generated/type/tagLabel';
import { usePaging } from '../../../hooks/paging/usePaging';
import { useFqn } from '../../../hooks/useFqn';
import { getTableColumnsByFQN } from '../../../rest/tableAPI';
import { getPartialNameFromTableFQN } from '../../../utils/CommonUtils';
import {
  getEntityName,
  highlightSearchArrayElement,
} from '../../../utils/EntityUtils';
import { pruneEmptyChildren } from '../../../utils/TableUtils';
import { PagingHandlerParams } from '../../common/NextPrevious/NextPrevious.interface';
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
  const [allColumns, setAllColumns] = useState<Column[]>([]);
  const [selectedKeys, setSelectedKeys] = useState<string[]>(selectedSchema);
  const [isLoading, setIsLoading] = useState(false);

  const tableFqn = useMemo(
    () =>
      getPartialNameFromTableFQN(
        fqn,
        [FqnPart.Service, FqnPart.Database, FqnPart.Schema, FqnPart.Table],
        FQN_SEPARATOR_CHAR
      ),
    [fqn]
  );

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

  const fetchTableColumns = useCallback(
    async (page = 1) => {
      if (!tableFqn) {
        return;
      }

      setIsLoading(true);
      try {
        const offset = (page - 1) * pageSize;

        const response = await getTableColumnsByFQN(tableFqn, {
          limit: pageSize,
          offset: offset,
          fields: 'tags',
        });

        const prunedColumns = pruneEmptyChildren(response.data);
        setAllColumns(prunedColumns);
        handlePagingChange(response.paging);
      } catch {
        // Set empty state if API fails
        setAllColumns([]);
        handlePagingChange({
          offset: 1,
          limit: pageSize,
          total: 0,
        });
      }
      setIsLoading(false);
    },
    [tableFqn, pageSize]
  );

  const handleColumnsPageChange = useCallback(
    ({ currentPage }: PagingHandlerParams) => {
      fetchTableColumns(currentPage);
      handlePageChange(currentPage);
    },
    [fetchTableColumns]
  );

  const paginationProps = useMemo(
    () => ({
      currentPage,
      showPagination,
      isLoading: isLoading,
      isNumberBased: false,
      pageSize,
      paging,
      pagingHandler: handleColumnsPageChange,
      onShowSizeChange: handlePageSizeChange,
    }),
    [
      currentPage,
      showPagination,
      isLoading,
      pageSize,
      paging,
      handlePageSizeChange,
      handleColumnsPageChange,
    ]
  );

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
            newLook
            entityFqn={tableFqn}
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
        render: (tags: TagLabel[], record: Column, index: number) => {
          // To remove Source from the tag so that we can have consistant tag icon
          const newTags = tags.map((tag) => {
            return {
              tagFQN: tag.tagFQN,
              ...pick(
                tag,
                'description',
                'displayName',
                'labelType',
                'name',
                'style'
              ),
            } as TagLabel;
          });

          return (
            <TableTags<Column>
              isReadOnly
              newLook
              entityFqn={tableFqn}
              entityType={EntityType.TABLE}
              handleTagSelection={() => Promise.resolve()}
              hasTagEditAccess={false}
              index={index}
              record={record}
              tags={newTags}
              type={TagSource.Glossary}
            />
          );
        },
      },
      {
        title: t('label.constraint-plural'),
        dataIndex: 'constraint',
        key: 'constraint',
        render: renderConstraint,
      },
    ],
    [tableFqn]
  );

  useEffect(() => {
    fetchTableColumns();
  }, [fetchTableColumns]);

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
          customPaginationProps={paginationProps}
          dataSource={allColumns}
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
        <Button
          className="contract-prev-button"
          icon={<LeftOutlined />}
          type="default"
          onClick={onPrev}>
          {prevLabel ?? t('label.previous')}
        </Button>
        <Button
          className="contract-next-button"
          type="primary"
          onClick={onNext}>
          {nextLabel ?? t('label.next')}
          <RightOutlined />
        </Button>
      </div>
    </>
  );
};
