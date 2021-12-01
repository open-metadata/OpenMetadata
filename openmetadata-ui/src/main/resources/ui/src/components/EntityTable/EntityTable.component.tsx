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

import classNames from 'classnames';
import { cloneDeep, isUndefined, lowerCase, upperCase } from 'lodash';
import { EntityTags } from 'Models';
import React, { Fragment, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useExpanded, useTable } from 'react-table';
import { getDatasetDetailsPath } from '../../constants/constants';
import {
  Column,
  ColumnJoins,
  DataType,
  JoinedWith,
  Table,
} from '../../generated/entity/data/table';
import { LabelType, State, TagLabel } from '../../generated/type/tagLabel';
import {
  getHtmlForNonAdminAction,
  getPartialNameFromFQN,
  getTableFQNFromColumnFQN,
  isEven,
} from '../../utils/CommonUtils';
import SVGIcons from '../../utils/SvgUtils';
import { getConstraintIcon, makeData } from '../../utils/TableUtils';
import { getTagCategories, getTaglist } from '../../utils/TagsUtils';
import NonAdminAction from '../common/non-admin-action/NonAdminAction';
import PopOver from '../common/popover/PopOver';
import RichTextEditorPreviewer from '../common/rich-text-editor/RichTextEditorPreviewer';
import { ModalWithMarkdownEditor } from '../Modals/ModalWithMarkdownEditor/ModalWithMarkdownEditor';
import TagsContainer from '../tags-container/tags-container';
import Tags from '../tags/tags';

type Props = {
  owner: Table['owner'];
  tableColumns: Table['columns'];
  joins: Array<ColumnJoins>;
  searchText?: string;
  columnName: string;
  hasEditAccess: boolean;
  isReadOnly?: boolean;
  onUpdate?: (columns: Table['columns']) => void;
};

const EntityTable = ({
  tableColumns,
  searchText,
  onUpdate,
  owner,
  hasEditAccess,
  joins,
  isReadOnly = false,
}: Props) => {
  const columns = React.useMemo(
    () => [
      {
        Header: 'Column Name',
        accessor: 'name',
      },
      {
        Header: 'Data Type',
        accessor: 'dataTypeDisplay',
      },
      {
        Header: 'Description',
        accessor: 'description',
      },
      {
        Header: 'Tags',
        accessor: 'tags',
      },
    ],
    []
  );

  const [searchedColumns, setSearchedColumns] = useState<Table['columns']>([]);

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

  const [allTags, setAllTags] = useState<Array<string>>([]);

  const getDataTypeString = (dataType: string): string => {
    switch (upperCase(dataType)) {
      case DataType.String:
      case DataType.Char:
      case DataType.Text:
      case DataType.Varchar:
      case DataType.Mediumtext:
      case DataType.Mediumblob:
      case DataType.Blob:
        return 'varchar';
      case DataType.Timestamp:
      case DataType.Time:
        return 'timestamp';
      case DataType.Int:
      case DataType.Float:
      case DataType.Smallint:
      case DataType.Bigint:
      case DataType.Numeric:
      case DataType.Tinyint:
        return 'numeric';
      case DataType.Boolean:
      case DataType.Enum:
        return 'boolean';
      default:
        return dataType;
    }
  };

  const fetchTags = () => {
    getTagCategories().then((res) => {
      if (res.data) {
        setAllTags(getTaglist(res.data));
      }
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

  const getCurrentRows = (editColumn: { column: Column; index: number }) => {
    const data = [];
    const indexs = editColumn.index.toString().split('.');
    for (let index = 0; index < indexs.length; index++) {
      if (index === 0) {
        // eslint-disable-next-line
        const column = rows.find((row: any) => row.id === indexs[index]);
        if (column) {
          data.push(column);
        }
      } else {
        const column = rows.find(
          // eslint-disable-next-line
          (row: any) => row.id === indexs.slice(0, index + 1).join('.')
        );
        if (column) {
          data.push(column);
        }
      }
    }

    return data;
  };

  const handleEditColumnChange = (columnDescription: string): void => {
    if (editColumn) {
      const tableCols = cloneDeep(tableColumns);
      const indexs = getCurrentRows(editColumn).map((row) => row.index);
      const columnArr: Array<Column & { index: number }> = [] as Array<
        Column & { index: number }
      >;
      if (indexs.length > 0) {
        indexs.forEach((value, index) => {
          if (index === 0) {
            columnArr.push({
              ...tableCols[value],
              index: value,
              description:
                indexs.length === 1
                  ? columnDescription
                  : tableCols[value].description,
            });

            return;
          }
          if (index === indexs.length - 1) {
            columnArr.push({
              ...columnArr?.[index - 1]?.children?.[value],
              description: columnDescription,
              index: value,
            } as Column & { index: number });

            return;
          }
          columnArr.push({
            ...columnArr?.[index - 1]?.children?.[value],
            index: value,
          } as Column & { index: number });
        });

        for (let index = columnArr.length - 1; index >= 0; index--) {
          const colChildren = columnArr[index - 1]?.children as Array<
            Column & { index: number }
          >;
          if (colChildren) {
            colChildren[columnArr[index].index] = columnArr[index];

            columnArr[index - 1] = {
              ...columnArr[index - 1],
              children: colChildren.map((child) => {
                /* eslint-disable-next-line */
                const { index, ...rest } = child;

                return rest;
              }),
            };
          }
        }
        /* eslint-disable-next-line */
        const { index, ...updatedColumn } = columnArr[0];
        const updatedColumns = [
          ...tableCols.slice(0, indexs[0]),
          {
            ...updatedColumn,
          },
          ...tableCols.slice(indexs[0] + 1),
        ];

        onUpdate?.(updatedColumns);
      }

      setEditColumn(undefined);
    } else {
      setEditColumn(undefined);
    }
  };

  const handleTagSelection = (selectedTags?: Array<EntityTags>) => {
    const newSelectedTags = selectedTags?.map((tag) => tag.tagFQN);
    if (newSelectedTags && editColumnTag) {
      const tableCols = cloneDeep(tableColumns);
      const indexs = getCurrentRows(editColumnTag).map((row) => row.index);
      const columnArr: Array<Column & { index: number }> = [] as Array<
        Column & { index: number }
      >;
      if (indexs.length > 0) {
        const getUpdatedTags = (column: Column) => {
          const prevTags = column?.tags?.filter((tag) => {
            return newSelectedTags.includes(tag?.tagFQN as string);
          });

          const newTags: Array<EntityTags> = newSelectedTags
            .filter((tag) => {
              return !prevTags?.map((prevTag) => prevTag.tagFQN).includes(tag);
            })
            .map((tag) => ({
              labelType: LabelType.Manual,
              state: State.Confirmed,
              tagFQN: tag,
            }));
          const updatedTags = [...(prevTags as TagLabel[]), ...newTags];

          return updatedTags;
        };
        indexs.forEach((value, index) => {
          if (index === 0) {
            columnArr.push({
              ...tableCols[value],
              index: value,
              tags:
                indexs.length === 1
                  ? getUpdatedTags(tableCols[value])
                  : tableCols[value].tags,
            });

            return;
          }
          if (index === indexs.length - 1) {
            columnArr.push({
              ...columnArr?.[index - 1]?.children?.[value],
              tags: getUpdatedTags(tableCols[value]),
              index: value,
            } as Column & { index: number });

            return;
          }
          columnArr.push({
            ...columnArr?.[index - 1]?.children?.[value],
            index: value,
          } as Column & { index: number });
        });

        for (let index = columnArr.length - 1; index >= 0; index--) {
          const colChildren = columnArr[index - 1]?.children as Array<
            Column & { index: number }
          >;
          if (colChildren) {
            colChildren[columnArr[index].index] = columnArr[index];

            columnArr[index - 1] = {
              ...columnArr[index - 1],
              children: colChildren.map((child) => {
                /* eslint-disable-next-line */
                const { index, ...rest } = child;

                return rest;
              }),
            };
          }
        }

        /* eslint-disable-next-line */
        const { index, ...updatedColumn } = columnArr[0];
        const updatedColumns = [
          ...tableCols.slice(0, indexs[0]),
          {
            ...updatedColumn,
          },
          ...tableCols.slice(indexs[0] + 1),
        ];

        onUpdate?.(updatedColumns);
      }
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

  useEffect(() => {
    if (!searchText) {
      setSearchedColumns(tableColumns);
    } else {
      const searchCols = searchInColumns(tableColumns, searchText);
      setSearchedColumns(searchCols);
    }
  }, [searchText, tableColumns]);

  useEffect(() => {
    fetchTags();
    toggleAllRowsExpanded(isReadOnly);
  }, []);

  return (
    <div className="tw-table-responsive" id="schemaTable">
      <table className="tw-w-full" {...getTableProps()}>
        <thead>
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
                    'tw-w-60': column.id === 'tags',
                  })}
                  key={index}
                  {...column.getHeaderProps()}>
                  {column.render('Header')}
                </th>
              ))}
            </tr>
          ))}
        </thead>

        <tbody {...getTableBodyProps()}>
          {/* eslint-disable-next-line */}
          {rows.map((row: any, index: number) => {
            prepareRow(row);

            return (
              <tr
                className={classNames(
                  'tableBody-row',
                  !isEven(index + 1) ? 'odd-row' : null
                )}
                key={index}
                {...row.getRowProps()}>
                {/* eslint-disable-next-line */}
                {row.cells.map((cell: any, index: number) => {
                  return (
                    <td
                      className={classNames(
                        'tableBody-cell tw-group tw-relative'
                      )}
                      key={index}
                      {...cell.getCellProps()}>
                      {row.canExpand && cell.column.id === 'name' ? (
                        <span
                          {...row.getToggleRowExpandedProps({})}
                          className="tw-mr-2 tw-cursor-pointer"
                          style={{
                            marginLeft: `${row.depth * 25}px`,
                          }}>
                          {row.isExpanded ? (
                            <i className="fas fa-caret-down" />
                          ) : (
                            <i className="fas fa-caret-right" />
                          )}
                        </span>
                      ) : null}

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
                                        <RichTextEditorPreviewer
                                          markdown={cell.value.toLowerCase()}
                                        />
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
                              {cell.value?.map(
                                (
                                  tag: TagLabel & {
                                    added: boolean;
                                    removed: boolean;
                                  },
                                  i: number
                                ) => (
                                  <Tags
                                    className={classNames(
                                      { 'diff-added': tag?.added },
                                      { 'diff-removed': tag?.removed }
                                    )}
                                    key={i}
                                    tag={`#${tag.tagFQN}`}
                                  />
                                )
                              )}
                            </div>
                          ) : (
                            <div
                              onClick={() => {
                                if (!editColumnTag) {
                                  handleEditColumnTag(row.original, row.id);
                                }
                              }}>
                              <NonAdminAction
                                html={getHtmlForNonAdminAction(Boolean(owner))}
                                isOwner={hasEditAccess}
                                position="left"
                                trigger="click">
                                <TagsContainer
                                  editable={editColumnTag?.index === row.id}
                                  selectedTags={cell.value || []}
                                  tagList={allTags}
                                  onCancel={() => {
                                    handleTagSelection();
                                  }}
                                  onSelectionChange={(tags) => {
                                    handleTagSelection(tags);
                                  }}>
                                  {cell.value.length ? (
                                    <button className="tw-opacity-0 tw-ml-1 group-hover:tw-opacity-100 focus:tw-outline-none">
                                      <SVGIcons
                                        alt="edit"
                                        icon="icon-edit"
                                        title="Edit"
                                        width="10px"
                                      />
                                    </button>
                                  ) : (
                                    <span className="tw-opacity-60 group-hover:tw-opacity-100 tw-text-grey-muted group-hover:tw-text-primary">
                                      <Tags tag="+ Add tag" type="outlined" />
                                    </span>
                                  )}
                                </TagsContainer>
                              </NonAdminAction>
                            </div>
                          )}
                        </>
                      )}
                      {cell.column.id === 'description' && (
                        <div>
                          <NonAdminAction
                            html={getHtmlForNonAdminAction(Boolean(owner))}
                            isOwner={hasEditAccess}
                            position="top">
                            <div className="tw-inline-block">
                              <div
                                className={classNames('tw-flex', {
                                  'tw-cursor-pointer hover:tw-underline':
                                    !isReadOnly,
                                })}
                                data-testid="description"
                                id={`column-description-${index}`}
                                onClick={() => {
                                  if (!isReadOnly) {
                                    handleEditColumn(row.original, row.id);
                                  }
                                }}>
                                <div>
                                  {cell.value ? (
                                    <RichTextEditorPreviewer
                                      markdown={cell.value}
                                    />
                                  ) : (
                                    <span className="tw-no-description">
                                      No description added
                                    </span>
                                  )}
                                </div>
                                {!isReadOnly ? (
                                  <button className="tw-self-start tw-w-8 tw-h-auto tw-opacity-0 tw-ml-1 group-hover:tw-opacity-100 focus:tw-outline-none">
                                    <SVGIcons
                                      alt="edit"
                                      icon="icon-edit"
                                      title="Edit"
                                      width="10px"
                                    />
                                  </button>
                                ) : null}
                              </div>
                            </div>
                          </NonAdminAction>
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
                                        to={getDatasetDetailsPath(
                                          getTableFQNFromColumnFQN(
                                            columnJoin?.fullyQualifiedName as string
                                          ),
                                          getPartialNameFromFQN(
                                            columnJoin?.fullyQualifiedName as string,
                                            ['column']
                                          )
                                        )}>
                                        {getPartialNameFromFQN(
                                          columnJoin?.fullyQualifiedName as string,
                                          ['database', 'table', 'column']
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
                                                href={getDatasetDetailsPath(
                                                  getTableFQNFromColumnFQN(
                                                    columnJoin?.fullyQualifiedName as string
                                                  ),
                                                  getPartialNameFromFQN(
                                                    columnJoin?.fullyQualifiedName as string,
                                                    ['column']
                                                  )
                                                )}>
                                                {getPartialNameFromFQN(
                                                  columnJoin?.fullyQualifiedName as string,
                                                  [
                                                    'database',
                                                    'table',
                                                    'column',
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
                        <>
                          {isReadOnly ? (
                            <div className="tw-inline-block">
                              <RichTextEditorPreviewer markdown={cell.value} />
                            </div>
                          ) : (
                            <span
                              style={{
                                paddingLeft: `${
                                  row.canExpand ? '0px' : `${row.depth * 25}px`
                                }`,
                              }}>
                              {getConstraintIcon(row.original.constraint)}
                              {cell.render('Cell')}
                            </span>
                          )}
                        </>
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
