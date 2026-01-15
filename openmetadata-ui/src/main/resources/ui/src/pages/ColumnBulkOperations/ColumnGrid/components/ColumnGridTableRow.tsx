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
      key={entity.id}
      selected={isSelected}
      sx={{ cursor: 'pointer' }}
      onClick={handleRowClick}>
      <TableCell padding="checkbox">
        <Checkbox
          checked={isSelected}
          onChange={(e) => {
            e.stopPropagation();
            onSelect(entity.parentId || entity.id, e.target.checked);
          }}
          onClick={(e) => {
            e.stopPropagation();
          }}
        />
      </TableCell>
      <TableCell>{renderColumnNameCell(entity)}</TableCell>
      <TableCell>{renderPathCell(entity)}</TableCell>
      <TableCell>{renderDescriptionCell(entity)}</TableCell>
      <TableCell>{entity.dataType || '-'}</TableCell>
      <TableCell>{renderTagsCell(entity)}</TableCell>
      <TableCell>{renderGlossaryTermsCell(entity)}</TableCell>
    </TableRow>
  );
};
