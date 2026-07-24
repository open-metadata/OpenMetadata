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
import { TableProps, Typography } from 'antd';
import { ColumnsType } from 'antd/lib/table';
import { groupBy, isEmpty, omit, uniqBy } from 'lodash';
import { EntityTags, TagFilterOptions } from 'Models';
import { lazy, useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { PAGE_SIZE_LARGE } from '../../../../../constants/constants';
import {
  COMMON_STATIC_TABLE_VISIBLE_COLUMNS,
  DEFAULT_DASHBOARD_DATA_MODEL_VISIBLE_COLUMNS,
  TABLE_COLUMNS_KEYS,
} from '../../../../../constants/TableKeys.constants';
import { EntityType, TabSpecificField } from '../../../../../enums/entity.enum';
import {
  Column,
  DashboardDataModel,
} from '../../../../../generated/entity/data/dashboardDataModel';
import { TagLabel, TagSource } from '../../../../../generated/type/tagLabel';
import { usePaging } from '../../../../../hooks/paging/usePaging';
import { useFqn } from '../../../../../hooks/useFqn';
import { useFqnDeepLink } from '../../../../../hooks/useFqnDeepLink';
import {
  getDataModelColumnsByFQN,
  searchDataModelColumnsByFQN,
  updateDataModelColumn,
} from '../../../../../rest/dataModelsAPI';
import { getEntityName } from '../../../../../utils/EntityNameUtils';
import { getColumnSorter } from '../../../../../utils/EntitySortUtils';
import { columnFilterIcon } from '../../../../../utils/TableColumn.util';
import {
  getExpandAllKeysToDepth,
  getHighlightedRowClassName,
  pruneEmptyChildren,
  updateColumnInNestedStructure,
} from '../../../../../utils/TablePureUtils';
import { getAllTags } from '../../../../../utils/TableTags/TableTags.utils';
import { getTableExpandableConfig } from '../../../../../utils/TableUtils';
import withSuspenseFallback from '../../../../AppRouter/withSuspenseFallback';
import DisplayName from '../../../../common/DisplayName/DisplayName';
import { EntityAttachmentProvider } from '../../../../common/EntityDescription/EntityAttachmentProvider/EntityAttachmentProvider';
import FilterTablePlaceHolder from '../../../../common/ErrorWithPlaceholder/FilterTablePlaceHolder';
import { PagingHandlerParams } from '../../../../common/NextPrevious/NextPrevious.interface';
import Table from '../../../../common/Table/Table';
import { useGenericContext } from '../../../../Customization/GenericProvider/GenericContext';
import { ColumnFilter } from '../../../../Database/ColumnFilter/ColumnFilter.component';
import TableDescription from '../../../../Database/TableDescription/TableDescription.component';
import TableTags from '../../../../Database/TableTags/TableTags.component';
import {
  EntityName,
  EntityNameWithAdditionFields,
} from '../../../../Modals/EntityNameModal/EntityNameModal.interface';

const ModalWithMarkdownEditor = withSuspenseFallback(
  lazy(() =>
    import(
      '../../../../Modals/ModalWithMarkdownEditor/ModalWithMarkdownEditor'
    ).then((m) => ({ default: m.ModalWithMarkdownEditor }))
  )
);

const ModelTab = () => {
  const { t } = useTranslation();

  const [editColumnDescription, setEditColumnDescription] = useState<Column>();
  const [_expandedRowKeys, setExpandedRowKeys] = useState<string[]>([]);
  const [searchText, setSearchText] = useState('');
  const [activeTagFilter, setActiveTagFilter] = useState<{
    tags: string[];
    glossaryTerms: string[];
  }>({ tags: [], glossaryTerms: [] });

  const tagsParam = activeTagFilter.tags.join(',');
  const glossaryTermsParam = activeTagFilter.glossaryTerms.join(',');
  const hasTagFilter = Boolean(tagsParam || glossaryTermsParam);
  const { openColumnDetailPanel, selectedColumn, setDisplayedColumns } =
    useGenericContext<DashboardDataModel>();

  const [paginatedColumns, setPaginatedColumns] = useState<Column[]>([]);
  const [columnsLoading, setColumnsLoading] = useState(true);

  const {
    currentPage,
    pageSize,
    handlePageChange,
    handlePageSizeChange,
    showPagination,
    paging,
    handlePagingChange,
  } = usePaging(PAGE_SIZE_LARGE);

  const { data: dataModel, permissions } =
    useGenericContext<DashboardDataModel>();
  const { fullyQualifiedName: entityFqn, deleted: isReadOnly } = dataModel;

  const { columnFqn: columnPart, fqn } = useFqn({
    type: EntityType.DASHBOARD_DATA_MODEL,
  });

  useFqnDeepLink({
    data: paginatedColumns,
    columnPart,
    fqn,
    setExpandedRowKeys: setExpandedRowKeys,
    openColumnDetailPanel,
    selectedColumn: selectedColumn as Column | null,
  });

  const getRowClassName = useCallback(
    (record: Column) => getHighlightedRowClassName(record, fqn),
    [fqn]
  );

  // Always use paginated columns, never dataModel.columns directly
  const data = paginatedColumns;

  // Function to fetch paginated columns or search results
  const fetchPaginatedColumns = useCallback(
    async (page = 1, searchQuery?: string) => {
      if (!entityFqn) {
        return;
      }

      setColumnsLoading(true);
      try {
        const offset = (page - 1) * pageSize;

        // Use search API when there's a search query or an active tag filter,
        // otherwise use regular pagination
        const response =
          searchQuery || hasTagFilter
            ? await searchDataModelColumnsByFQN(entityFqn, {
                limit: pageSize,
                offset,
                fields: TabSpecificField.TAGS,
                q: searchQuery ?? '',
                ...(tagsParam ? { tags: tagsParam } : {}),
                ...(glossaryTermsParam
                  ? { glossaryTerms: glossaryTermsParam }
                  : {}),
              })
            : await getDataModelColumnsByFQN(entityFqn, {
                limit: pageSize,
                offset,
                fields: TabSpecificField.TAGS,
              });

        const data = pruneEmptyChildren(response.data) || [];
        setPaginatedColumns(data);
        handlePagingChange(response.paging);
      } catch {
        setPaginatedColumns([]);
        handlePagingChange({
          offset: 1,
          limit: pageSize,
          total: 0,
        });
      }
      setColumnsLoading(false);
    },
    [
      entityFqn,
      pageSize,
      handlePagingChange,
      hasTagFilter,
      tagsParam,
      glossaryTermsParam,
    ]
  );

  const handleColumnsPageChange = useCallback(
    ({ currentPage }: PagingHandlerParams) => {
      fetchPaginatedColumns(currentPage, searchText);

      handlePageChange(currentPage);
    },
    [paging, fetchPaginatedColumns, searchText, handlePageChange]
  );

  const handleColumnFilterChange = useCallback<
    NonNullable<TableProps<Column>['onChange']>
  >(
    (_pagination, tableFilters, _sorter, extra) => {
      // AntD fires onChange for sort/paginate too; only react to filter changes
      if (extra.action !== 'filter') {
        return;
      }

      const tags = (tableFilters?.[TABLE_COLUMNS_KEYS.TAGS] as string[]) ?? [];
      const glossaryTerms =
        (tableFilters?.[TABLE_COLUMNS_KEYS.GLOSSARY] as string[]) ?? [];
      setActiveTagFilter({ tags, glossaryTerms });
      handlePageChange(1);
    },
    [handlePageChange]
  );

  const { deleted } = useMemo(
    () => ({
      deleted: dataModel?.deleted,
    }),
    [dataModel]
  );
  const {
    hasEditDescriptionPermission,
    hasEditTagsPermission,
    hasEditGlossaryTermPermission,
    editDisplayNamePermission,
  } = useMemo(() => {
    return {
      hasEditDescriptionPermission:
        permissions.EditAll || permissions.EditDescription,
      hasEditTagsPermission: permissions.EditAll || permissions.EditTags,
      hasEditGlossaryTermPermission:
        permissions.EditAll || permissions.EditGlossaryTerms,
      editDisplayNamePermission:
        (permissions.EditDisplayName || permissions.EditAll) && !deleted,
    };
  }, [permissions]);

  const tagFilter = useMemo(() => {
    const tags = getAllTags([...(dataModel?.columns ?? []), ...(data ?? [])]);

    return groupBy(uniqBy(tags, 'value'), (tag) => tag.source) as Record<
      TagSource,
      TagFilterOptions[]
    >;
  }, [dataModel?.columns, data]);

  useEffect(() => {
    if (entityFqn) {
      fetchPaginatedColumns(1, searchText || undefined);
    }
  }, [entityFqn, searchText, fetchPaginatedColumns, pageSize, dataModel]);

  useEffect(() => {
    setExpandedRowKeys((prev) => {
      const depth = searchText || hasTagFilter ? Number.MAX_SAFE_INTEGER : 1;
      const autoKeys = getExpandAllKeysToDepth(paginatedColumns ?? [], depth);

      return [...new Set([...autoKeys, ...prev])];
    });
  }, [paginatedColumns, searchText, hasTagFilter]);

  // Sync displayed columns with GenericProvider for ColumnDetailPanel navigation
  useEffect(() => {
    setDisplayedColumns(paginatedColumns);
  }, [paginatedColumns, setDisplayedColumns]);

  const updateColumnDetails = async (
    columnFqn: string,
    column: Partial<Column>,
    field: keyof Column
  ) => {
    const response = await updateDataModelColumn(columnFqn, column);
    const cleanResponse = isEmpty(response.children)
      ? omit(response, 'children')
      : response;

    setPaginatedColumns((prev) =>
      updateColumnInNestedStructure(prev, columnFqn, cleanResponse, field)
    );

    return response;
  };

  const handleFieldTagsChange = useCallback(
    async (selectedTags: EntityTags[], editColumnTag: Column) => {
      if (editColumnTag.fullyQualifiedName) {
        await updateColumnDetails(
          editColumnTag.fullyQualifiedName,
          {
            tags: selectedTags,
          },
          'tags'
        );
      }
    },
    [updateColumnDetails]
  );

  const handleColumnDescriptionChange = useCallback(
    async (updatedDescription: string) => {
      if (editColumnDescription?.fullyQualifiedName) {
        await updateColumnDetails(
          editColumnDescription.fullyQualifiedName,
          {
            description: updatedDescription,
          },
          'description'
        );

        setEditColumnDescription(undefined);
      }
    },
    [updateColumnDetails, editColumnDescription]
  );

  const handleEditColumnData = async (
    data: EntityName,
    fullyQualifiedName?: string
  ) => {
    const { displayName } = data as EntityNameWithAdditionFields;

    if (!fullyQualifiedName) {
      return; // Early return if id is not provided
    }

    await updateColumnDetails(
      fullyQualifiedName,
      {
        displayName,
      },
      'displayName'
    );
  };

  const handleColumnClick = useCallback(
    (column: Column, event: React.MouseEvent) => {
      const target = event.target as HTMLElement;
      if (
        target.closest(
          'button, a, input, textarea, select, .table-expand-icon'
        ) !== null
      ) {
        return;
      }
      openColumnDetailPanel(column);
    },
    [openColumnDetailPanel]
  );

  const searchProps = useMemo(
    () => ({
      placeholder: t('message.find-in-table'),
      value: searchText,
      onSearch: (value: string) => {
        setSearchText(value);
        handlePageChange(1);
      },
      onClear: () => setSearchText(''),
    }),
    [searchText, handlePageChange, t]
  );

  const paginationProps = useMemo(
    () => ({
      currentPage,
      showPagination,
      isLoading: columnsLoading,
      isNumberBased: Boolean(searchText || hasTagFilter),
      pageSize,
      paging,
      pagingHandler: handleColumnsPageChange,
      onShowSizeChange: handlePageSizeChange,
    }),
    [
      currentPage,
      showPagination,
      columnsLoading,
      searchText,
      hasTagFilter,
      pageSize,
      paging,
      handleColumnsPageChange,
      handlePageSizeChange,
    ]
  );

  const tableColumn: ColumnsType<Column> = useMemo(
    () => [
      {
        title: t('label.name'),
        dataIndex: TABLE_COLUMNS_KEYS.NAME,
        key: TABLE_COLUMNS_KEYS.NAME,
        width: 250,
        fixed: 'left',
        className: 'cursor-pointer text-link-color',
        sorter: getColumnSorter<Column, 'name'>('name'),
        onCell: (record: Column) => ({
          onClick: (event: React.MouseEvent) =>
            handleColumnClick(record, event),
          'data-testid': 'column-name-cell',
        }),
        render: (_, record: Column) => {
          const { displayName } = record;

          return (
            <DisplayName
              displayName={displayName}
              entityType={EntityType.DASHBOARD_DATA_MODEL}
              hasEditPermission={editDisplayNamePermission}
              id={record.fullyQualifiedName ?? ''}
              name={record.name}
              parentEntityFqn={entityFqn}
              onEditDisplayName={handleEditColumnData}
            />
          );
        },
      },
      {
        title: t('label.type'),
        dataIndex: TABLE_COLUMNS_KEYS.DATA_TYPE,
        key: TABLE_COLUMNS_KEYS.DATA_TYPE,
        width: 100,
        render: (dataType, record) => (
          <Typography.Text>
            {record.dataTypeDisplay || dataType}
          </Typography.Text>
        ),
      },
      {
        title: t('label.description'),
        dataIndex: TABLE_COLUMNS_KEYS.DESCRIPTION,
        key: TABLE_COLUMNS_KEYS.DESCRIPTION,
        width: 350,
        render: (_, record, index) => (
          <TableDescription
            columnData={{
              fqn: record.fullyQualifiedName ?? '',
              field: record.description,
            }}
            entityFqn={entityFqn ?? ''}
            entityType={EntityType.DASHBOARD_DATA_MODEL}
            hasEditPermission={hasEditDescriptionPermission}
            index={index}
            isReadOnly={isReadOnly}
            onClick={() => setEditColumnDescription(record)}
          />
        ),
      },
      {
        title: t('label.tag-plural'),
        dataIndex: TABLE_COLUMNS_KEYS.TAGS,
        key: TABLE_COLUMNS_KEYS.TAGS,
        width: 250,
        filters: tagFilter.Classification,
        filterIcon: columnFilterIcon,
        filterDropdown: ColumnFilter,
        filteredValue: activeTagFilter.tags.length
          ? activeTagFilter.tags
          : null,
        render: (tags: TagLabel[], record: Column, index: number) => (
          <TableTags<Column>
            entityFqn={entityFqn ?? ''}
            entityType={EntityType.DASHBOARD_DATA_MODEL}
            handleTagSelection={handleFieldTagsChange}
            hasTagEditAccess={hasEditTagsPermission}
            index={index}
            isReadOnly={isReadOnly}
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
        width: 250,
        filterIcon: columnFilterIcon,
        filters: tagFilter.Glossary,
        filterDropdown: ColumnFilter,
        filteredValue: activeTagFilter.glossaryTerms.length
          ? activeTagFilter.glossaryTerms
          : null,
        render: (tags: TagLabel[], record: Column, index: number) => (
          <TableTags<Column>
            entityFqn={entityFqn ?? ''}
            entityType={EntityType.DASHBOARD_DATA_MODEL}
            handleTagSelection={handleFieldTagsChange}
            hasTagEditAccess={hasEditGlossaryTermPermission}
            index={index}
            isReadOnly={isReadOnly}
            record={record}
            tags={tags}
            type={TagSource.Glossary}
          />
        ),
      },
    ],
    [
      entityFqn,
      isReadOnly,
      tagFilter,
      activeTagFilter,
      hasEditTagsPermission,
      hasEditGlossaryTermPermission,
      editColumnDescription,
      hasEditDescriptionPermission,
      handleFieldTagsChange,
      handleColumnClick,
      editDisplayNamePermission,
      handleEditColumnData,
    ]
  );

  return (
    <>
      <Table
        className="p-t-xs align-table-filter-left"
        columns={tableColumn}
        customPaginationProps={paginationProps}
        data-testid="data-model-column-table"
        dataSource={data}
        defaultVisibleColumns={DEFAULT_DASHBOARD_DATA_MODEL_VISIBLE_COLUMNS}
        expandable={{
          ...getTableExpandableConfig<Column>(false, 'text-link-color'),
          rowExpandable: (record) => !isEmpty(record.children),
        }}
        loading={columnsLoading}
        locale={{
          emptyText: <FilterTablePlaceHolder />,
        }}
        pagination={false}
        rowClassName={getRowClassName}
        rowKey="fullyQualifiedName"
        scroll={{ x: 1200 }}
        searchProps={searchProps}
        size="small"
        staticVisibleColumns={COMMON_STATIC_TABLE_VISIBLE_COLUMNS}
        onChange={handleColumnFilterChange}
      />

      {editColumnDescription && (
        <EntityAttachmentProvider
          entityFqn={editColumnDescription.fullyQualifiedName}
          entityType={EntityType.DASHBOARD_DATA_MODEL}>
          <ModalWithMarkdownEditor
            header={`${t('label.edit-entity', {
              entity: t('label.column'),
            })}: "${getEntityName(editColumnDescription)}"`}
            placeholder={t('label.enter-field-description', {
              field: t('label.column'),
            })}
            value={editColumnDescription.description || ''}
            visible={Boolean(editColumnDescription)}
            onCancel={() => setEditColumnDescription(undefined)}
            onSave={handleColumnDescriptionChange}
          />
        </EntityAttachmentProvider>
      )}
    </>
  );
};

export default ModelTab;
