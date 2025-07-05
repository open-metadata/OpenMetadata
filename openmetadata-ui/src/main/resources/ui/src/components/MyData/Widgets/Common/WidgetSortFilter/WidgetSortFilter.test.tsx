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
import { ReactComponent as TaskIcon } from '../../../../../assets/svg/ic-task.svg';
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
  icon: <TaskIcon data-testid="sort-icon" />,
  className: 'custom-sort-class',
  dataTestId: 'test-sort-filter',
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

    expect(screen.getByTestId('sort-filter-button')).toBeInTheDocument();
    expect(screen.getByText('Name')).toBeInTheDocument();
  });

  it('displays icon when provided', () => {
    renderWidgetSortFilter();

    expect(screen.getByTestId('sort-icon')).toBeInTheDocument();
  });

  it('calls onSortChange when sort option is clicked', () => {
    renderWidgetSortFilter();

    const sortButton = screen.getByTestId('sort-filter-button');
    fireEvent.click(sortButton);

    const dateOption = screen.getByText('Date');
    fireEvent.click(dateOption);

    expect(mockProps.onSortChange).toHaveBeenCalledWith('date');
  });

  it('does not render when in edit view', () => {
    renderWidgetSortFilter({ isEditView: true });

    expect(screen.queryByTestId('sort-filter-button')).not.toBeInTheDocument();
  });

  it('does not call onSortChange when in edit view', () => {
    renderWidgetSortFilter({ isEditView: true });

    // Component should not be rendered in edit view
    expect(screen.queryByTestId('sort-filter-button')).not.toBeInTheDocument();
  });

  it('applies custom className', () => {
    renderWidgetSortFilter();

    const sortFilter = screen.getByTestId('test-sort-filter');

    expect(sortFilter).toHaveClass('custom-sort-class');
  });

  it('renders with custom data test id', () => {
    renderWidgetSortFilter({ dataTestId: 'custom-sort' });

    expect(screen.getByTestId('custom-sort')).toBeInTheDocument();
  });

  it('shows all sort options in dropdown', () => {
    renderWidgetSortFilter();

    const sortButton = screen.getByTestId('sort-filter-button');
    fireEvent.click(sortButton);

    expect(screen.getByText('Name')).toBeInTheDocument();
    expect(screen.getByText('Date')).toBeInTheDocument();
    expect(screen.getByText('Type')).toBeInTheDocument();
  });

  it('handles empty sort options gracefully', () => {
    renderWidgetSortFilter({ sortOptions: [] });

    expect(screen.getByTestId('sort-filter-button')).toBeInTheDocument();
    expect(screen.getByText('')).toBeInTheDocument();
  });

  it('handles missing selectedSortBy gracefully', () => {
    renderWidgetSortFilter({ selectedSortBy: undefined });

    expect(screen.getByTestId('sort-filter-button')).toBeInTheDocument();
    expect(screen.getByText('')).toBeInTheDocument();
  });

  it('handles missing icon gracefully', () => {
    renderWidgetSortFilter({ icon: undefined });

    expect(screen.getByTestId('sort-filter-button')).toBeInTheDocument();
    expect(screen.queryByTestId('sort-icon')).not.toBeInTheDocument();
  });

  it('handles missing onSortChange gracefully', () => {
    renderWidgetSortFilter({ onSortChange: undefined });

    const sortButton = screen.getByTestId('sort-filter-button');
    fireEvent.click(sortButton);

    const dateOption = screen.getByText('Date');
    fireEvent.click(dateOption);

    // Should not throw error when onSortChange is undefined
    expect(screen.getByTestId('sort-filter-button')).toBeInTheDocument();
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
