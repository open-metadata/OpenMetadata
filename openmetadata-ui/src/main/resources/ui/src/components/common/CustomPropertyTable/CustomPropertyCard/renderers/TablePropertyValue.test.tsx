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

describe('TablePropertyView scroll shadows', () => {
  const originalResizeObserver = global.ResizeObserver;

  beforeAll(() => {
    global.ResizeObserver = class {
      observe = jest.fn();
      disconnect = jest.fn();
      unobserve = jest.fn();
    } as unknown as typeof ResizeObserver;
    // jsdom has no layout: every div reports 300px visible of 900px content.
    jest
      .spyOn(HTMLElement.prototype, 'clientWidth', 'get')
      .mockReturnValue(300);
    jest
      .spyOn(HTMLElement.prototype, 'scrollWidth', 'get')
      .mockReturnValue(900);
  });

  afterAll(() => {
    global.ResizeObserver = originalResizeObserver;
    jest.restoreAllMocks();
  });

  it('shadows the end edge at rest and both edges once scrolled', () => {
    const { View } = tablePropertyRenderer;

    render(
      <View
        property={TEN_COLUMN_PROPERTY}
        value={{ columns: TEN_COLUMNS, rows: [TEN_COLUMN_ROW] }}
      />
    );

    expect(screen.getByTestId('scroll-shadow-end')).toBeInTheDocument();
    expect(screen.queryByTestId('scroll-shadow-start')).not.toBeInTheDocument();

    const scroller = screen.getByRole('grid').parentElement as HTMLElement;
    scroller.scrollLeft = 300;
    fireEvent.scroll(scroller);

    expect(screen.getByTestId('scroll-shadow-start')).toBeInTheDocument();
    expect(screen.getByTestId('scroll-shadow-end')).toBeInTheDocument();

    scroller.scrollLeft = 600;
    fireEvent.scroll(scroller);

    expect(screen.queryByTestId('scroll-shadow-end')).not.toBeInTheDocument();
  });
});
