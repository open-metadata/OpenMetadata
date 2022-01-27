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
import { lowerCase, upperCase } from 'lodash';
import { EntityTags } from 'Models';
import React, {
  Fragment,
  FunctionComponent,
  useEffect,
  useRef,
  useState,
} from 'react';
import { Link } from 'react-router-dom';
import { getTableDetailsPath } from '../../constants/constants';
import {
  Column,
  ColumnJoins,
  DataType,
  JoinedWith,
  Table,
} from '../../generated/entity/data/table';
import { TagLabel } from '../../generated/type/tagLabel';
import {
  getHtmlForNonAdminAction,
  getPartialNameFromFQN,
  getTableFQNFromColumnFQN,
  isEven,
} from '../../utils/CommonUtils';
import SVGIcons from '../../utils/SvgUtils';
import { getConstraintIcon } from '../../utils/TableUtils';
import { getTagCategories, getTaglist } from '../../utils/TagsUtils';
import NonAdminAction from '../common/non-admin-action/NonAdminAction';
import PopOver from '../common/popover/PopOver';
import RichTextEditorPreviewer from '../common/rich-text-editor/RichTextEditorPreviewer';
// import { EditSchemaColumnModal } from '../Modals/EditSchemaColumnModal/EditSchemaColumnModal';
import { ModalWithMarkdownEditor } from '../Modals/ModalWithMarkdownEditor/ModalWithMarkdownEditor';
import TagsContainer from '../tags-container/tags-container';
import Tags from '../tags/tags';

type Props = {
  owner: Table['owner'];
  columns: Table['columns'];
  joins: Array<ColumnJoins>;
  searchText?: string;
  onUpdate: (columns: Table['columns']) => void;
  columnName: string;
  hasEditAccess: boolean;
};

const SchemaTable: FunctionComponent<Props> = ({
  columns,
  joins,
  searchText = '',
  onUpdate,
  columnName,
  hasEditAccess,
  owner,
}: Props) => {
  const [editColumn, setEditColumn] = useState<{
    column: Column;
    index: number;
  }>();

  const [editColumnTag, setEditColumnTag] = useState<{
    column: Column;
    index: number;
  }>();

  const [searchedColumns, setSearchedColumns] = useState<Table['columns']>([]);

  const [allTags, setAllTags] = useState<Array<string>>([]);
  const rowRef = useRef<HTMLTableRowElement>(null);
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

  const checkIfJoinsAvailable = (columnName: string): boolean => {
    return (
      joins &&
      Boolean(joins.length) &&
      Boolean(joins.find((join) => join.columnName === columnName))
    );
  };

  const getFrequentlyJoinedWithColumns = (
    columnName: string
  ): Array<JoinedWith> => {
    return (
      joins.find((join) => join.columnName === columnName)?.joinedWith || []
    );
  };

  const fetchTags = () => {
    getTagCategories().then((res) => {
      if (res.data) {
        setAllTags(getTaglist(res.data));
      }
    });
  };

  const updateColumnTags = (
    column: Column,
    index: number,
    selectedTags: Array<string>
  ) => {
    const prevTags = column?.tags?.filter((tag) => {
      return selectedTags.includes(tag?.tagFQN as string);
    });

    const newTags: Array<EntityTags> = selectedTags
      .filter((tag) => {
        return !prevTags?.map((prevTag) => prevTag.tagFQN).includes(tag);
      })
      .map((tag) => ({
        labelType: 'Manual',
        state: 'Confirmed',
        tagFQN: tag,
      }));
    const updatedTags = [...(prevTags as TagLabel[]), ...newTags];
    const updatedColumns = [
      ...columns.slice(0, index),
      {
        ...column,
        tags: updatedTags,
      },
      ...columns.slice(index + 1),
    ];
    onUpdate(updatedColumns);
  };

  const handleEditColumnTag = (column: Column, index: number): void => {
    setEditColumnTag({ column, index });
  };

  const handleTagSelection = (selectedTags?: Array<EntityTags>) => {
    const newSelectedTags = selectedTags?.map((tag) => tag.tagFQN);
    if (newSelectedTags && editColumnTag) {
      updateColumnTags(
        editColumnTag.column,
        editColumnTag.index,
        newSelectedTags
      );
    }
    setEditColumnTag(undefined);
  };

  const handleEditColumn = (column: Column, index: number): void => {
    setEditColumn({ column, index });
  };

  const closeEditColumnModal = (): void => {
    setEditColumn(undefined);
  };

  const handleEditColumnChange = (columnDescription: string): void => {
    if (editColumn) {
      const updatedColumns = [
        ...columns.slice(0, editColumn.index),
        {
          ...editColumn.column,
          description: columnDescription,
        },
        ...columns.slice(editColumn.index + 1),
      ];
      onUpdate(updatedColumns);
      setEditColumn(undefined);
    } else {
      setEditColumn(undefined);
    }
  };

  useEffect(() => {
    if (!searchText) {
      setSearchedColumns(columns);
    } else {
      const searchCols = columns.filter((column) => {
        return (
          lowerCase(column.name).includes(searchText) ||
          lowerCase(column.description).includes(searchText) ||
          lowerCase(getDataTypeString(column.dataType)).includes(searchText)
        );
      });
      setSearchedColumns(searchCols);
    }
  }, [searchText, columns]);

  useEffect(() => {
    closeEditColumnModal();
  }, [columns]);

  useEffect(() => {
    fetchTags();
  }, []);

  useEffect(() => {
    if (rowRef.current) {
      rowRef.current.scrollIntoView({
        behavior: 'smooth',
        inline: 'center',
        block: 'center',
      });
    }
  }, [columnName, rowRef.current]);

  return (
    <>
      <div className="tw-table-responsive">
        <table className="tw-w-full" data-testid="schema-table">
          <thead>
            <tr className="tableHead-row">
              <th className="tableHead-cell">Column Name</th>
              <th className="tableHead-cell">Data Type</th>
              <th className="tableHead-cell">Description</th>
              <th className="tableHead-cell tw-w-60">Tags</th>
            </tr>
          </thead>
          <tbody className="tableBody">
            {searchedColumns.map((column, index) => {
              return (
                <tr
                  className={classNames(
                    'tableBody-row',
                    !isEven(index + 1) ? 'odd-row' : null,
                    {
                      'column-highlight': columnName === column.name,
                    }
                  )}
                  data-testid="column"
                  id={column.name}
                  key={index}
                  ref={columnName === column.name ? rowRef : null}>
                  <td className="tw-relative tableBody-cell">
                    {getConstraintIcon(column.constraint)}
                    <span>{column.name}</span>
                  </td>

                  <td className="tableBody-cell">
                    <span>
                      {column.dataType
                        ? lowerCase(getDataTypeString(column.dataType))
                        : ''}
                    </span>
                  </td>
                  <td className="tw-group tableBody-cell tw-relative">
                    <div>
                      <div
                        className="tw-cursor-pointer hover:tw-underline tw-flex"
                        data-testid="description"
                        id={`column-description-${index}`}
                        onClick={() => handleEditColumn(column, index)}>
                        <div>
                          {column.description ? (
                            <RichTextEditorPreviewer
                              markdown={column.description}
                            />
                          ) : (
                            <span className="tw-no-description">
                              No description added
                            </span>
                          )}
                        </div>
                        <button className="tw-self-start tw-w-8 tw-h-auto tw-opacity-0 tw-ml-1 group-hover:tw-opacity-100 focus:tw-outline-none">
                          <SVGIcons
                            alt="edit"
                            icon="icon-edit"
                            title="Edit"
                            width="10px"
                          />
                        </button>
                      </div>

                      {checkIfJoinsAvailable(column.name) && (
                        <div className="tw-mt-3">
                          <span className="tw-text-gray-400 tw-mr-1">
                            Frequently joined columns:
                          </span>
                          {getFrequentlyJoinedWithColumns(column.name)
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
                          {getFrequentlyJoinedWithColumns(column.name).length >
                            3 && (
                            <PopOver
                              html={
                                <div className="tw-text-left">
                                  {getFrequentlyJoinedWithColumns(column.name)
                                    ?.slice(3)
                                    .map((columnJoin, index) => (
                                      <Fragment key={index}>
                                        <a
                                          className="link-text tw-block tw-py-1"
                                          href={getTableDetailsPath(
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
                                        </a>
                                      </Fragment>
                                    ))}
                                </div>
                              }
                              position="bottom"
                              theme="light"
                              trigger="click">
                              <span className="show-more tw-ml-1">...</span>
                            </PopOver>
                          )}
                        </div>
                      )}
                    </div>
                  </td>
                  <td
                    className="tw-group tw-relative tableBody-cell"
                    onClick={() => {
                      if (!editColumnTag) {
                        handleEditColumnTag(column, index);
                      } else {
                        handleTagSelection();
                      }
                    }}>
                    <NonAdminAction
                      html={getHtmlForNonAdminAction(Boolean(owner))}
                      isOwner={hasEditAccess}
                      position="left"
                      trigger="click">
                      <TagsContainer
                        editable={editColumnTag?.index === index}
                        selectedTags={column.tags as EntityTags[]}
                        tagList={allTags}
                        onCancel={() => {
                          handleTagSelection();
                        }}
                        onSelectionChange={(tags) => {
                          handleTagSelection(tags);
                        }}>
                        {column?.tags?.length ? (
                          <button className="tw-opacity-0 tw-ml-1 group-hover:tw-opacity-100 focus:tw-outline-none">
                            <SVGIcons
                              alt="edit"
                              icon="icon-edit"
                              title="Edit"
                              width="10px"
                            />
                          </button>
                        ) : (
                          <span className="tw-opacity-0 group-hover:tw-opacity-100">
                            <Tags
                              className="tw-border-main"
                              startWith="+ "
                              tag="Add tag"
                              type="outlined"
                            />
                          </span>
                        )}
                      </TagsContainer>
                    </NonAdminAction>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
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

export default SchemaTable;
