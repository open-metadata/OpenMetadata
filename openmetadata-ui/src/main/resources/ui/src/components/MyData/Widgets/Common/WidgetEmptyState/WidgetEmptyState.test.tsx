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
import TaskIcon from '../../../../../assets/svg/ic-task.svg?react';
import WidgetEmptyState from './WidgetEmptyState';

const mockProps = {
  icon: <TaskIcon data-testid="empty-icon" />,
  title: 'No Data Found',
  description: 'There are no items to display',
  showActionButton: true,
  actionButtonText: 'Add Item',
  onActionClick: jest.fn(),
  className: 'custom-empty-class',
  dataTestId: 'test-empty-state',
};

const renderWidgetEmptyState = (props = {}) => {
  return render(
    <MemoryRouter>
      <WidgetEmptyState {...mockProps} {...props} />
    </MemoryRouter>
  );
};

describe('WidgetEmptyState', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders with icon, title and description', () => {
    renderWidgetEmptyState();

    expect(screen.getByTestId('empty-icon')).toBeInTheDocument();
    expect(screen.getByText('No Data Found')).toBeInTheDocument();
    expect(
      screen.getByText('There are no items to display')
    ).toBeInTheDocument();
  });

  it('renders action button when showActionButton is true', () => {
    renderWidgetEmptyState();

    expect(screen.getByText('Add Item')).toBeInTheDocument();
  });

  it('calls onActionClick when action button is clicked', () => {
    renderWidgetEmptyState();

    const actionButton = screen.getByText('Add Item');
    fireEvent.click(actionButton);

    expect(mockProps.onActionClick).toHaveBeenCalled();
  });

  it('uses default action button text when not provided', () => {
    renderWidgetEmptyState({ actionButtonText: undefined });

    expect(screen.getByText('label.explore')).toBeInTheDocument();
  });

  it('renders action link when actionButtonLink is provided', () => {
    renderWidgetEmptyState({
      showActionButton: false,
      actionButtonLink: '/explore',
    });

    const actionLink = screen.getByText('Add Item');

    expect(actionLink.closest('a')).toHaveAttribute('href', '/explore');
  });

  it('does not render action button when showActionButton is false', () => {
    renderWidgetEmptyState({ showActionButton: false });

    expect(screen.queryByText('Add Item')).not.toBeInTheDocument();
  });

  it('renders without title when not provided', () => {
    renderWidgetEmptyState({ title: undefined });

    expect(screen.queryByText('No Data Found')).not.toBeInTheDocument();
    expect(
      screen.getByText('There are no items to display')
    ).toBeInTheDocument();
  });

  it('renders without description when not provided', () => {
    renderWidgetEmptyState({ description: undefined });

    expect(screen.getByText('No Data Found')).toBeInTheDocument();
    expect(
      screen.queryByText('There are no items to display')
    ).not.toBeInTheDocument();
  });

  it('renders without icon when not provided', () => {
    renderWidgetEmptyState({ icon: undefined });

    expect(screen.queryByTestId('empty-icon')).not.toBeInTheDocument();
    expect(screen.getByText('No Data Found')).toBeInTheDocument();
  });

  it('applies custom className', () => {
    renderWidgetEmptyState();

    const emptyState = screen.getByTestId('test-empty-state');

    expect(emptyState).toHaveClass('custom-empty-class');
  });

  it('renders with custom data test id', () => {
    renderWidgetEmptyState({ dataTestId: 'custom-empty' });

    expect(screen.getByTestId('custom-empty')).toBeInTheDocument();
  });

  it('handles missing optional props gracefully', () => {
    renderWidgetEmptyState({
      icon: undefined,
      title: undefined,
      description: undefined,
      showActionButton: false,
      actionButtonLink: undefined,
      onActionClick: undefined,
    });

    // Should still render the empty state container
    expect(screen.getByTestId('test-empty-state')).toBeInTheDocument();
  });
});
