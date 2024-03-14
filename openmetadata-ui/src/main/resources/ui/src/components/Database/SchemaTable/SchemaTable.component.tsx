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

import { Button, Tooltip, Typography } from 'antd';
import { ColumnsType } from 'antd/lib/table';
import { ExpandableConfig } from 'antd/lib/table/interface';
import {
  cloneDeep,
  groupBy,
  isEmpty,
  isUndefined,
  set,
  sortBy,
  toLower,
  uniqBy,
} from 'lodash';
import { EntityTags, TagFilterOptions } from 'Models';
import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ReactComponent as IconEdit } from '../../../assets/svg/edit-new.svg';
import {
  DE_ACTIVE_COLOR,
  ICON_DIMENSION,
  NO_DATA_PLACEHOLDER,
} from '../../../constants/constants';
import { TABLE_SCROLL_VALUE } from '../../../constants/Table.constants';
import { usePermissionProvider } from '../../../context/PermissionProvider/PermissionProvider';
import {
  OperationPermission,
  ResourceEntity,
} from '../../../context/PermissionProvider/PermissionProvider.interface';
import { EntityType } from '../../../enums/entity.enum';
import { Column } from '../../../generated/entity/data/table';
import { TagSource } from '../../../generated/type/schema';
import { TagLabel } from '../../../generated/type/tagLabel';
import { useFqn } from '../../../hooks/useFqn';
import {
  getEntityName,
  getFrequentlyJoinedColumns,
  searchInColumns,
} from '../../../utils/EntityUtils';
import {
  getAllTags,
  searchTagInData,
} from '../../../utils/TableTags/TableTags.utils';
import {
  getAllRowKeysByKeyName,
  getFilterIcon,
  getTableExpandableConfig,
  makeData,
  prepareConstraintIcon,
  updateFieldTags,
} from '../../../utils/TableUtils';
import { showErrorToast } from '../../../utils/ToastUtils';
import FilterTablePlaceHolder from '../../common/ErrorWithPlaceholder/FilterTablePlaceHolder';
import Table from '../../common/Table/Table';
import EntityNameModal from '../../Modals/EntityNameModal/EntityNameModal.component';
import { EntityName } from '../../Modals/EntityNameModal/EntityNameModal.interface';
import { ModalWithMarkdownEditor } from '../../Modals/ModalWithMarkdownEditor/ModalWithMarkdownEditor';
import { ColumnFilter } from '../ColumnFilter/ColumnFilter.component';
import TableDescription from '../TableDescription/TableDescription.component';
import TableTags from '../TableTags/TableTags.component';
import { SchemaTableProps, TableCellRendered } from './SchemaTable.interface';

const SchemaTable = ({
  tableColumns,
  searchText,
  onUpdate,
  hasDescriptionEditAccess,
  hasTagEditAccess,
  joins,
  isReadOnly = false,
  onThreadLinkSelect,
  tableConstraints,
}: SchemaTableProps) => {
  const { t } = useTranslation();

  const [searchedColumns, setSearchedColumns] = useState<Column[]>([]);
  const [expandedRowKeys, setExpandedRowKeys] = useState<string[]>([]);
  const [tablePermissions, setTablePermissions] =
    useState<OperationPermission>();
  const [editColumn, setEditColumn] = useState<Column>();

  const { fqn: decodedEntityFqn } = useFqn();

  const [editColumnDisplayName, setEditColumnDisplayName] = useState<Column>();
  const { getEntityPermissionByFqn } = usePermissionProvider();

  const sortByOrdinalPosition = useMemo(
    () => sortBy(tableColumns, 'ordinalPosition'),
    [tableColumns]
  );

  const fetchResourcePermission = async (entityFqn: string) => {
    try {
      const permissions = await getEntityPermissionByFqn(
        ResourceEntity.TABLE,
        entityFqn
      );
      setTablePermissions(permissions);
    } catch (error) {
      showErrorToast(
        t('server.fetch-entity-permissions-error', {
          entity: entityFqn,
        })
      );
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
    if (!isEmpty(decodedEntityFqn)) {
      fetchResourcePermission(decodedEntityFqn);
    }
  }, [decodedEntityFqn]);

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
  }: {
    fqn: string;
    field: keyof Column;
    value?: string;
    columns: Column[];
  }) => {
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

    return isReadOnly ||
      (displayValue && displayValue.length < 25 && !isReadOnly) ? (
      toLower(displayValue)
    ) : (
      <Tooltip title={toLower(displayValue)}>
        <Typography.Text ellipsis className="cursor-pointer">
          {displayValue}
        </Typography.Text>
      </Tooltip>
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
            field: record.description,
            record,
          }}
          entityFqn={decodedEntityFqn}
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

  const handleEditDisplayName = async ({ displayName }: EntityName) => {
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
                  {name}
                </Typography.Text>
              </div>
              {!isEmpty(displayName) ? (
                // It will render displayName fallback to name
                <Typography.Text
                  className="m-b-0 d-block break-word"
                  data-testid="column-display-name">
                  {getEntityName(record)}
                </Typography.Text>
              ) : null}
              {(tablePermissions?.EditAll ||
                tablePermissions?.EditDisplayName) && (
                <Tooltip
                  placement="right"
                  title={t('label.edit-entity', {
                    entity: t('label.display-name'),
                  })}>
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
        ellipsis: true,
        width: 180,
        render: renderDataTypeDisplay,
      },
      {
        title: t('label.description'),
        dataIndex: 'description',
        key: 'description',
        accessor: 'description',
        width: 320,
        render: renderDescription,
      },
      {
        title: t('label.tag-plural'),
        dataIndex: 'tags',
        key: 'tags',
        accessor: 'tags',
        width: 250,
        filterIcon: getFilterIcon('tag-filter'),
        render: (tags: TagLabel[], record: Column, index: number) => (
          <TableTags<Column>
            entityFqn={decodedEntityFqn}
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
        width: 250,
        filterIcon: getFilterIcon('glossary-filter'),
        render: (tags: TagLabel[], record: Column, index: number) => (
          <TableTags<Column>
            entityFqn={decodedEntityFqn}
            entityType={EntityType.TABLE}
            handleTagSelection={handleTagSelection}
            hasTagEditAccess={hasTagEditAccess}
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
    ],
    [
      decodedEntityFqn,
      isReadOnly,
      tableConstraints,
      hasTagEditAccess,
      handleUpdate,
      handleTagSelection,
      renderDataTypeDisplay,
      renderDescription,
      handleTagSelection,
      onThreadLinkSelect,
      tagFilter,
    ]
  );

  useEffect(() => {
    setExpandedRowKeys(nestedTableFqnKeys);
  }, [searchText]);

  return (
    <>
      <Table
        bordered
        className="m-b-sm"
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
          entity={editColumnDisplayName}
          title={`${t('label.edit-entity', {
            entity: t('label.column'),
          })}: "${editColumnDisplayName?.name}"`}
          visible={Boolean(editColumnDisplayName)}
          onCancel={() => setEditColumnDisplayName(undefined)}
          onSave={handleEditDisplayName}
        />
      )}
    </>
  );
};

export default SchemaTable;
