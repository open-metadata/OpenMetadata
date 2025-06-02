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
import classNames from 'classnames';
import {
  cloneDeep,
  groupBy,
  isEmpty,
  isEqual,
  isUndefined,
  set,
  sortBy,
  uniqBy,
} from 'lodash';
import { EntityTags, TagFilterOptions } from 'Models';
import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useHistory } from 'react-router-dom';
import { ReactComponent as IconEdit } from '../../../assets/svg/edit-new.svg';
import { FQN_SEPARATOR_CHAR } from '../../../constants/char.constants';
import {
  DE_ACTIVE_COLOR,
  ICON_DIMENSION,
  NO_DATA_PLACEHOLDER,
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
import { TestSummary } from '../../../generated/tests/testCase';
import { TagSource } from '../../../generated/type/schema';
import { TagLabel } from '../../../generated/type/tagLabel';
import { useFqn } from '../../../hooks/useFqn';
import { getTestCaseExecutionSummary } from '../../../rest/testAPI';
import { getPartialNameFromTableFQN } from '../../../utils/CommonUtils';
import { getBulkEditButton } from '../../../utils/EntityBulkEdit/EntityBulkEditUtils';
import {
  getColumnSorter,
  getEntityBulkEditPath,
  getEntityName,
  getFrequentlyJoinedColumns,
  highlightSearchArrayElement,
  highlightSearchText,
  searchInColumns,
} from '../../../utils/EntityUtils';
import { getEntityColumnFQN } from '../../../utils/FeedUtils';
import { stringToHTML } from '../../../utils/StringsUtils';
import { columnFilterIcon } from '../../../utils/TableColumn.util';
import {
  getAllTags,
  searchTagInData,
} from '../../../utils/TableTags/TableTags.utils';
import {
  getAllRowKeysByKeyName,
  getTableExpandableConfig,
  makeData,
  prepareConstraintIcon,
  updateFieldTags,
} from '../../../utils/TableUtils';
import { EntityAttachmentProvider } from '../../common/EntityDescription/EntityAttachmentProvider/EntityAttachmentProvider';
import FilterTablePlaceHolder from '../../common/ErrorWithPlaceholder/FilterTablePlaceHolder';
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
import {
  TableCellRendered,
  UpdatedColumnFieldData,
} from './SchemaTable.interface';

const SchemaTable = () => {
  const { t } = useTranslation();
  const history = useHistory();
  const [testCaseSummary, setTestCaseSummary] = useState<TestSummary>();
  const [searchedColumns, setSearchedColumns] = useState<Column[]>([]);
  const [expandedRowKeys, setExpandedRowKeys] = useState<string[]>([]);
  const [searchText, setSearchText] = useState('');

  const [editColumn, setEditColumn] = useState<Column>();

  const { fqn: decodedEntityFqn } = useFqn();

  const [editColumnDisplayName, setEditColumnDisplayName] = useState<Column>();
  const {
    permissions: tablePermissions,
    data: table,
    onUpdate,
    onThreadLinkSelect,
  } = useGenericContext<TableType>();

  const { testCaseCounts, tableColumns, joins, tableConstraints, deleted } =
    useMemo(
      () => ({
        testCaseCounts: testCaseSummary?.columnTestSummary ?? [],
        tableColumns: table?.columns ?? [],
        joins: table?.joins?.columnJoins ?? [],
        tableConstraints: table?.tableConstraints,
        deleted: table?.deleted,
      }),
      [table, testCaseSummary]
    );

  const tableFqn = useMemo(
    () =>
      getPartialNameFromTableFQN(
        decodedEntityFqn,
        [FqnPart.Service, FqnPart.Database, FqnPart.Schema, FqnPart.Table],
        FQN_SEPARATOR_CHAR
      ),
    [decodedEntityFqn]
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
      editAllPermission: tablePermissions.EditAll && !deleted,
      editLineagePermission:
        (tablePermissions.EditAll || tablePermissions.EditLineage) && !deleted,
      viewSampleDataPermission:
        tablePermissions.ViewAll || tablePermissions.ViewSampleData,
      viewQueriesPermission:
        tablePermissions.ViewAll || tablePermissions.ViewQueries,
      viewProfilerPermission:
        tablePermissions.ViewAll ||
        tablePermissions.ViewDataProfile ||
        tablePermissions.ViewTests,
      viewAllPermission: tablePermissions.ViewAll,
      viewBasicPermission:
        tablePermissions.ViewAll || tablePermissions.ViewBasic,
      editDisplayNamePermission:
        (tablePermissions.EditDisplayName || tablePermissions.EditAll) &&
        !deleted,
    }),
    [tablePermissions, deleted]
  );

  const sortByOrdinalPosition = useMemo(
    () => sortBy(tableColumns, 'ordinalPosition'),
    [tableColumns]
  );

  const fetchTestCaseSummary = async () => {
    try {
      const response = await getTestCaseExecutionSummary(table?.testSuite?.id);
      setTestCaseSummary(response);
    } catch (error) {
      setTestCaseSummary(undefined);
    }
  };

  const data = React.useMemo(
    () => makeData(searchedColumns),
    [searchedColumns]
  );

  const nestedTableFqnKeys = useMemo(
    () =>
      getAllRowKeysByKeyName<Column>(tableColumns ?? [], 'fullyQualifiedName'),
    [tableColumns]
  );

  useEffect(() => {
    fetchTestCaseSummary();
  }, [tableFqn]);

  const handleEditColumn = (column: Column): void => {
    setEditColumn(column);
  };
  const closeEditColumnModal = (): void => {
    setEditColumn(undefined);
  };

  const handleColumnUpdate = async (updatedColumns: Column[]) => {
    if (table && !isEqual(tableColumns, updatedColumns)) {
      const updatedTableDetails = {
        ...table,
        columns: updatedColumns,
      };
      await onUpdate(updatedTableDetails);
    }
  };

  const updateColumnFields = ({
    fqn,
    field,
    value,
    columns,
  }: UpdatedColumnFieldData) => {
    columns?.forEach((col) => {
      if (col.fullyQualifiedName === fqn) {
        set(col, field, value);
      } else {
        updateColumnFields({
          fqn,
          field,
          value,
          columns: col.children as Column[],
        });
      }
    });
  };

  const handleEditColumnChange = async (columnDescription: string) => {
    if (!isUndefined(editColumn) && editColumn.fullyQualifiedName) {
      const tableCols = cloneDeep(tableColumns);
      updateColumnFields({
        fqn: editColumn.fullyQualifiedName,
        value: columnDescription,
        field: 'description',
        columns: tableCols,
      });
      await handleColumnUpdate(tableCols);
      setEditColumn(undefined);
    } else {
      setEditColumn(undefined);
    }
  };

  const handleTagSelection = async (
    selectedTags: EntityTags[],
    editColumnTag: Column
  ) => {
    if (selectedTags && editColumnTag) {
      const tableCols = cloneDeep(tableColumns);

      updateFieldTags<Column>(
        editColumnTag.fullyQualifiedName ?? '',
        selectedTags,
        tableCols
      );
      await handleColumnUpdate(tableCols);
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

  useEffect(() => {
    if (!searchText) {
      setSearchedColumns(sortByOrdinalPosition);
    } else {
      const searchCols = searchInColumns(sortByOrdinalPosition, searchText);
      setSearchedColumns(searchCols);
    }
  }, [searchText, sortByOrdinalPosition]);

  const handleEditDisplayNameClick = (record: Column) => {
    setEditColumnDisplayName(record);
  };

  const handleEditColumnData = async (data: EntityName) => {
    const { displayName, constraint } = data as EntityNameWithAdditionFields;
    if (
      !isUndefined(editColumnDisplayName) &&
      editColumnDisplayName.fullyQualifiedName
    ) {
      const tableCols = cloneDeep(tableColumns);

      updateColumnFields({
        fqn: editColumnDisplayName.fullyQualifiedName,
        value: isEmpty(displayName) ? undefined : displayName,
        field: 'displayName',
        columns: tableCols,
      });

      updateColumnFields({
        fqn: editColumnDisplayName.fullyQualifiedName,
        value: isEmpty(constraint) ? undefined : constraint,
        field: 'constraint',
        columns: tableCols,
      });
      await handleColumnUpdate(tableCols);
      setEditColumnDisplayName(undefined);
    } else {
      setEditColumnDisplayName(undefined);
    }
  };

  const tagFilter = useMemo(() => {
    const tags = getAllTags(data);

    return groupBy(uniqBy(tags, 'value'), (tag) => tag.source) as Record<
      TagSource,
      TagFilterOptions[]
    >;
  }, [data]);

  const columns: ColumnsType<Column> = useMemo(
    () => [
      {
        title: t('label.name'),
        dataIndex: TABLE_COLUMNS_KEYS.NAME,
        key: TABLE_COLUMNS_KEYS.NAME,
        accessor: TABLE_COLUMNS_KEYS.NAME,
        width: 200,
        fixed: 'left',
        sorter: getColumnSorter<Column, 'name'>('name'),
        render: (name: Column['name'], record: Column) => {
          const { displayName } = record;

          return (
            <div className="d-inline-flex flex-column hover-icon-group w-max-90">
              <div className="d-inline-flex items-baseline">
                {prepareConstraintIcon({
                  columnName: name,
                  columnConstraint: record.constraint,
                  tableConstraints,
                })}
                <Typography.Text
                  className={classNames('m-b-0 d-block break-word', {
                    'text-grey-600': !isEmpty(displayName),
                  })}
                  data-testid="column-name">
                  {stringToHTML(highlightSearchText(name, searchText))}
                </Typography.Text>
              </div>
              {!isEmpty(displayName) ? (
                // It will render displayName fallback to name
                <Typography.Text
                  className="m-b-0 d-block break-word"
                  data-testid="column-display-name">
                  {stringToHTML(
                    highlightSearchText(getEntityName(record), searchText)
                  )}
                </Typography.Text>
              ) : null}

              {editDisplayNamePermission && (
                <Tooltip placement="right" title={t('label.edit')}>
                  <Button
                    className="cursor-pointer hover-cell-icon w-fit-content"
                    data-testid="edit-displayName-button"
                    style={{
                      color: DE_ACTIVE_COLOR,
                      padding: 0,
                      border: 'none',
                      background: 'transparent',
                    }}
                    onClick={() => handleEditDisplayNameClick(record)}>
                    <IconEdit
                      style={{ color: DE_ACTIVE_COLOR, ...ICON_DIMENSION }}
                    />
                  </Button>
                </Tooltip>
              )}
            </div>
          );
        },
      },
      {
        title: t('label.type'),
        dataIndex: TABLE_COLUMNS_KEYS.DATA_TYPE_DISPLAY,
        key: TABLE_COLUMNS_KEYS.DATA_TYPE_DISPLAY,
        accessor: TABLE_COLUMNS_KEYS.DATA_TYPE_DISPLAY,
        width: 150,
        render: renderDataTypeDisplay,
      },
      {
        title: t('label.description'),
        dataIndex: TABLE_COLUMNS_KEYS.DESCRIPTION,
        key: TABLE_COLUMNS_KEYS.DESCRIPTION,
        accessor: TABLE_COLUMNS_KEYS.DESCRIPTION,
        width: 300,
        render: renderDescription,
      },
      {
        title: t('label.tag-plural'),
        dataIndex: TABLE_COLUMNS_KEYS.TAGS,
        key: TABLE_COLUMNS_KEYS.TAGS,
        accessor: TABLE_COLUMNS_KEYS.TAGS,
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
        accessor: TABLE_COLUMNS_KEYS.TAGS,
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
        render: (_, record) => {
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
      handleUpdate,
      handleTagSelection,
      renderDataTypeDisplay,
      renderDescription,
      handleTagSelection,
      onThreadLinkSelect,
      tagFilter,
      testCaseCounts,
    ]
  );

  const additionalFieldsInEntityNameModal = (
    <Form.Item
      label={t('label.entity-type-plural', {
        entity: t('label.constraint'),
      })}
      name="constraint">
      <Select
        data-testid="constraint-type-select"
        options={COLUMN_CONSTRAINT_TYPE_OPTIONS}
        placeholder={t('label.select-entity', {
          entity: t('label.entity-type-plural', {
            entity: t('label.constraint'),
          }),
        })}
      />
    </Form.Item>
  );

  const handleEditTable = () => {
    history.push({
      pathname: getEntityBulkEditPath(EntityType.TABLE, decodedEntityFqn),
    });
  };

  useEffect(() => {
    setExpandedRowKeys(nestedTableFqnKeys);
  }, [searchText]);

  // Need to scroll to the selected row
  useEffect(() => {
    const columnName = getPartialNameFromTableFQN(decodedEntityFqn, [
      FqnPart.Column,
    ]);
    if (!columnName) {
      return;
    }

    const row = document.querySelector(`[data-row-key="${decodedEntityFqn}"]`);

    if (row && data.length > 0) {
      // Need to wait till table loads fully so that we can call scroll accurately
      setTimeout(() => row.scrollIntoView(), 1);
    }
  }, [data, decodedEntityFqn]);

  const searchProps = useMemo(
    () => ({
      placeholder: t('message.find-in-table'),
      value: searchText,
      onSearch: (value: string) => setSearchText(value),
      onClear: () => setSearchText(''),
    }),
    [searchText]
  );

  return (
    <Row gutter={[0, 16]}>
      <Col id="schemaDetails" span={24}>
        <Table
          className="align-table-filter-left"
          columns={columns}
          data-testid="entity-table"
          dataSource={data}
          defaultVisibleColumns={DEFAULT_SCHEMA_TABLE_VISIBLE_COLUMNS}
          expandable={expandableConfig}
          extraTableFilters={getBulkEditButton(
            tablePermissions.EditAll && !deleted,
            handleEditTable
          )}
          locale={{
            emptyText: <FilterTablePlaceHolder />,
          }}
          pagination={false}
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
