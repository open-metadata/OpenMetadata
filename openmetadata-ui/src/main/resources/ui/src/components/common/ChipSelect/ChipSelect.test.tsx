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
import ChipSelect from './ChipSelect';
import { ChipSelectProps } from './ChipSelect.interface';

const mockOptions = [
  { value: 'option1', label: 'Option 1' },
  { value: 'option2', label: 'Option 2' },
  { value: 'option3', label: 'Option 3' },
];

const mockOnChange = jest.fn();

const defaultProps: ChipSelectProps = {
  options: mockOptions,
  value: 'option1',
  onChange: mockOnChange,
};

describe('ChipSelect component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render all chip options', () => {
    render(<ChipSelect {...defaultProps} />);

    expect(screen.getByTestId('chip-option1')).toBeInTheDocument();
    expect(screen.getByTestId('chip-option2')).toBeInTheDocument();
    expect(screen.getByTestId('chip-option3')).toBeInTheDocument();
  });

  it('should display chip labels correctly', () => {
    render(<ChipSelect {...defaultProps} />);

    expect(screen.getByText('Option 1')).toBeInTheDocument();
    expect(screen.getByText('Option 2')).toBeInTheDocument();
    expect(screen.getByText('Option 3')).toBeInTheDocument();
  });

  it('should render label when provided', () => {
    render(<ChipSelect {...defaultProps} label="Select an option" />);

    expect(screen.getByText('Select an option')).toBeInTheDocument();
  });

  it('should not render label when not provided', () => {
    const { container } = render(<ChipSelect {...defaultProps} />);

    const label = container.querySelector('label');

    expect(label).not.toBeInTheDocument();
  });

  it('should apply required class to label when required is true', () => {
    render(<ChipSelect {...defaultProps} required label="Select an option" />);

    const label = screen.getByText('Select an option');

    expect(label).toHaveClass('Mui-required');
  });

  it('should call onChange when a chip is clicked', () => {
    render(<ChipSelect {...defaultProps} />);

    const chip2 = screen.getByTestId('chip-option2');
    fireEvent.click(chip2);

    expect(mockOnChange).toHaveBeenCalledWith('option2');
    expect(mockOnChange).toHaveBeenCalledTimes(1);
  });

  it('should not call onChange when disabled', () => {
    render(<ChipSelect {...defaultProps} disabled />);

    const chip2 = screen.getByTestId('chip-option2');
    fireEvent.click(chip2);

    expect(mockOnChange).not.toHaveBeenCalled();
  });

  it('should show selected chip with check icon', () => {
    render(<ChipSelect {...defaultProps} value="option2" />);

    const chip2 = screen.getByTestId('chip-option2');
    const icon = chip2.querySelector('svg');

    expect(icon).toBeInTheDocument();
  });

  it('should not show check icon for unselected chips', () => {
    render(<ChipSelect {...defaultProps} value="option1" />);

    const chip2 = screen.getByTestId('chip-option2');
    const icon = chip2.querySelector('svg');

    expect(icon).not.toBeInTheDocument();
  });

  it('should render helper text when provided', () => {
    render(
      <ChipSelect {...defaultProps} helperText="Please select an option" />
    );

    expect(screen.getByText('Please select an option')).toBeInTheDocument();
  });

  it('should not render helper text when not provided', () => {
    const { container } = render(<ChipSelect {...defaultProps} />);

    const helperText = container.querySelector('.MuiFormHelperText-root');

    expect(helperText).not.toBeInTheDocument();
  });

  it('should apply error styling to label when error is true', () => {
    render(<ChipSelect {...defaultProps} error label="Select an option" />);

    const label = screen.getByText('Select an option');

    expect(label).toHaveClass('Mui-error');
  });

  it('should apply error styling to helper text when error is true', () => {
    render(
      <ChipSelect {...defaultProps} error helperText="This field is required" />
    );

    const helperText = screen.getByText('This field is required');

    expect(helperText).toHaveClass('Mui-error');
  });

  it('should apply disabled class to all chips when disabled is true', () => {
    render(<ChipSelect {...defaultProps} disabled />);

    const chip1 = screen.getByTestId('chip-option1');
    const chip2 = screen.getByTestId('chip-option2');
    const chip3 = screen.getByTestId('chip-option3');

    expect(chip1).toHaveClass('Mui-disabled');
    expect(chip2).toHaveClass('Mui-disabled');
    expect(chip3).toHaveClass('Mui-disabled');
  });

  it('should render with custom dataTestId', () => {
    render(<ChipSelect {...defaultProps} dataTestId="custom-chip-select" />);

    expect(screen.getByTestId('custom-chip-select')).toBeInTheDocument();
  });

  it('should handle clicking the same chip that is already selected', () => {
    render(<ChipSelect {...defaultProps} value="option1" />);

    const chip1 = screen.getByTestId('chip-option1');
    fireEvent.click(chip1);

    expect(mockOnChange).toHaveBeenCalledWith('option1');
  });

  it('should apply filled class to selected chip and outlined class to unselected chips', () => {
    render(<ChipSelect {...defaultProps} value="option2" />);

    const chip1 = screen.getByTestId('chip-option1');
    const chip2 = screen.getByTestId('chip-option2');

    expect(chip2).toHaveClass('MuiChip-filled');
    expect(chip1).toHaveClass('MuiChip-outlined');
  });

  it('should handle empty options array', () => {
    render(<ChipSelect {...defaultProps} options={[]} />);

    const chip1 = screen.queryByTestId('chip-option1');

    expect(chip1).not.toBeInTheDocument();
  });

  it('should apply filled and clickable classes to selected chip', () => {
    render(<ChipSelect {...defaultProps} value="option2" />);

    const chip2 = screen.getByTestId('chip-option2');

    expect(chip2).toHaveClass('MuiChip-filled');
    expect(chip2).toHaveClass('MuiChip-clickable');
  });

  it('should apply outlined and clickable classes to unselected chip', () => {
    render(<ChipSelect {...defaultProps} value="option1" />);

    const chip2 = screen.getByTestId('chip-option2');

    expect(chip2).toHaveClass('MuiChip-outlined');
    expect(chip2).toHaveClass('MuiChip-clickable');
  });
});
