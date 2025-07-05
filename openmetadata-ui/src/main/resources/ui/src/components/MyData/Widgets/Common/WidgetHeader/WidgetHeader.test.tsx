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
import WidgetHeader from './WidgetHeader';

const mockProps = {
  title: 'Test Widget',
  icon: <TaskIcon data-testid="widget-icon" />,
  badge: <span data-testid="widget-badge">(5)</span>,
  isEditView: false,
  widgetWidth: 2,
  sortOptions: [
    { key: 'name', label: 'Name' },
    { key: 'date', label: 'Date' },
  ],
  selectedSortBy: 'name',
  onSortChange: jest.fn(),
  moreMenuItems: [
    { key: 'edit', label: 'Edit' },
    { key: 'delete', label: 'Delete' },
  ],
  onMoreMenuClick: jest.fn(),
  onEditClick: jest.fn(),
  className: 'custom-class',
  dataTestId: 'test-widget-header',
};

const renderWidgetHeader = (props = {}) => {
  return render(
    <MemoryRouter>
      <WidgetHeader {...mockProps} {...props} />
    </MemoryRouter>
  );
};

describe('WidgetHeader', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders with title and icon', () => {
    renderWidgetHeader();

    expect(screen.getByText('Test Widget')).toBeInTheDocument();
    expect(screen.getByTestId('widget-icon')).toBeInTheDocument();
    expect(screen.getByTestId('widget-badge')).toBeInTheDocument();
  });

  it('renders sort dropdown when not in edit view', () => {
    renderWidgetHeader();

    expect(screen.getByTestId('sort-by-button')).toBeInTheDocument();
    expect(screen.getByText('Name')).toBeInTheDocument();
  });

  it('calls onSortChange when sort option is clicked', () => {
    renderWidgetHeader();

    const sortButton = screen.getByTestId('sort-by-button');
    fireEvent.click(sortButton);

    const dateOption = screen.getByText('Date');
    fireEvent.click(dateOption);

    expect(mockProps.onSortChange).toHaveBeenCalledWith('date');
  });

  it('renders edit controls when in edit view', () => {
    renderWidgetHeader({ isEditView: true });

    expect(screen.getByTestId('drag-widget-button')).toBeInTheDocument();
    expect(screen.queryByTestId('sort-by-button')).not.toBeInTheDocument();
  });

  it('calls onEditClick when edit button is clicked', () => {
    renderWidgetHeader({ isEditView: true });

    const editButton = screen.getByTestId('edit-widget-button');
    fireEvent.click(editButton);

    expect(mockProps.onEditClick).toHaveBeenCalled();
  });

  it('renders more menu when in edit view', () => {
    renderWidgetHeader({ isEditView: true });

    const moreButton = screen.getByTestId('more-button');
    fireEvent.click(moreButton);

    expect(screen.getByText('Edit')).toBeInTheDocument();
    expect(screen.getByText('Delete')).toBeInTheDocument();
  });

  it('calls onMoreMenuClick when more menu item is clicked', () => {
    renderWidgetHeader({ isEditView: true });

    const moreButton = screen.getByTestId('more-button');
    fireEvent.click(moreButton);

    const editOption = screen.getByText('Edit');
    fireEvent.click(editOption);

    expect(mockProps.onMoreMenuClick).toHaveBeenCalledWith(
      expect.objectContaining({ key: 'edit' })
    );
  });

  it('does not call onSortChange when in edit view', () => {
    renderWidgetHeader({ isEditView: true });

    // Sort dropdown should not be visible in edit view
    expect(screen.queryByTestId('sort-by-button')).not.toBeInTheDocument();
  });

  it('applies custom className', () => {
    renderWidgetHeader();

    const header = screen.getByTestId('test-widget-header');

    expect(header).toHaveClass('custom-class');
  });

  it('handles missing optional props gracefully', () => {
    renderWidgetHeader({
      icon: undefined,
      badge: undefined,
      sortOptions: undefined,
      selectedSortBy: undefined,
      onSortChange: undefined,
      moreMenuItems: undefined,
      onMoreMenuClick: undefined,
      onEditClick: undefined,
    });

    expect(screen.getByText('Test Widget')).toBeInTheDocument();
    expect(screen.queryByTestId('sort-by-button')).not.toBeInTheDocument();
    expect(screen.queryByTestId('drag-widget-button')).not.toBeInTheDocument();
  });

  it('adjusts title width based on widget width', () => {
    renderWidgetHeader({ widgetWidth: 1 });

    const title = screen.getByText('Test Widget');

    expect(title.parentElement).toHaveStyle({ maxWidth: '200px' });
  });

  it('shows ellipsis for long titles', () => {
    renderWidgetHeader({
      title: 'Very Long Widget Title That Should Be Truncated',
    });

    const title = screen.getByText(
      'Very Long Widget Title That Should Be Truncated'
    );

    expect(title).toHaveAttribute('title');
  });
});
