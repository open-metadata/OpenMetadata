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

import { memo, ReactNode } from 'react';
import { ColumnGridRowData } from '../ColumnGrid.interface';
import { ColumnGridTableRow } from './ColumnGridTableRow';

type CellRenderer = (entity: ColumnGridRowData) => ReactNode;

interface ColumnGridRowProps {
  entity: ColumnGridRowData;
  columnWidthPercent?: Record<string, string>;
  isSelected: boolean;
  isPendingRefetch?: boolean;
  isRecentlyUpdated?: boolean;
  showParentChildColors?: boolean;
  tableColumns: { id: string }[];
  renderColumnNameCell: CellRenderer;
  renderPathCell: CellRenderer;
  renderDescriptionCell: CellRenderer;
  renderTagsCell: CellRenderer;
  renderGlossaryTermsCell: CellRenderer;
}

/**
 * One row of the column-bulk-operations grid. Wires the parent's cell
 * renderers into the compound `ColumnGridTableRow.Cell` slots so the parent's
 * render stays a single element, and memoises the row.
 */
const ColumnGridRow = ({
  entity,
  renderColumnNameCell,
  renderPathCell,
  renderDescriptionCell,
  renderTagsCell,
  renderGlossaryTermsCell,
  ...rowProps
}: ColumnGridRowProps) => (
  <ColumnGridTableRow {...rowProps} entity={entity}>
    <ColumnGridTableRow.Cell columnId="columnName">
      {renderColumnNameCell(entity)}
    </ColumnGridTableRow.Cell>
    <ColumnGridTableRow.Cell columnId="path">
      {renderPathCell(entity)}
    </ColumnGridTableRow.Cell>
    <ColumnGridTableRow.Cell columnId="description">
      {renderDescriptionCell(entity)}
    </ColumnGridTableRow.Cell>
    <ColumnGridTableRow.Cell columnId="tags">
      {renderTagsCell(entity)}
    </ColumnGridTableRow.Cell>
    <ColumnGridTableRow.Cell columnId="glossaryTerms">
      {renderGlossaryTermsCell(entity)}
    </ColumnGridTableRow.Cell>
  </ColumnGridTableRow>
);

export default memo(ColumnGridRow);
