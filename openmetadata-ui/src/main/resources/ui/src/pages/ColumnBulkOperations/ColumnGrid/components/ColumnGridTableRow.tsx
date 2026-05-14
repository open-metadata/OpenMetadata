/*
 *  Copyright 2025 Collate.
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

import { Table } from '@openmetadata/ui-core-components';
import classNames from 'classnames';
import React, { useMemo } from 'react';
import Loader from '../../../../components/common/Loader/Loader';
import { ColumnGridRowData } from '../ColumnGrid.interface';

interface ColumnGridTableRowProps {
  /** Width percent per column id for fixed column layout */
  columnWidthPercent?: Record<string, string>;
  entity: ColumnGridRowData;
  isSelected: boolean;
  /** When true, show loader in place of checkbox until refetch completes */
  isPendingRefetch?: boolean;
  /** When true, row shows highlighted (theme warning) background for recently bulk-updated columns */
  isRecentlyUpdated?: boolean;
  /** When true, parent (grey) vs child (light grey) backgrounds and child row indent are applied */
  showParentChildColors?: boolean;
  /** Column definitions for Table.Row (id only), used for core Table layout */
  tableColumns: { id: string }[];
  renderColumnNameCell: (entity: ColumnGridRowData) => React.ReactNode;
  renderPathCell: (entity: ColumnGridRowData) => React.ReactNode;
  renderDescriptionCell: (entity: ColumnGridRowData) => React.ReactNode;
  renderTagsCell: (entity: ColumnGridRowData) => React.ReactNode;
  renderGlossaryTermsCell: (entity: ColumnGridRowData) => React.ReactNode;
}

const CELL_ELLIPSIS_CLASS = 'tw:min-w-0 tw:w-full tw:overflow-hidden';

const CHILD_ROW_INDENT_PX = 24;
const BASE_CELL_PADDING_PX = 24;
const PARENT_ROW_BG_CLASS = 'tw:bg-gray-100';
const CHILD_ROW_BG_CLASS = 'tw:bg-gray-50';

export const ColumnGridTableRow: React.FC<ColumnGridTableRowProps> = ({
  columnWidthPercent = {},
  entity,
  isSelected,
  isPendingRefetch = false,
  isRecentlyUpdated,
  showParentChildColors = false,
  tableColumns,
  renderColumnNameCell,
  renderPathCell,
  renderDescriptionCell,
  renderTagsCell,
  renderGlossaryTermsCell,
}) => {
  const isChildRow = Boolean(entity.parentId || entity.isStructChild);

  const { rowClassName, cellClassName, rowType } = useMemo(() => {
    const type = isChildRow ? 'child' : 'parent';

    if (isRecentlyUpdated) {
      return {
        rowType: type,
        rowClassName: classNames(
          'tw:transition-colors',
          'tw:bg-utility-warning-50',
          isSelected && 'tw:bg-utility-warning-50'
        ),
        cellClassName: classNames('tw:bg-utility-warning-50'),
      };
    }

    if (!showParentChildColors) {
      return {
        rowType: type,
        rowClassName: classNames(
          'tw:transition-colors tw:hover:bg-secondary',
          isSelected && 'tw:bg-secondary'
        ),
      };
    }

    const bgClass = isChildRow ? CHILD_ROW_BG_CLASS : PARENT_ROW_BG_CLASS;

    return {
      rowType: type,
      rowClassName: classNames(
        'tw:transition-colors',
        bgClass,
        isSelected && bgClass,
        'tw:hover:opacity-95'
      ),
      cellClassName: classNames(bgClass),
    };
  }, [
    isRecentlyUpdated,
    showParentChildColors,
    entity.parentId,
    entity.isStructChild,
    isSelected,
  ]);

  const renderCellContent = (columnId: string) => {
    const content = (() => {
      switch (columnId) {
        case 'columnName':
          return renderColumnNameCell(entity);
        case 'path':
          return renderPathCell(entity);
        case 'description':
          return renderDescriptionCell(entity);
        case 'dataType':
          return entity.dataType || '-';
        case 'tags':
          return renderTagsCell(entity);
        case 'glossaryTerms':
          return renderGlossaryTermsCell(entity);
        default:
          return null;
      }
    })();

    if (content == null) {
      return null;
    }

    const wrapped = <div className={CELL_ELLIPSIS_CLASS}>{content}</div>;

    if (columnId === 'columnName' && isPendingRefetch) {
      return (
        <div className="tw:flex tw:items-center tw:gap-2 tw:min-w-0">
          <Loader className="tw:shrink-0" size="x-small" />
          {wrapped}
        </div>
      );
    }

    return wrapped;
  };

  const getCellStyle = (columnId: string): React.CSSProperties | undefined => {
    const width = columnWidthPercent[columnId];
    const base = width ? { width, minWidth: 0, maxWidth: width } : undefined;
    const isFirstCell = columnId === 'columnName';
    const shouldIndent = showParentChildColors && isChildRow && isFirstCell;
    const level = entity.nestingLevel ?? (entity.parentId ? 1 : 0);
    const indentPx = shouldIndent
      ? BASE_CELL_PADDING_PX + level * CHILD_ROW_INDENT_PX
      : 0;

    if (indentPx === 0) {
      return base;
    }

    return { ...base, paddingLeft: indentPx };
  };

  const cellTestIdMap: Record<string, string | undefined> = {
    columnName: 'column-name-cell',
    path: 'column-path-cell',
    description: 'column-description-cell',
    dataType: 'column-datatype-cell',
    tags: 'column-tags-cell',
    glossaryTerms: 'column-glossary-cell',
  };

  return (
    <Table.Row
      className={rowClassName}
      columns={tableColumns}
      data-row-id={entity.id}
      data-row-type={rowType}
      data-testid={`column-row-${entity.columnName}`}
      id={entity.id}>
      {(column) => (
        <Table.Cell
          className={classNames(cellClassName, 'tw:overflow-hidden')}
          data-testid={cellTestIdMap[column.id]}
          style={getCellStyle(column.id)}>
          {renderCellContent(column.id)}
        </Table.Cell>
      )}
    </Table.Row>
  );
};
