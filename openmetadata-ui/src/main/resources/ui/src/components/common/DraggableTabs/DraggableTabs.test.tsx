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
import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import { TabItem } from './DraggableTabs';

jest.mock('../../../utils/CustomizePage/CustomizePageUtils', () => ({
  getTabDisplayName: jest.fn().mockReturnValue('Test Tab'),
}));

describe('TabItem', () => {
  const mockTab = {
    id: 'test-tab-1',
    name: 'Test Tab',
    editable: true,
    layout: [],
  };

  const defaultProps = {
    item: mockTab,
    index: 0,
    moveTab: jest.fn(),
    onEdit: jest.fn(),
    onRename: jest.fn(),
    onRemove: jest.fn(),
    onItemClick: jest.fn(),
  };

  const renderComponent = (props = {}) => {
    return render(
      <DndProvider backend={HTML5Backend}>
        <TabItem {...defaultProps} {...props} />
      </DndProvider>
    );
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders tab item with correct name', () => {
    renderComponent();

    expect(screen.getByTestId('tab-Test Tab')).toBeInTheDocument();
  });

  it('calls onItemClick when tab is clicked', () => {
    renderComponent();
    fireEvent.click(screen.getByTestId('tab-Test Tab'));

    expect(defaultProps.onItemClick).toHaveBeenCalledWith(mockTab.id);
  });

  describe('dropdown menu', () => {
    const openDropdownMenu = () => {
      const moreButton = screen.getByRole('button');
      fireEvent.click(moreButton);
    };

    it('calls onEdit when Edit Widgets is clicked', () => {
      renderComponent();
      openDropdownMenu();
      fireEvent.click(screen.getByText('label.edit-widget-plural'));

      expect(defaultProps.onEdit).toHaveBeenCalledWith(mockTab.id);
    });

    it('does not render dropdown menu when tab is not editable', () => {
      renderComponent({ item: { ...mockTab, editable: false } });

      expect(
        screen.queryByText('label.edit-widget-plural')
      ).not.toBeInTheDocument();
    });

    it('calls onRename when Rename is clicked', () => {
      renderComponent();
      openDropdownMenu();
      fireEvent.click(screen.getByText('label.rename'));

      expect(defaultProps.onRename).toHaveBeenCalledWith(mockTab.id);
    });

    it('calls onRemove when Delete is clicked', () => {
      renderComponent();
      openDropdownMenu();
      fireEvent.click(screen.getByText('label.delete'));

      expect(defaultProps.onRemove).toHaveBeenCalledWith(mockTab.id);
    });
  });
});
