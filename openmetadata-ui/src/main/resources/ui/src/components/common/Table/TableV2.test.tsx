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
import { render, screen } from '@testing-library/react';
import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import TableV2 from './TableV2';

jest.mock('../../../utils/CustomizeColumnUtils', () => ({
  getCustomizeColumnDetails: jest.fn().mockReturnValue([]),
  getReorderedColumns: jest.fn().mockImplementation((_, columns) => columns),
}));

// react-aria's ColumnResizer relies on pointer/layout APIs that jsdom does not
// implement; stub it so the resizable table can render. It does not affect the
// behavior under test (column width props + inline-width gating).
jest.mock('react-aria-components', () => ({
  ...jest.requireActual('react-aria-components'),
  ColumnResizer: () => null,
}));

jest.mock('../SearchBarComponent/SearchBar.component', () =>
  jest.fn().mockImplementation(() => <div>SearchBar</div>)
);

jest.mock('./DraggableMenu/DraggableMenuItemV2.component', () =>
  jest.fn().mockImplementation(() => <div>DraggableMenuItemV2</div>)
);

const mockUseCurrentUserPreferences = {
  preferences: { selectedEntityTableColumns: {} },
  setPreference: jest.fn(),
};

jest.mock('../../../hooks/currentUserStore/useCurrentUserStore', () => ({
  useCurrentUserPreferences: jest.fn(() => mockUseCurrentUserPreferences),
}));

jest.mock('../../Customization/GenericProvider/GenericContext', () => ({
  ...jest.requireActual('../../Customization/GenericProvider/GenericContext'),
  useGenericContext: jest.fn(() => ({ type: 'table' })),
}));

const COLUMN_WIDTH = 200;

const columns = [
  { title: 'Name', dataIndex: 'name', key: 'name', width: COLUMN_WIDTH },
  { title: 'Description', dataIndex: 'description', key: 'description' },
];

const dataSource = [{ name: 'term-1', description: 'desc-1' }];

const renderTable = (props = {}) =>
  render(
    <DndProvider backend={HTML5Backend}>
      <TableV2
        columns={columns}
        dataSource={dataSource}
        pagination={false}
        {...props}
      />
    </DndProvider>
  );

describe('TableV2 - column width handling', () => {
  beforeAll(() => {
    // react-aria's ResizableTableContainer observes size changes.
    global.ResizeObserver = jest.fn().mockImplementation(() => ({
      observe: jest.fn(),
      unobserve: jest.fn(),
      disconnect: jest.fn(),
    }));
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('applies the configured width inline on header cells for non-resizable tables', () => {
    renderTable();

    const nameHeader = screen.getByRole('columnheader', { name: /Name/i });

    expect(nameHeader).toHaveStyle({
      width: `${COLUMN_WIDTH}px`,
      minWidth: `${COLUMN_WIDTH}px`,
    });
  });

  it('does not set an inline min-width on header cells for resizable tables, so react-aria owns sizing and the table can scroll instead of squishing', () => {
    renderTable({ resizableColumns: true });

    const nameHeader = screen.getByRole('columnheader', { name: /Name/i });
    
    expect(nameHeader.style.minWidth).toBe('');
  });
});
