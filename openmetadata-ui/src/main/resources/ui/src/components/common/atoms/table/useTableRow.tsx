/*
 *  Copyright 2024 Collate.
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

import { Checkbox, TableCell, TableRow } from '@mui/material';
import { useMemo } from 'react';
import { CellRenderer, ColumnConfig } from '../shared/types';
import { useCellRenderer } from './useCellRenderer';

interface TableRowConfig<T> {
  entity: T;
  columns: ColumnConfig<T>[];
  renderers: CellRenderer<T>;
  isSelected: boolean;
  onSelect: (id: string, checked: boolean) => void;
  onEntityClick: (entity: T) => void;
  enableSelection?: boolean;
}

/**
 * Renders table row using shared cell renderers
 *
 * @description
 * Creates table row structure using useCellRenderer for all cell content.
 * No duplicate rendering logic - delegates all rendering to useCellRenderer
 * for perfect consistency with card view.
 *
 * @stability Stable - Uses shared cell renderer
 * @complexity Low - Just table structure + shared rendering
 */
export const useTableRow = <T extends { id: string }>(
  config: TableRowConfig<T>
) => {
  const { renderCell } = useCellRenderer({
    columns: config.columns,
    renderers: config.renderers,
    chipSize: 'large',
  });

  const tableRow = useMemo(
    () => (
      <TableRow
        hover
        data-testid={(config.entity as any).name}
        sx={{ cursor: 'pointer' }}
        onClick={() => config.onEntityClick(config.entity)}>
        {config.enableSelection && (
          <TableCell padding="checkbox">
            <Checkbox
              checked={config.isSelected}
              onChange={(e) => {
                e.stopPropagation();
                config.onSelect(config.entity.id, e.target.checked);
              }}
              onClick={(e) => {
                e.stopPropagation();
              }}
            />
          </TableCell>
        )}
        {config.columns.map((column) => (
          <TableCell key={column.key}>
            {renderCell(config.entity, column)}
          </TableCell>
        ))}
      </TableRow>
    ),
    [config, renderCell]
  );

  return {
    tableRow,
  };
};
