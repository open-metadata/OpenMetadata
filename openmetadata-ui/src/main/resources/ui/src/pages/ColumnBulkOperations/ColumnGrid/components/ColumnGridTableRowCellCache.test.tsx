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
import { fireEvent, render, screen } from '@testing-library/react';
import { useMemo, useState } from 'react';
import { ColumnGridRowData } from '../ColumnGrid.interface';
import { ColumnGridTableRow } from './ColumnGridTableRow';

// Deliberately runs against the real core `Table` (no module mock): the
// behaviour under test is react-aria's per-row cell cache, which the mocked
// Table in ColumnGridTableRow.test.tsx cannot exercise.

const tableColumns = [{ id: 'columnName' }, { id: 'dataType' }];

const Harness = () => {
  const [isExpanded, setIsExpanded] = useState(false);

  // Rows are rebuilt on every expansion change, as transformGridItemsToRows does.
  const items = useMemo(
    () =>
      [
        {
          id: 'col-1',
          columnName: 'test_col',
          dataType: 'RECORD',
          isExpanded,
        },
      ] as ColumnGridRowData[],
    [isExpanded]
  );

  return (
    <Table aria-label="columns" selectionMode="none">
      <Table.Header columns={tableColumns}>
        {(column: { id: string }) => (
          <Table.Head id={column.id}>{column.id}</Table.Head>
        )}
      </Table.Header>
      <Table.Body items={items}>
        {(entity: ColumnGridRowData) => (
          <ColumnGridTableRow
            entity={entity}
            isSelected={false}
            tableColumns={tableColumns}>
            <ColumnGridTableRow.Cell columnId="columnName">
              <button
                data-testid="expand-chevron"
                onClick={() => setIsExpanded((prev) => !prev)}>
                {isExpanded ? 'expanded' : 'collapsed'}
              </button>
            </ColumnGridTableRow.Cell>
          </ColumnGridTableRow>
        )}
      </Table.Body>
    </Table>
  );
};

describe('ColumnGridTableRow cell cache', () => {
  it('should re-render cell content and handlers after the row expands and collapses', () => {
    render(<Harness />);

    const chevron = () => screen.getByTestId('expand-chevron');

    expect(chevron()).toHaveTextContent('collapsed');

    fireEvent.click(chevron());

    expect(chevron()).toHaveTextContent('expanded');

    fireEvent.click(chevron());

    expect(chevron()).toHaveTextContent('collapsed');
  });
});
