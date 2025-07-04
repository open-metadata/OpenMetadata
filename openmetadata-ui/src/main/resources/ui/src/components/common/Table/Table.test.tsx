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

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
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

jest.mock('../../../utils/TableUtils', () => ({
  getTableExpandableConfig: jest.fn(),
}));

jest.mock('../SearchBarComponent/SearchBar.component', () =>
  jest.fn().mockImplementation(() => <div>SearchBar</div>)
);

// Mock DraggableMenuItem component
jest.mock('./DraggableMenu/DraggableMenuItem.component', () =>
  jest.fn().mockImplementation(({ currentItem, selectedOptions, onSelect }) => (
    <div key={currentItem.value}>
      <input
        checked={selectedOptions.includes(currentItem.value)}
        data-testid={`column-checkbox-${currentItem.value}`}
        type="checkbox"
        onChange={(e) => onSelect(currentItem.value, e.target.checked)}
      />
      <label>{currentItem.label}</label>
    </div>
  ))
);

// Mock hooks
const mockSetPreference = jest.fn();
const mockUseCurrentUserPreferences = {
  preferences: {
    selectedEntityTableColumns: {},
  },
  setPreference: mockSetPreference,
};

const mockUseGenericContext = {
  type: 'table',
};

jest.mock('../../../hooks/currentUserStore/useCurrentUserStore', () => ({
  useCurrentUserPreferences: jest.fn(() => mockUseCurrentUserPreferences),
}));

jest.mock('../../Customization/GenericProvider/GenericProvider', () => ({
  useGenericContext: jest.fn(() => mockUseGenericContext),
}));

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
  {
    title: 'Column 3',
    dataIndex: 'col3',
    key: 'col3',
  },
];

const mockData = [
  { col1: 'Value 1', col2: 'Value 2', col3: 'Value 3' },
  { col1: 'Value 4', col2: 'Value 5', col3: 'Value 6' },
];

describe('Table component', () => {
  const renderComponent = (props = {}) => {
    return render(
      <DndProvider backend={HTML5Backend}>
        <Table columns={mockColumns} dataSource={mockData} {...props} />
      </DndProvider>
    );
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockUseCurrentUserPreferences.preferences.selectedEntityTableColumns = {};
  });

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

  describe('Column Selection Functionality', () => {
    beforeEach(() => {
      (getCustomizeColumnDetails as jest.Mock).mockReturnValue([
        { label: 'Column 1', value: 'col1' },
        { label: 'Column 2', value: 'col2' },
        { label: 'Column 3', value: 'col3' },
      ]);
    });

    it('should initialize column selections from existing user preferences', () => {
      mockUseCurrentUserPreferences.preferences.selectedEntityTableColumns = {
        table: ['col1', 'col2'],
      };

      renderComponent({
        staticVisibleColumns: ['col1'],
        defaultVisibleColumns: ['col2', 'col3'],
        entityType: 'table',
      });

      // Component should use existing preferences
      expect(mockSetPreference).not.toHaveBeenCalled();
    });

    it('should use default columns when no existing preferences and customization is enabled', () => {
      mockUseCurrentUserPreferences.preferences.selectedEntityTableColumns = {};

      renderComponent({
        staticVisibleColumns: ['col1'],
        defaultVisibleColumns: ['col2', 'col3'],
        entityType: 'table',
      });

      // Component should not automatically set preferences
      expect(mockSetPreference).not.toHaveBeenCalled();
    });

    it('should require both static and default columns for customization', () => {
      renderComponent({
        staticVisibleColumns: ['col1'],
        defaultVisibleColumns: ['col2'],
      });

      expect(screen.getByTestId('column-dropdown')).toBeInTheDocument();
    });

    it('should not render column dropdown when only staticVisibleColumns is provided', () => {
      renderComponent({
        staticVisibleColumns: ['col1'],
        defaultVisibleColumns: undefined,
      });

      expect(screen.queryByTestId('column-dropdown')).not.toBeInTheDocument();
    });

    it('should not render column dropdown when only defaultVisibleColumns is provided', () => {
      renderComponent({
        staticVisibleColumns: undefined,
        defaultVisibleColumns: ['col2'],
      });

      expect(screen.queryByTestId('column-dropdown')).not.toBeInTheDocument();
    });

    it('should not render column dropdown when both static and default columns are empty', () => {
      renderComponent({
        staticVisibleColumns: undefined,
        defaultVisibleColumns: undefined,
      });

      expect(screen.queryByTestId('column-dropdown')).not.toBeInTheDocument();
    });

    it('should not enable customization when no static or default columns are provided', () => {
      renderComponent();

      expect(screen.queryByTestId('column-dropdown')).not.toBeInTheDocument();
    });

    it('should open column dropdown and show column options', async () => {
      mockUseCurrentUserPreferences.preferences.selectedEntityTableColumns = {
        table: ['col1', 'col2'],
      };

      renderComponent({
        staticVisibleColumns: ['col1'],
        defaultVisibleColumns: ['col2'],
      });

      const columnDropdown = screen.getByTestId('column-dropdown');
      fireEvent.click(columnDropdown);

      await waitFor(() => {
        expect(screen.getByTestId('column-dropdown-title')).toBeInTheDocument();
        expect(screen.getByText('label.column')).toBeInTheDocument();
      });
    });

    it('should handle column selection when checkbox is clicked', async () => {
      mockUseCurrentUserPreferences.preferences.selectedEntityTableColumns = {
        table: ['col1', 'col2'],
      };

      renderComponent({
        staticVisibleColumns: ['col1'],
        defaultVisibleColumns: ['col2'],
        entityType: 'table',
      });

      const columnDropdown = screen.getByTestId('column-dropdown');
      fireEvent.click(columnDropdown);

      await waitFor(() => {
        expect(screen.getByTestId('column-checkbox-col2')).toBeInTheDocument();
      });

      const checkbox = screen.getByTestId('column-checkbox-col2');
      fireEvent.click(checkbox);

      // Verify that preferences are updated
      expect(mockSetPreference).toHaveBeenCalledWith({
        selectedEntityTableColumns: {
          table: ['col1'],
        },
      });
    });

    it('should handle column addition when unchecked checkbox is clicked', async () => {
      mockUseCurrentUserPreferences.preferences.selectedEntityTableColumns = {
        table: ['col1'],
      };

      renderComponent({
        staticVisibleColumns: ['col1'],
        defaultVisibleColumns: ['col2', 'col3'],
        entityType: 'table',
      });

      const columnDropdown = screen.getByTestId('column-dropdown');
      fireEvent.click(columnDropdown);

      await waitFor(() => {
        expect(screen.getByTestId('column-checkbox-col3')).toBeInTheDocument();
      });

      const checkbox = screen.getByTestId('column-checkbox-col3');
      fireEvent.click(checkbox);

      expect(mockSetPreference).toHaveBeenCalledWith({
        selectedEntityTableColumns: {
          table: ['col1', 'col3'],
        },
      });
    });

    it('should show "View All" button when not all columns are selected', async () => {
      mockUseCurrentUserPreferences.preferences.selectedEntityTableColumns = {
        table: ['col1'],
      };

      renderComponent({
        staticVisibleColumns: ['col1'],
        defaultVisibleColumns: ['col2'],
      });

      const columnDropdown = screen.getByTestId('column-dropdown');
      fireEvent.click(columnDropdown);

      await waitFor(() => {
        expect(
          screen.getByTestId('column-dropdown-action-button')
        ).toBeInTheDocument();
        expect(screen.getByText('label.view-all')).toBeInTheDocument();
      });
    });

    it('should show "Hide All" button when all columns are selected', async () => {
      mockUseCurrentUserPreferences.preferences.selectedEntityTableColumns = {
        table: ['col1', 'col2', 'col3'],
      };

      renderComponent({
        staticVisibleColumns: ['col1'],
        defaultVisibleColumns: ['col2'],
      });

      const columnDropdown = screen.getByTestId('column-dropdown');
      fireEvent.click(columnDropdown);

      await waitFor(() => {
        expect(
          screen.getByTestId('column-dropdown-action-button')
        ).toBeInTheDocument();
        expect(screen.getByText('label.hide-all')).toBeInTheDocument();
      });
    });

    it('should select all columns when "View All" button is clicked', async () => {
      mockUseCurrentUserPreferences.preferences.selectedEntityTableColumns = {
        table: ['col1'],
      };

      renderComponent({
        staticVisibleColumns: ['col1'],
        defaultVisibleColumns: ['col2'],
        entityType: 'table',
      });

      const columnDropdown = screen.getByTestId('column-dropdown');
      fireEvent.click(columnDropdown);

      await waitFor(() => {
        expect(
          screen.getByTestId('column-dropdown-action-button')
        ).toBeInTheDocument();
      });

      const viewAllButton = screen.getByTestId('column-dropdown-action-button');
      fireEvent.click(viewAllButton);

      expect(mockSetPreference).toHaveBeenCalledWith({
        selectedEntityTableColumns: {
          table: ['col1', 'col2', 'col3'],
        },
      });
    });

    it('should deselect all columns when "Hide All" button is clicked', async () => {
      mockUseCurrentUserPreferences.preferences.selectedEntityTableColumns = {
        table: ['col1', 'col2', 'col3'],
      };

      renderComponent({
        staticVisibleColumns: ['col1'],
        defaultVisibleColumns: ['col2'],
        entityType: 'table',
      });

      const columnDropdown = screen.getByTestId('column-dropdown');
      fireEvent.click(columnDropdown);

      await waitFor(() => {
        expect(
          screen.getByTestId('column-dropdown-action-button')
        ).toBeInTheDocument();
      });

      const hideAllButton = screen.getByTestId('column-dropdown-action-button');
      fireEvent.click(hideAllButton);

      expect(mockSetPreference).toHaveBeenCalledWith({
        selectedEntityTableColumns: {
          table: [],
        },
      });
    });

    it('should preserve existing preferences for other entity types', async () => {
      mockUseCurrentUserPreferences.preferences.selectedEntityTableColumns = {
        dashboard: ['dash1', 'dash2'],
        table: ['col1'],
      };

      renderComponent({
        staticVisibleColumns: ['col1'],
        defaultVisibleColumns: ['col2'],
        entityType: 'table',
      });

      const columnDropdown = screen.getByTestId('column-dropdown');
      fireEvent.click(columnDropdown);

      await waitFor(() => {
        expect(
          screen.getByTestId('column-dropdown-action-button')
        ).toBeInTheDocument();
      });

      const viewAllButton = screen.getByTestId('column-dropdown-action-button');
      fireEvent.click(viewAllButton);

      expect(mockSetPreference).toHaveBeenCalledWith({
        selectedEntityTableColumns: {
          dashboard: ['dash1', 'dash2'],
          table: ['col1', 'col2', 'col3'],
        },
      });
    });

    it('should render search bar when searchProps are provided', () => {
      renderComponent({
        staticVisibleColumns: ['col1'],
        defaultVisibleColumns: ['col2'],
        searchProps: {
          placeholder: 'Search columns',
          value: 'test',
          onSearch: jest.fn(),
        },
      });

      expect(screen.getByText('SearchBar')).toBeInTheDocument();
    });

    it('should not render column dropdown in full view mode', () => {
      renderComponent({
        staticVisibleColumns: undefined,
        defaultVisibleColumns: undefined,
      });

      expect(screen.queryByTestId('column-dropdown')).not.toBeInTheDocument();
    });
  });
});
