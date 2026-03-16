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
import MUISwitch from './MUISwitch';

describe('MUISwitch Component', () => {
  it('should render the switch component', () => {
    render(<MUISwitch />);

    const switchElement = screen.getByRole('switch');

    expect(switchElement).toBeInTheDocument();
  });

  it('should render with unchecked state by default', () => {
    render(<MUISwitch />);

    const switchElement = screen.getByRole('switch');

    expect(switchElement).not.toBeChecked();
  });

  it('should render with checked state when checked prop is true', () => {
    render(<MUISwitch checked />);

    const switchElement = screen.getByRole('switch');

    expect(switchElement).toBeChecked();
  });

  it('should render label when provided', () => {
    const labelText = 'Enable Feature';

    render(<MUISwitch label={labelText} />);

    expect(screen.getByText(labelText)).toBeInTheDocument();
  });

  it('should not render label when not provided', () => {
    render(<MUISwitch />);

    expect(screen.queryByText('Enable Feature')).not.toBeInTheDocument();
  });

  it('should call onChange with true when switch is toggled on', () => {
    const mockOnChange = jest.fn();

    render(<MUISwitch checked={false} onChange={mockOnChange} />);

    const switchElement = screen.getByRole('switch');

    fireEvent.click(switchElement);

    expect(mockOnChange).toHaveBeenCalledTimes(1);
    expect(mockOnChange).toHaveBeenCalledWith(true);
  });

  it('should call onChange with false when switch is toggled off', () => {
    const mockOnChange = jest.fn();

    render(<MUISwitch checked onChange={mockOnChange} />);

    const switchElement = screen.getByRole('switch');

    fireEvent.click(switchElement);

    expect(mockOnChange).toHaveBeenCalledTimes(1);
    expect(mockOnChange).toHaveBeenCalledWith(false);
  });

  it('should not throw error when onChange is not provided', () => {
    render(<MUISwitch />);

    const switchElement = screen.getByRole('switch');

    expect(() => fireEvent.click(switchElement)).not.toThrow();
  });

  it('should apply disabled attribute when disabled prop is true', () => {
    render(<MUISwitch disabled />);

    const switchElement = screen.getByRole('switch');

    expect(switchElement).toBeDisabled();
  });

  it('should not call onChange when disabled', () => {
    const mockOnChange = jest.fn();

    render(<MUISwitch disabled onChange={mockOnChange} />);

    const switchElement = screen.getByRole('switch');

    fireEvent.click(switchElement);

    expect(mockOnChange).not.toHaveBeenCalled();
  });

  it('should pass additional props to the underlying Switch component', () => {
    render(<MUISwitch data-testid="custom-switch" size="small" />);

    expect(screen.getByTestId('custom-switch')).toBeInTheDocument();
  });

  it('should render with both label and checked state', () => {
    const labelText = 'Toggle Me';

    render(<MUISwitch checked label={labelText} />);

    const switchElement = screen.getByRole('switch');

    expect(switchElement).toBeChecked();

    expect(screen.getByText(labelText)).toBeInTheDocument();
  });

  it('should support memoization without breaking rendering', () => {
    const { rerender } = render(<MUISwitch />);

    rerender(<MUISwitch />);

    expect(screen.getByRole('switch')).toBeInTheDocument();
  });
});
