/*
 *  Copyright 2023 Collate.
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
import HeaderCard from './HeaderCard.component';

const renderHeaderCard = (props = {}) => {
  const defaultProps = {
    title: 'Test Title',
    description: 'Test Description',
    addLabel: 'Add Item',
    onAdd: jest.fn(),
    ...props,
  };

  return render(<HeaderCard {...defaultProps} />);
};

describe('HeaderCard', () => {
  it('should render the component with all props', () => {
    renderHeaderCard();

    expect(screen.getByTestId('header-card')).toBeInTheDocument();
    expect(screen.getByText('Test Title')).toBeInTheDocument();
    expect(screen.getByText('Test Description')).toBeInTheDocument();
    expect(screen.getByText('Add Item')).toBeInTheDocument();
  });

  it('should call onAdd when add button is clicked', () => {
    const onAdd = jest.fn();
    renderHeaderCard({ onAdd });

    const addButton = screen.getByTestId('add-button');
    fireEvent.click(addButton);

    expect(onAdd).toHaveBeenCalledTimes(1);
  });

  it('should disable the add button when disabled prop is true', () => {
    renderHeaderCard({ disabled: true });

    const addButton = screen.getByTestId('add-button');

    expect(addButton).toBeDisabled();
  });

  it('should apply custom className', () => {
    renderHeaderCard({ className: 'custom-class' });

    expect(screen.getByTestId('header-card')).toHaveClass('custom-class');
  });

  it('should render with different title and description', () => {
    renderHeaderCard({
      title: 'Custom Title',
      description: 'Custom Description',
    });

    expect(screen.getByText('Custom Title')).toBeInTheDocument();
    expect(screen.getByText('Custom Description')).toBeInTheDocument();
  });

  it('should render with different add label', () => {
    renderHeaderCard({ addLabel: 'Create New' });

    expect(screen.getByText('Create New')).toBeInTheDocument();
  });

  it('should have proper button styling and icon', () => {
    renderHeaderCard();

    const addButton = screen.getByTestId('add-button');

    expect(addButton).toHaveClass('ant-btn-primary');

    // Check if PlusOutlined icon is present
    const icon = addButton.querySelector('.anticon-plus');

    expect(icon).toBeInTheDocument();
  });

  it('should not show add button when showAddButton is false', () => {
    renderHeaderCard({ showAddButton: false });

    expect(screen.queryByTestId('add-button')).not.toBeInTheDocument();
  });

  it('should not show add button when addLabel is not provided', () => {
    renderHeaderCard({ addLabel: undefined });

    expect(screen.queryByTestId('add-button')).not.toBeInTheDocument();
  });

  it('should not show add button when onAdd is not provided', () => {
    renderHeaderCard({ onAdd: undefined });

    expect(screen.queryByTestId('add-button')).not.toBeInTheDocument();
  });

  it('should apply custom gradient when provided', () => {
    const customGradient = 'linear-gradient(45deg, #ff6b6b, #4ecdc4)';
    renderHeaderCard({ gradient: customGradient });

    const headerCard = screen.getByTestId('header-card');

    expect(headerCard).toHaveStyle({ background: customGradient });
  });

  it('should render without add button when only title and description are provided', () => {
    renderHeaderCard({
      title: 'Simple Title',
      description: 'Simple Description',
      addLabel: undefined,
      onAdd: undefined,
    });

    expect(screen.getByText('Simple Title')).toBeInTheDocument();
    expect(screen.getByText('Simple Description')).toBeInTheDocument();
    expect(screen.queryByTestId('add-button')).not.toBeInTheDocument();
  });
});
