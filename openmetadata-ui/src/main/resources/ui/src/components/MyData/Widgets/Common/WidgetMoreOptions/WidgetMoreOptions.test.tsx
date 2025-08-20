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
import WidgetMoreOptions from './WidgetMoreOptions';

const mockProps = {
  menuItems: [
    { key: 'edit', label: 'Edit', icon: <TaskIcon data-testid="edit-icon" /> },
    {
      key: 'delete',
      label: 'Delete',
      icon: <TaskIcon data-testid="delete-icon" />,
    },
    { key: 'share', label: 'Share', disabled: true },
  ],
  onMenuClick: jest.fn(),
  className: 'custom-more-class',
  dataTestId: 'test-more-options',
};

const renderWidgetMoreOptions = (props = {}) => {
  return render(
    <MemoryRouter>
      <WidgetMoreOptions {...mockProps} {...props} />
    </MemoryRouter>
  );
};

describe('WidgetMoreOptions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders more options button', () => {
    renderWidgetMoreOptions();

    expect(screen.getByTestId('more-options-button')).toBeInTheDocument();
  });

  it('shows menu items when button is clicked', () => {
    renderWidgetMoreOptions();

    const moreButton = screen.getByTestId('more-options-button');
    fireEvent.click(moreButton);

    expect(screen.getByText('Edit')).toBeInTheDocument();
    expect(screen.getByText('Delete')).toBeInTheDocument();
    expect(screen.getByText('Share')).toBeInTheDocument();
  });

  it('calls onMenuClick when menu item is clicked', () => {
    renderWidgetMoreOptions();

    const moreButton = screen.getByTestId('more-options-button');
    fireEvent.click(moreButton);

    const editOption = screen.getByText('Edit');
    fireEvent.click(editOption);

    expect(mockProps.onMenuClick).toHaveBeenCalledWith(
      expect.objectContaining({ key: 'edit' })
    );
  });

  it('renders menu items with icons when provided', () => {
    renderWidgetMoreOptions();

    const moreButton = screen.getByTestId('more-options-button');
    fireEvent.click(moreButton);

    expect(screen.getByTestId('edit-icon')).toBeInTheDocument();
    expect(screen.getByTestId('delete-icon')).toBeInTheDocument();
  });

  it('handles disabled menu items', () => {
    renderWidgetMoreOptions();

    const moreButton = screen.getByTestId('more-options-button');
    fireEvent.click(moreButton);

    const shareOption = screen.getByText('Share');

    expect(shareOption.closest('li')).toHaveClass(
      'ant-dropdown-menu-item-disabled'
    );
  });

  it('applies custom className', () => {
    renderWidgetMoreOptions();

    const moreOptions = screen.getByTestId('more-options-button');

    expect(moreOptions).toHaveClass('custom-more-class');
  });

  it('handles empty menu items gracefully', () => {
    renderWidgetMoreOptions({ menuItems: [] });

    const moreButton = screen.getByTestId('more-options-button');
    fireEvent.click(moreButton);

    // Should not crash with empty menu items
    expect(screen.getByTestId('more-options-button')).toBeInTheDocument();
  });

  it('handles missing onMenuClick gracefully', () => {
    renderWidgetMoreOptions({ onMenuClick: undefined });

    const moreButton = screen.getByTestId('more-options-button');
    fireEvent.click(moreButton);

    const editOption = screen.getByText('Edit');
    fireEvent.click(editOption);

    // Should not throw error when onMenuClick is undefined
    expect(screen.getByTestId('more-options-button')).toBeInTheDocument();
  });

  it('handles menu items without icons', () => {
    renderWidgetMoreOptions({
      menuItems: [
        { key: 'edit', label: 'Edit' },
        { key: 'delete', label: 'Delete' },
      ],
    });

    const moreButton = screen.getByTestId('more-options-button');
    fireEvent.click(moreButton);

    expect(screen.getByText('Edit')).toBeInTheDocument();
    expect(screen.getByText('Delete')).toBeInTheDocument();
    expect(screen.queryByTestId('edit-icon')).not.toBeInTheDocument();
  });

  it('handles menu items with complex keys', () => {
    renderWidgetMoreOptions({
      menuItems: [
        { key: 'edit-widget', label: 'Edit Widget' },
        { key: 'delete-widget', label: 'Delete Widget' },
      ],
    });

    const moreButton = screen.getByTestId('more-options-button');
    fireEvent.click(moreButton);

    const editOption = screen.getByText('Edit Widget');
    fireEvent.click(editOption);

    expect(mockProps.onMenuClick).toHaveBeenCalledWith(
      expect.objectContaining({ key: 'edit-widget' })
    );
  });
});
