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

import {
  Checkbox,
  CircularProgress,
  TableCell,
  TableRow,
  useTheme,
} from '@mui/material';
import React, { useMemo } from 'react';
import { ColumnGridRowData } from '../ColumnGrid.interface';

interface ColumnGridTableRowProps {
  entity: ColumnGridRowData;
  isSelected: boolean;
  isIndeterminate?: boolean;
  /** When true, show loader in place of checkbox until refetch completes */
  isPendingRefetch?: boolean;
  /** When true, row shows highlighted (theme warning) background for recently bulk-updated columns */
  isRecentlyUpdated?: boolean;
  /** When true, parent/child row colors are shown (only when group/struct is expanded) */
  showParentChildColors?: boolean;
  onSelect: (id: string, checked: boolean) => void;
  onGroupSelect?: (groupId: string, checked: boolean) => void;
  renderColumnNameCell: (entity: ColumnGridRowData) => React.ReactNode;
  renderPathCell: (entity: ColumnGridRowData) => React.ReactNode;
  renderDescriptionCell: (entity: ColumnGridRowData) => React.ReactNode;
  renderTagsCell: (entity: ColumnGridRowData) => React.ReactNode;
  renderGlossaryTermsCell: (entity: ColumnGridRowData) => React.ReactNode;
}

const ROW_BG_TRANSITION = 'background-color 0.4s ease-in-out';

export const ColumnGridTableRow: React.FC<ColumnGridTableRowProps> = ({
  entity,
  isSelected,
  isIndeterminate,
  isPendingRefetch = false,
  isRecentlyUpdated,
  showParentChildColors = false,
  onSelect,
  onGroupSelect,
  renderColumnNameCell,
  renderPathCell,
  renderDescriptionCell,
  renderTagsCell,
  renderGlossaryTermsCell,
}) => {
  const theme = useTheme();

  const { rowSx, cellSx, rowType } = useMemo(() => {
    const isChildRow = Boolean(entity.parentId || entity.isStructChild);
    const type = isChildRow ? 'child' : 'parent';

    const yellowHighlightBg =
      theme.palette.allShades?.warning?.[50] ??
      theme.palette.warning?.light ??
      theme.palette.warning?.main;

    if (isRecentlyUpdated) {
      return {
        rowType: type,
        rowSx: {
          backgroundColor: yellowHighlightBg,
          transition: ROW_BG_TRANSITION,
          '&.Mui-selected': { backgroundColor: yellowHighlightBg },
          '&.Mui-selected:hover': { backgroundColor: yellowHighlightBg },
        },
        cellSx: {
          backgroundColor: yellowHighlightBg,
          transition: ROW_BG_TRANSITION,
        },
      };
    }

    if (!showParentChildColors) {
      return { rowType: type, rowSx: undefined, cellSx: undefined };
    }

    const parentBg =
      theme.palette.allShades?.gray?.[100] ?? theme.palette.grey?.[100];
    const childBg =
      theme.palette.allShades?.gray?.[50] ?? theme.palette.grey?.[50];
    const bg = isChildRow ? childBg : parentBg;

    return {
      rowType: type,
      rowSx: {
        backgroundColor: bg,
        transition: ROW_BG_TRANSITION,
        '&.Mui-selected': { backgroundColor: bg },
        '&.Mui-selected:hover': { backgroundColor: bg },
      },
      cellSx: { backgroundColor: bg, transition: ROW_BG_TRANSITION },
    };
  }, [
    isRecentlyUpdated,
    showParentChildColors,
    entity.parentId,
    entity.isStructChild,
    theme,
  ]);

  const handleCheckboxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const checked = e.target.checked;

    if (entity.isGroup && entity.occurrenceCount > 1 && onGroupSelect) {
      onGroupSelect(entity.id, checked);
    } else {
      onSelect(entity.id, checked);
    }
  };

  return (
    <TableRow
      hover
      data-row-id={entity.id}
      data-row-type={rowType}
      data-testid={`column-row-${entity.columnName}`}
      key={entity.id}
      selected={isSelected}
      sx={rowSx}>
      <TableCell padding="checkbox" sx={cellSx}>
        {isPendingRefetch ? (
          <CircularProgress size={20} sx={{ display: 'block' }} />
        ) : (
          <Checkbox
            checked={isSelected}
            data-testid={`column-checkbox-${entity.columnName}`}
            indeterminate={isIndeterminate}
            onChange={handleCheckboxChange}
          />
        )}
      </TableCell>
      <TableCell data-testid="column-name-cell" sx={cellSx}>
        {renderColumnNameCell(entity)}
      </TableCell>
      <TableCell data-testid="column-path-cell" sx={cellSx}>
        {renderPathCell(entity)}
      </TableCell>
      <TableCell data-testid="column-description-cell" sx={cellSx}>
        {renderDescriptionCell(entity)}
      </TableCell>
      <TableCell data-testid="column-datatype-cell" sx={cellSx}>
        {entity.dataType || '-'}
      </TableCell>
      <TableCell data-testid="column-tags-cell" sx={cellSx}>
        {renderTagsCell(entity)}
      </TableCell>
      <TableCell data-testid="column-glossary-cell" sx={cellSx}>
        {renderGlossaryTermsCell(entity)}
      </TableCell>
    </TableRow>
  );
};
