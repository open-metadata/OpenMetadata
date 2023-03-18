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

import { Button, Popover, Space, Table, Typography } from 'antd';
import { ColumnsType } from 'antd/lib/table';
import { LabelType, State, TagSource } from 'generated/type/schema';
import {
  cloneDeep,
  isEmpty,
  isUndefined,
  lowerCase,
  map,
  reduce,
  toLower,
} from 'lodash';
import { EntityTags, TagOption } from 'Models';
import React, { Fragment, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useHistory } from 'react-router-dom';
import { ReactComponent as IconEdit } from '../../assets/svg/ic-edit.svg';
import { ReactComponent as IconRequest } from '../../assets/svg/request-icon.svg';
import { FQN_SEPARATOR_CHAR } from '../../constants/char.constants';
import { EntityField } from '../../constants/Feeds.constants';
import { EntityType, FqnPart } from '../../enums/entity.enum';
import { Column } from '../../generated/entity/data/table';
import { ThreadType } from '../../generated/entity/feed/thread';
import { TagLabel } from '../../generated/type/tagLabel';
import { EntityFieldThreads } from '../../interface/feed.interface';
import { getPartialNameFromTableFQN } from '../../utils/CommonUtils';
import {
  ENTITY_LINK_SEPARATOR,
  getEntityName,
  getFrequentlyJoinedColumns,
} from '../../utils/EntityUtils';
import { getFieldThreadElement } from '../../utils/FeedElementUtils';
import {
  fetchGlossaryTerms,
  getGlossaryTermlist,
} from '../../utils/GlossaryUtils';
import {
  getDataTypeString,
  getTableExpandableConfig,
  makeData,
  prepareConstraintIcon,
} from '../../utils/TableUtils';
import { getClassifications, getTaglist } from '../../utils/TagsUtils';
import {
  getRequestDescriptionPath,
  getRequestTagsPath,
  getUpdateDescriptionPath,
  getUpdateTagsPath,
} from '../../utils/TasksUtils';
import RichTextEditorPreviewer from '../common/rich-text-editor/RichTextEditorPreviewer';
import { ModalWithMarkdownEditor } from '../Modals/ModalWithMarkdownEditor/ModalWithMarkdownEditor';
import {
  EditColumnTag,
  EntityTableProps,
  TableCellRendered,
  TableTagsProps,
} from './EntityTable.interface';
import './EntityTable.style.less';
import EntityTableTags from './EntityTableTags.component';

const EntityTable = ({
  tableColumns,
  searchText,
  onUpdate,
  hasDescriptionEditAccess,
  hasTagEditAccess,
  joins,
  entityFieldThreads,
  isReadOnly = false,
  onThreadLinkSelect,
  entityFqn,
  tableConstraints,
  entityFieldTasks,
}: EntityTableProps) => {
  const history = useHistory();
  const { t } = useTranslation();

  const [searchedColumns, setSearchedColumns] = useState<Column[]>([]);

  const data = React.useMemo(
    () => makeData(searchedColumns),
    [searchedColumns]
  );

  const [editColumn, setEditColumn] = useState<{
    column: Column;
    index: number;
  }>();

  const [isTagLoading, setIsTagLoading] = useState<boolean>(false);
  const [tagFetchFailed, setTagFetchFailed] = useState<boolean>(false);
  const [glossaryTags, setGlossaryTags] = useState<TagOption[]>([]);
  const [classificationTags, setClassificationTags] = useState<TagOption[]>([]);

  const fetchGlossaryTags = async () => {
    setIsTagLoading(true);
    try {
      const res = await fetchGlossaryTerms();

      const glossaryTerms: TagOption[] = getGlossaryTermlist(res).map(
        (tag) => ({ fqn: tag, source: TagSource.Glossary })
      );
      setGlossaryTags(glossaryTerms);
    } catch {
      setTagFetchFailed(true);
    } finally {
      setIsTagLoading(false);
    }
  };

  const fetchClassificationTags = async () => {
    setIsTagLoading(true);
    try {
      const res = await getClassifications();
      const tagList = await getTaglist(res.data);

      const classificationTag: TagOption[] = map(tagList, (tag) => ({
        fqn: tag,
        source: TagSource.Classification,
      }));

      setClassificationTags(classificationTag);
    } catch {
      setTagFetchFailed(true);
    } finally {
      setIsTagLoading(false);
    }
  };

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
      await onUpdate?.(tableCols);
      setEditColumn(undefined);
    } else {
      setEditColumn(undefined);
    }
  };

  const handleTagSelection = (
    selectedTags?: Array<EntityTags>,
    columnFQN = '',
    editColumnTag?: EditColumnTag,
    otherTags?: TagLabel[]
  ) => {
    const newSelectedTags: TagOption[] = map(
      [...(selectedTags || []), ...(otherTags || [])],
      (tag) => ({ fqn: tag.tagFQN, source: tag.source })
    );
    if (newSelectedTags && (editColumnTag || columnFQN)) {
      const tableCols = cloneDeep(tableColumns);
      updateColumnTags(
        tableCols,
        editColumnTag?.column.fullyQualifiedName || columnFQN,
        newSelectedTags
      );
      onUpdate?.(tableCols);
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

  const getColumnName = (cell: Column) => {
    const fqn = cell?.fullyQualifiedName || '';
    const columnName = getPartialNameFromTableFQN(fqn, [FqnPart.NestedColumn]);
    // wrap it in quotes if dot is present

    return columnName.includes(FQN_SEPARATOR_CHAR)
      ? `"${columnName}"`
      : columnName;
  };

  const onRequestDescriptionHandler = (cell: Column) => {
    const field = EntityField.COLUMNS;
    const value = getColumnName(cell);
    history.push(
      getRequestDescriptionPath(
        EntityType.TABLE,
        entityFqn as string,
        field,
        value
      )
    );
  };

  const onUpdateDescriptionHandler = (cell: Column) => {
    const field = EntityField.COLUMNS;
    const value = getColumnName(cell);
    history.push(
      getUpdateDescriptionPath(
        EntityType.TABLE,
        entityFqn as string,
        field,
        value
      )
    );
  };

  const onRequestTagsHandler = (cell: Column) => {
    const field = EntityField.COLUMNS;
    const value = getColumnName(cell);
    history.push(
      getRequestTagsPath(EntityType.TABLE, entityFqn as string, field, value)
    );
  };

  const onUpdateTagsHandler = (cell: Column) => {
    const field = EntityField.COLUMNS;
    const value = getColumnName(cell);
    history.push(
      getUpdateTagsPath(EntityType.TABLE, entityFqn as string, field, value)
    );
  };

  const handleUpdate = (column: Column, index: number) => {
    handleEditColumn(column, index);
  };

  const getRequestDescriptionElement = (cell: Column) => {
    const hasDescription = Boolean(cell?.description ?? '');

    return (
      <Button
        className="p-0 w-7 h-7 tw-flex-none flex-center link-text focus:tw-outline-none hover-cell-icon m-r-xss"
        data-testid="request-description"
        type="text"
        onClick={() =>
          hasDescription
            ? onUpdateDescriptionHandler(cell)
            : onRequestDescriptionHandler(cell)
        }>
        <Popover
          destroyTooltipOnHide
          content={
            hasDescription
              ? t('message.request-update-description')
              : t('message.request-description')
          }
          overlayClassName="ant-popover-request-description"
          trigger="hover"
          zIndex={9999}>
          <IconRequest
            height={16}
            name={t('message.request-description')}
            width={16}
          />
        </Popover>
      </Button>
    );
  };

  const renderDataTypeDisplay: TableCellRendered<Column, 'dataTypeDisplay'> = (
    dataTypeDisplay
  ) => {
    return (
      <>
        {dataTypeDisplay ? (
          isReadOnly || (dataTypeDisplay.length < 25 && !isReadOnly) ? (
            toLower(dataTypeDisplay)
          ) : (
            <Popover
              destroyTooltipOnHide
              content={toLower(dataTypeDisplay)}
              overlayInnerStyle={{
                maxWidth: '420px',
                overflowWrap: 'break-word',
                textAlign: 'center',
              }}
              trigger="hover">
              <Typography.Text ellipsis className="cursor-pointer">
                {dataTypeDisplay}
              </Typography.Text>
            </Popover>
          )
        ) : (
          '--'
        )}
      </>
    );
  };

  const renderDescription: TableCellRendered<Column, 'description'> = (
    description,
    record,
    index
  ) => {
    return (
      <div className="hover-icon-group">
        <div className="d-inline-block">
          <Space
            align="end"
            data-testid="description"
            id={`column-description-${index}`}
            size={4}>
            <div>
              {description ? (
                <RichTextEditorPreviewer markdown={description} />
              ) : (
                <span className="tw-no-description">
                  {t('label.no-entity', {
                    entity: t('label.description'),
                  })}
                </span>
              )}
            </div>
            <div className="d-flex tw--mt-1.5">
              {!isReadOnly ? (
                <Fragment>
                  {hasDescriptionEditAccess && (
                    <>
                      <Button
                        className="p-0 tw-self-start flex-center w-7 h-7 focus:tw-outline-none tw-flex-none hover-cell-icon"
                        type="text"
                        onClick={() => handleUpdate(record, index)}>
                        <IconEdit
                          height={16}
                          name={t('label.edit')}
                          width={16}
                        />
                      </Button>
                    </>
                  )}
                  {getRequestDescriptionElement(record)}
                  {getFieldThreadElement(
                    getColumnName(record),
                    EntityField.DESCRIPTION,
                    entityFieldThreads as EntityFieldThreads[],
                    onThreadLinkSelect,
                    EntityType.TABLE,
                    entityFqn,
                    `columns${ENTITY_LINK_SEPARATOR}${getColumnName(
                      record
                    )}${ENTITY_LINK_SEPARATOR}description`,
                    Boolean(record)
                  )}
                  {getFieldThreadElement(
                    getColumnName(record),
                    EntityField.DESCRIPTION,
                    entityFieldTasks as EntityFieldThreads[],
                    onThreadLinkSelect,
                    EntityType.TABLE,
                    entityFqn,
                    `columns${ENTITY_LINK_SEPARATOR}${getColumnName(
                      record
                    )}${ENTITY_LINK_SEPARATOR}description`,
                    Boolean(record),
                    ThreadType.Task
                  )}
                </Fragment>
              ) : null}
            </div>
          </Space>
        </div>
        {getFrequentlyJoinedColumns(
          record?.name,
          joins,
          t('label.frequently-joined-column-plural')
        )}
      </div>
    );
  };

  const getFilterTags = (tags: TagLabel[]): TableTagsProps =>
    reduce(
      tags,
      (acc, cv) => {
        if (cv.source === TagSource.Classification) {
          return { ...acc, Classification: [...acc.Classification, cv] };
        } else {
          return { ...acc, Glossary: [...acc.Glossary, cv] };
        }
      },
      { Classification: [] as TagLabel[], Glossary: [] as TagLabel[] }
    );

  const columns: ColumnsType<Column> = useMemo(
    () => [
      {
        title: t('label.name'),
        dataIndex: 'name',
        key: 'name',
        accessor: 'name',
        width: 220,
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
        width: 220,
        render: renderDataTypeDisplay,
      },
      {
        title: t('label.scale'),
        dataIndex: 'scale',
        key: 'scale',
        accessor: 'scale',
        width: 80,
        render: (scale: number) => scale || '--',
      },
      {
        title: t('label.precision'),
        dataIndex: 'precision',
        key: 'precision',
        accessor: 'precision',
        width: 80,
        render: (precision: number) => precision || '--',
      },
      {
        title: t('label.ordinal-position'),
        dataIndex: 'ordinalPosition',
        key: 'ordinalPosition',
        accessor: 'ordinalPosition',
        width: 80,
        render: (ordinalPosition: number) => ordinalPosition || '--',
      },
      {
        title: t('label.description'),
        dataIndex: 'description',
        key: 'description',
        accessor: 'description',
        render: renderDescription,
      },
      {
        title: t('label.tag-plural'),
        dataIndex: 'tags',
        key: 'tags',
        accessor: 'tags',
        width: 350,
        render: (tags: TagLabel[], record: Column, index: number) => (
          <EntityTableTags
            allTags={classificationTags}
            dataTestId="classification-tags"
            entityFieldTasks={entityFieldTasks}
            entityFieldThreads={entityFieldThreads}
            entityFqn={entityFqn}
            fetchTags={fetchClassificationTags}
            getColumnName={getColumnName}
            handleTagSelection={handleTagSelection}
            hasTagEditAccess={hasTagEditAccess}
            index={index}
            isReadOnly={isReadOnly}
            isTagLoading={isTagLoading}
            record={record}
            tagFetchFailed={tagFetchFailed}
            tags={getFilterTags(tags)}
            type={TagSource.Classification}
            onRequestTagsHandler={onRequestTagsHandler}
            onThreadLinkSelect={onThreadLinkSelect}
            onUpdate={onUpdate}
            onUpdateTagsHandler={onUpdateTagsHandler}
          />
        ),
      },
      {
        title: t('label.glossary-term-plural'),
        dataIndex: 'tags',
        key: 'tags',
        accessor: 'tags',
        width: 350,
        render: (tags: TagLabel[], record: Column, index: number) => (
          <EntityTableTags
            allTags={glossaryTags}
            dataTestId="glossary-tags"
            entityFieldTasks={entityFieldTasks}
            entityFieldThreads={entityFieldThreads}
            entityFqn={entityFqn}
            fetchTags={fetchGlossaryTags}
            getColumnName={getColumnName}
            handleTagSelection={handleTagSelection}
            hasTagEditAccess={hasTagEditAccess}
            index={index}
            isReadOnly={isReadOnly}
            isTagLoading={isTagLoading}
            record={record}
            tagFetchFailed={tagFetchFailed}
            tags={getFilterTags(tags)}
            type={TagSource.Glossary}
            onRequestTagsHandler={onRequestTagsHandler}
            onThreadLinkSelect={onThreadLinkSelect}
            onUpdate={onUpdate}
            onUpdateTagsHandler={onUpdateTagsHandler}
          />
        ),
      },
    ],
    [isTagLoading, handleUpdate]
  );

  useEffect(() => {
    if (!searchText) {
      setSearchedColumns(tableColumns);
    } else {
      const searchCols = searchInColumns(tableColumns, searchText);
      setSearchedColumns(searchCols);
    }
  }, [searchText, tableColumns]);

  return (
    <>
      <Table
        bordered
        columns={columns}
        data-testid="entity-table"
        dataSource={data}
        expandable={{
          ...getTableExpandableConfig<Column>(),
          rowExpandable: (record) => !isEmpty(record.children),
        }}
        pagination={false}
        scroll={{ x: 1800 }}
        size="small"
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

export default EntityTable;
