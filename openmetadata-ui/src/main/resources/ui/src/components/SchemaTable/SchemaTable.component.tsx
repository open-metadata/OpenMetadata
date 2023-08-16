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

import { Space, Table, Tooltip, Typography } from 'antd';
import { ColumnsType } from 'antd/lib/table';
import { ExpandableConfig } from 'antd/lib/table/interface';
import FilterTablePlaceHolder from 'components/common/error-with-placeholder/FilterTablePlaceHolder';
import TableDescription from 'components/TableDescription/TableDescription.component';
import TableTags from 'components/TableTags/TableTags.component';
import { TABLE_SCROLL_VALUE } from 'constants/Table.constants';
import { LabelType, State, TagSource } from 'generated/type/schema';
import {
  cloneDeep,
  isEmpty,
  isUndefined,
  lowerCase,
  map,
  reduce,
  sortBy,
  toLower,
} from 'lodash';
import { EntityTags, TagOption } from 'Models';
import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { EntityType } from '../../enums/entity.enum';
import { Column } from '../../generated/entity/data/table';
import { TagLabel } from '../../generated/type/tagLabel';
import {
  getEntityName,
  getFrequentlyJoinedColumns,
} from '../../utils/EntityUtils';
import {
  getDataTypeString,
  getTableExpandableConfig,
  makeData,
  prepareConstraintIcon,
} from '../../utils/TableUtils';
import { ModalWithMarkdownEditor } from '../Modals/ModalWithMarkdownEditor/ModalWithMarkdownEditor';
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
  entityFqn,
  tableConstraints,
}: SchemaTableProps) => {
  const { t } = useTranslation();

  const [searchedColumns, setSearchedColumns] = useState<Column[]>([]);
  const [expandedRowKeys, setExpandedRowKeys] = useState<string[]>([]);

  const sortByOrdinalPosition = useMemo(
    () => sortBy(tableColumns, 'ordinalPosition'),
    [tableColumns]
  );

  const data = React.useMemo(
    () => makeData(searchedColumns),
    [searchedColumns]
  );

  const [editColumn, setEditColumn] = useState<{
    column: Column;
    index: number;
  }>();

  const handleEditColumn = (column: Column, index: number): void => {
    setEditColumn({ column, index });
  };
  const closeEditColumnModal = (): void => {
    setEditColumn(undefined);
  };

  const updateColumnDescription = (
    tableCols: Column[],
    changedColFQN: string,
    description: string
  ) => {
    tableCols?.forEach((col) => {
      if (col.fullyQualifiedName === changedColFQN) {
        col.description = description;
      } else {
        updateColumnDescription(
          col?.children as Column[],
          changedColFQN,
          description
        );
      }
    });
  };

  const getUpdatedTags = (
    column: Column,
    newColumnTags: Array<EntityTags>
  ): TagLabel[] => {
    const prevTagsFqn = column?.tags?.map((tag) => tag.tagFQN);

    return reduce(
      newColumnTags,
      (acc: Array<EntityTags>, cv: TagOption) => {
        if (prevTagsFqn?.includes(cv.fqn)) {
          const prev = column?.tags?.find((tag) => tag.tagFQN === cv.fqn);

          return [...acc, prev];
        } else {
          return [
            ...acc,
            {
              labelType: LabelType.Manual,
              state: State.Confirmed,
              source: cv.source,
              tagFQN: cv.fqn,
            },
          ];
        }
      },
      []
    );
  };

  const updateColumnTags = (
    tableCols: Column[],
    changedColFQN: string,
    newColumnTags: Array<TagOption>
  ) => {
    tableCols?.forEach((col) => {
      if (col.fullyQualifiedName === changedColFQN) {
        col.tags = getUpdatedTags(col, newColumnTags);
      } else {
        updateColumnTags(
          col?.children as Column[],
          changedColFQN,
          newColumnTags
        );
      }
    });
  };

  const handleEditColumnChange = async (columnDescription: string) => {
    if (editColumn && editColumn.column.fullyQualifiedName) {
      const tableCols = cloneDeep(tableColumns);
      updateColumnDescription(
        tableCols,
        editColumn.column.fullyQualifiedName,
        columnDescription
      );
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
    const newSelectedTags: TagOption[] = map(selectedTags, (tag) => ({
      fqn: tag.tagFQN,
      source: tag.source,
    }));
    if (newSelectedTags && editColumnTag) {
      const tableCols = cloneDeep(tableColumns);
      updateColumnTags(
        tableCols,
        editColumnTag.fullyQualifiedName ?? '',
        newSelectedTags
      );
      await onUpdate(tableCols);
    }
  };

  const searchInColumns = (table: Column[], searchText: string): Column[] => {
    const searchedValue: Column[] = table.reduce((searchedCols, column) => {
      const isContainData =
        lowerCase(column.name).includes(searchText) ||
        lowerCase(column.description).includes(searchText) ||
        lowerCase(getDataTypeString(column.dataType)).includes(searchText);

      if (isContainData) {
        return [...searchedCols, column];
      } else if (!isUndefined(column.children)) {
        const searchedChildren = searchInColumns(column.children, searchText);
        if (searchedChildren.length > 0) {
          return [
            ...searchedCols,
            {
              ...column,
              children: searchedChildren,
            },
          ];
        }
      }

      return searchedCols;
    }, [] as Column[]);

    return searchedValue;
  };

  const handleUpdate = (column: Column, index: number) => {
    handleEditColumn(column, index);
  };

  const renderDataTypeDisplay: TableCellRendered<Column, 'dataTypeDisplay'> = (
    dataTypeDisplay,
    record
  ) => {
    return (
      <>
        {dataTypeDisplay ? (
          isReadOnly || (dataTypeDisplay.length < 25 && !isReadOnly) ? (
            toLower(dataTypeDisplay)
          ) : (
            <Tooltip title={toLower(dataTypeDisplay)}>
              <Typography.Text ellipsis className="cursor-pointer">
                {dataTypeDisplay || record.dataType}
              </Typography.Text>
            </Tooltip>
          )
        ) : (
          '--'
        )}
      </>
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
          }}
          entityFqn={entityFqn}
          entityType={EntityType.TABLE}
          hasEditPermission={hasDescriptionEditAccess}
          index={index}
          isReadOnly={isReadOnly}
          onClick={() => handleUpdate(record, index)}
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

  const columns: ColumnsType<Column> = useMemo(
    () => [
      {
        title: t('label.name'),
        dataIndex: 'name',
        key: 'name',
        accessor: 'name',
        width: 180,
        fixed: 'left',
        render: (name: Column['name'], record: Column) => (
          <Space
            align="start"
            className="w-max-90 vertical-align-inherit"
            size={2}>
            {prepareConstraintIcon(name, record.constraint, tableConstraints)}
            <span className="break-word">{getEntityName(record)}</span>
          </Space>
        ),
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
        render: (tags: TagLabel[], record: Column, index: number) => (
          <TableTags<Column>
            entityFqn={entityFqn}
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
      },
      {
        title: t('label.glossary-term-plural'),
        dataIndex: 'tags',
        key: 'tags',
        accessor: 'tags',
        width: 250,
        render: (tags: TagLabel[], record: Column, index: number) => (
          <TableTags<Column>
            entityFqn={entityFqn}
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
      },
    ],
    [
      entityFqn,
      isReadOnly,
      tableConstraints,
      hasTagEditAccess,
      handleUpdate,
      handleTagSelection,
      renderDataTypeDisplay,
      renderDescription,
      handleTagSelection,
      onThreadLinkSelect,
    ]
  );
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
          })}: "${editColumn.column.name}"`}
          placeholder={t('message.enter-column-description')}
          value={editColumn.column.description as string}
          visible={Boolean(editColumn)}
          onCancel={closeEditColumnModal}
          onSave={handleEditColumnChange}
        />
      )}
    </>
  );
};

export default SchemaTable;
