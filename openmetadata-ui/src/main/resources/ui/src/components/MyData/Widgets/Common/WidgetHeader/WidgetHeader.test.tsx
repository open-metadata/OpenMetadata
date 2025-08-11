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
  isEditView: false,
  widgetWidth: 2,
  sortOptions: [
    { key: 'name', label: 'Name' },
    { key: 'date', label: 'Date' },
  ],
  selectedSortBy: 'name',
  onSortChange: jest.fn(),
  onEditClick: jest.fn(),
  className: 'custom-class',
  widgetKey: 'test-widget-key',
  handleLayoutUpdate: jest.fn(),
  handleRemoveWidget: jest.fn(),
  currentLayout: [],
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
  });

  it('renders sort dropdown when not in edit view', () => {
    renderWidgetHeader();

    expect(screen.getByTestId('widget-sort-by-dropdown')).toBeInTheDocument();
    expect(screen.getByText('Name')).toBeInTheDocument();
  });

  it('renders edit controls when in edit view', () => {
    renderWidgetHeader({ isEditView: true });

    expect(screen.getByTestId('drag-widget-button')).toBeInTheDocument();
    expect(
      screen.queryByTestId('widget-sort-by-dropdown')
    ).not.toBeInTheDocument();
  });

  it('calls onEditClick when edit button is clicked', () => {
    renderWidgetHeader({ isEditView: true });

    const editButton = screen.getByTestId('edit-widget-button');
    fireEvent.click(editButton);

    expect(mockProps.onEditClick).toHaveBeenCalled();
  });

  it('renders more options when in edit view', () => {
    renderWidgetHeader({ isEditView: true });

    expect(screen.getByTestId('more-options-button')).toBeInTheDocument();
  });

  it('does not render sort dropdown when in edit view', () => {
    renderWidgetHeader({ isEditView: true });

    expect(
      screen.queryByTestId('widget-sort-by-dropdown')
    ).not.toBeInTheDocument();
  });

  it('applies custom className', () => {
    renderWidgetHeader();

    const header = screen.getByTestId('widget-header');

    expect(header).toHaveClass('custom-class');
  });

  it('handles missing optional props gracefully', () => {
    renderWidgetHeader({
      icon: undefined,
      sortOptions: undefined,
      selectedSortBy: undefined,
      onSortChange: undefined,
      onEditClick: undefined,
    });

    expect(screen.getByText('Test Widget')).toBeInTheDocument();
    expect(
      screen.queryByTestId('widget-sort-by-dropdown')
    ).not.toBeInTheDocument();
    expect(screen.queryByTestId('drag-widget-button')).not.toBeInTheDocument();
  });

  it('shows ellipsis for long titles', () => {
    renderWidgetHeader({
      title: 'Very Long Widget Title That Should Be Truncated',
    });

    const title = screen.getByText(
      'Very Long Widget Title That Should Be Truncated'
    );

    expect(title).toHaveClass('ant-typography-ellipsis');
  });
});
