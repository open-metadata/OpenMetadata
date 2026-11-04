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
import { Badge, Typography } from '@openmetadata/ui-core-components';
import { isEmpty, uniqBy } from 'lodash';
import { Key, useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
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
import { TagLabel } from '../../../generated/type/tagLabel';
import { usePaging } from '../../../hooks/paging/usePaging';
import { useFqn } from '../../../hooks/useFqn';
import { getApiEndPointByFQN } from '../../../rest/apiEndpointsAPI';
import { getDataModelColumnsByFQN } from '../../../rest/dataModelsAPI';
import { getTableColumnsByFQN } from '../../../rest/tableAPI';
import { getTopicByFqn } from '../../../rest/topicsAPI';
import { getEntityName } from '../../../utils/EntityNameUtils';
import { highlightSearchArrayElement } from '../../../utils/EntitySearchUtils';
import Fqn from '../../../utils/Fqn';
import { getPartialNameFromTableFQN } from '../../../utils/FqnUtils';
import { pruneEmptyChildren } from '../../../utils/TablePureUtils';
import { getTableExpandableConfig } from '../../../utils/TableUtils';
import {
  getClassificationTags,
  getGlossaryTags,
} from '../../../utils/TagsPureUtils';
import { useRequiredParams } from '../../../utils/useRequiredParams';
import { PagingHandlerParams } from '../../common/NextPrevious/NextPrevious.interface';
import { ColumnsType } from '../../common/Table/Table.interface';
import TableV2 from '../../common/Table/TableV2';
import { useGenericContext } from '../../Customization/GenericProvider/GenericContext';
import TagsViewer from '../../Tag/TagsViewer/TagsViewer';
import { ContractFormStep } from '../ContractFormStep/ContractFormStep';

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
  const renderDataTypeDisplay = (
    dataTypeDisplay: Column['dataTypeDisplay'],
    record: Column | Field
  ) => {
    const displayValue = isEmpty(dataTypeDisplay)
      ? record.dataType
      : dataTypeDisplay;

    if (isEmpty(displayValue)) {
      return NO_DATA_PLACEHOLDER;
    }

    return (
      <Badge
        bordered={false}
        className="tw:mr-2 tw:inline-flex tw:max-w-full tw:whitespace-normal tw:font-medium tw:cursor-pointer"
        color="purple"
        size="sm"
        title={displayValue}
        type="color">
        {highlightSearchArrayElement(dataTypeDisplay, '')}
      </Badge>
    );
  };

  const renderConstraint = (constraint: Column['constraint']) => {
    if (isEmpty(constraint)) {
      return NO_DATA_PLACEHOLDER;
    }

    return (
      <Badge
        bordered={false}
        className="tw:mr-2 tw:inline-flex tw:max-w-full tw:whitespace-normal tw:font-medium tw:cursor-pointer"
        color="blue"
        size="sm"
        title={constraint}
        type="color">
        {constraint}
      </Badge>
    );
  };

  const columns = useMemo<ColumnsType<Column | Field>>(
    () => [
      {
        title: t('label.name'),
        dataIndex: TABLE_COLUMNS_KEYS.NAME,
        key: TABLE_COLUMNS_KEYS.NAME,
        render: (_: unknown, record: Column | Field) => (
          <Typography className="schema-table-name tw:text-primary">
            {getEntityName(record)}
          </Typography>
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
        render: (tags: TagLabel[]) => (
          <TagsViewer sizeCap={1} tags={getClassificationTags(tags)} />
        ),
      },
      {
        title: t('label.glossary-term-plural'),
        dataIndex: TABLE_COLUMNS_KEYS.TAGS,
        key: TABLE_COLUMNS_KEYS.GLOSSARY,
        render: (tags: TagLabel[]) => (
          <TagsViewer sizeCap={1} tags={getGlossaryTags(tags)} />
        ),
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
    [entityType]
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
    (record: Column | Field) => ({
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
    <ContractFormStep
      description={t('message.data-contract-schema-description')}
      isNextVisible={isNextVisible}
      nextLabel={nextLabel}
      prevLabel={prevLabel}
      title={t('label.schema')}
      onNext={onNext}
      onPrev={onPrev}>
      <TableV2
        columns={columns}
        customPaginationProps={paginationProps}
        dataSource={columnsData}
        expandable={{
          ...getTableExpandableConfig<Column | Field>(),
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
    </ContractFormStep>
  );
};
