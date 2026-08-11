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
import { FormField } from './FormField';
import { InfoLabel } from './InfoLabel';

jest.mock('./InfoLabel', () => ({
  InfoLabel: jest
    .fn()
    .mockImplementation(({ text, description, showIcon, onInfoClick }) => (
      <div data-testid="info-label">
        <span data-testid="label-text">{text}</span>
        {description && (
          <span data-testid="label-description">{description}</span>
        )}
        {showIcon && (
          <button data-testid="info-icon" onClick={onInfoClick}>
            Info Icon
          </button>
        )}
      </div>
    )),
}));

const mockProps = {
  label: 'Test Field',
  children: <input data-testid="test-input" placeholder="Test input" />,
};

describe('FormField', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render with basic props', () => {
    render(<FormField {...mockProps} />);

    expect(screen.getByTestId('info-label')).toBeInTheDocument();
    expect(screen.getByTestId('label-text')).toHaveTextContent('Test Field');
    expect(screen.getByTestId('test-input')).toBeInTheDocument();
  });

  it('should show required asterisk when required is true', () => {
    render(<FormField {...mockProps} required />);

    expect(screen.getByTestId('label-text')).toHaveTextContent('Test Field *');
  });

  it('should not show required asterisk when required is false', () => {
    render(<FormField {...mockProps} required={false} />);

    expect(screen.getByTestId('label-text')).toHaveTextContent('Test Field');
    expect(screen.getByTestId('label-text')).not.toHaveTextContent('*');
  });

  it('should render with description', () => {
    render(<FormField {...mockProps} description="Field description" />);

    expect(screen.getByTestId('label-description')).toHaveTextContent(
      'Field description'
    );
  });

  it('should show info icon when showInfoIcon is true', () => {
    render(<FormField {...mockProps} showInfoIcon />);

    expect(screen.getByTestId('info-icon')).toBeInTheDocument();
  });

  it('should not show info icon when showInfoIcon is false', () => {
    render(<FormField {...mockProps} showInfoIcon={false} />);

    expect(screen.queryByTestId('info-icon')).not.toBeInTheDocument();
  });

  it('should call onInfoClick when info icon is clicked', () => {
    const mockOnInfoClick = jest.fn();
    render(
      <FormField {...mockProps} showInfoIcon onInfoClick={mockOnInfoClick} />
    );

    const infoIcon = screen.getByTestId('info-icon');
    fireEvent.click(infoIcon);

    expect(mockOnInfoClick).toHaveBeenCalled();
  });

  it('should render children inside FormControl', () => {
    render(<FormField {...mockProps} />);

    expect(screen.getByTestId('test-input')).toBeInTheDocument();
  });

  it('should render with complex children', () => {
    const complexChildren = (
      <div data-testid="complex-child">
        <input data-testid="input-1" />
        <select data-testid="select-1">
          <option value="option1">Option 1</option>
        </select>
        <button data-testid="button-1">Submit</button>
      </div>
    );

    render(<FormField {...mockProps}>{complexChildren}</FormField>);

    expect(screen.getByTestId('complex-child')).toBeInTheDocument();
    expect(screen.getByTestId('input-1')).toBeInTheDocument();
    expect(screen.getByTestId('select-1')).toBeInTheDocument();
    expect(screen.getByTestId('button-1')).toBeInTheDocument();
  });

  it('should handle long label text', () => {
    const longLabel =
      'This is a very long label that might wrap to multiple lines and should still be handled correctly by the component';

    render(<FormField {...mockProps} label={longLabel} />);

    expect(screen.getByTestId('label-text')).toHaveTextContent(longLabel);
  });

  it('should handle empty label', () => {
    render(<FormField {...mockProps} label="" />);

    expect(screen.getByTestId('label-text')).toHaveTextContent('');
  });

  it('should handle special characters in label', () => {
    const specialLabel = 'Field with @#$%^&*() special characters';

    render(<FormField {...mockProps} label={specialLabel} />);

    expect(screen.getByTestId('label-text')).toHaveTextContent(specialLabel);
  });

  it('should pass correct props to InfoLabel', () => {
    const mockOnInfoClick = jest.fn();

    render(
      <FormField
        {...mockProps}
        required
        showInfoIcon
        description="Test Description"
        label="Test Label"
        onInfoClick={mockOnInfoClick}
      />
    );

    expect(InfoLabel).toHaveBeenCalledWith(
      expect.objectContaining({
        text: 'Test Label *',
        description: 'Test Description',
        showIcon: true,
        onInfoClick: mockOnInfoClick,
      }),
      expect.anything()
    );
  });

  it('should render multiple FormField components independently', () => {
    render(
      <div>
        <FormField required label="Field 1">
          <input data-testid="input-1" />
        </FormField>
        <FormField showInfoIcon description="Description 2" label="Field 2">
          <input data-testid="input-2" />
        </FormField>
      </div>
    );

    expect(screen.getByText('Field 1 *')).toBeInTheDocument();
    expect(screen.getByText('Field 2')).toBeInTheDocument();
    expect(screen.getByText('Description 2')).toBeInTheDocument();
    expect(screen.getByTestId('input-1')).toBeInTheDocument();
    expect(screen.getByTestId('input-2')).toBeInTheDocument();
    expect(screen.getByTestId('info-icon')).toBeInTheDocument();
  });
});
