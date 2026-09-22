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
import { Dropdown } from '@openmetadata/ui-core-components';
import { fireEvent, render, screen } from '@testing-library/react';
import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import DraggableMenuItemV2 from './DraggableMenuItemV2.component';

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
      <Dropdown.Menu aria-label="Columns">
        <DraggableMenuItemV2 {...props} />
      </Dropdown.Menu>
    </DndProvider>
  );
};

describe('DraggableMenuItemV2', () => {
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

  it('should call onSelect with correct arguments when clicked', () => {
    renderComponent();

    fireEvent.click(screen.getByText('Test Column'));

    expect(mockOnSelect).toHaveBeenCalledWith('test', false);
  });

  it('should call onSelect with true when unselected item is clicked', () => {
    renderComponent({
      ...mockProps,
      selectedOptions: [],
    });

    fireEvent.click(screen.getByText('Test Column'));

    expect(mockOnSelect).toHaveBeenCalledWith('test', true);
  });

  it('should render inside a draggable-menu-item-v2 container', () => {
    renderComponent();

    const menuItem = screen
      .getByText('Test Column')
      .closest('.draggable-menu-item-v2');

    expect(menuItem).toBeInTheDocument();
  });

  it('should render the drag icon', () => {
    renderComponent();

    expect(
      screen.getByTestId('draggable-menu-item-drag-icon')
    ).toBeInTheDocument();
  });

  it('should render a draggable grip handle', () => {
    renderComponent();

    expect(
      screen.getByTestId('draggable-menu-item-drag-handle')
    ).toBeInTheDocument();
  });
});
