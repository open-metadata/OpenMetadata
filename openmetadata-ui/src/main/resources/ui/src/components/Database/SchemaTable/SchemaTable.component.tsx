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

import { Button, Form, Select, Tooltip, Typography } from 'antd';
import { ColumnsType } from 'antd/lib/table';
import { ExpandableConfig } from 'antd/lib/table/interface';
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
import {
  getColumnSorter,
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
import FilterTablePlaceHolder from '../../common/ErrorWithPlaceholder/FilterTablePlaceHolder';
import Table from '../../common/Table/Table';
import TestCaseStatusSummaryIndicator from '../../common/TestCaseStatusSummaryIndicator/TestCaseStatusSummaryIndicator.component';
import { useGenericContext } from '../../GenericProvider/GenericProvider';
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
  SchemaTableProps,
  TableCellRendered,
  UpdatedColumnFieldData,
} from './SchemaTable.interface';

const SchemaTable = ({
  searchText,
  hasDescriptionEditAccess,
  hasTagEditAccess,
  hasGlossaryTermEditAccess,
  isReadOnly = false,
  onUpdate,
  onThreadLinkSelect,
}: SchemaTableProps) => {
  const { t } = useTranslation();
  const [testCaseSummary, setTestCaseSummary] = useState<TestSummary>();
  const [searchedColumns, setSearchedColumns] = useState<Column[]>([]);
  const [expandedRowKeys, setExpandedRowKeys] = useState<string[]>([]);

  const [editColumn, setEditColumn] = useState<Column>();

  const { fqn: decodedEntityFqn } = useFqn();

  const [editColumnDisplayName, setEditColumnDisplayName] = useState<Column>();
  const { permissions: tablePermissions, data: table } =
    useGenericContext<TableType>();

  const { testCaseCounts, tableColumns, joins, tableConstraints } = useMemo(
    () => ({
      testCaseCounts: testCaseSummary?.columnTestSummary ?? [],
      tableColumns: table?.columns ?? [],
      joins: table?.joins?.columnJoins ?? [],
      tableConstraints: table?.tableConstraints,
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
      await onUpdate(tableCols);
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
      await onUpdate(tableCols);
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
          hasEditPermission={hasDescriptionEditAccess}
          index={index}
          isReadOnly={isReadOnly}
          onClick={() => handleUpdate(record)}
          onThreadLinkSelect={onThreadLinkSelect}
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
      await onUpdate(tableCols);
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
        dataIndex: 'name',
        key: 'name',
        accessor: 'name',
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
                  className="m-b-0 d-block text-grey-muted break-word"
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

              {(tablePermissions?.EditAll ||
                tablePermissions?.EditDisplayName) &&
                !isReadOnly && (
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
        dataIndex: 'dataTypeDisplay',
        key: 'dataTypeDisplay',
        accessor: 'dataTypeDisplay',
        width: 150,
        render: renderDataTypeDisplay,
      },
      {
        title: t('label.description'),
        dataIndex: 'description',
        key: 'description',
        accessor: 'description',
        width: 300,
        render: renderDescription,
      },
      {
        title: t('label.tag-plural'),
        dataIndex: 'tags',
        key: 'tags',
        accessor: 'tags',
        width: 230,
        filterIcon: columnFilterIcon,
        render: (tags: TagLabel[], record: Column, index: number) => (
          <TableTags<Column>
            entityFqn={tableFqn}
            entityType={EntityType.TABLE}
            handleTagSelection={handleTagSelection}
            hasTagEditAccess={hasTagEditAccess}
            index={index}
            isReadOnly={isReadOnly}
            record={record}
            tags={tags}
            type={TagSource.Classification}
            onThreadLinkSelect={onThreadLinkSelect}
          />
        ),
        filters: tagFilter.Classification,
        filterDropdown: ColumnFilter,
        onFilter: searchTagInData,
      },
      {
        title: t('label.glossary-term-plural'),
        dataIndex: 'tags',
        key: 'glossary',
        accessor: 'tags',
        width: 230,
        filterIcon: columnFilterIcon,
        render: (tags: TagLabel[], record: Column, index: number) => (
          <TableTags<Column>
            entityFqn={tableFqn}
            entityType={EntityType.TABLE}
            handleTagSelection={handleTagSelection}
            hasTagEditAccess={hasGlossaryTermEditAccess}
            index={index}
            isReadOnly={isReadOnly}
            record={record}
            tags={tags}
            type={TagSource.Glossary}
            onThreadLinkSelect={onThreadLinkSelect}
          />
        ),
        filters: tagFilter.Glossary,
        filterDropdown: ColumnFilter,
        onFilter: searchTagInData,
      },
      {
        title: t('label.data-quality'),
        dataIndex: 'dataQualityTest',
        key: 'dataQualityTest',
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
      isReadOnly,
      tableConstraints,
      hasTagEditAccess,
      hasGlossaryTermEditAccess,
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

  return (
    <>
      <Table
        bordered
        className="m-b-sm align-table-filter-left"
        columns={columns}
        data-testid="entity-table"
        dataSource={data}
        expandable={expandableConfig}
        locale={{
          emptyText: <FilterTablePlaceHolder />,
        }}
        pagination={false}
        rowKey="fullyQualifiedName"
        scroll={TABLE_SCROLL_VALUE}
        size="middle"
      />
      {editColumn && (
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
    </>
  );
};

export default SchemaTable;
