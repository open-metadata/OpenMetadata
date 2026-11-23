/*
 *  Copyright 2026 Collate.
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
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CustomProperty } from '../../../../../generated/type/customProperty';
import { tablePropertyRenderer } from './TablePropertyValue';

describe('TablePropertyEdit', () => {
  it('reports a table editor dirty after a cell edit and clean after reverting it', async () => {
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    const onDirtyChange = jest.fn();
    const { Edit } = tablePropertyRenderer;

    render(
      <Edit
        formId="table-form"
        isSaving={false}
        property={
          {
            name: 'contacts',
            propertyType: { id: 't', name: 'table-cp', type: 'type' },
            customPropertyConfig: { config: { columns: ['name'] } },
          } as CustomProperty
        }
        value={{ columns: ['name'], rows: [{ name: 'Ann' }] }}
        onDirtyChange={onDirtyChange}
        onSave={jest.fn()}
      />
    );

    expect(onDirtyChange).toHaveBeenLastCalledWith(false);

    const cell = screen.getByTestId('name-0');
    await user.type(cell, 'e');

    expect(onDirtyChange).toHaveBeenLastCalledWith(true);

    await user.type(cell, '{Backspace}');

    expect(onDirtyChange).toHaveBeenLastCalledWith(false);
  });
});

const TEN_COLUMNS = Array.from({ length: 10 }, (_, i) => `col${i + 1}`);
const TEN_COLUMN_ROW = Object.fromEntries(
  TEN_COLUMNS.map((column) => [column, `${column}-value`])
);
const TEN_COLUMN_PROPERTY = {
  name: 'wide',
  propertyType: { id: 't', name: 'table-cp', type: 'type' },
  customPropertyConfig: { config: { columns: TEN_COLUMNS } },
} as CustomProperty;

describe('TablePropertyView', () => {
  it('renders every column and cell of a 10-column table', () => {
    const { View } = tablePropertyRenderer;

    render(
      <View
        property={TEN_COLUMN_PROPERTY}
        value={{ columns: TEN_COLUMNS, rows: [TEN_COLUMN_ROW] }}
      />
    );

    expect(
      screen.getAllByRole('columnheader').map((header) => header.textContent)
    ).toEqual(TEN_COLUMNS);
    expect(
      screen.getByRole('rowheader', { name: 'col1-value' })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('gridcell', { name: 'col10-value' })
    ).toBeInTheDocument();
  });
});

describe('TablePropertyEdit with 10 columns', () => {
  it('edits the 10th column and saves all 10 columns', async () => {
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    const onSave = jest.fn();
    const { Edit } = tablePropertyRenderer;

    render(
      <Edit
        formId="wide-form"
        isSaving={false}
        property={TEN_COLUMN_PROPERTY}
        value={{ columns: TEN_COLUMNS, rows: [TEN_COLUMN_ROW] }}
        onDirtyChange={jest.fn()}
        onSave={onSave}
      />
    );

    expect(screen.getAllByRole('columnheader')).toHaveLength(11);

    const lastCell = screen.getByTestId('col10-0');
    await user.clear(lastCell);
    await user.type(lastCell, 'edited');
    fireEvent.submit(lastCell.closest('form') as HTMLFormElement);

    expect(onSave).toHaveBeenCalledWith({
      columns: TEN_COLUMNS,
      rows: [{ ...TEN_COLUMN_ROW, col10: 'edited' }],
    });
  });
});
