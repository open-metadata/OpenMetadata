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
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import MUITagSuggestion from './MUITagSuggestion';
import { MOCK_TAG_OPTIONS } from './MUITagSuggestion.mock';

const mockGetTags = jest.fn();

jest.mock('../../../utils/TagClassBase', () => ({
  __esModule: true,
  default: {
    getTags: (...args: unknown[]) => mockGetTags(...args),
  },
}));

jest.mock('lodash', () => {
  const original = jest.requireActual('lodash');

  return {
    ...original,
    debounce: (fn: (...args: unknown[]) => unknown) => fn,
  };
});

jest.mock('../atoms/TagChip', () => ({
  TagChip: ({ label, onDelete }: { label: string; onDelete?: () => void }) => (
    <span data-testid="tag-chip">
      {label}
      {onDelete && (
        <button data-testid="tag-chip-delete" onClick={onDelete}>
          x
        </button>
      )}
    </span>
  ),
}));

describe('MUITagSuggestion', () => {
  const mockOnChange = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    mockGetTags.mockResolvedValue({
      data: MOCK_TAG_OPTIONS,
      paging: { total: 3 },
    });
  });

  it('should render the component', async () => {
    await act(async () => {
      render(<MUITagSuggestion onChange={mockOnChange} />);
    });

    expect(screen.getByTestId('tag-suggestion')).toBeInTheDocument();
  });

  it('should render with custom label', async () => {
    await act(async () => {
      render(<MUITagSuggestion label="Tags" onChange={mockOnChange} />);
    });

    expect(screen.getAllByText('Tags')[0]).toBeInTheDocument();
  });

  it('should fetch and display options when input is focused', async () => {
    await act(async () => {
      render(<MUITagSuggestion onChange={mockOnChange} />);
    });

    const input = screen.getByRole('combobox');

    await act(async () => {
      fireEvent.mouseDown(input);
    });

    await waitFor(() => {
      expect(screen.getByRole('listbox')).toBeInTheDocument();
    });

    expect(screen.getByText('Personal')).toBeInTheDocument();
    expect(screen.getByText('PII')).toBeInTheDocument();
    expect(screen.getByText('Sensitive')).toBeInTheDocument();
  });

  it('should search by display name and render all matching options from server', async () => {
    mockGetTags.mockResolvedValue({
      data: [MOCK_TAG_OPTIONS[0], MOCK_TAG_OPTIONS[1]],
      paging: { total: 2 },
    });

    await act(async () => {
      render(<MUITagSuggestion onChange={mockOnChange} />);
    });

    const input = screen.getByRole('combobox');

    await act(async () => {
      fireEvent.change(input, { target: { value: 'Personal' } });
    });

    await waitFor(() => {
      expect(mockGetTags).toHaveBeenCalledWith('Personal', 1, true);
    });

    await act(async () => {
      fireEvent.mouseDown(input);
    });

    await waitFor(() => {
      expect(screen.getByRole('listbox')).toBeInTheDocument();
    });

    expect(screen.getByText('Personal')).toBeInTheDocument();
    expect(screen.getByText('PII')).toBeInTheDocument();
  });

  it('should search by name and render all matching options from server', async () => {
    mockGetTags.mockResolvedValue({
      data: [MOCK_TAG_OPTIONS[2]],
      paging: { total: 1 },
    });

    await act(async () => {
      render(<MUITagSuggestion onChange={mockOnChange} />);
    });

    const input = screen.getByRole('combobox');

    await act(async () => {
      fireEvent.change(input, { target: { value: 'Sensitive' } });
    });

    await waitFor(() => {
      expect(mockGetTags).toHaveBeenCalledWith('Sensitive', 1, true);
    });

    await act(async () => {
      fireEvent.mouseDown(input);
    });

    await waitFor(() => {
      expect(screen.getByRole('listbox')).toBeInTheDocument();
    });

    expect(screen.getByText('Sensitive')).toBeInTheDocument();
  });

  it('should be searchable by completely different name and displayName', async () => {
    const tagWithDifferentNameAndDisplayName = {
      label: 'Jest 1',
      value: 'Testing.Jest1',
      data: {
        tagFQN: 'Testing.Jest1',
        name: 'Jest 1',
        displayName: 'Testing 1',
        description: 'A tag with completely different name and displayName',
        source: 'Classification',
      },
    };

    mockGetTags.mockResolvedValue({
      data: [tagWithDifferentNameAndDisplayName],
      paging: { total: 1 },
    });

    await act(async () => {
      render(<MUITagSuggestion onChange={mockOnChange} />);
    });

    const input = screen.getByRole('combobox');

    await act(async () => {
      fireEvent.change(input, { target: { value: 'Testing 1' } });
    });

    await waitFor(() => {
      expect(mockGetTags).toHaveBeenCalledWith('Testing 1', 1, true);
    });

    await act(async () => {
      fireEvent.mouseDown(input);
    });

    await waitFor(() => {
      expect(screen.getByRole('listbox')).toBeInTheDocument();
    });

    expect(screen.getByText('Jest 1')).toBeInTheDocument();
    expect(screen.getByText('Testing 1')).toBeInTheDocument();

    mockGetTags.mockClear();

    await act(async () => {
      fireEvent.change(input, { target: { value: 'Jest 1' } });
    });

    await waitFor(() => {
      expect(mockGetTags).toHaveBeenCalledWith('Jest 1', 1, true);
    });

    expect(screen.getByText('Jest 1')).toBeInTheDocument();
    expect(screen.getByText('Testing 1')).toBeInTheDocument();
  });

  it('should NOT apply client-side filtering - all server results should be visible', async () => {
    mockGetTags.mockResolvedValue({
      data: MOCK_TAG_OPTIONS,
      paging: { total: 3 },
    });

    await act(async () => {
      render(<MUITagSuggestion onChange={mockOnChange} />);
    });

    const input = screen.getByRole('combobox');

    await act(async () => {
      fireEvent.change(input, { target: { value: 'xyz' } });
    });

    await waitFor(() => {
      expect(mockGetTags).toHaveBeenCalledWith('xyz', 1, true);
    });

    await act(async () => {
      fireEvent.mouseDown(input);
    });

    await waitFor(() => {
      expect(screen.getByRole('listbox')).toBeInTheDocument();
    });

    expect(screen.getByText('Personal')).toBeInTheDocument();
    expect(screen.getByText('PII')).toBeInTheDocument();
    expect(screen.getByText('Sensitive')).toBeInTheDocument();
  });

  it('should call onChange when a tag is selected', async () => {
    await act(async () => {
      render(<MUITagSuggestion onChange={mockOnChange} />);
    });

    const input = screen.getByRole('combobox');

    await act(async () => {
      fireEvent.mouseDown(input);
    });

    await waitFor(() => {
      expect(screen.getByRole('listbox')).toBeInTheDocument();
    });

    const option = screen.getByTestId('tag-option-PersonalData.Personal');

    await act(async () => {
      fireEvent.click(option);
    });

    expect(mockOnChange).toHaveBeenCalled();

    const callArg = mockOnChange.mock.calls[0][0];

    expect(callArg).toHaveLength(1);
    expect(callArg[0].tagFQN).toBe('PersonalData.Personal');
  });

  it('should render option with displayName when available', async () => {
    await act(async () => {
      render(<MUITagSuggestion onChange={mockOnChange} />);
    });

    const input = screen.getByRole('combobox');

    await act(async () => {
      fireEvent.mouseDown(input);
    });

    await waitFor(() => {
      expect(screen.getByRole('listbox')).toBeInTheDocument();
    });

    expect(screen.getByText('Personal Data')).toBeInTheDocument();
    expect(
      screen.getByText('Personally Identifiable Information')
    ).toBeInTheDocument();
  });

  it('should handle empty search results', async () => {
    mockGetTags.mockResolvedValue({
      data: [],
      paging: { total: 0 },
    });

    await act(async () => {
      render(<MUITagSuggestion onChange={mockOnChange} />);
    });

    const input = screen.getByRole('combobox');

    await act(async () => {
      fireEvent.change(input, { target: { value: 'nonexistent' } });
    });

    await waitFor(() => {
      expect(mockGetTags).toHaveBeenCalledWith('nonexistent', 1, true);
    });

    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  it('should handle API errors gracefully', async () => {
    mockGetTags.mockRejectedValue(new Error('API Error'));

    await act(async () => {
      render(<MUITagSuggestion onChange={mockOnChange} />);
    });

    const input = screen.getByRole('combobox');

    await act(async () => {
      fireEvent.change(input, { target: { value: 'test' } });
    });

    await waitFor(() => {
      expect(mockGetTags).toHaveBeenCalled();
    });

    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });
});
