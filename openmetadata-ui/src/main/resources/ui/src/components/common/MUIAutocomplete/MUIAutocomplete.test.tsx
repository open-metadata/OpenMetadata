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
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import MUIAutocomplete from './MUIAutocomplete';

describe('MUIAutocomplete', () => {
  const mockOnChange = jest.fn();
  const defaultProps = {
    value: [],
    onChange: mockOnChange,
    label: 'Test Label',
    placeholder: 'Test Placeholder',
    options: ['Option 1', 'Option 2', 'Option 3'],
    dataTestId: 'test-autocomplete',
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render the component', () => {
    render(<MUIAutocomplete {...defaultProps} />);

    expect(screen.getByTestId('test-autocomplete')).toBeInTheDocument();
  });

  it('should display the label', () => {
    render(<MUIAutocomplete {...defaultProps} />);

    expect(screen.getAllByText('Test Label')[0]).toBeInTheDocument();
  });

  it('should display placeholder when no value is selected', () => {
    render(<MUIAutocomplete {...defaultProps} />);

    expect(screen.getByPlaceholderText('Test Placeholder')).toBeInTheDocument();
  });

  it('should hide placeholder when values are selected', () => {
    render(<MUIAutocomplete {...defaultProps} value={['Option 1']} />);

    expect(
      screen.queryByPlaceholderText('Test Placeholder')
    ).not.toBeInTheDocument();
  });

  it('should render with data-testid', () => {
    render(<MUIAutocomplete {...defaultProps} />);

    expect(screen.getByTestId('test-autocomplete')).toBeInTheDocument();
  });

  it('should display selected values', () => {
    render(
      <MUIAutocomplete {...defaultProps} value={['Option 1', 'Option 2']} />
    );

    expect(screen.getByText('Option 1')).toBeInTheDocument();
    expect(screen.getByText('Option 2')).toBeInTheDocument();
  });

  it('should call onChange when a new value is selected', async () => {
    render(<MUIAutocomplete {...defaultProps} />);

    const input = screen.getByTestId('test-autocomplete');
    fireEvent.mouseDown(input);

    await waitFor(() => {
      expect(screen.getByRole('listbox')).toBeInTheDocument();
    });

    const option = screen.getByText('Option 1');
    fireEvent.click(option);

    expect(mockOnChange).toHaveBeenCalledWith(['Option 1']);
  });

  it('should handle multiple selections', async () => {
    render(<MUIAutocomplete {...defaultProps} value={['Option 1']} />);

    const input = screen.getByTestId('test-autocomplete');
    fireEvent.mouseDown(input);

    await waitFor(() => {
      expect(screen.getByRole('listbox')).toBeInTheDocument();
    });

    const option = screen.getByText('Option 2');
    fireEvent.click(option);

    expect(mockOnChange).toHaveBeenCalledWith(['Option 1', 'Option 2']);
  });

  it('should allow freeSolo input', () => {
    render(<MUIAutocomplete {...defaultProps} />);

    const input = screen.getByTestId('test-autocomplete');
    fireEvent.change(input, { target: { value: 'Custom Value' } });
    fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' });

    expect(mockOnChange).toHaveBeenCalledWith(['Custom Value']);
  });

  it('should remove a selected value when clicking the delete icon', () => {
    render(
      <MUIAutocomplete {...defaultProps} value={['Option 1', 'Option 2']} />
    );

    const deleteButtons = screen.getAllByTestId('CancelIcon');
    fireEvent.click(deleteButtons[0]);

    expect(mockOnChange).toHaveBeenCalledWith(['Option 2']);
  });

  it('should render as required when required prop is true', () => {
    render(<MUIAutocomplete {...defaultProps} required />);

    const input = screen.getByTestId('test-autocomplete');

    expect(input).toBeRequired();
  });

  it('should not render as required when required prop is false', () => {
    render(<MUIAutocomplete {...defaultProps} required={false} />);

    const input = screen.getByTestId('test-autocomplete');

    expect(input).not.toBeRequired();
  });

  it('should handle empty options array', () => {
    render(<MUIAutocomplete {...defaultProps} options={[]} />);

    expect(screen.getByTestId('test-autocomplete')).toBeInTheDocument();
  });

  it('should handle undefined onChange', async () => {
    render(<MUIAutocomplete {...defaultProps} onChange={undefined} />);

    const input = screen.getByTestId('test-autocomplete');
    fireEvent.mouseDown(input);

    await waitFor(() => {
      expect(screen.getByRole('listbox')).toBeInTheDocument();
    });

    const option = screen.getByText('Option 1');
    fireEvent.click(option);

    expect(mockOnChange).not.toHaveBeenCalled();
  });

  it('should pass through additional MUI Autocomplete props', () => {
    render(<MUIAutocomplete {...defaultProps} disabled />);

    const input = screen.getByTestId('test-autocomplete');

    expect(input).toBeDisabled();
  });

  it('should handle clearing all values', () => {
    render(
      <MUIAutocomplete {...defaultProps} value={['Option 1', 'Option 2']} />
    );

    const clearButton = screen.getByTitle('Clear');
    fireEvent.click(clearButton);

    expect(mockOnChange).toHaveBeenCalledWith([]);
  });

  it('should display all options when input is focused', async () => {
    render(<MUIAutocomplete {...defaultProps} />);

    const input = screen.getByTestId('test-autocomplete');
    fireEvent.mouseDown(input);

    await waitFor(() => {
      expect(screen.getByRole('listbox')).toBeInTheDocument();
    });

    expect(screen.getByText('Option 1')).toBeInTheDocument();
    expect(screen.getByText('Option 2')).toBeInTheDocument();
    expect(screen.getByText('Option 3')).toBeInTheDocument();
  });

  it('should filter options based on input', async () => {
    render(<MUIAutocomplete {...defaultProps} />);

    const input = screen.getByTestId('test-autocomplete');
    fireEvent.change(input, { target: { value: 'Option 1' } });

    await waitFor(() => {
      expect(screen.getByRole('listbox')).toBeInTheDocument();
    });

    expect(screen.getByText('Option 1')).toBeInTheDocument();
    expect(screen.queryByText('Option 2')).not.toBeInTheDocument();
    expect(screen.queryByText('Option 3')).not.toBeInTheDocument();
  });

  it('should support multiple freeSolo values', () => {
    render(<MUIAutocomplete {...defaultProps} value={['Custom 1']} />);

    const input = screen.getByTestId('test-autocomplete');
    fireEvent.change(input, { target: { value: 'Custom 2' } });
    fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' });

    expect(mockOnChange).toHaveBeenCalledWith(['Custom 1', 'Custom 2']);
  });

  it('should handle onChange callback being called', () => {
    const { rerender } = render(<MUIAutocomplete {...defaultProps} />);

    expect(mockOnChange).not.toHaveBeenCalled();

    rerender(<MUIAutocomplete {...defaultProps} value={['Option 1']} />);

    const input = screen.getByTestId('test-autocomplete');
    fireEvent.change(input, { target: { value: 'New Value' } });
    fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' });

    expect(mockOnChange).toHaveBeenCalled();
  });
});
