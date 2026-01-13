/*
 *  Copyright 2022 Collate.
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

import { Button, Col, Form, Row, Select, Tooltip, Typography } from 'antd';
import { ColumnsType } from 'antd/lib/table';
import { ExpandableConfig } from 'antd/lib/table/interface';
import { AxiosError } from 'axios';
import classNames from 'classnames';
import { groupBy, isEmpty, isEqual, isUndefined, omit, uniqBy } from 'lodash';
import { EntityTags, TagFilterOptions } from 'Models';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { ReactComponent as IconEdit } from '../../../assets/svg/edit-new.svg';
import { FQN_SEPARATOR_CHAR } from '../../../constants/char.constants';
import {
  DE_ACTIVE_COLOR,
  ICON_DIMENSION,
  INITIAL_PAGING_VALUE,
  NO_DATA_PLACEHOLDER,
  PAGE_SIZE_LARGE,
} from '../../../constants/constants';
import {
  COLUMN_CONSTRAINT_TYPE_OPTIONS,
  TABLE_SCROLL_VALUE,
} from '../../../constants/Table.constants';
import {
  COMMON_STATIC_TABLE_VISIBLE_COLUMNS,
  DEFAULT_SCHEMA_TABLE_VISIBLE_COLUMNS,
  TABLE_COLUMNS_KEYS,
} from '../../../constants/TableKeys.constants';
import { EntityType, FqnPart } from '../../../enums/entity.enum';
import {
  Column,
  Table as TableType,
} from '../../../generated/entity/data/table';
import {
  Suggestion,
  SuggestionType,
} from '../../../generated/entity/feed/suggestion';
import { TestSummary } from '../../../generated/tests/testCase';
import { TagSource } from '../../../generated/type/schema';
import { TagLabel } from '../../../generated/type/tagLabel';
import { usePaging } from '../../../hooks/paging/usePaging';
import { useFqn } from '../../../hooks/useFqn';
import { useScrollToElement } from '../../../hooks/useScrollToElement';
import { useFqnDeepLink } from '../../../hooks/useFqnDeepLink';
import { useSub } from '../../../hooks/usePubSub';
import { useTableFilters } from '../../../hooks/useTableFilters';
import {
  getTableColumnsByFQN,
  searchTableColumnsByFQN,
  updateTableColumn,
} from '../../../rest/tableAPI';
import { getTestCaseExecutionSummary } from '../../../rest/testAPI';
import { buildColumnFqn, getPartialNameFromTableFQN } from '../../../utils/CommonUtils';
import { getBulkEditButton } from '../../../utils/EntityBulkEdit/EntityBulkEditUtils';
import {
  getColumnSorter,
  getEntityBulkEditPath,
  getEntityName,
  getFrequentlyJoinedColumns,
  highlightSearchArrayElement,
  highlightSearchText,
} from '../../../utils/EntityUtils';
import { getEntityColumnFQN } from '../../../utils/FeedUtils';
import { stringToHTML } from '../../../utils/StringsUtils';
import { columnFilterIcon } from '../../../utils/TableColumn.util';
import {
  getAllTags,
  searchTagInData,
} from '../../../utils/TableTags/TableTags.utils';
import {
  findColumnByEntityLink,
  getAllRowKeysByKeyName,
  getTableExpandableConfig,
  prepareConstraintIcon,
  pruneEmptyChildren,
  updateColumnInNestedStructure,
} from '../../../utils/TableUtils';
import { showErrorToast } from '../../../utils/ToastUtils';
import CopyLinkButton from '../../common/CopyLinkButton/CopyLinkButton';
import { EntityAttachmentProvider } from '../../common/EntityDescription/EntityAttachmentProvider/EntityAttachmentProvider';
import FilterTablePlaceHolder from '../../common/ErrorWithPlaceholder/FilterTablePlaceHolder';
import { PagingHandlerParams } from '../../common/NextPrevious/NextPrevious.interface';
import Table from '../../common/Table/Table';
import TestCaseStatusSummaryIndicator from '../../common/TestCaseStatusSummaryIndicator/TestCaseStatusSummaryIndicator.component';
import { useGenericContext } from '../../Customization/GenericProvider/GenericProvider';
import EntityNameModal from '../../Modals/EntityNameModal/EntityNameModal.component';
import {
  EntityName,
  EntityNameWithAdditionFields,
} from '../../Modals/EntityNameModal/EntityNameModal.interface';
import { ModalWithMarkdownEditor } from '../../Modals/ModalWithMarkdownEditor/ModalWithMarkdownEditor';
import { ColumnFilter } from '../ColumnFilter/ColumnFilter.component';
import TableDescription from '../TableDescription/TableDescription.component';
import TableTags from '../TableTags/TableTags.component';
import { TableCellRendered } from './SchemaTable.interface';

const SchemaTable = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [testCaseSummary, setTestCaseSummary] = useState<TestSummary>();
  const [expandedRowKeys, setExpandedRowKeys] = useState<string[]>([]);
  const [editColumn, setEditColumn] = useState<Column>();

  const {
    currentPage,
    pageSize,
    handlePageChange,
    handlePageSizeChange,
    showPagination,
    paging,
    handlePagingChange,
  } = usePaging(PAGE_SIZE_LARGE);

  const { filters, setFilters } = useTableFilters({
    columnSearch: undefined as string | undefined,
  });

  const searchText = filters.columnSearch ?? '';

  // Pagination state for columns
  const [tableColumns, setTableColumns] = useState<Column[]>([]);
  const [columnsLoading, setColumnsLoading] = useState(true); // Start with loading state
  const [hasInitialLoad, setHasInitialLoad] = useState(false);
  const [prevTableColumns, setPrevTableColumns] = useState<
    Column[] | undefined
  >();
  const { fqn: decodedEntityFqn } = useFqn();

  const [editColumnDisplayName, setEditColumnDisplayName] = useState<Column>();

  const {
    permissions: tablePermissions,
    data: table,
    onThreadLinkSelect,
    openColumnDetailPanel,
  } = useGenericContext<TableType>();

  const { tableFqn, columnPart } = useMemo(() => {
    const parts = decodedEntityFqn.split(FQN_SEPARATOR_CHAR);

    if (parts.length > 4) {
      const tableParts = parts.slice(0, 4);
      const columnParts = parts.slice(4);

      return {
        tableFqn: tableParts.join(FQN_SEPARATOR_CHAR),
        columnPart: columnParts.join(FQN_SEPARATOR_CHAR),
      };
    }

    return {
      tableFqn: decodedEntityFqn,
      columnPart: undefined,
    };
  }, [decodedEntityFqn]);

  const highlightedColumnFqn = useMemo(() => {
    if (!columnPart) {return undefined;}

    return buildColumnFqn(tableFqn, decodeURIComponent(columnPart));
  }, [columnPart, tableFqn]);

  useFqnDeepLink({
    data: table.columns || [],
    tableFqn,
    columnPart,
    setExpandedRowKeys: setExpandedRowKeys,
    openColumnDetailPanel,
  });

  const { testCaseCounts, joins, tableConstraints, deleted } = useMemo(
    () => ({
      testCaseCounts: testCaseSummary?.columnTestSummary ?? [],
      joins: table?.joins?.columnJoins ?? [],
      tableConstraints: table?.tableConstraints,
      deleted: table?.deleted,
    }),
    [testCaseSummary, table]
  );

  useScrollToElement(
    '.highlighted-row',
    Boolean(highlightedColumnFqn && tableColumns.length > 0 && !columnsLoading)
  );

  const getRowClassName = useCallback(
    (record: Column) => {
      if (highlightedColumnFqn && record.fullyQualifiedName) {
        // Check if this row matches the highlighted FQN
        if (record.fullyQualifiedName === highlightedColumnFqn) {
          return 'highlighted-row';
        }
      }

      return '';
    },
    [highlightedColumnFqn]
  );

  const {
    editTagsPermission,
    editGlossaryTermsPermission,
    editDescriptionPermission,
    editDisplayNamePermission,
  } = useMemo(
    () => ({
      editTagsPermission:
        (tablePermissions.EditTags || tablePermissions.EditAll) && !deleted,
      editDescriptionPermission:
        (tablePermissions.EditDescription || tablePermissions.EditAll) &&
        !deleted,
      editGlossaryTermsPermission:
        (tablePermissions.EditGlossaryTerms || tablePermissions.EditAll) &&
        !deleted,
      editDisplayNamePermission:
        (tablePermissions.EditDisplayName || tablePermissions.EditAll) &&
        !deleted,
    }),
    [tablePermissions, deleted]
  );

  const searchTableColumns = useCallback(
    async (searchQuery: string, page = 1) => {
      if (!tableFqn) {
        return;
      }

      setColumnsLoading(true);
      try {
        const offset = (page - 1) * pageSize;

        const response = await searchTableColumnsByFQN(tableFqn, {
          q: searchQuery,
          limit: pageSize,
          offset: offset,
          fields: 'tags,customMetrics',
        });

        setTableColumns(pruneEmptyChildren(response.data) || []);
        handlePagingChange(response.paging);
      } catch {
        setTableColumns([]);
        handlePagingChange({
          offset: 1,
          limit: pageSize,
          total: 0,
        });
      } finally {
        setColumnsLoading(false);
      }
    },
    [tableFqn, pageSize, handlePagingChange]
  );

  const fetchTableColumns = useCallback(
    async (page = 1) => {
      if (!tableFqn) {
        return;
      }

      setColumnsLoading(true);
      try {
        const offset = (page - 1) * pageSize;

        const response = await getTableColumnsByFQN(tableFqn, {
          limit: pageSize,
          offset: offset,
          fields: 'tags,customMetrics',
        });

        setTableColumns(pruneEmptyChildren(response.data) || []);
        handlePagingChange(response.paging);
      } catch {
        setTableColumns([]);
        handlePagingChange({
          offset: 1,
          limit: pageSize,
          total: 0,
        });
      } finally {
        setColumnsLoading(false);
      }
    },
    [tableFqn, pageSize, handlePagingChange]
  );

  const handleColumnsPageChange = useCallback(
    ({ currentPage }: PagingHandlerParams) => {
      handlePageChange(currentPage);
    },
    [handlePageChange]
  );

  const fetchTestCaseSummary = async () => {
    try {
      const response = await getTestCaseExecutionSummary(table?.testSuite?.id);
      setTestCaseSummary(response);
    } catch {
      setTestCaseSummary(undefined);
    }
  };

  useEffect(() => {
    fetchTestCaseSummary();
  }, [tableFqn]);

  useEffect(() => {
    if (searchText) {
      searchTableColumns(searchText, currentPage);
    }
  }, [searchText, currentPage, searchTableColumns]);

  useEffect(() => {
    if (searchText) {
      return;
    }
    fetchTableColumns(currentPage);
  }, [tableFqn, pageSize, currentPage, searchText, fetchTableColumns]);

  useEffect(() => {
    if (!isEmpty(tableColumns)) {
      setHasInitialLoad(true);
    }
  }, [tableColumns]);

  useEffect(() => {
    if (!hasInitialLoad || !table?.columns) {
      return;
    }

    const columnsChanged = !isEqual(prevTableColumns, table.columns);

    if (!columnsChanged) {
      return;
    }

    setPrevTableColumns(table.columns);
  }, [table?.columns, hasInitialLoad]);

  const updateDescriptionTagFromSuggestions = useCallback(
    (suggestion: Suggestion) => {
      setTableColumns((prev) => {
        if (!prev) {
          return prev;
        }

        const activeCol = findColumnByEntityLink(
          tableFqn ?? '',
          prev,
          suggestion.entityLink
        );

        if (activeCol) {
          const update =
            suggestion.type === SuggestionType.SuggestDescription
              ? { description: suggestion.description }
              : { tags: suggestion.tagLabels };

          // Update the column in the nested structure
          const updatedColumns = updateColumnInNestedStructure(
            prev,
            activeCol.fullyQualifiedName ?? '',
            update
          );

          return updatedColumns;
        }

        return prev;
      });
    },
    []
  );

  useSub(
    'updateDetails',
    (suggestion: Suggestion) => {
      updateDescriptionTagFromSuggestions(suggestion);
    },
    [tableColumns]
  );

  const handleEditColumn = (column: Column): void => {
    setEditColumn(column);
  };
  const closeEditColumnModal = (): void => {
    setEditColumn(undefined);
  };

  const updateColumnDetails = async (
    columnFqn: string,
    column: Partial<Column>,
    field?: keyof Column
  ) => {
    const response = await updateTableColumn(columnFqn, column);
    const cleanResponse = isEmpty(response.children)
      ? omit(response, 'children')
      : response;

    setTableColumns((prev) =>
      prev.map((col) =>
        col.fullyQualifiedName === columnFqn
          ? // Have to omit the field which is being updated to avoid persisted old value
            { ...omit(col, field ?? ''), ...cleanResponse }
          : col
      )
    );

    return response;
  };

  const handleEditColumnChange = async (columnDescription: string) => {
    if (!isUndefined(editColumn) && editColumn.fullyQualifiedName) {
      try {
        await updateColumnDetails(
          editColumn.fullyQualifiedName,
          {
            description: columnDescription,
          },
          'description'
        );
      } catch (error) {
        showErrorToast(error as AxiosError);
      } finally {
        setEditColumn(undefined);
      }
    } else {
      setEditColumn(undefined);
    }
  };

  const handleTagSelection = async (
    selectedTags: EntityTags[],
    editColumnTag: Column
  ) => {
    if (selectedTags && editColumnTag.fullyQualifiedName) {
      try {
        await updateColumnDetails(
          editColumnTag.fullyQualifiedName,
          {
            tags: selectedTags,
          },
          'tags'
        );
      } catch (error) {
        showErrorToast(error as AxiosError);
      }
    }
  };

  const handleUpdate = (column: Column) => {
    handleEditColumn(column);
  };

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
      <Typography.Paragraph
        className="cursor-pointer"
        ellipsis={{ tooltip: displayValue, rows: 3 }}>
        {highlightSearchArrayElement(dataTypeDisplay, searchText)}
      </Typography.Paragraph>
    );
  };

  const renderDescription: TableCellRendered<Column, 'description'> = (
    _,
    record,
    index
  ) => {
    return (
      <>
        <TableDescription
          columnData={{
            fqn: record.fullyQualifiedName ?? '',
            field: highlightSearchText(record.description, searchText),
            record,
          }}
          entityFqn={tableFqn}
          entityType={EntityType.TABLE}
          hasEditPermission={editDescriptionPermission}
          index={index}
          isReadOnly={deleted}
          onClick={() => handleUpdate(record)}
        />
        {getFrequentlyJoinedColumns(
          record?.name,
          joins,
          t('label.frequently-joined-column-plural')
        )}
      </>
    );
  };

  const expandableConfig: ExpandableConfig<Column> = useMemo(
    () => ({
      ...getTableExpandableConfig<Column>(),
      rowExpandable: (record) => !isEmpty(record.children),
      expandedRowKeys,
      onExpand: (expanded, record) => {
        setExpandedRowKeys(
          expanded
            ? [...expandedRowKeys, record.fullyQualifiedName ?? '']
            : expandedRowKeys.filter((key) => key !== record.fullyQualifiedName)
        );
      },
    }),
    [expandedRowKeys]
  );

  const handleEditDisplayNameClick = (record: Column) => {
    setEditColumnDisplayName(record);
  };

  const handleEditColumnData = async (data: EntityName) => {
    const { displayName, constraint } = data as EntityNameWithAdditionFields;
    if (
      !isUndefined(editColumnDisplayName) &&
      editColumnDisplayName.fullyQualifiedName
    ) {
      try {
        await updateColumnDetails(
          editColumnDisplayName.fullyQualifiedName,
          {
            displayName: displayName,
            ...(isEmpty(constraint)
              ? {
                  removeConstraint: true,
                }
              : { constraint }),
          },
          'displayName'
        );
      } catch (error) {
        showErrorToast(error as AxiosError);
      } finally {
        setEditColumnDisplayName(undefined);
      }
    } else {
      setEditColumnDisplayName(undefined);
    }
  };

  const tagFilter = useMemo(() => {
    const tags = getAllTags(tableColumns);

    return groupBy(uniqBy(tags, 'value'), (tag) => tag.source) as Record<
      TagSource,
      TagFilterOptions[]
    >;
  }, [tableColumns]);

  const handleColumnClick = useCallback(
    (column: Column, event: React.MouseEvent) => {
      const target = event.target as HTMLElement;
      const isExpandIcon = target.closest('.table-expand-icon') !== null;
      const isButton = target.closest('button') !== null;

      if (!isExpandIcon && !isButton) {
        openColumnDetailPanel(column);
      }
    },
    [openColumnDetailPanel]
  );

  const columns: ColumnsType<Column> = useMemo(
    () => [
      {
        title: t('label.name'),
        dataIndex: TABLE_COLUMNS_KEYS.NAME,
        key: TABLE_COLUMNS_KEYS.NAME,
        width: 200,
        fixed: 'left',
        sorter: getColumnSorter<Column, 'name'>('name'),
        onCell: (record: Column) => ({
          onClick: (event) => handleColumnClick(record, event),
          'data-testid': 'column-name-cell',
        }),
        render: (name: Column['name'], record: Column) => {
          const { displayName } = record;

          return (
            <div className="d-inline-flex flex-column hover-icon-group w-max-90">
              <div className="d-inline-flex items-center gap-2">
                <div className="d-inline-flex items-baseline">
                  {prepareConstraintIcon({
                    columnName: name,
                    columnConstraint: record.constraint,
                    tableConstraints,
                  })}
                  <Typography.Text
                    className={classNames(
                      'm-b-0 d-block break-word cursor-pointer',
                      {
                        'text-grey-600': !isEmpty(displayName),
                      }
                    )}
                    data-testid="column-name">
                    {stringToHTML(highlightSearchText(name, searchText))}
                  </Typography.Text>
                </div>
                <div className="d-flex items-center">
                  {editDisplayNamePermission && (
                    <Tooltip placement="top" title={t('label.edit')}>
                      <Button
                        className="cursor-pointer hover-cell-icon flex-center"
                        data-testid="edit-displayName-button"
                        style={{
                          color: DE_ACTIVE_COLOR,
                          padding: 0,
                          border: 'none',
                          background: 'transparent',
                          width: '24px',
                          height: '24px',
                        }}
                        onClick={() => handleEditDisplayNameClick(record)}>
                        <IconEdit
                          style={{ color: DE_ACTIVE_COLOR, ...ICON_DIMENSION }}
                        />
                      </Button>
                    </Tooltip>
                  )}
                  {record.fullyQualifiedName && (
                    <CopyLinkButton
                      entityType={EntityType.TABLE}
                      fieldFqn={record.fullyQualifiedName}
                      testId="copy-column-link-button"
                    />
                  )}
                </div>
              </div>
              {isEmpty(displayName) ? null : (
                <Typography.Text
                  className="m-b-0 d-block break-word"
                  data-testid="column-display-name">
                  {stringToHTML(
                    highlightSearchText(getEntityName(record), searchText)
                  )}
                </Typography.Text>
              )}
            </div>
          );
        },
      },
      {
        title: t('label.type'),
        dataIndex: TABLE_COLUMNS_KEYS.DATA_TYPE_DISPLAY,
        key: TABLE_COLUMNS_KEYS.DATA_TYPE_DISPLAY,
        width: 150,
        render: renderDataTypeDisplay,
      },
      {
        title: t('label.description'),
        dataIndex: TABLE_COLUMNS_KEYS.DESCRIPTION,
        key: TABLE_COLUMNS_KEYS.DESCRIPTION,
        width: 300,
        render: renderDescription,
      },
      {
        title: t('label.tag-plural'),
        dataIndex: TABLE_COLUMNS_KEYS.TAGS,
        key: TABLE_COLUMNS_KEYS.TAGS,
        width: 230,
        filterIcon: columnFilterIcon,
        render: (tags: TagLabel[], record: Column, index: number) => (
          <TableTags<Column>
            entityFqn={tableFqn}
            entityType={EntityType.TABLE}
            handleTagSelection={handleTagSelection}
            hasTagEditAccess={editTagsPermission}
            index={index}
            isReadOnly={deleted}
            record={record}
            tags={tags}
            type={TagSource.Classification}
          />
        ),
        filters: tagFilter.Classification,
        filterDropdown: ColumnFilter,
        onFilter: searchTagInData,
      },
      {
        title: t('label.glossary-term-plural'),
        dataIndex: TABLE_COLUMNS_KEYS.TAGS,
        key: TABLE_COLUMNS_KEYS.GLOSSARY,
        width: 230,
        filterIcon: columnFilterIcon,
        render: (tags: TagLabel[], record: Column, index: number) => (
          <TableTags<Column>
            entityFqn={tableFqn}
            entityType={EntityType.TABLE}
            handleTagSelection={handleTagSelection}
            hasTagEditAccess={editGlossaryTermsPermission}
            index={index}
            isReadOnly={deleted}
            record={record}
            tags={tags}
            type={TagSource.Glossary}
          />
        ),
        filters: tagFilter.Glossary,
        filterDropdown: ColumnFilter,
        onFilter: searchTagInData,
      },
      {
        title: t('label.data-quality'),
        dataIndex: TABLE_COLUMNS_KEYS.DATA_QUALITY_TEST,
        key: TABLE_COLUMNS_KEYS.DATA_QUALITY_TEST,
        width: 120,
        render: (_: string, record: Column) => {
          const testCounts = testCaseCounts.find((column) => {
            return isEqual(
              getEntityColumnFQN(column.entityLink ?? ''),
              record.fullyQualifiedName
            );
          });

          return (
            <TestCaseStatusSummaryIndicator testCaseStatusCounts={testCounts} />
          );
        },
      },
    ],
    [
      tableFqn,
      deleted,
      tableConstraints,
      editTagsPermission,
      editGlossaryTermsPermission,
      editDisplayNamePermission,
      handleUpdate,
      handleTagSelection,
      renderDataTypeDisplay,
      renderDescription,
      onThreadLinkSelect,
      tagFilter,
      testCaseCounts,
    ]
  );

  const constraintOptionsTranslated = useMemo(
    () =>
      COLUMN_CONSTRAINT_TYPE_OPTIONS.map((option) => ({
        ...option,
        label: t(option.label),
      })),
    [t]
  );

  const additionalFieldsInEntityNameModal = (
    <Form.Item
      label={t('label.entity-type-plural', {
        entity: t('label.constraint'),
      })}
      name="constraint">
      <Select
        allowClear
        data-testid="constraint-type-select"
        options={constraintOptionsTranslated}
        placeholder={t('label.select-entity', {
          entity: t('label.entity-type-plural', {
            entity: t('label.constraint'),
          }),
        })}
      />
    </Form.Item>
  );

  const handleEditTable = () => {
    navigate(getEntityBulkEditPath(EntityType.TABLE, decodedEntityFqn));
  };

  useEffect(() => {
    setExpandedRowKeys(
      getAllRowKeysByKeyName<Column>(tableColumns ?? [], 'fullyQualifiedName')
    );
  }, [tableColumns]);

  // Need to scroll to the selected row
  useEffect(() => {
    const columnName = getPartialNameFromTableFQN(decodedEntityFqn, [
      FqnPart.Column,
    ]);
    if (!columnName) {
      return;
    }

    const row = document.querySelector(`[data-row-key="${decodedEntityFqn}"]`);

    if (row && tableColumns?.length && tableColumns.length > 0) {
      // Need to wait till table loads fully so that we can call scroll accurately
      setTimeout(() => row.scrollIntoView(), 1);
    }
  }, [tableColumns, decodedEntityFqn]);

  const searchProps = useMemo(
    () => ({
      placeholder: t('message.find-in-table'),
      searchValue: searchText,
      onSearch: (value: string) => {
        setFilters({ columnSearch: value || undefined });
        handlePageChange(INITIAL_PAGING_VALUE, {
          cursorType: null,
          cursorValue: undefined,
        });
      },
    }),
    [searchText, handlePageChange, setFilters]
  );

  const paginationProps = useMemo(
    () => ({
      currentPage,
      showPagination,
      isLoading: columnsLoading,
      isNumberBased: Boolean(searchText),
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
      pageSize,
      paging,
      handleColumnsPageChange,
      handlePageSizeChange,
    ]
  );

  return (
    <Row gutter={[0, 16]}>
      <Col id="schemaDetails" span={24}>
        <Table
          className="align-table-filter-left"
          columns={columns}
          customPaginationProps={paginationProps}
          data-testid="entity-table"
          dataSource={tableColumns}
          defaultVisibleColumns={DEFAULT_SCHEMA_TABLE_VISIBLE_COLUMNS}
          expandable={expandableConfig}
          extraTableFilters={getBulkEditButton(
            tablePermissions.EditAll && !deleted,
            handleEditTable
          )}
          loading={columnsLoading}
          locale={{
            emptyText: <FilterTablePlaceHolder />,
          }}
          pagination={false}
          rowClassName={getRowClassName}
          rowKey="fullyQualifiedName"
          scroll={TABLE_SCROLL_VALUE}
          searchProps={searchProps}
          size="middle"
          staticVisibleColumns={COMMON_STATIC_TABLE_VISIBLE_COLUMNS}
        />
      </Col>
      {editColumn && (
        <EntityAttachmentProvider
          entityFqn={editColumn.fullyQualifiedName}
          entityType={EntityType.TABLE}>
          <ModalWithMarkdownEditor
            header={`${t('label.edit-entity', {
              entity: t('label.column'),
            })}: "${getEntityName(editColumn)}"`}
            placeholder={t('message.enter-column-description')}
            value={editColumn.description as string}
            visible={Boolean(editColumn)}
            onCancel={closeEditColumnModal}
            onSave={handleEditColumnChange}
          />
        </EntityAttachmentProvider>
      )}
      {editColumnDisplayName && (
        <EntityNameModal
          additionalFields={additionalFieldsInEntityNameModal}
          entity={editColumnDisplayName}
          title={`${t('label.edit-entity', {
            entity: t('label.column'),
          })}: "${editColumnDisplayName?.name}"`}
          visible={Boolean(editColumnDisplayName)}
          onCancel={() => setEditColumnDisplayName(undefined)}
          onSave={handleEditColumnData}
        />
      )}
    </Row>
  );
};

export default SchemaTable;
