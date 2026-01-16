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

import { Checkbox, TableCell, TableRow } from '@mui/material';
import React from 'react';
import { ColumnGridRowData } from '../ColumnGrid.interface';

interface ColumnGridTableRowProps {
  entity: ColumnGridRowData;
  isSelected: boolean;
  onSelect: (id: string, checked: boolean) => void;
  onEntityClick: (entity: ColumnGridRowData) => void;
  renderColumnNameCell: (entity: ColumnGridRowData) => React.ReactNode;
  renderPathCell: (entity: ColumnGridRowData) => React.ReactNode;
  renderDescriptionCell: (entity: ColumnGridRowData) => React.ReactNode;
  renderTagsCell: (entity: ColumnGridRowData) => React.ReactNode;
  renderGlossaryTermsCell: (entity: ColumnGridRowData) => React.ReactNode;
}

export const ColumnGridTableRow: React.FC<ColumnGridTableRowProps> = ({
  entity,
  isSelected,
  onSelect,
  onEntityClick,
  renderColumnNameCell,
  renderPathCell,
  renderDescriptionCell,
  renderTagsCell,
  renderGlossaryTermsCell,
}) => {
  const handleRowClick = () => {
    onEntityClick(entity);
  };

  return (
    <TableRow
      hover
      data-testid={`column-row-${entity.columnName}`}
      key={entity.id}
      selected={isSelected}
      sx={{ cursor: 'pointer' }}
      onClick={handleRowClick}>
      <TableCell padding="checkbox">
        <Checkbox
          checked={isSelected}
          data-testid={`column-checkbox-${entity.columnName}`}
          onChange={(e) => {
            e.stopPropagation();
            onSelect(entity.parentId || entity.id, e.target.checked);
          }}
          onClick={(e) => {
            e.stopPropagation();
          }}
        />
      </TableCell>
      <TableCell data-testid="column-name-cell">
        {renderColumnNameCell(entity)}
      </TableCell>
      <TableCell data-testid="column-path-cell">
        {renderPathCell(entity)}
      </TableCell>
      <TableCell data-testid="column-description-cell">
        {renderDescriptionCell(entity)}
      </TableCell>
      <TableCell data-testid="column-datatype-cell">
        {entity.dataType || '-'}
      </TableCell>
      <TableCell data-testid="column-tags-cell">
        {renderTagsCell(entity)}
      </TableCell>
      <TableCell data-testid="column-glossary-cell">
        {renderGlossaryTermsCell(entity)}
      </TableCell>
    </TableRow>
  );
};
