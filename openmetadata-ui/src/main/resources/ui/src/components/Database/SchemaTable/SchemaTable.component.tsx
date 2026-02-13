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

import {
  Button,
  Col,
  Dropdown,
  Form,
  Row,
  Select,
  Tooltip,
  Typography,
} from 'antd';
import { ItemType } from 'antd/lib/menu/hooks/useItems';
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
import { ReactComponent as IconSortIndicator } from '../../../assets/svg/ic-down-up-arrow.svg';
import { ReactComponent as IconSort } from '../../../assets/svg/ic-sort-both.svg';
import {
  DE_ACTIVE_COLOR,
  ICON_DIMENSION,
  INITIAL_PAGING_VALUE,
  NO_DATA_PLACEHOLDER,
  PAGE_SIZE_LARGE,
} from '../../../constants/constants';
import {
  COLUMN_CONSTRAINT_TYPE_OPTIONS,
  HIGHLIGHTED_ROW_SELECTOR,
  TABLE_SCROLL_VALUE,
} from '../../../constants/Table.constants';
import {
  COMMON_STATIC_TABLE_VISIBLE_COLUMNS,
  DEFAULT_SCHEMA_TABLE_VISIBLE_COLUMNS,
  TABLE_COLUMNS_KEYS,
} from '../../../constants/TableKeys.constants';
import { EntityType } from '../../../enums/entity.enum';
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
import { useFqnDeepLink } from '../../../hooks/useFqnDeepLink';
import { useSub } from '../../../hooks/usePubSub';
import { useScrollToElement } from '../../../hooks/useScrollToElement';
import { useTableFilters } from '../../../hooks/useTableFilters';
import {
  getTableColumnsByFQN,
  searchTableColumnsByFQN,
  updateTableColumn,
} from '../../../rest/tableAPI';
import { getTestCaseExecutionSummary } from '../../../rest/testAPI';
import { getBulkEditButton } from '../../../utils/EntityBulkEdit/EntityBulkEditUtils';
import {
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
  getHighlightedRowClassName,
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
  const [sortBy, setSortBy] = useState<'name' | 'ordinalPosition'>('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

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
  const {
    entityFqn: tableFqn,
    columnFqn: columnPart,
    fqn,
  } = useFqn({ type: EntityType.TABLE });

  const [editColumnDisplayName, setEditColumnDisplayName] = useState<Column>();

  const {
    permissions: tablePermissions,
    data: table,
    onThreadLinkSelect,
    openColumnDetailPanel,
    setDisplayedColumns,
  } = useGenericContext<TableType>();

  useFqnDeepLink({
    data: table.columns || [],
    columnPart,
    fqn,
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
    HIGHLIGHTED_ROW_SELECTOR,
    Boolean(fqn && tableColumns.length > 0 && !columnsLoading)
  );

  const getRowClassName = useCallback(
    (record: Column) => getHighlightedRowClassName(record, fqn),
    [fqn]
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
    async (
      searchQuery: string,
      page = 1,
      columnSortBy?: 'name' | 'ordinalPosition',
      columnSortOrder?: 'asc' | 'desc'
    ) => {
      if (!tableFqn) {
        return;
      }

      setColumnsLoading(true);
      try {
        const offset = (page - 1) * pageSize;
        const sortByParam = columnSortBy ?? sortBy;
        const sortOrderParam = columnSortOrder ?? sortOrder;

        const response = await searchTableColumnsByFQN(tableFqn, {
          q: searchQuery,
          limit: pageSize,
          offset: offset,
          fields: 'tags,customMetrics,extension',
          sortBy: sortByParam,
          sortOrder: sortOrderParam,
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
    async (
      page = 1,
      columnSortBy?: 'name' | 'ordinalPosition',
      columnSortOrder?: 'asc' | 'desc'
    ) => {
      if (!tableFqn) {
        return;
      }

      setColumnsLoading(true);
      try {
        const offset = (page - 1) * pageSize;
        const sortByParam = columnSortBy ?? sortBy;
        const sortOrderParam = columnSortOrder ?? sortOrder;

        const response = await getTableColumnsByFQN(tableFqn, {
          limit: pageSize,
          offset: offset,
          fields: 'tags,customMetrics,extension',
          sortBy: sortByParam,
          sortOrder: sortOrderParam,
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
      searchTableColumns(searchText, currentPage, sortBy, sortOrder);
    }
  }, [searchText, currentPage, searchTableColumns, sortBy, sortOrder]);

  useEffect(() => {
    if (searchText) {
      return;
    }
    fetchTableColumns(currentPage, sortBy, sortOrder);
  }, [
    tableFqn,
    pageSize,
    currentPage,
    searchText,
    fetchTableColumns,
    sortBy,
    sortOrder,
  ]);

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

    const updatedColumns = table.columns;
    setTableColumns((prev) => {
      // Create a deep clone to avoid mutation of the previous state during updates
      let newColumns = [...prev];
      updatedColumns?.forEach((updatedCol) => {
        // Recursively remove empty children from the update object
        const [cleanUpdate] = pruneEmptyChildren([updatedCol]);

        // Use the utility to recursively find and update the column in the nested structure
        newColumns = updateColumnInNestedStructure(
          newColumns,
          updatedCol.fullyQualifiedName ?? '',
          cleanUpdate as Column
        );
      });

      return newColumns;
    });

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
    field: keyof Column
  ) => {
    const response = await updateTableColumn(columnFqn, column);
    const cleanResponse = isEmpty(response.children)
      ? omit(response, 'children')
      : response;

    setTableColumns((prev) =>
      pruneEmptyChildren(
        updateColumnInNestedStructure(prev, columnFqn, cleanResponse, field)
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
      ...getTableExpandableConfig<Column>(false, 'text-link-color'),
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

  const sortMenuItems: ItemType[] = useMemo(
    () => [
      {
        key: 'name',
        label: (
          <span data-testid="sort-alphabetical">
            {t('label.alphabetical')} (A → Z)
          </span>
        ),
        icon:
          sortBy === 'name' ? <span className="text-primary">✓</span> : null,
      },
      {
        key: 'ordinalPosition',
        label: (
          <span data-testid="sort-original-order">
            {t('label.original-order')}
          </span>
        ),
        icon:
          sortBy === 'ordinalPosition' ? (
            <span className="text-primary">✓</span>
          ) : null,
      },
    ],
    [sortBy, t]
  );

  const handleSortMenuClick = useCallback(
    ({ key }: { key: string }) => {
      const newSortBy = key as 'name' | 'ordinalPosition';
      if (newSortBy !== sortBy) {
        setSortBy(newSortBy);
        setSortOrder('asc'); // Reset to ascending when changing sort field
        handlePageChange(1);
      }
    },
    [sortBy, handlePageChange]
  );

  const handleColumnHeaderSortToggle = useCallback(() => {
    setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    handlePageChange(1);
  }, [handlePageChange]);

  const columns: ColumnsType<Column> = useMemo(
    () => [
      {
        title: (
          <div
            className="d-flex items-center cursor-pointer"
            data-testid="name-column-header"
            onClick={handleColumnHeaderSortToggle}>
            <span
              className={sortBy === 'name' ? 'text-primary font-medium' : ''}>
              {t('label.name')}
            </span>
            <IconSortIndicator
              className="m-l-xss"
              data-testid="sort-indicator"
              height={12}
              style={{
                color: sortBy === 'name' ? 'var(--primary-color)' : '#6B7280',
                transform: sortOrder === 'desc' ? 'rotate(180deg)' : 'none',
                transition: 'transform 0.2s ease',
              }}
              width={8}
            />
          </div>
        ),
        dataIndex: TABLE_COLUMNS_KEYS.NAME,
        key: TABLE_COLUMNS_KEYS.NAME,
        width: 200,
        fixed: 'left',
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
                      'm-b-0 d-block break-word cursor-pointer text-link-color'
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
      searchText,
      sortBy,
      sortOrder,
      handleColumnHeaderSortToggle,
      t,
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
    navigate(getEntityBulkEditPath(EntityType.TABLE, tableFqn));
  };

  useEffect(() => {
    setExpandedRowKeys(
      getAllRowKeysByKeyName<Column>(tableColumns ?? [], 'fullyQualifiedName')
    );
  }, [tableColumns]);

  // Sync displayed columns with GenericProvider for ColumnDetailPanel navigation
  useEffect(() => {
    setDisplayedColumns(tableColumns);
  }, [tableColumns, setDisplayedColumns]);

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
          extraTableFilters={
            <div className="d-flex items-center gap-4">
              <Dropdown
                menu={{ items: sortMenuItems, onClick: handleSortMenuClick }}
                trigger={['click']}>
                <Button
                  className="flex-center gap-2"
                  data-testid="sort-dropdown"
                  icon={<IconSort height={14} width={14} />}
                  size="small"
                  type="text">
                  {t('label.sort')}
                </Button>
              </Dropdown>
              {getBulkEditButton(
                tablePermissions.EditAll && !deleted,
                handleEditTable
              )}
            </div>
          }
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
