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
import { fireEvent, render, screen } from '@testing-library/react';
import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import DraggableMenuItem from './DraggableMenuItem.component';

const mockOnSelect = jest.fn();
const mockOnMoveItem = jest.fn();

const mockProps = {
  currentItem: { label: 'Test Column', value: 'test' },
  index: 0,
  itemList: [
    { label: 'Test Column', value: 'test' },
    { label: 'Another Column', value: 'another' },
  ],
  selectedOptions: ['test'],
  onSelect: mockOnSelect,
  onMoveItem: mockOnMoveItem,
};

const renderComponent = (props = mockProps) => {
  return render(
    <DndProvider backend={HTML5Backend}>
      <DraggableMenuItem {...props} />
    </DndProvider>
  );
};

describe('DraggableMenuItem', () => {
  it('should render the component', () => {
    renderComponent();

    expect(screen.getByText('Test Column')).toBeInTheDocument();
  });

  it('should show eye icon when item is selected', () => {
    renderComponent();

    expect(screen.getByLabelText('eye')).toBeInTheDocument();
  });

  it('should show eye-invisible icon when item is not selected', () => {
    renderComponent({
      ...mockProps,
      selectedOptions: [],
    });

    expect(screen.getByLabelText('eye-invisible')).toBeInTheDocument();
  });

  it('should call onSelect with correct arguments when clicked', async () => {
    renderComponent();

    const button = screen.getByRole('button');
    fireEvent.click(button);

    expect(mockOnSelect).toHaveBeenCalledWith('test', false);
  });

  it('should call onSelect with true when unselected item is clicked', async () => {
    renderComponent({
      ...mockProps,
      selectedOptions: [],
    });

    const button = screen.getByRole('button');
    fireEvent.click(button);

    expect(mockOnSelect).toHaveBeenCalledWith('test', true);
  });

  it('should have draggable-menu-item class', () => {
    renderComponent();

    const menuItem = screen
      .getByText('Test Column')
      .closest('.draggable-menu-item');

    expect(menuItem).toHaveClass('draggable-menu-item');
  });

  it('should render drag icon', () => {
    renderComponent();

    // Find SVG by its class
    const dragIcon = screen.getByTestId('draggable-menu-item-drag-icon');

    expect(dragIcon).toBeInTheDocument();
  });

  it('should render button with correct class', () => {
    renderComponent();

    const button = screen.getByRole('button');

    expect(button).toHaveClass('draggable-menu-item-button');
  });

  it('should render label with correct class', () => {
    renderComponent();

    const label = screen.getByText('Test Column');

    expect(label).toHaveClass('draggable-menu-item-button-label');
  });
});
