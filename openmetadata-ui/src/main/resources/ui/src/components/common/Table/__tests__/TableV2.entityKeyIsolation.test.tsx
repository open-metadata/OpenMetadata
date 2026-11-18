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
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from '@testing-library/react';
import { ContextType, ReactNode } from 'react';
import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import { usePersistentStorage } from '../../../../hooks/currentUserStore/useCurrentUserStore';
import { useApplicationStore } from '../../../../hooks/useApplicationStore';
import { DEFAULT_ENTITY_PERMISSION } from '../../../../utils/PermissionsUtils';
import { createGenericContext } from '../../../Customization/GenericProvider/GenericContext';
import { ColumnsType } from '../Table.interface';
import TableV2 from '../TableV2';

const USER_NAME = 'isolation-user';
const USER_ID = 'isolation-user-id';

const press = (element: HTMLElement) => {
  fireEvent.pointerDown(element, {
    button: 0,
    pointerId: 1,
    pointerType: 'mouse',
  });
  fireEvent.pointerUp(element, {
    button: 0,
    pointerId: 1,
    pointerType: 'mouse',
  });
  fireEvent.click(element);
};

interface Row {
  name: string;
  description: string;
  tags: string;
}

const ROWS: Row[] = [{ name: 'alpha', description: 'desc', tags: 'tag' }];

const COLUMNS: ColumnsType<Row> = [
  { title: 'Name', dataIndex: 'name', key: 'name' },
  { title: 'Description', dataIndex: 'description', key: 'description' },
  { title: 'Tags', dataIndex: 'tags', key: 'tags' },
];

const ALL_VISIBLE = ['name', 'description', 'tags'];

const wrapper = ({ children }: { children: ReactNode }) => (
  <DndProvider backend={HTML5Backend}>{children}</DndProvider>
);

const renderTable = (entityType: string, rest: Record<string, unknown> = {}) =>
  render(
    <TableV2
      columns={COLUMNS}
      dataSource={ROWS}
      defaultVisibleColumns={ALL_VISIBLE}
      entityType={entityType}
      pagination={false}
      rowKey="name"
      staticVisibleColumns={['name']}
      {...rest}
    />,
    { wrapper }
  );

const toggleColumn = (columnKey: string) => {
  act(() => press(screen.getByTestId('column-dropdown')));
  const menuItem = screen.getByTestId(`column-menu-item-${columnKey}`);
  act(() => press(within(menuItem).getByRole('button')));
};

const storedSelection = (entityKey: string): string[] | undefined =>
  usePersistentStorage.getState().preferences[USER_NAME]
    ?.selectedEntityTableColumns?.[entityKey];

const seedLegacySharedBucket = () => {
  usePersistentStorage.getState().setUserPreference(USER_NAME, {
    selectedEntityTableColumns: {
      dashboardDataModelTable: ['name', 'tags'],
    },
  });
};

describe('TableV2 column-visibility preference-key isolation', () => {
  beforeEach(() => {
    useApplicationStore.setState({
      currentUser: {
        email: 'isolation-user@open-metadata.org',
        id: USER_ID,
        name: USER_NAME,
      },
    });
    usePersistentStorage.setState({ preferences: {} });
  });

  it('persists Files (entityType=driveFilesTable) selections under its own key, not the shared Data Models key', () => {
    renderTable('driveFilesTable');

    toggleColumn('description');

    expect(storedSelection('driveFilesTable')).toEqual(['name', 'tags']);
    expect(storedSelection('dashboardDataModelTable')).toBeUndefined();
  });

  it('persists Spreadsheets (entityType=driveSpreadsheetsTable) selections under its own key, not the shared Data Models key', () => {
    renderTable('driveSpreadsheetsTable');

    toggleColumn('description');

    expect(storedSelection('driveSpreadsheetsTable')).toEqual(['name', 'tags']);
    expect(storedSelection('dashboardDataModelTable')).toBeUndefined();
  });

  it('does not leak a Files customization into the Data Models table', () => {
    renderTable('driveFilesTable');
    toggleColumn('description');

    expect(storedSelection('driveFilesTable')).toEqual(['name', 'tags']);

    const { unmount } = render(
      <DndProvider backend={HTML5Backend}>
        <TableV2
          columns={COLUMNS}
          dataSource={ROWS}
          defaultVisibleColumns={ALL_VISIBLE}
          entityType="dashboardDataModelTable"
          pagination={false}
          rowKey="name"
          staticVisibleColumns={['name']}
        />
      </DndProvider>
    );

    expect(storedSelection('dashboardDataModelTable')).toBeUndefined();
    expect(
      screen.getByRole('columnheader', { hidden: true, name: /Description/ })
    ).toBeInTheDocument();

    unmount();
  });

  it('keeps Files and Spreadsheets customizations independent of each other', () => {
    renderTable('driveFilesTable');
    toggleColumn('description');

    expect(storedSelection('driveFilesTable')).toEqual(['name', 'tags']);

    expect(storedSelection('driveSpreadsheetsTable')).toBeUndefined();
    expect(storedSelection('dashboardDataModelTable')).toBeUndefined();
  });

  it('does not leak a Files list customization into the file schema table (keyed by type=file)', () => {
    renderTable('driveFilesTable');
    toggleColumn('description');

    expect(storedSelection('driveFilesTable')).toEqual(['name', 'tags']);
    expect(storedSelection('file')).toBeUndefined();

    cleanup();
    const GenericContext = createGenericContext();
    render(
      <GenericContext.Provider
        value={
          {
            permissions: DEFAULT_ENTITY_PERMISSION,
            type: 'file',
          } as ContextType<typeof GenericContext>
        }>
        <TableV2
          columns={COLUMNS}
          dataSource={ROWS}
          defaultVisibleColumns={ALL_VISIBLE}
          pagination={false}
          rowKey="name"
          staticVisibleColumns={['name']}
        />
      </GenericContext.Provider>,
      { wrapper }
    );

    expect(
      screen.getByRole('columnheader', { hidden: true, name: /Description/ })
    ).toBeInTheDocument();
  });

  it('does not carry over a legacy shared-bucket selection into the Drive tables (G7)', () => {
    seedLegacySharedBucket();

    expect(storedSelection('dashboardDataModelTable')).toEqual([
      'name',
      'tags',
    ]);

    renderTable('driveFilesTable');

    expect(
      screen.getByRole('columnheader', { hidden: true, name: /Description/ })
    ).toBeInTheDocument();
    expect(storedSelection('driveFilesTable')).toBeUndefined();
  });

  it('still persists the Data Models table under the shared literal key (regression-safe)', () => {
    renderTable('dashboardDataModelTable');

    toggleColumn('description');

    expect(storedSelection('dashboardDataModelTable')).toEqual([
      'name',
      'tags',
    ]);
    expect(storedSelection('driveFilesTable')).toBeUndefined();
    expect(storedSelection('driveSpreadsheetsTable')).toBeUndefined();
  });
});
