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

import { Tooltip } from 'antd';
import { ColumnsType } from 'antd/lib/table';
import { isEmpty, isUndefined } from 'lodash';
import { Key, useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { NO_DATA_PLACEHOLDER } from '../../../constants/constants';
import { TABLE_SCROLL_VALUE } from '../../../constants/Table.constants';
import { TableConstraint } from '../../../generated/api/data/createTable';
import { SearchIndexField } from '../../../generated/entity/data/searchIndex';
import { Column } from '../../../generated/entity/data/table';
import {
  getFrequentlyJoinedColumns,
  searchInColumns,
} from '../../../utils/EntityUtils';
import { getFilterTags } from '../../../utils/TableTags/TableTags.utils';
import {
  getAllRowKeysByKeyName,
  getTableExpandableConfig,
  makeData,
  prepareConstraintIcon,
} from '../../../utils/TableUtils';
import FilterTablePlaceHolder from '../../common/ErrorWithPlaceholder/FilterTablePlaceHolder';
import RichTextEditorPreviewerV1 from '../../common/RichTextEditor/RichTextEditorPreviewerV1';
import RichTextEditorPreviewerNew from '../../common/RichTextEditor/RichTextEditorPreviewNew';
import Table from '../../common/Table/Table';
import TagsViewer from '../../Tag/TagsViewer/TagsViewer';
import { VersionTableProps } from './VersionTable.interfaces';

function VersionTable<T extends Column | SearchIndexField>({
  columnName,
  columns,
  isLoading,
  paginationProps,
  joins,
  tableConstraints,
  addedColumnConstraintDiffs,
  deletedColumnConstraintDiffs,
  addedTableConstraintDiffs,
  deletedTableConstraintDiffs,
  handelSearchCallback,
}: Readonly<VersionTableProps<T>>) {
  const { t } = useTranslation();

  const [searchText, setSearchText] = useState('');
  const [expandedRowKeys, setExpandedRowKeys] = useState<string[]>([]);

  const data = useMemo(() => {
    if (!searchText) {
      return makeData<T>(columns);
    } else {
      const searchCols = searchInColumns<T>(columns, searchText);

      return makeData<T>(searchCols);
    }
  }, [searchText, columns]);

  const renderColumnName = useCallback(
    (name: T['name'], record: T) => {
      const addedColumnConstraint = addedColumnConstraintDiffs?.find((diff) =>
        diff.name?.includes(name)
      );
      const deletedColumnConstraint = deletedColumnConstraintDiffs?.find(
        (diff) => diff.name?.includes(name)
      );
      let addedTableConstraint: TableConstraint[] | undefined;
      let deletedTableConstraint: TableConstraint[] | undefined;

      addedTableConstraintDiffs?.forEach((diff) => {
        const constraintNewValue = JSON.parse(diff.newValue);
        constraintNewValue?.forEach((constraint: TableConstraint) => {
          if (constraint.columns?.includes(name)) {
            addedTableConstraint = [
              ...(addedTableConstraint ?? []),
              constraint,
            ];
          }
        });
      });

      deletedTableConstraintDiffs?.forEach((diff) => {
        const constraintOldValue = JSON.parse(diff.oldValue);
        constraintOldValue?.forEach((constraint: TableConstraint) => {
          if (constraint.columns?.includes(name)) {
            deletedTableConstraint = [
              ...(deletedTableConstraint ?? []),
              constraint,
            ];
          }
        });
      });

      let addedConstraintIcon = null;
      let deletedConstraintIcon = null;

      const existingAddedTableConstraint = isUndefined(addedTableConstraint)
        ? tableConstraints
        : undefined;

      addedConstraintIcon = prepareConstraintIcon({
        columnName: name,
        columnConstraint:
          addedColumnConstraint?.newValue ?? (record as Column).constraint,
        tableConstraints: addedTableConstraint ?? existingAddedTableConstraint,
        isColumnConstraintAdded: !isUndefined(addedColumnConstraint),
        isTableConstraintAdded: !isUndefined(addedTableConstraint),
      });

      deletedConstraintIcon = prepareConstraintIcon({
        columnName: name,
        columnConstraint: deletedColumnConstraint?.oldValue,
        tableConstraints: deletedTableConstraint,
        isColumnConstraintAdded: false,
        isColumnConstraintDeleted: !isUndefined(deletedColumnConstraint),
        isTableConstraintDeleted: !isUndefined(deletedTableConstraint),
      });

      return (
        <div className="d-inline-flex flex-column hover-icon-group w-full">
          <div className="d-inline-flex">
            {deletedConstraintIcon}
            {addedConstraintIcon}
            <RichTextEditorPreviewerV1 markdown={name} />
          </div>
          {!isEmpty(record.displayName) ? (
            <RichTextEditorPreviewerV1 markdown={record.displayName ?? ''} />
          ) : null}
        </div>
      );
    },
    [
      tableConstraints,
      addedColumnConstraintDiffs,
      deletedColumnConstraintDiffs,
      addedTableConstraintDiffs,
      deletedTableConstraintDiffs,
    ]
  );

  const versionTableColumns: ColumnsType<T> = useMemo(
    () => [
      {
        title: t('label.name'),
        dataIndex: 'name',
        key: 'name',
        width: 200,
        render: renderColumnName,
      },
      {
        title: t('label.type'),
        dataIndex: 'dataTypeDisplay',
        key: 'dataTypeDisplay',
        ellipsis: true,
        width: 200,
        render: (dataTypeDisplay: T['dataTypeDisplay']) => {
          return dataTypeDisplay ? (
            <Tooltip
              title={
                <RichTextEditorPreviewerV1
                  markdown={dataTypeDisplay?.toLowerCase() ?? ''}
                  textVariant="white"
                />
              }>
              <div className="cursor-pointer">
                <RichTextEditorPreviewerV1
                  markdown={dataTypeDisplay?.toLowerCase() ?? ''}
                />
              </div>
            </Tooltip>
          ) : (
            NO_DATA_PLACEHOLDER
          );
        },
      },
      {
        title: t('label.description'),
        dataIndex: 'description',
        key: 'description',
        width: 400,
        render: (description: T['description']) =>
          description ? (
            <>
              <RichTextEditorPreviewerNew markdown={description} />
              {getFrequentlyJoinedColumns(
                columnName,
                joins ?? [],
                t('label.frequently-joined-column-plural')
              )}
            </>
          ) : (
            <span className="text-grey-muted">
              {t('label.no-entity', {
                entity: t('label.description'),
              })}
            </span>
          ),
      },
      {
        title: t('label.tag-plural'),
        dataIndex: 'tags',
        key: 'tags',
        width: 272,
        render: (tags: T['tags']) => (
          <TagsViewer
            sizeCap={-1}
            tags={getFilterTags(tags ?? []).Classification}
          />
        ),
      },
      {
        title: t('label.glossary-term-plural'),
        dataIndex: 'tags',
        key: 'tags',
        width: 272,
        render: (tags: T['tags']) => (
          <TagsViewer sizeCap={-1} tags={getFilterTags(tags ?? []).Glossary} />
        ),
      },
    ],
    [columnName, joins, renderColumnName]
  );

  const handleSearchAction = (searchValue: string) => {
    setSearchText(searchValue);
    handelSearchCallback?.(searchValue);
  };

  const searchProps = useMemo(
    () => ({
      placeholder: t('message.find-in-table'),
      value: searchText,
      typingInterval: 500,
      onSearch: handleSearchAction,
    }),
    [searchText, handleSearchAction]
  );

  const handleExpandedRowsChange = useCallback((keys: readonly Key[]) => {
    setExpandedRowKeys(keys as string[]);
  }, []);

  useEffect(() => {
    setExpandedRowKeys(getAllRowKeysByKeyName<T>(columns ?? [], 'name'));
  }, [columns]);

  return (
    <Table
      columns={versionTableColumns}
      containerClassName="m-b-sm"
      customPaginationProps={paginationProps}
      data-testid="entity-table"
      dataSource={data}
      expandable={{
        ...getTableExpandableConfig<T>(),
        rowExpandable: (record) => !isEmpty(record.children),
        onExpandedRowsChange: handleExpandedRowsChange,
        expandedRowKeys: expandedRowKeys,
      }}
      loading={isLoading}
      locale={{
        emptyText: <FilterTablePlaceHolder />,
      }}
      pagination={false}
      rowKey="name"
      scroll={TABLE_SCROLL_VALUE}
      searchProps={searchProps}
      size="small"
    />
  );
}

export default VersionTable;
