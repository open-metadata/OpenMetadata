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
import { Popover } from 'antd';
import classNames from 'classnames';
import { cloneDeep, isEmpty, isNil, isUndefined, lowerCase } from 'lodash';
import { EntityFieldThreads, EntityTags, TagOption } from 'Models';
import React, { Fragment, useEffect, useState } from 'react';
import { Link, useHistory } from 'react-router-dom';
import { useExpanded, useTable } from 'react-table';
import { useAuthContext } from '../../authentication/auth-provider/AuthProvider';
import { FQN_SEPARATOR_CHAR } from '../../constants/char.constants';
import { getTableDetailsPath } from '../../constants/constants';
import { EntityField } from '../../constants/feed.constants';
import { SettledStatus } from '../../enums/axios.enum';
import { EntityType, FqnPart } from '../../enums/entity.enum';
import {
  Column,
  ColumnTest,
  JoinedWith,
} from '../../generated/entity/data/table';
import { ThreadType } from '../../generated/entity/feed/thread';
import { Operation } from '../../generated/entity/policies/accessControl/rule';
import { TestCaseStatus } from '../../generated/tests/tableTest';
import { LabelType, State, TagLabel } from '../../generated/type/tagLabel';
import { useAuth } from '../../hooks/authHooks';
import { ModifiedTableColumn } from '../../interface/dataQuality.interface';
import {
  getHtmlForNonAdminAction,
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
} from '../../utils/TasksUtils';
import NonAdminAction from '../common/non-admin-action/NonAdminAction';
import PopOver from '../common/popover/PopOver';
import RichTextEditorPreviewer from '../common/rich-text-editor/RichTextEditorPreviewer';
import { ModalWithMarkdownEditor } from '../Modals/ModalWithMarkdownEditor/ModalWithMarkdownEditor';
import TagsContainer from '../tags-container/tags-container';
import TagsViewer from '../tags-viewer/tags-viewer';
import { TABLE_HEADERS } from './EntityTable.constant';
import { EntityTableProps } from './EntityTable.interface';

const EntityTable = ({
  tableColumns,
  searchText,
  onUpdate,
  owner,
  hasEditAccess,
  joins,
  entityFieldThreads,
  isReadOnly = false,
  onThreadLinkSelect,
  entityFqn,
  tableConstraints,
  entityFieldTasks,
}: EntityTableProps) => {
  const { isAdminUser, userPermissions } = useAuth();
  const { isAuthDisabled } = useAuthContext();
  const history = useHistory();
  const columns = TABLE_HEADERS;

  const [searchedColumns, setSearchedColumns] = useState<ModifiedTableColumn[]>(
    []
  );

  const data = React.useMemo(
    () => makeData(searchedColumns),
    [searchedColumns]
  );

  const {
    getTableProps,
    getTableBodyProps,
    headerGroups,
    rows,
    prepareRow,
    toggleAllRowsExpanded,
  } = useTable(
    {
      columns,
      data,
      autoResetExpanded: false,
    },
    useExpanded
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
    tableCols: ModifiedTableColumn[],
    changedColName: string,
    description: string
  ) => {
    tableCols?.forEach((col) => {
      if (col.name === changedColName) {
        col.description = description;
      } else {
        updateColumnDescription(
          col?.children as ModifiedTableColumn[],
          changedColName,
          description
        );
      }
    });
  };

  const updateColumnTags = (
    tableCols: ModifiedTableColumn[],
    changedColName: string,
    newColumnTags: Array<TagOption>
  ) => {
    const getUpdatedTags = (column: Column) => {
      const prevTags = column?.tags?.filter((tag) => {
        return newColumnTags
          .map((tag) => tag.fqn)
          .includes(tag?.tagFQN as string);
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
          col?.children as ModifiedTableColumn[],
          changedColName,
          newColumnTags
        );
      }
    });
  };

  const handleEditColumnChange = (columnDescription: string): void => {
    if (editColumn) {
      const tableCols = cloneDeep(tableColumns);
      updateColumnDescription(
        tableCols,
        editColumn.column.name,
        columnDescription
      );
      onUpdate?.(tableCols);
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
          toggleAllRowsExpanded(true);

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

  const checkPermission = () =>
    isAdminUser ||
    hasEditAccess ||
    isAuthDisabled ||
    userPermissions[Operation.EditDescription];

  /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
  const getColumnName = (cell: any) => {
    const fqn = cell?.row?.original?.fullyQualifiedName || '';
    const columnName = getPartialNameFromTableFQN(fqn, [FqnPart.NestedColumn]);
    // wrap it in quotes if dot is present

    return columnName.includes(FQN_SEPARATOR_CHAR)
      ? `"${columnName}"`
      : columnName;
  };

  /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
  const onRequestDescriptionHandler = (cell: any) => {
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

  /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
  const onUpdateDescriptionHandler = (cell: any) => {
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

  /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
  const onRequestTagsHandler = (cell: any) => {
    const field = EntityField.COLUMNS;
    const value = getColumnName(cell);
    history.push(
      getRequestTagsPath(EntityType.TABLE, entityFqn as string, field, value)
    );
  };

  const prepareConstraintIcon = (
    columnName: string,
    columnConstraint?: string
  ) => {
    if (!isNil(columnConstraint)) {
      return getConstraintIcon(columnConstraint);
    } else {
      const flag = tableConstraints?.find((constraint) =>
        constraint.columns?.includes(columnName)
      );
      if (!isUndefined(flag)) {
        return getConstraintIcon(flag.constraintType);
      } else {
        return null;
      }
    }
  };

  const handleUpdate = (column: Column, index: number) => {
    handleEditColumn(column, index);
  };

  /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
  const getRequestDescriptionElement = (cell: any) => {
    const hasDescription = Boolean(cell.value);

    return (
      <button
        className="tw-w-8 tw-h-8 tw-mr-1 tw-flex-none link-text focus:tw-outline-none tw-opacity-0 group-hover:tw-opacity-100"
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

  /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
  const getRequestTagsElement = (cell: any) => {
    const hasTags = !isEmpty(cell.value || []);

    return !hasTags ? (
      <button
        className="tw-w-8 tw-h-8 tw-mr-1 tw-flex-none link-text focus:tw-outline-none tw-opacity-0 group-hover:tw-opacity-100 tw-align-top"
        data-testid="request-tags"
        onClick={() => onRequestTagsHandler(cell)}>
        <Popover
          destroyTooltipOnHide
          content="Request tags"
          overlayClassName="ant-popover-request-description"
          trigger="hover"
          zIndex={9999}>
          <SVGIcons alt="request-tags" icon={Icons.REQUEST} width="16px" />
        </Popover>
      </button>
    ) : null;
  };

  useEffect(() => {
    if (!searchText) {
      setSearchedColumns(tableColumns);
    } else {
      const searchCols = searchInColumns(tableColumns, searchText);
      setSearchedColumns(searchCols);
    }
  }, [searchText, tableColumns]);

  useEffect(() => {
    toggleAllRowsExpanded(isReadOnly);
  }, []);

  return (
    <div className="tw-table-responsive" id="schemaTable">
      <table
        className="tw-w-full"
        {...getTableProps()}
        data-testid="entity-table">
        <thead data-testid="table-header">
          {/* eslint-disable-next-line */}
          {headerGroups.map((headerGroup: any, index: number) => (
            <tr
              className="tableHead-row"
              key={index}
              {...headerGroup.getHeaderGroupProps()}>
              {/* eslint-disable-next-line */}
              {headerGroup.headers.map((column: any, index: number) => (
                <th
                  className={classNames('tableHead-cell', {
                    'tw-w-60':
                      column.id === 'tags' || column.id === 'columnTests',
                  })}
                  data-testid={column.id}
                  key={index}
                  {...column.getHeaderProps()}>
                  {column.render('Header')}
                </th>
              ))}
            </tr>
          ))}
        </thead>

        <tbody {...getTableBodyProps()} data-testid="table-body">
          {/* eslint-disable-next-line */}
          {rows.map((row: any, index: number) => {
            prepareRow(row);

            return (
              <tr
                className={classNames('tableBody-row')}
                data-testid="row"
                key={index}
                {...row.getRowProps()}>
                {/* eslint-disable-next-line */}
                {row.cells.map((cell: any, index: number) => {
                  const columnTests =
                    cell.column.id === 'columnTests'
                      ? ((cell.value ?? []) as ColumnTest[])
                      : ([] as ColumnTest[]);
                  const columnTestLength = columnTests.length;
                  const failingTests = columnTests.filter((test) =>
                    test.results?.some(
                      (t) => t.testCaseStatus === TestCaseStatus.Failed
                    )
                  );
                  const passingTests = columnTests.filter((test) =>
                    test.results?.some(
                      (t) => t.testCaseStatus === TestCaseStatus.Success
                    )
                  );

                  return (
                    <td
                      className={classNames(
                        'tableBody-cell tw-group tw-relative tw-align-baseline'
                      )}
                      key={index}
                      {...cell.getCellProps()}>
                      {row.canExpand && cell.column.id === 'name' ? (
                        <span
                          {...row.getToggleRowExpandedProps({})}
                          className="tw-mr-2 tw-cursor-pointer"
                          style={{
                            marginLeft: `${row.depth * 35}px`,
                          }}>
                          <FontAwesomeIcon
                            icon={row.isExpanded ? faCaretDown : faCaretRight}
                          />
                        </span>
                      ) : null}

                      {cell.column.id === 'columnTests' && (
                        <Fragment>
                          {columnTestLength ? (
                            <Fragment>
                              {failingTests.length ? (
                                <div className="tw-flex">
                                  <p className="tw-mr-2">
                                    <FontAwesomeIcon
                                      className="tw-text-status-failed"
                                      icon="times"
                                    />
                                  </p>
                                  <p>
                                    {`${failingTests.length}/${columnTestLength} tests failing`}
                                  </p>
                                </div>
                              ) : (
                                <Fragment>
                                  {passingTests.length ? (
                                    <div className="tw-flex">
                                      <div className="tw-mr-2">
                                        <FontAwesomeIcon
                                          className="tw-text-status-success"
                                          icon="check-square"
                                        />
                                      </div>
                                      <p>{`${passingTests.length} tests`}</p>
                                    </div>
                                  ) : (
                                    <p>{`${columnTestLength} tests`}</p>
                                  )}
                                </Fragment>
                              )}
                            </Fragment>
                          ) : (
                            '--'
                          )}
                        </Fragment>
                      )}

                      {cell.column.id === 'dataTypeDisplay' && (
                        <>
                          {isReadOnly ? (
                            <div className="tw-flex tw-flex-wrap tw-w-60 tw-overflow-x-auto">
                              <RichTextEditorPreviewer
                                markdown={cell.value.toLowerCase()}
                              />
                            </div>
                          ) : (
                            <>
                              {cell.value.length > 25 ? (
                                <span>
                                  <PopOver
                                    html={
                                      <div className="tw-break-words">
                                        <span>{cell.value.toLowerCase()}</span>
                                      </div>
                                    }
                                    position="bottom"
                                    theme="light"
                                    trigger="click">
                                    <div className="tw-cursor-pointer tw-underline tw-inline-block">
                                      <RichTextEditorPreviewer
                                        markdown={`${cell.value
                                          .slice(0, 20)
                                          .toLowerCase()}...`}
                                      />
                                    </div>
                                  </PopOver>
                                </span>
                              ) : (
                                cell.value.toLowerCase()
                              )}
                            </>
                          )}
                        </>
                      )}

                      {cell.column.id === 'tags' && (
                        <>
                          {isReadOnly ? (
                            <div className="tw-flex tw-flex-wrap">
                              <TagsViewer
                                sizeCap={-1}
                                tags={cell.value || []}
                              />
                            </div>
                          ) : (
                            <div
                              data-testid="tags-wrapper"
                              onClick={() => {
                                if (!editColumnTag) {
                                  handleEditColumnTag(row.original, row.id);
                                  // Fetch tags and terms only once
                                  if (allTags.length === 0 || tagFetchFailed) {
                                    fetchTagsAndGlossaryTerms();
                                  }
                                }
                              }}>
                              <NonAdminAction
                                html={getHtmlForNonAdminAction(Boolean(owner))}
                                isOwner={hasEditAccess}
                                permission={Operation.EditTags}
                                position="left"
                                trigger="click">
                                <TagsContainer
                                  showAddTagButton
                                  editable={editColumnTag?.index === row.id}
                                  isLoading={
                                    isTagLoading &&
                                    editColumnTag?.index === row.id
                                  }
                                  selectedTags={cell.value || []}
                                  size="small"
                                  tagList={allTags}
                                  type="label"
                                  onCancel={() => {
                                    handleTagSelection();
                                  }}
                                  onSelectionChange={(tags) => {
                                    handleTagSelection(tags, row.original.name);
                                  }}
                                />
                              </NonAdminAction>
                              <div className="tw-mt-1">
                                {getRequestTagsElement(cell)}
                                {getFieldThreadElement(
                                  getColumnName(cell),
                                  'tags',
                                  entityFieldThreads as EntityFieldThreads[],
                                  onThreadLinkSelect,
                                  EntityType.TABLE,
                                  entityFqn,
                                  `columns${ENTITY_LINK_SEPARATOR}${getColumnName(
                                    cell
                                  )}${ENTITY_LINK_SEPARATOR}tags`,
                                  Boolean(cell.value.length)
                                )}
                                {getFieldThreadElement(
                                  getColumnName(cell),
                                  EntityField.TAGS,
                                  entityFieldTasks as EntityFieldThreads[],
                                  onThreadLinkSelect,
                                  EntityType.TABLE,
                                  entityFqn,
                                  `${
                                    EntityField.COLUMNS
                                  }${ENTITY_LINK_SEPARATOR}${getColumnName(
                                    cell
                                  )}${ENTITY_LINK_SEPARATOR}${
                                    EntityField.TAGS
                                  }`,
                                  Boolean(cell.value),
                                  ThreadType.Task
                                )}
                              </div>
                            </div>
                          )}
                        </>
                      )}
                      {cell.column.id === 'description' && (
                        <div>
                          <div className="tw-inline-block">
                            <div
                              className="tw-flex"
                              data-testid="description"
                              id={`column-description-${index}`}>
                              <div>
                                {cell.value ? (
                                  <RichTextEditorPreviewer
                                    markdown={cell.value}
                                  />
                                ) : (
                                  <span className="tw-no-description">
                                    No description{' '}
                                  </span>
                                )}
                              </div>
                              <div className="tw-flex tw--mt-1.5">
                                {!isReadOnly ? (
                                  <Fragment>
                                    {checkPermission() && (
                                      <button
                                        className="tw-self-start tw-w-8 tw-h-8 tw-opacity-0 tw-ml-1 group-hover:tw-opacity-100 focus:tw-outline-none tw-flex-none"
                                        onClick={() =>
                                          handleUpdate(row.original, row.id)
                                        }>
                                        <SVGIcons
                                          alt="edit"
                                          icon="icon-edit"
                                          title="Edit"
                                          width="14px"
                                        />
                                      </button>
                                    )}
                                    {getRequestDescriptionElement(cell)}
                                    {getFieldThreadElement(
                                      getColumnName(cell),
                                      EntityField.DESCRIPTION,
                                      entityFieldThreads as EntityFieldThreads[],
                                      onThreadLinkSelect,
                                      EntityType.TABLE,
                                      entityFqn,
                                      `columns${ENTITY_LINK_SEPARATOR}${getColumnName(
                                        cell
                                      )}${ENTITY_LINK_SEPARATOR}description`,
                                      Boolean(cell.value)
                                    )}
                                    {getFieldThreadElement(
                                      getColumnName(cell),
                                      EntityField.DESCRIPTION,
                                      entityFieldTasks as EntityFieldThreads[],
                                      onThreadLinkSelect,
                                      EntityType.TABLE,
                                      entityFqn,
                                      `columns${ENTITY_LINK_SEPARATOR}${getColumnName(
                                        cell
                                      )}${ENTITY_LINK_SEPARATOR}description`,
                                      Boolean(cell.value),
                                      ThreadType.Task
                                    )}
                                  </Fragment>
                                ) : null}
                              </div>
                            </div>
                          </div>
                          {checkIfJoinsAvailable(row.original.name) && (
                            <div
                              className="tw-mt-3"
                              data-testid="frequently-joined-columns">
                              <span className="tw-text-grey-muted tw-mr-1">
                                Frequently joined columns:
                              </span>
                              <span>
                                {getFrequentlyJoinedWithColumns(
                                  row.original.name
                                )
                                  .slice(0, 3)
                                  .map((columnJoin, index) => (
                                    <Fragment key={index}>
                                      {index > 0 && (
                                        <span className="tw-mr-1">,</span>
                                      )}
                                      <Link
                                        className="link-text"
                                        to={getTableDetailsPath(
                                          getTableFQNFromColumnFQN(
                                            columnJoin?.fullyQualifiedName as string
                                          ),
                                          getPartialNameFromTableFQN(
                                            columnJoin?.fullyQualifiedName as string,
                                            [FqnPart.Column]
                                          )
                                        )}>
                                        {getPartialNameFromTableFQN(
                                          columnJoin?.fullyQualifiedName as string,
                                          [
                                            FqnPart.Database,
                                            FqnPart.Table,
                                            FqnPart.Column,
                                          ],
                                          FQN_SEPARATOR_CHAR
                                        )}
                                      </Link>
                                    </Fragment>
                                  ))}

                                {getFrequentlyJoinedWithColumns(
                                  row.original.name
                                ).length > 3 && (
                                  <PopOver
                                    html={
                                      <div className="tw-text-left">
                                        {getFrequentlyJoinedWithColumns(
                                          row.original.name
                                        )
                                          ?.slice(3)
                                          .map((columnJoin, index) => (
                                            <Fragment key={index}>
                                              <a
                                                className="link-text tw-block tw-py-1"
                                                href={getTableDetailsPath(
                                                  getTableFQNFromColumnFQN(
                                                    columnJoin?.fullyQualifiedName as string
                                                  ),
                                                  getPartialNameFromTableFQN(
                                                    columnJoin?.fullyQualifiedName as string,
                                                    [FqnPart.Column]
                                                  )
                                                )}>
                                                {getPartialNameFromTableFQN(
                                                  columnJoin?.fullyQualifiedName as string,
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
                                    <span className="show-more tw-ml-1 tw-underline">
                                      ...
                                    </span>
                                  </PopOver>
                                )}
                              </span>
                            </div>
                          )}
                        </div>
                      )}
                      {cell.column.id === 'name' && (
                        <Fragment>
                          {isReadOnly ? (
                            <div className="tw-inline-block">
                              <RichTextEditorPreviewer markdown={cell.value} />
                            </div>
                          ) : (
                            <span
                              style={{
                                paddingLeft: `${
                                  row.canExpand ? '0px' : `${row.depth * 35}px`
                                }`,
                              }}>
                              {prepareConstraintIcon(
                                cell.value,
                                row.original.constraint
                              )}
                              {cell.render('Cell')}
                            </span>
                          )}
                        </Fragment>
                      )}
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
      {editColumn && (
        <ModalWithMarkdownEditor
          header={`Edit column: "${editColumn.column.name}"`}
          placeholder="Enter Column Description"
          value={editColumn.column.description as string}
          onCancel={closeEditColumnModal}
          onSave={handleEditColumnChange}
        />
      )}
    </div>
  );
};

export default EntityTable;
