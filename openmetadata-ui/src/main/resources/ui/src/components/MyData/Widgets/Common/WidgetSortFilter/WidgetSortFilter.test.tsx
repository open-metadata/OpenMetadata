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

import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import WidgetSortFilter from './WidgetSortFilter';

const mockProps = {
  sortOptions: [
    { key: 'name', label: 'Name' },
    { key: 'date', label: 'Date' },
    { key: 'type', label: 'Type' },
  ],
  selectedSortBy: 'name',
  onSortChange: jest.fn(),
  isEditView: false,
};

const renderWidgetSortFilter = (props = {}) => {
  return render(
    <MemoryRouter>
      <WidgetSortFilter {...mockProps} {...props} />
    </MemoryRouter>
  );
};

describe('WidgetSortFilter', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders sort dropdown with selected option', () => {
    renderWidgetSortFilter();

    expect(screen.getByTestId('widget-sort-by-dropdown')).toBeInTheDocument();
    expect(screen.getByText('Name')).toBeInTheDocument();
  });

  it('calls onSortChange when sort option is clicked', () => {
    renderWidgetSortFilter();

    const sortButton = screen.getByTestId('widget-sort-by-dropdown');
    fireEvent.click(sortButton);

    const dateOption = screen.getByText('Date');
    fireEvent.click(dateOption);

    expect(mockProps.onSortChange).toHaveBeenCalledWith(
      expect.objectContaining({ key: 'date' })
    );
  });

  it('does not render when in edit view', () => {
    renderWidgetSortFilter({ isEditView: true });

    expect(
      screen.queryByTestId('widget-sort-by-dropdown')
    ).not.toBeInTheDocument();
  });

  it('shows all sort options in dropdown', () => {
    renderWidgetSortFilter();

    const sortButton = screen.getByTestId('widget-sort-by-dropdown');
    fireEvent.click(sortButton);

    expect(screen.getAllByText('Name')).toHaveLength(2);
    expect(screen.getByText('Date')).toBeInTheDocument();
    expect(screen.getByText('Type')).toBeInTheDocument();
  });

  it('handles empty sort options gracefully', () => {
    renderWidgetSortFilter({ sortOptions: [] });

    const sortButton = screen.getByTestId('widget-sort-by-dropdown');

    expect(sortButton).toHaveTextContent('');
  });

  it('handles missing selectedSortBy gracefully', () => {
    renderWidgetSortFilter({ selectedSortBy: undefined });

    const sortButton = screen.getByTestId('widget-sort-by-dropdown');

    expect(sortButton).toHaveTextContent('');
  });

  it('renders with different selected option', () => {
    renderWidgetSortFilter({ selectedSortBy: 'date' });

    expect(screen.getByText('Date')).toBeInTheDocument();
  });

  it('handles single sort option', () => {
    renderWidgetSortFilter({
      sortOptions: [{ key: 'name', label: 'Name' }],
    });

    expect(screen.getByText('Name')).toBeInTheDocument();
  });
});
