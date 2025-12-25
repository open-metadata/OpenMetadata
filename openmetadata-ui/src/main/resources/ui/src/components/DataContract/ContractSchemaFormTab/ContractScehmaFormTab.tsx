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
import Icon from '@ant-design/icons';
import { Button, Card, Tag, Typography } from 'antd';
import { ColumnsType } from 'antd/lib/table';
import { isEmpty, pick, uniqBy } from 'lodash';
import { Key, useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ReactComponent as LeftOutlined } from '../../../assets/svg/left-arrow.svg';
import { ReactComponent as RightIcon } from '../../../assets/svg/right-arrow.svg';
import { FQN_SEPARATOR_CHAR } from '../../../constants/char.constants';
import {
  NO_DATA_PLACEHOLDER,
  PAGE_SIZE_MEDIUM,
} from '../../../constants/constants';
import { TABLE_COLUMNS_KEYS } from '../../../constants/TableKeys.constants';
import {
  EntityType,
  FqnPart,
  TabSpecificField,
} from '../../../enums/entity.enum';
import { APIEndpoint } from '../../../generated/entity/data/apiEndpoint';
import { DataContract } from '../../../generated/entity/data/dataContract';
import { Column, Table } from '../../../generated/entity/data/table';
import { Field, Topic } from '../../../generated/entity/data/topic';
import { TagSource } from '../../../generated/tests/testCase';
import { TagLabel } from '../../../generated/type/tagLabel';
import { usePaging } from '../../../hooks/paging/usePaging';
import { useFqn } from '../../../hooks/useFqn';
import { getApiEndPointByFQN } from '../../../rest/apiEndpointsAPI';
import { getDataModelColumnsByFQN } from '../../../rest/dataModelsAPI';
import { getTableColumnsByFQN } from '../../../rest/tableAPI';
import { getTopicByFqn } from '../../../rest/topicsAPI';
import { getPartialNameFromTableFQN } from '../../../utils/CommonUtils';
import {
  getEntityName,
  highlightSearchArrayElement,
} from '../../../utils/EntityUtils';
import Fqn from '../../../utils/Fqn';
import {
  getTableExpandableConfig,
  pruneEmptyChildren,
} from '../../../utils/TableUtils';
import { useRequiredParams } from '../../../utils/useRequiredParams';
import { PagingHandlerParams } from '../../common/NextPrevious/NextPrevious.interface';
import AntTable from '../../common/Table/Table';
import { useGenericContext } from '../../Customization/GenericProvider/GenericProvider';
import { TableCellRendered } from '../../Database/SchemaTable/SchemaTable.interface';
import TableTags from '../../Database/TableTags/TableTags.component';

export const ContractSchemaFormTab: React.FC<{
  selectedSchema: Column[];
  onNext: () => void;
  onChange: (data: Partial<DataContract>) => void;
  onPrev: () => void;
  buttonProps: {
    nextLabel?: string;
    prevLabel?: string;
    isNextVisible?: boolean;
  };
}> = ({
  selectedSchema,
  onNext,
  onChange,
  onPrev,
  buttonProps: { nextLabel, prevLabel, isNextVisible = true },
}) => {
  const { t } = useTranslation();
  const { fqn } = useFqn();
  const { entityType } = useRequiredParams<{ entityType: EntityType }>();
  const { data: entityData } = useGenericContext();
  const [allColumnsData, setAllColumnsData] = useState<Column[] | Field[]>([]);
  const [columnsData, setColumnsData] = useState<Column[] | Field[]>([]);
  const [selectedKeys, setSelectedKeys] = useState<string[]>();
  const [isLoading, setIsLoading] = useState(false);
  const [expandedRowKeys, setExpandedRowKeys] = useState<string[]>([]);

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
      const selectedColumns =
        selectedRowKeys.length > 0
          ? allColumnsData.filter((column) =>
              selectedRowKeys.includes(column.fullyQualifiedName ?? '')
            )
          : [];

      onChange({
        schema: selectedColumns as unknown as Column[],
      });
    },
    [allColumnsData, onChange]
  );

  // Old Columns which are available in Contract but being Modified/Removed at Table Schema Level
  const oldRemovedColumns = useMemo(() => {
    switch (entityType) {
      case EntityType.TABLE:
      case EntityType.DASHBOARD_DATA_MODEL: {
        const columnsDataFQN = new Set(
          (entityData as Table).columns?.map((col) => col.fullyQualifiedName)
        );

        return selectedSchema.filter(
          (col) => !columnsDataFQN.has(col.fullyQualifiedName)
        );
      }

      case EntityType.TOPIC: {
        const schemaFieldsFQN = new Set(
          (entityData as Topic).messageSchema?.schemaFields?.map(
            (col) => col.fullyQualifiedName
          )
        );

        return selectedSchema.filter(
          (col) => !schemaFieldsFQN.has(col.fullyQualifiedName)
        );
      }
      case EntityType.API_ENDPOINT: {
        const schemaFieldsFQN = new Set(
          (entityData as APIEndpoint).responseSchema?.schemaFields?.map(
            (col) => col.fullyQualifiedName
          )
        );

        return selectedSchema.filter(
          (col) => !schemaFieldsFQN.has(col.fullyQualifiedName)
        );
      }

      default:
        return [];
    }
  }, [selectedSchema, entityData]);

  const fetchTableColumns = useCallback(
    async (page = 1) => {
      try {
        const offset = (page - 1) * pageSize;
        const response = await getTableColumnsByFQN(tableFqn, {
          limit: pageSize,
          offset: offset,
          fields: TabSpecificField.TAGS,
        });

        const prunedColumns = pruneEmptyChildren(response.data);
        const oldPrunedColumns = pruneEmptyChildren(oldRemovedColumns);
        // should render the oldPrunedColumns only on the first page, if there is pagination
        setColumnsData(
          offset === 0 ? [...oldPrunedColumns, ...prunedColumns] : prunedColumns
        );
        setAllColumnsData((prev) => {
          const combined = [
            ...(prev as Column[]),
            ...selectedSchema,
            ...oldPrunedColumns,
            ...prunedColumns,
          ];

          return uniqBy(combined, 'fullyQualifiedName');
        });

        handlePagingChange(response.paging);
      } catch {
        // Set empty state if API fails
        setColumnsData([]);
        handlePagingChange({
          offset: 1,
          limit: pageSize,
          total: 0,
        });
      }
      setIsLoading(false);
    },
    [tableFqn, pageSize, selectedSchema, oldRemovedColumns, setAllColumnsData]
  );

  const fetchDashboardDataModalColumns = useCallback(
    async (page = 1) => {
      try {
        const offset = (page - 1) * pageSize;
        const response = await getDataModelColumnsByFQN(fqn, {
          limit: pageSize,
          offset,
          fields: TabSpecificField.TAGS,
        });

        const prunedColumns = pruneEmptyChildren(response.data);
        const oldPrunedColumns = pruneEmptyChildren(oldRemovedColumns);
        // should render the oldPrunedColumns only on the first page, if there is pagination
        setColumnsData(
          offset === 0 ? [...oldPrunedColumns, ...prunedColumns] : prunedColumns
        );

        setAllColumnsData((prev) => {
          const combined = [
            ...(prev as Column[]),
            ...selectedSchema,
            ...oldPrunedColumns,
            ...prunedColumns,
          ];

          return uniqBy(combined, 'fullyQualifiedName');
        });

        handlePagingChange(response.paging);
      } catch {
        setAllColumnsData([]);
        handlePagingChange({
          offset: 1,
          limit: pageSize,
          total: 0,
        });
      }
      setIsLoading(false);
    },
    [fqn, pageSize, handlePagingChange]
  );

  const fetchTopicColumns = useCallback(async () => {
    try {
      const response = await getTopicByFqn(fqn, {
        fields: TabSpecificField.TAGS,
      });

      const schemaFields = response.messageSchema?.schemaFields ?? [];
      setColumnsData([
        ...(oldRemovedColumns as unknown as Field[]),
        ...schemaFields,
      ]);
      setAllColumnsData((prev) => {
        const combined = [
          ...(prev as unknown as Field[]),
          ...(selectedSchema as unknown as Field[]),
          ...(oldRemovedColumns as unknown as Field[]),
          ...schemaFields,
        ];

        return uniqBy(combined, 'fullyQualifiedName');
      });
    } catch {
      setAllColumnsData([]);
    }
    setIsLoading(false);
  }, [fqn]);

  const fetchApiEndPointColumns = async () => {
    try {
      const response = await getApiEndPointByFQN(fqn, {
        fields: TabSpecificField.TAGS,
      });

      const schemaFields = response.responseSchema?.schemaFields || [];
      setColumnsData([
        ...(oldRemovedColumns as unknown as Field[]),
        ...schemaFields,
      ]);

      setAllColumnsData((prev) => {
        const combined = [
          ...(prev as unknown as Field[]),
          ...(selectedSchema as unknown as Field[]),
          ...(oldRemovedColumns as unknown as Field[]),
          ...schemaFields,
        ];

        return uniqBy(combined, 'fullyQualifiedName');
      });
    } catch {
      setAllColumnsData([]);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchColumnsBasedOnEntity = useCallback(
    (currentPage?: number) => {
      if (!fqn) {
        return;
      }

      setIsLoading(true);

      switch (entityType) {
        case EntityType.TOPIC:
          fetchTopicColumns();

          break;

        case EntityType.API_ENDPOINT:
          fetchApiEndPointColumns();

          break;
        case EntityType.DASHBOARD_DATA_MODEL:
          fetchDashboardDataModalColumns(currentPage);

          break;

        default:
          fetchTableColumns(currentPage);
      }
    },
    [
      fqn,
      entityType,
      fetchTableColumns,
      fetchTopicColumns,
      fetchApiEndPointColumns,
      fetchDashboardDataModalColumns,
    ]
  );

  const handleColumnsPageChange = useCallback(
    ({ currentPage }: PagingHandlerParams) => {
      fetchColumnsBasedOnEntity(currentPage);
      handlePageChange(currentPage);
    },
    [fetchColumnsBasedOnEntity, handlePageChange]
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
          // To remove Source from the tag so that we can have consistent tag icon
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
      ...(entityType === EntityType.TABLE
        ? [
            {
              title: t('label.constraint-plural'),
              dataIndex: 'constraint',
              key: 'constraint',
              render: renderConstraint,
            },
          ]
        : []),
    ],
    [entityType, tableFqn]
  );

  const handleExpandedRowsChange = useCallback((keys: readonly Key[]) => {
    setExpandedRowKeys(keys as string[]);
  }, []);

  const schemaRecordDisabledEntity = useMemo(() => {
    switch (entityType) {
      case EntityType.TABLE:
        return 5; // 5 since FQN+Column = 4+1
      case EntityType.TOPIC:
        return 3; // 3 since FQN+Column = 2+1
      case EntityType.DASHBOARD_DATA_MODEL:
        return 4; // 4 since FQN+Column = 3+1
      case EntityType.API_ENDPOINT:
        return 5; // 5 since FQN+Column = 4+1

      default:
        return 3;
    }
  }, [entityType]);

  const tableCheckBoxProps = useCallback(
    (record: Column) => ({
      disabled:
        Fqn.split(record.fullyQualifiedName ?? '').length !==
        schemaRecordDisabledEntity,
    }),
    [schemaRecordDisabledEntity]
  );

  useEffect(() => {
    setSelectedKeys(
      selectedSchema.map((item) => item.fullyQualifiedName ?? '')
    );
  }, [selectedSchema]);

  useEffect(() => {
    fetchColumnsBasedOnEntity();
  }, []);

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
        <AntTable
          columns={columns}
          customPaginationProps={paginationProps}
          dataSource={columnsData}
          expandable={{
            ...getTableExpandableConfig<Field>(),
            rowExpandable: (record) => !isEmpty(record.children),
            onExpandedRowsChange: handleExpandedRowsChange,
            expandedRowKeys: expandedRowKeys,
          }}
          loading={isLoading}
          pagination={false}
          rowKey="fullyQualifiedName"
          rowSelection={{
            selectedRowKeys: selectedKeys,
            onChange: handleChangeTable,
            preserveSelectedRowKeys: true, // Preserve selections across page changes
            getCheckboxProps: tableCheckBoxProps,
          }}
        />
      </Card>
      <div className="d-flex justify-between m-t-md">
        <Button
          className="contract-prev-button"
          icon={<LeftOutlined height={22} width={20} />}
          type="default"
          onClick={onPrev}>
          {prevLabel ?? t('label.previous')}
        </Button>
        {isNextVisible && (
          <Button
            className="contract-next-button"
            type="primary"
            onClick={onNext}>
            {nextLabel ?? t('label.next')}
            <Icon component={RightIcon} />
          </Button>
        )}
      </div>
    </>
  );
};
