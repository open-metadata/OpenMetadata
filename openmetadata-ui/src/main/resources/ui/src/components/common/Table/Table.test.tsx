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

import { render, screen } from '@testing-library/react';
import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import { getCustomizeColumnDetails } from '../../../utils/CustomizeColumnUtils';
import Table from './Table';

jest.mock('../../../utils/CustomizeColumnUtils', () => ({
  getCustomizeColumnDetails: jest.fn().mockReturnValue([
    { label: 'Column 1', value: 'col1' },
    { label: 'Column 2', value: 'col2' },
  ]),
  getReorderedColumns: jest.fn().mockImplementation((_, columns) => columns),
}));

jest.mock('../SearchBarComponent/SearchBar.component', () =>
  jest.fn().mockImplementation(() => <div>SearchBar</div>)
);

const mockColumns = [
  {
    title: 'Column 1',
    dataIndex: 'col1',
    key: 'col1',
  },
  {
    title: 'Column 2',
    dataIndex: 'col2',
    key: 'col2',
  },
];

const mockData = [
  { col1: 'Value 1', col2: 'Value 2' },
  { col1: 'Value 3', col2: 'Value 4' },
];

describe('Table component', () => {
  const renderComponent = (props = {}) => {
    return render(
      <DndProvider backend={HTML5Backend}>
        <Table columns={mockColumns} dataSource={mockData} {...props} />
      </DndProvider>
    );
  };

  it('should display skeleton loader if loading is true', async () => {
    renderComponent({ loading: true });

    expect(await screen.findByTestId('loader')).toBeInTheDocument();
  });

  it('should display skeleton loader if spinning is true', async () => {
    renderComponent({ loading: { spinning: true } });

    expect(await screen.findByTestId('loader')).toBeInTheDocument();
  });

  it('should not display skeleton loader if loading is false', () => {
    renderComponent({ loading: false });

    expect(screen.queryByTestId('loader')).not.toBeInTheDocument();
  });

  it('should not display skeleton loader if spinning is false', () => {
    renderComponent({ loading: { spinning: false } });

    expect(screen.queryByTestId('loader')).not.toBeInTheDocument();
  });

  it('should render table with column dropdown when columns are provided', () => {
    renderComponent({
      staticVisibleColumns: ['col1'],
      defaultVisibleColumns: ['col2'],
    });

    expect(screen.getByTestId('column-dropdown')).toBeInTheDocument();
  });

  it('should not render column dropdown when no customizable columns props are provided', () => {
    (getCustomizeColumnDetails as jest.Mock).mockImplementationOnce(() => []);

    renderComponent();

    expect(screen.queryByTestId('column-dropdown')).not.toBeInTheDocument();
  });

  it('should render table filters when provided', () => {
    const extraTableFilters = <div data-testid="table-filters">Filters</div>;
    renderComponent({
      extraTableFilters,
    });

    expect(screen.getByTestId('table-filters')).toBeInTheDocument();
  });
});
