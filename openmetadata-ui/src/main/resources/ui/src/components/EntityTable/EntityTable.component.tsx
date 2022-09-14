/*
 *  Copyright 2021 Collate
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

import { faCaretDown, faCaretRight } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { Popover, Table } from 'antd';
import classNames from 'classnames';
import { cloneDeep, isEmpty, isNil, isUndefined, lowerCase } from 'lodash';
import { EntityFieldThreads, EntityTags, TagOption } from 'Models';
import React, {
  Fragment,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { Link, useHistory } from 'react-router-dom';
import { FQN_SEPARATOR_CHAR } from '../../constants/char.constants';
import { getTableDetailsPath } from '../../constants/constants';
import { EntityField } from '../../constants/feed.constants';
import { SettledStatus } from '../../enums/axios.enum';
import { EntityType, FqnPart } from '../../enums/entity.enum';
import { Column, JoinedWith } from '../../generated/entity/data/table';
import { ThreadType } from '../../generated/entity/feed/thread';
import { LabelType, State, TagLabel } from '../../generated/type/tagLabel';
import {
  getPartialNameFromTableFQN,
  getTableFQNFromColumnFQN,
} from '../../utils/CommonUtils';
import { ENTITY_LINK_SEPARATOR } from '../../utils/EntityUtils';
import { getFieldThreadElement } from '../../utils/FeedElementUtils';
import {
  fetchGlossaryTerms,
  getGlossaryTermlist,
} from '../../utils/GlossaryUtils';
import SVGIcons, { Icons } from '../../utils/SvgUtils';
import {
  getConstraintIcon,
  getDataTypeString,
  makeData,
} from '../../utils/TableUtils';
import { getTagCategories, getTaglist } from '../../utils/TagsUtils';
import {
  getRequestDescriptionPath,
  getRequestTagsPath,
  getUpdateDescriptionPath,
  getUpdateTagsPath,
} from '../../utils/TasksUtils';
import PopOver from '../common/popover/PopOver';
import RichTextEditorPreviewer from '../common/rich-text-editor/RichTextEditorPreviewer';
import { ModalWithMarkdownEditor } from '../Modals/ModalWithMarkdownEditor/ModalWithMarkdownEditor';
import TagsContainer from '../tags-container/tags-container';
import TagsViewer from '../tags-viewer/tags-viewer';
import { TABLE_HEADERS_V1 } from './EntityTable.constants';
import { EntityTableProps } from './EntityTable.interface';
import './EntityTable.style.less';

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

  const [searchedColumns, setSearchedColumns] = useState<Column[]>([]);

  const data = React.useMemo(
    () => makeData(searchedColumns),
    [searchedColumns]
  );

  const [editColumn, setEditColumn] = useState<{
    column: Column;
    index: number;
  }>();

  const [editColumnTag, setEditColumnTag] = useState<{
    column: Column;
    index: number;
  }>();

  const [allTags, setAllTags] = useState<Array<TagOption>>([]);
  const [isTagLoading, setIsTagLoading] = useState<boolean>(false);
  const [tagFetchFailed, setTagFetchFailed] = useState<boolean>(false);

  const fetchTagsAndGlossaryTerms = () => {
    setIsTagLoading(true);
    Promise.allSettled([getTagCategories(), fetchGlossaryTerms()])
      .then((values) => {
        let tagsAndTerms: TagOption[] = [];
        if (
          values[0].status === SettledStatus.FULFILLED &&
          values[0].value.data
        ) {
          tagsAndTerms = getTaglist(values[0].value.data).map((tag) => {
            return { fqn: tag, source: 'Tag' };
          });
        }
        if (
          values[1].status === SettledStatus.FULFILLED &&
          values[1].value &&
          values[1].value.length > 0
        ) {
          const glossaryTerms: TagOption[] = getGlossaryTermlist(
            values[1].value
          ).map((tag) => {
            return { fqn: tag, source: 'Glossary' };
          });
          tagsAndTerms = [...tagsAndTerms, ...glossaryTerms];
        }
        setAllTags(tagsAndTerms);
        if (
          values[0].status === SettledStatus.FULFILLED &&
          values[1].status === SettledStatus.FULFILLED
        ) {
          setTagFetchFailed(false);
        } else {
          setTagFetchFailed(true);
        }
        setIsTagLoading(false);
      })
      .catch(() => {
        setAllTags([]);
        setTagFetchFailed(true);
      })
      .finally(() => {
        setIsTagLoading(false);
      });
  };

  const handleEditColumn = (column: Column, index: number): void => {
    setEditColumn({ column, index });
  };
  const closeEditColumnModal = (): void => {
    setEditColumn(undefined);
  };

  const handleEditColumnTag = (column: Column, index: number): void => {
    setEditColumnTag({ column, index });
  };

  const updateColumnDescription = (
    tableCols: Column[],
    changedColName: string,
    description: string
  ) => {
    tableCols?.forEach((col) => {
      if (col.name === changedColName) {
        col.description = description;
      } else {
        updateColumnDescription(
          col?.children as Column[],
          changedColName,
          description
        );
      }
    });
  };

  const updateColumnTags = (
    tableCols: Column[],
    changedColName: string,
    newColumnTags: Array<TagOption>
  ) => {
    const getUpdatedTags = (column: Column) => {
      const prevTags = column?.tags?.filter((tag) => {
        return newColumnTags.map((tag) => tag.fqn).includes(tag.tagFQN);
      });

      const newTags: Array<EntityTags> = newColumnTags
        .filter((tag) => {
          return !prevTags?.map((prevTag) => prevTag.tagFQN).includes(tag.fqn);
        })
        .map((tag) => ({
          labelType: LabelType.Manual,
          state: State.Confirmed,
          source: tag.source,
          tagFQN: tag.fqn,
        }));
      const updatedTags = [...(prevTags as TagLabel[]), ...newTags];

      return updatedTags;
    };

    tableCols?.forEach((col) => {
      if (col.name === changedColName) {
        col.tags = getUpdatedTags(col);
      } else {
        updateColumnTags(
          col?.children as Column[],
          changedColName,
          newColumnTags
        );
      }
    });
  };

  const handleEditColumnChange = async (columnDescription: string) => {
    if (editColumn) {
      const tableCols = cloneDeep(tableColumns);
      updateColumnDescription(
        tableCols,
        editColumn.column.name,
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
    columnName = ''
  ) => {
    const newSelectedTags: TagOption[] | undefined = selectedTags?.map(
      (tag) => {
        return { fqn: tag.tagFQN, source: tag.source };
      }
    );
    if (newSelectedTags && (editColumnTag || columnName)) {
      const tableCols = cloneDeep(tableColumns);
      updateColumnTags(
        tableCols,
        editColumnTag?.column.name || columnName,
        newSelectedTags
      );
      onUpdate?.(tableCols);
    }
    setEditColumnTag(undefined);
  };

  const getFrequentlyJoinedWithColumns = (
    columnName: string
  ): Array<JoinedWith> => {
    return (
      joins.find((join) => join.columnName === columnName)?.joinedWith || []
    );
  };
  const checkIfJoinsAvailable = (columnName: string): boolean => {
    return (
      joins &&
      Boolean(joins.length) &&
      Boolean(joins.find((join) => join.columnName === columnName))
    );
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

  const prepareConstraintIcon = (
    columnName: string,
    columnConstraint?: string
  ) => {
    if (!isNil(columnConstraint)) {
      return getConstraintIcon(columnConstraint, 'tw-mr-2');
    } else {
      const flag = tableConstraints?.find((constraint) =>
        constraint.columns?.includes(columnName)
      );
      if (!isUndefined(flag)) {
        return getConstraintIcon(flag.constraintType, 'tw-mr-2');
      } else {
        return null;
      }
    }
  };

  const handleUpdate = (column: Column, index: number) => {
    handleEditColumn(column, index);
  };

  const getRequestDescriptionElement = (cell: Column) => {
    const hasDescription = Boolean(cell?.description ?? '');

    return (
      <button
        className="tw-w-7 tw-h-7 tw-flex-none link-text focus:tw-outline-none hover-cell-icon"
        data-testid="request-description"
        onClick={() =>
          hasDescription
            ? onUpdateDescriptionHandler(cell)
            : onRequestDescriptionHandler(cell)
        }>
        <Popover
          destroyTooltipOnHide
          content={
            hasDescription
              ? 'Request update description'
              : 'Request description'
          }
          overlayClassName="ant-popover-request-description"
          trigger="hover"
          zIndex={9999}>
          <SVGIcons
            alt="request-description"
            icon={Icons.REQUEST}
            width="16px"
          />
        </Popover>
      </button>
    );
  };

  const getRequestTagsElement = (cell: Column) => {
    const hasTags = !isEmpty(cell?.tags || []);
    const text = hasTags ? 'Update request tags' : 'Request tags';

    return (
      <button
        className="tw-w-7 tw-h-7 tw-flex-none link-text focus:tw-outline-none tw-align-top hover-cell-icon"
        data-testid="request-tags"
        onClick={() =>
          hasTags ? onUpdateTagsHandler(cell) : onRequestTagsHandler(cell)
        }>
        <Popover
          destroyTooltipOnHide
          content={text}
          overlayClassName="ant-popover-request-description"
          trigger="hover"
          zIndex={9999}>
          <SVGIcons alt="request-tags" icon={Icons.REQUEST} width="16px" />
        </Popover>
      </button>
    );
  };

  const getDataTypeDisplayCell = (record: Column | Column) => {
    return (
      <>
        {record.dataTypeDisplay ? (
          <>
            {isReadOnly ? (
              <div className="tw-flex tw-flex-wrap tw-w-60 tw-overflow-x-auto">
                <RichTextEditorPreviewer
                  markdown={record.dataTypeDisplay.toLowerCase()}
                />
              </div>
            ) : (
              <>
                {record.dataTypeDisplay.length > 25 ? (
                  <span>
                    <PopOver
                      html={
                        <div className="tw-break-words">
                          <span>{record.dataTypeDisplay.toLowerCase()}</span>
                        </div>
                      }
                      key="pop-over"
                      position="bottom"
                      theme="light"
                      trigger="click">
                      <div className="tw-cursor-pointer tw-underline tw-inline-block">
                        <RichTextEditorPreviewer
                          markdown={`${record.dataTypeDisplay
                            .slice(0, 20)
                            .toLowerCase()}...`}
                        />
                      </div>
                    </PopOver>
                  </span>
                ) : (
                  record.dataTypeDisplay.toLowerCase()
                )}
              </>
            )}
          </>
        ) : (
          '--'
        )}
      </>
    );
  };

  const getDescriptionCell = (index: number, record: Column | Column) => {
    return (
      <div className="hover-icon-group">
        <div className="tw-inline-block">
          <div
            className="tw-flex"
            data-testid="description"
            id={`column-description-${index}`}>
            <div>
              {record?.description ? (
                <RichTextEditorPreviewer markdown={record?.description} />
              ) : (
                <span className="tw-no-description">No description</span>
              )}
            </div>
            <div className="tw-flex tw--mt-1.5">
              {!isReadOnly ? (
                <Fragment>
                  {hasDescriptionEditAccess && (
                    <>
                      <button
                        className="tw-self-start tw-w-7 tw-h-7 focus:tw-outline-none tw-flex-none hover-cell-icon"
                        onClick={() => handleUpdate(record, index)}>
                        <SVGIcons
                          alt="edit"
                          icon="icon-edit"
                          title="Edit"
                          width="16px"
                        />
                      </button>
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
          </div>
        </div>
        {checkIfJoinsAvailable(record?.name) && (
          <div className="tw-mt-3" data-testid="frequently-joined-columns">
            <span className="tw-text-grey-muted tw-mr-1">
              Frequently joined columns:
            </span>
            <span>
              {getFrequentlyJoinedWithColumns(record?.name)
                .slice(0, 3)
                .map((columnJoin, index) => (
                  <Fragment key={index}>
                    {index > 0 && <span className="tw-mr-1">,</span>}
                    <Link
                      className="link-text"
                      to={getTableDetailsPath(
                        getTableFQNFromColumnFQN(columnJoin.fullyQualifiedName),
                        getPartialNameFromTableFQN(
                          columnJoin.fullyQualifiedName,
                          [FqnPart.Column]
                        )
                      )}>
                      {getPartialNameFromTableFQN(
                        columnJoin.fullyQualifiedName,
                        [FqnPart.Database, FqnPart.Table, FqnPart.Column],
                        FQN_SEPARATOR_CHAR
                      )}
                    </Link>
                  </Fragment>
                ))}

              {getFrequentlyJoinedWithColumns(record?.name).length > 3 && (
                <PopOver
                  html={
                    <div className="tw-text-left">
                      {getFrequentlyJoinedWithColumns(record?.name)
                        ?.slice(3)
                        .map((columnJoin, index) => (
                          <Fragment key={index}>
                            <a
                              className="link-text tw-block tw-py-1"
                              href={getTableDetailsPath(
                                getTableFQNFromColumnFQN(
                                  columnJoin?.fullyQualifiedName
                                ),
                                getPartialNameFromTableFQN(
                                  columnJoin?.fullyQualifiedName,
                                  [FqnPart.Column]
                                )
                              )}>
                              {getPartialNameFromTableFQN(
                                columnJoin?.fullyQualifiedName,
                                [
                                  FqnPart.Database,
                                  FqnPart.Table,
                                  FqnPart.Column,
                                ]
                              )}
                            </a>
                          </Fragment>
                        ))}
                    </div>
                  }
                  position="bottom"
                  theme="light"
                  trigger="click">
                  <span className="show-more tw-ml-1 tw-underline">...</span>
                </PopOver>
              )}
            </span>
          </div>
        )}
      </div>
    );
  };

  const getTagsCell = (index: number, record: Column | Column) => {
    return (
      <div className="hover-icon-group">
        {isReadOnly ? (
          <div className="tw-flex tw-flex-wrap">
            <TagsViewer sizeCap={-1} tags={record?.tags || []} />
          </div>
        ) : (
          <div
            className={classNames(
              `tw-flex tw-justify-content`,
              editColumnTag?.index === index || !isEmpty(record.tags)
                ? 'tw-flex-col tw-items-start'
                : 'tw-items-center'
            )}
            data-testid="tags-wrapper"
            onClick={() => {
              if (!editColumnTag) {
                handleEditColumnTag(record, index);
                // Fetch tags and terms only once
                if (allTags.length === 0 || tagFetchFailed) {
                  fetchTagsAndGlossaryTerms();
                }
              }
            }}>
            <TagsContainer
              editable={editColumnTag?.index === index}
              isLoading={isTagLoading && editColumnTag?.index === index}
              selectedTags={record?.tags || []}
              showAddTagButton={hasTagEditAccess}
              size="small"
              tagList={allTags}
              type="label"
              onCancel={() => {
                handleTagSelection();
              }}
              onSelectionChange={(tags) => {
                handleTagSelection(tags, record?.name);
              }}
            />

            <div className="tw-mt-1 tw-flex">
              {getRequestTagsElement(record)}
              {getFieldThreadElement(
                getColumnName(record),
                'tags',
                entityFieldThreads as EntityFieldThreads[],
                onThreadLinkSelect,
                EntityType.TABLE,
                entityFqn,
                `columns${ENTITY_LINK_SEPARATOR}${getColumnName(
                  record
                )}${ENTITY_LINK_SEPARATOR}tags`,
                Boolean(record?.name?.length)
              )}
              {getFieldThreadElement(
                getColumnName(record),
                EntityField.TAGS,
                entityFieldTasks as EntityFieldThreads[],
                onThreadLinkSelect,
                EntityType.TABLE,
                entityFqn,
                `${EntityField.COLUMNS}${ENTITY_LINK_SEPARATOR}${getColumnName(
                  record
                )}${ENTITY_LINK_SEPARATOR}${EntityField.TAGS}`,
                Boolean(record?.name),
                ThreadType.Task
              )}
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderCell = useCallback(
    (key: string, record: Column | Column, index: number) => {
      switch (key) {
        case TABLE_HEADERS_V1.dataTypeDisplay:
          return getDataTypeDisplayCell(record);

        case TABLE_HEADERS_V1.description:
          return getDescriptionCell(index, record);

        case TABLE_HEADERS_V1.tags:
          return getTagsCell(index, record);

        default:
          return (
            <Fragment>
              {isReadOnly ? (
                <div className="tw-inline-block">
                  <RichTextEditorPreviewer markdown={record.name} />
                </div>
              ) : (
                <span>
                  {prepareConstraintIcon(record.name, record.constraint)}
                  <span>{record.name}</span>
                </span>
              )}
            </Fragment>
          );
      }
    },
    [editColumnTag, isTagLoading, handleUpdate, handleTagSelection]
  );

  const columns = useMemo(
    () => [
      {
        title: 'Name',
        dataIndex: 'name',
        key: 'name',
        accessor: 'name',
        ellipsis: true,
        width: 180,
        render: (_: Array<unknown>, record: Column, index: number) =>
          renderCell(TABLE_HEADERS_V1.name, record, index),
      },
      {
        title: 'Type',
        dataIndex: 'dataTypeDisplay',
        key: 'dataTypeDisplay',
        accessor: 'dataTypeDisplay',
        ellipsis: true,
        width: 200,
        render: (_: Array<unknown>, record: Column, index: number) => {
          return renderCell(TABLE_HEADERS_V1.dataTypeDisplay, record, index);
        },
      },
      {
        title: 'Description',
        dataIndex: 'description',
        key: 'description',
        accessor: 'description',
        render: (_: Array<unknown>, record: Column, index: number) =>
          renderCell(TABLE_HEADERS_V1.description, record, index),
      },
      {
        title: 'Tags',
        dataIndex: 'tags',
        key: 'tags',
        accessor: 'tags',
        width: 272,
        render: (_: Array<unknown>, record: Column | Column, index: number) =>
          renderCell(TABLE_HEADERS_V1.tags, record, index),
      },
    ],
    [editColumnTag, isTagLoading, renderCell]
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
        columns={columns}
        data-testid="entity-table"
        dataSource={data}
        expandable={{
          defaultExpandedRowKeys: [],
          expandIcon: ({ expanded, onExpand, record }) =>
            record.children ? (
              <FontAwesomeIcon
                className="tw-mr-2 tw-cursor-pointer"
                icon={expanded ? faCaretDown : faCaretRight}
                onClick={(e) =>
                  onExpand(
                    record,
                    e as unknown as React.MouseEvent<HTMLElement, MouseEvent>
                  )
                }
              />
            ) : null,
        }}
        pagination={false}
        size="small"
      />
      {editColumn && (
        <ModalWithMarkdownEditor
          header={`Edit column: "${editColumn.column.name}"`}
          placeholder="Enter Column Description"
          value={editColumn.column.description as string}
          onCancel={closeEditColumnModal}
          onSave={handleEditColumnChange}
        />
      )}
    </>
  );
};

export default EntityTable;
