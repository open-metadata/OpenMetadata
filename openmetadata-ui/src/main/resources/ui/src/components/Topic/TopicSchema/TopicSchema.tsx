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
  Badge,
  Box,
  ButtonGroup,
  ButtonGroupItem,
  Tooltip,
  Typography,
} from '@openmetadata/ui-core-components';
import { AxiosError } from 'axios';
import classNames from 'classnames';
import { cloneDeep, groupBy, isEmpty, isUndefined, uniqBy } from 'lodash';
import { EntityTags, TagFilterOptions } from 'Models';
import {
  FC,
  Key,
  lazy,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import { INITIAL_PAGING_VALUE } from '../../../constants/constants';
import {
  SEGMENT_TOGGLE_GROUP_CLASS,
  SEGMENT_TOGGLE_ITEM_CLASS,
} from '../../../constants/SegmentToggle.constants';
import {
  HIGHLIGHTED_ROW_SELECTOR,
  TABLE_SCROLL_VALUE,
} from '../../../constants/Table.constants';
import {
  COMMON_STATIC_TABLE_VISIBLE_COLUMNS,
  DEFAULT_TOPIC_VISIBLE_COLUMNS,
  TABLE_COLUMNS_KEYS,
} from '../../../constants/TableKeys.constants';
import { CSMode } from '../../../enums/codemirror.enum';
import { EntityType, TabSpecificField } from '../../../enums/entity.enum';
import {
  DataTypeTopic,
  Field,
  MessageSchemaObject,
  Topic,
} from '../../../generated/entity/data/topic';
import { TagLabel, TagSource } from '../../../generated/type/tagLabel';
import { usePaging } from '../../../hooks/paging/usePaging';
import { useFqn } from '../../../hooks/useFqn';
import { useFqnDeepLink } from '../../../hooks/useFqnDeepLink';
import { useScrollToElement } from '../../../hooks/useScrollToElement';
import { useTableFilters } from '../../../hooks/useTableFilters';
import { useTreeTagFilter } from '../../../hooks/useTreeTagFilter';
import { getTopicSchemaFieldsByFQN } from '../../../rest/topicsAPI';
import { getLayoutGutter } from '../../../utils/common/layout.utils';
import { getEntityName } from '../../../utils/EntityNameUtils';
import { getColumnSorter } from '../../../utils/EntitySortUtils';
import { getDerivedPermissionFlags } from '../../../utils/PermissionDerivation';
import { getEntityDetailsUrl } from '../../../utils/RouterUtils';
import { getVersionedSchema } from '../../../utils/SchemaVersionUtils';
import { columnFilterIcon } from '../../../utils/TableColumn.util';
import {
  getAllRowKeysByKeyName,
  getExpandAllKeysToDepth,
  getHighlightedRowClassName,
  getSafeExpandAllKeys,
  getSchemaDepth,
  getSchemaFieldCount,
  isLargeSchema,
  shouldCollapseSchema,
  updateFieldDescription,
  updateFieldTags,
} from '../../../utils/TablePureUtils';
import { getAllTags } from '../../../utils/TableTags/TableTags.utils';
import { getTableExpandableConfig } from '../../../utils/TableUtils';
import { showErrorToast } from '../../../utils/ToastUtils';
import withSuspenseFallback from '../../AppRouter/withSuspenseFallback';
import CopyButton from '../../common/CopyButton/CopyButton';
import NoDataPlaceholder from '../../common/EmptyPlaceholder/NoDataPlaceholder';
import { EntityAttachmentProvider } from '../../common/EntityDescription/EntityAttachmentProvider/EntityAttachmentProvider';
import { PagingHandlerParams } from '../../common/NextPrevious/NextPrevious.interface';
import RichTextEditorPreviewerV1 from '../../common/RichTextEditor/RichTextEditorPreviewerV1';
import { EntityDetailWidgetSkeleton } from '../../common/Skeleton/EntityDetailWidgetSkeleton/EntityDetailWidgetSkeleton.component';
import {
  ColumnsType,
  SortOrder,
  TableProps,
} from '../../common/Table/Table.interface';
import Table from '../../common/Table/TableV2';
import ToggleExpandButton from '../../common/ToggleExpandButton/ToggleExpandButton';
import { useGenericContext } from '../../Customization/GenericProvider/GenericContext';
import { ColumnFilter } from '../../Database/ColumnFilter/ColumnFilter.component';
import TableDescription from '../../Database/TableDescription/TableDescription.component';
import TableTags from '../../Database/TableTags/TableTags.component';
import { FIELD_SORT_ORDERS } from './TopicSchema.constants';
import {
  SchemaViewType,
  TopicSchemaFieldsProps,
} from './TopicSchema.interface';

const SchemaEditor = withSuspenseFallback(
  lazy(() => import('../../Database/SchemaEditor/SchemaEditor')),
  <EntityDetailWidgetSkeleton lineCount={5} />
);

const ModalWithMarkdownEditor = withSuspenseFallback(
  lazy(() =>
    import('../../Modals/ModalWithMarkdownEditor/ModalWithMarkdownEditor').then(
      (m) => ({ default: m.ModalWithMarkdownEditor })
    )
  )
);

const TopicSchemaFields: FC<TopicSchemaFieldsProps> = ({
  className,
  schemaTypePlaceholder,
}) => {
  const { t } = useTranslation();
  const [editFieldDescription, setEditFieldDescription] = useState<Field>();
  const [expandedRowKeys, setExpandedRowKeys] = useState<string[]>([]);
  const [viewType, setViewType] = useState<SchemaViewType>(
    SchemaViewType.FIELDS
  );
  const [paginatedFields, setPaginatedFields] = useState<Field[]>([]);
  const [fieldsLoading, setFieldsLoading] = useState(true);

  const {
    currentPage,
    pageSize,
    handlePageChange,
    handlePageSizeChange,
    showPagination,
    paging,
    handlePagingChange,
  } = usePaging();

  // Search and Name sort live in the URL with the page, so a reload restores all three.
  const { filters, setFilters } = useTableFilters({
    columnSearch: undefined as string | undefined,
    fieldSort: undefined as string | undefined,
  });
  const searchText = filters.columnSearch ?? '';
  const nameSortOrder = FIELD_SORT_ORDERS.find(
    (order) => order === filters.fieldSort
  );

  const viewTypeOptions = [
    {
      label: t('label.field-plural'),
      value: SchemaViewType.FIELDS,
    },
    { label: t('label.text'), value: SchemaViewType.TEXT },
  ];

  const {
    data: topicDetails,
    isVersionView,
    permissions,
    onUpdate,
    currentVersionData,
    openColumnDetailPanel,
    selectedColumn,
    setDisplayedColumns,
  } = useGenericContext<Topic>();

  const {
    entityFqn: topicFqn,
    columnFqn: columnPart,
    fqn,
  } = useFqn({
    type: EntityType.TOPIC,
  });

  const isReadOnly = useMemo(() => {
    // If there is a current version, it should be read only
    return currentVersionData ? true : topicDetails.deleted;
  }, [currentVersionData, topicDetails.deleted]);

  const messageSchema = useMemo(
    () =>
      isVersionView && currentVersionData?.changeDescription
        ? getVersionedSchema(
            currentVersionData?.['messageSchema'] as MessageSchemaObject,
            currentVersionData?.changeDescription
          )
        : topicDetails.messageSchema,
    [currentVersionData, isVersionView, topicDetails]
  );

  // The version view diffs the full stored schema; the live view pages it from the server.
  const schemaFields = useMemo(
    () => (isVersionView ? messageSchema?.schemaFields ?? [] : paginatedFields),
    [isVersionView, messageSchema?.schemaFields, paginatedFields]
  );

  const latestFetchId = useRef(0);

  const fetchSchemaFields = useCallback(
    async (page = 1, searchQuery?: string) => {
      if (!topicDetails.fullyQualifiedName) {
        return;
      }
      const fetchId = ++latestFetchId.current;
      const isStale = () => fetchId !== latestFetchId.current;
      setFieldsLoading(true);
      try {
        const response = await getTopicSchemaFieldsByFQN(
          topicDetails.fullyQualifiedName,
          {
            limit: pageSize,
            offset: (page - 1) * pageSize,
            fields: TabSpecificField.TAGS,
            q: searchQuery,
            sortOrder: nameSortOrder,
          }
        );
        if (isStale()) {
          return;
        }
        setPaginatedFields(response.data);
        handlePagingChange(response.paging);
      } catch (error) {
        if (isStale()) {
          return;
        }
        showErrorToast(error as AxiosError);
        setPaginatedFields([]);
        handlePagingChange({ offset: 1, limit: pageSize, total: 0 });
      } finally {
        if (!isStale()) {
          setFieldsLoading(false);
        }
      }
    },
    [
      topicDetails.fullyQualifiedName,
      pageSize,
      handlePagingChange,
      nameSortOrder,
    ]
  );

  // Every saved topic update (inline or from the column detail panel) replaces
  // messageSchema, so its identity triggers a reload of the page the user is on.
  // topicDetails.version is not enough: quick edits by the same user can share one version.
  useEffect(() => {
    if (!isVersionView) {
      fetchSchemaFields(currentPage, searchText || undefined);
    }
  }, [
    isVersionView,
    currentPage,
    searchText,
    fetchSchemaFields,
    topicDetails.messageSchema,
  ]);

  const handleFieldsPageChange = useCallback(
    ({ currentPage }: PagingHandlerParams) => handlePageChange(currentPage),
    [handlePageChange]
  );

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
    [searchText, handlePageChange, setFilters, t]
  );

  const paginationProps = useMemo(
    () => ({
      currentPage,
      showPagination,
      isLoading: fieldsLoading,
      isNumberBased: Boolean(searchText),
      pageSize,
      paging,
      pagingHandler: handleFieldsPageChange,
      onShowSizeChange: handlePageSizeChange,
    }),
    [
      currentPage,
      showPagination,
      fieldsLoading,
      searchText,
      pageSize,
      paging,
      handleFieldsPageChange,
      handlePageSizeChange,
    ]
  );

  // Consumer via useGenericContext() (Task 8 rule 2). Ungated: `isReadOnly` above
  // (currentVersionData or topicDetails.deleted) is passed separately to each
  // TableDescription/TableTags render site below, never folded into these edit
  // flags in the old code — same isReadOnly-vs-deleted separation as the sibling
  // SearchIndexFieldsTab/SchemaTable family. All 3 raw `EditAll || EditField`
  // OR-expressions are explicit-deny-wins fixes.
  const flags = useMemo(
    () => getDerivedPermissionFlags(permissions),
    [permissions]
  );

  const {
    hasDescriptionEditAccess,
    hasTagEditAccess,
    hasGlossaryTermEditAccess,
  } = useMemo(
    () => ({
      hasDescriptionEditAccess: flags.canEditDescription,
      hasTagEditAccess: flags.canEditTags,
      hasGlossaryTermEditAccess: flags.canEditGlossaryTerms,
    }),
    [flags]
  );

  const schemaAllRowKeys = useMemo(() => {
    return getAllRowKeysByKeyName<Field>(schemaFields, 'fullyQualifiedName');
  }, [schemaFields]);

  useScrollToElement(
    HIGHLIGHTED_ROW_SELECTOR,
    Boolean(fqn && schemaFields.length)
  );

  const getRowClassName = useCallback(
    (record: Field) => getHighlightedRowClassName(record, fqn),
    [fqn]
  );

  const schemaStats = useMemo(
    () => ({
      totalFields: getSchemaFieldCount(schemaFields),
      maxDepth: getSchemaDepth(schemaFields),
      isLargeSchema: isLargeSchema(schemaFields),
      shouldCollapse: shouldCollapseSchema(schemaFields),
    }),
    [schemaFields]
  );

  // Saves go through the topic PATCH so the shared topic (and the column detail panel)
  // stays current; the version bump then reloads the page the user is on.
  const handleFieldTagsChange = async (
    selectedTags: EntityTags[],
    editColumnTag: Field
  ) => {
    if (selectedTags && editColumnTag && !isUndefined(onUpdate)) {
      const schema = cloneDeep(topicDetails.messageSchema);
      updateFieldTags<Field>(
        editColumnTag.fullyQualifiedName ?? '',
        selectedTags,
        schema?.schemaFields
      );
      await onUpdate({ ...topicDetails, messageSchema: schema });
    }
  };

  const handleFieldDescriptionChange = async (updatedDescription: string) => {
    if (!isUndefined(editFieldDescription) && !isUndefined(onUpdate)) {
      const schema = cloneDeep(topicDetails.messageSchema);
      updateFieldDescription<Field>(
        editFieldDescription.fullyQualifiedName ?? '',
        updatedDescription,
        schema?.schemaFields
      );
      await onUpdate({ ...topicDetails, messageSchema: schema });
    }
    setEditFieldDescription(undefined);
  };

  const handleColumnClick = useCallback(
    (field: Field, event: React.MouseEvent) => {
      const target = event.target as HTMLElement;
      if (
        target.closest(
          'button, a, input, textarea, select, .table-expand-icon'
        ) !== null
      ) {
        return;
      }
      openColumnDetailPanel(field);
    },
    [openColumnDetailPanel]
  );

  useFqnDeepLink({
    data: topicDetails?.messageSchema?.schemaFields ?? [],
    columnPart,
    fqn,
    setExpandedRowKeys: setExpandedRowKeys,
    openColumnDetailPanel,
    selectedColumn: selectedColumn as Field | null,
  });

  // Sync displayed columns with GenericProvider for ColumnDetailPanel navigation
  useEffect(() => {
    setDisplayedColumns(schemaFields);
  }, [schemaFields, setDisplayedColumns]);

  const toggleExpandAll = () => {
    if (expandedRowKeys.length < schemaAllRowKeys.length) {
      const safeKeys = getSafeExpandAllKeys(
        schemaFields,
        schemaStats.isLargeSchema,
        schemaAllRowKeys
      );
      setExpandedRowKeys(safeKeys);
    } else {
      setExpandedRowKeys([]);
    }
  };

  const handleExpandedRowsChange = (keys: readonly Key[]) => {
    setExpandedRowKeys(keys as string[]);
  };

  const {
    tagFilterState,
    filteredData: filteredSchemaFields,
    handleTableChange,
  } = useTreeTagFilter<Field>(schemaFields);

  const handleSchemaTableChange = useCallback<
    NonNullable<TableProps<Field>['onChange']>
  >(
    (pagination, filters, sorter, extra) => {
      if (extra.action !== 'sort') {
        handleTableChange(pagination, filters);

        return;
      }
      const { order } = Array.isArray(sorter) ? sorter[0] : sorter;
      const descendingOrder = order === 'descend' ? 'desc' : undefined;
      handlePageChange(INITIAL_PAGING_VALUE, {
        cursorType: null,
        cursorValue: undefined,
      });
      setFilters({
        fieldSort: order === 'ascend' ? 'asc' : descendingOrder,
      });
    },
    [handleTableChange, handlePageChange, setFilters]
  );

  const renderSchemaName = useCallback(
    (_: unknown, record: Field) => (
      <div
        className="d-inline-flex gap-1 hover-icon-group vertical-align-inherit flex-column items-start"
        style={{ maxWidth: '80%' }}>
        <Tooltip
          arrow
          excludeTriggerFromTabOrder
          title={getEntityName(record)}
          triggerClassName="tw:inline-flex">
          <span className="break-word">
            {isVersionView ? (
              <RichTextEditorPreviewerV1 markdown={getEntityName(record)} />
            ) : (
              <span className="text-link-color">{getEntityName(record)}</span>
            )}
          </span>
        </Tooltip>
        {!isVersionView && record.fullyQualifiedName && (
          <CopyButton
            className="hover-cell-icon"
            isDisabled={!record.fullyQualifiedName}
            size="xs"
            testId="copy-field-link-button"
            value={getEntityDetailsUrl(
              EntityType.TOPIC,
              record.fullyQualifiedName ?? ''
            )}
          />
        )}
      </div>
    ),
    [isVersionView]
  );

  const renderDataType = useCallback(
    (dataType: DataTypeTopic, record: Field) => (
      <Typography className="tw:text-primary">
        {isVersionView ? (
          <RichTextEditorPreviewerV1
            markdown={record.dataTypeDisplay ?? dataType}
          />
        ) : (
          record.dataTypeDisplay ?? dataType
        )}
      </Typography>
    ),
    [isVersionView]
  );

  const tagFilter = useMemo(() => {
    const tags = getAllTags(schemaFields);

    return groupBy(uniqBy(tags, 'value'), (tag) => tag.source) as Record<
      TagSource,
      TagFilterOptions[]
    >;
  }, [schemaFields]);

  const renderDescription = useCallback(
    (_: string, record: Field, index: number) => (
      <TableDescription
        columnData={{
          fqn: record.fullyQualifiedName ?? '',
          field: record.description,
        }}
        entityFqn={topicFqn}
        entityType={EntityType.TOPIC}
        hasEditPermission={hasDescriptionEditAccess}
        index={index}
        isReadOnly={isReadOnly}
        onClick={() => setEditFieldDescription(record)}
      />
    ),
    [topicFqn, hasDescriptionEditAccess, isReadOnly]
  );

  const renderClassificationTags = useCallback(
    (tags: TagLabel[], record: Field, index: number) => (
      <TableTags<Field>
        entityFqn={topicFqn}
        entityType={EntityType.TOPIC}
        handleTagSelection={handleFieldTagsChange}
        hasTagEditAccess={hasTagEditAccess}
        index={index}
        isReadOnly={isReadOnly}
        record={record}
        tags={tags}
        type={TagSource.Classification}
      />
    ),
    [topicFqn, handleFieldTagsChange, hasTagEditAccess, isReadOnly]
  );

  const renderGlossaryTags = useCallback(
    (tags: TagLabel[], record: Field, index: number) => (
      <TableTags<Field>
        entityFqn={topicFqn}
        entityType={EntityType.TOPIC}
        handleTagSelection={handleFieldTagsChange}
        hasTagEditAccess={hasGlossaryTermEditAccess}
        index={index}
        isReadOnly={isReadOnly}
        record={record}
        tags={tags}
        type={TagSource.Glossary}
      />
    ),
    [topicFqn, handleFieldTagsChange, hasGlossaryTermEditAccess, isReadOnly]
  );

  const descendingNameSort = nameSortOrder === 'desc' ? 'descend' : null;
  const nameColumnSortOrder: SortOrder =
    nameSortOrder === 'asc' ? 'ascend' : descendingNameSort;

  const columns: ColumnsType<Field> = useMemo(
    () => [
      {
        title: t('label.name'),
        dataIndex: TABLE_COLUMNS_KEYS.NAME,
        key: TABLE_COLUMNS_KEYS.NAME,
        fixed: 'left',
        width: 220,
        // The live view sorts on the server before paging; the version view sorts the full stored schema.
        sorter: isVersionView ? getColumnSorter<Field, 'name'>('name') : true,
        ...(!isVersionView && { sortOrder: nameColumnSortOrder }),
        render: renderSchemaName,
        className: 'cursor-pointer hover:text-link-color',
        onCell: (record: Field) => ({
          onClick: (event) => handleColumnClick(record, event),
          'data-testid': 'column-name-cell',
        }),
      },
      {
        title: t('label.type'),
        dataIndex: TABLE_COLUMNS_KEYS.DATA_TYPE,
        key: TABLE_COLUMNS_KEYS.DATA_TYPE,
        ellipsis: true,
        width: 220,
        render: renderDataType,
      },
      {
        title: t('label.description'),
        dataIndex: TABLE_COLUMNS_KEYS.DESCRIPTION,
        key: TABLE_COLUMNS_KEYS.DESCRIPTION,
        width: 350,
        render: renderDescription,
      },
      {
        title: t('label.tag-plural'),
        dataIndex: TABLE_COLUMNS_KEYS.TAGS,
        key: TABLE_COLUMNS_KEYS.TAGS,
        width: 300,
        filterIcon: columnFilterIcon,
        render: renderClassificationTags,
        filters: tagFilter.Classification,
        filterDropdown: ColumnFilter,
        filteredValue: tagFilterState[TABLE_COLUMNS_KEYS.TAGS] ?? null,
      },
      {
        title: t('label.glossary-term-plural'),
        dataIndex: TABLE_COLUMNS_KEYS.TAGS,
        key: TABLE_COLUMNS_KEYS.GLOSSARY,
        width: 300,
        filterIcon: columnFilterIcon,
        render: renderGlossaryTags,
        filters: tagFilter.Glossary,
        filterDropdown: ColumnFilter,
        filteredValue: tagFilterState[TABLE_COLUMNS_KEYS.GLOSSARY] ?? null,
      },
    ],
    [
      t,
      renderSchemaName,
      renderDataType,
      renderDescription,
      renderClassificationTags,
      renderGlossaryTags,
      tagFilter,
      tagFilterState,
      isVersionView,
      nameColumnSortOrder,
    ]
  );

  useEffect(() => {
    if (schemaStats.shouldCollapse) {
      // For large schemas, expand only 2 levels deep for better performance
      setExpandedRowKeys(getExpandAllKeysToDepth(schemaFields, 2));
    } else {
      // For small schemas, expand all for better UX
      setExpandedRowKeys(schemaAllRowKeys);
    }
  }, [schemaStats.shouldCollapse, schemaAllRowKeys, schemaFields]);

  const hasNoSchemaContent =
    isEmpty(messageSchema?.schemaFields) && isEmpty(messageSchema?.schemaText);

  const renderSchemaTypeBadge = () => {
    if (!messageSchema?.schemaType) {
      return null;
    }

    return (
      <Box className="layout-column tw:block">
        <Typography color="secondary">{t('label.schema')}</Typography>
        {schemaTypePlaceholder ?? (
          <Badge
            className="tw:inline-flex tw:mr-2 ml-4"
            color="gray"
            size="sm"
            type="color">
            {messageSchema.schemaType}
          </Badge>
        )}
      </Box>
    );
  };

  // These helpers return flex-row siblings, so full-width sections need explicit widths.
  const renderViewToggle = () => {
    if (isEmpty(messageSchema?.schemaFields) || isVersionView) {
      return null;
    }

    return (
      <Box className="layout-column tw:block tw:flex-none tw:w-full">
        <ButtonGroup
          disallowEmptySelection
          className={SEGMENT_TOGGLE_GROUP_CLASS}
          selectedKeys={[viewType]}
          size="sm"
          onSelectionChange={(keys) => {
            const selected = [...keys][0];
            if (selected) {
              setViewType(selected as SchemaViewType);
            }
          }}>
          {viewTypeOptions.map(({ label, value }) => (
            <ButtonGroupItem
              className={SEGMENT_TOGGLE_ITEM_CLASS}
              id={value}
              key={value}>
              {label}
            </ButtonGroupItem>
          ))}
        </ButtonGroup>
      </Box>
    );
  };

  const renderSchemaContent = () => {
    const showTextView =
      viewType === SchemaViewType.TEXT || isEmpty(messageSchema?.schemaFields);

    if (showTextView) {
      return messageSchema?.schemaText ? (
        <SchemaEditor
          className="custom-code-mirror-theme custom-query-editor"
          editorClass={classNames('table-query-editor')}
          mode={{ name: CSMode.JAVASCRIPT }}
          options={{
            styleActiveLine: false,
          }}
          value={messageSchema?.schemaText ?? ''}
        />
      ) : null;
    }

    return (
      <Table
        className={classNames('align-table-filter-left', className)}
        columns={columns}
        customPaginationProps={isVersionView ? undefined : paginationProps}
        data-testid="topic-schema-fields-table"
        dataSource={filteredSchemaFields}
        defaultVisibleColumns={DEFAULT_TOPIC_VISIBLE_COLUMNS}
        expandable={{
          ...getTableExpandableConfig<Field>(false, 'text-link-color'),
          rowExpandable: (record) => !isEmpty(record.children),
          onExpandedRowsChange: handleExpandedRowsChange,
          expandedRowKeys,
        }}
        extraTableFilters={
          <ToggleExpandButton
            allRowKeys={schemaAllRowKeys}
            expandedRowKeys={expandedRowKeys}
            toggleExpandAll={toggleExpandAll}
          />
        }
        loading={!isVersionView && fieldsLoading}
        pagination={false}
        rowClassName={getRowClassName}
        rowKey="fullyQualifiedName"
        scroll={TABLE_SCROLL_VALUE}
        searchProps={isVersionView ? undefined : searchProps}
        size="small"
        staticVisibleColumns={COMMON_STATIC_TABLE_VISIBLE_COLUMNS}
        onChange={handleSchemaTableChange}
      />
    );
  };

  const renderSchemaBody = () => {
    if (hasNoSchemaContent) {
      return (
        <div className="tw:relative tw:h-full tw:w-full tw:min-h-60 tw:rounded-xl tw:bg-surface">
          <NoDataPlaceholder data-testid="no-data-placeholder" />
        </div>
      );
    }

    return (
      <>
        {renderViewToggle()}
        <Box className="layout-column tw:block tw:flex-none tw:w-full">
          {renderSchemaContent()}
        </Box>
      </>
    );
  };

  return (
    <Box
      className="layout-row"
      style={{ ...getLayoutGutter(16, 16) }}
      wrap="wrap">
      {renderSchemaTypeBadge()}
      {renderSchemaBody()}
      {editFieldDescription && (
        <EntityAttachmentProvider
          entityFqn={editFieldDescription.fullyQualifiedName}
          entityType={EntityType.TOPIC}>
          <ModalWithMarkdownEditor
            header={`${t('label.edit-entity', {
              entity: t('label.schema-field'),
            })}: "${getEntityName(editFieldDescription)}"`}
            placeholder={t('label.enter-field-description', {
              field: t('label.schema-field'),
            })}
            value={editFieldDescription.description ?? ''}
            visible={Boolean(editFieldDescription)}
            onCancel={() => setEditFieldDescription(undefined)}
            onSave={handleFieldDescriptionChange}
          />
        </EntityAttachmentProvider>
      )}
    </Box>
  );
};

export default TopicSchemaFields;
