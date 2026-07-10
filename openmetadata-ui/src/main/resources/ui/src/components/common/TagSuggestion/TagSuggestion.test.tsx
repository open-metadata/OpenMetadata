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
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { TagSource } from '../../../generated/entity/data/container';
import TagSuggestion from './TagSuggestion';
import {
  MOCK_GLOSSARY_OPTIONS,
  MOCK_TAG_OPTIONS,
} from './TagSuggestion.mock';

const mockGetTags = jest.fn();
const mockFetchGlossaryList = jest.fn();

jest.mock('../../../utils/TagClassBase', () => ({
  __esModule: true,
  default: {
    getTags: (...args: unknown[]) => mockGetTags(...args),
  },
}));

jest.mock('../../../utils/TagsUtils', () => ({
  __esModule: true,
  fetchGlossaryList: (...args: unknown[]) => mockFetchGlossaryList(...args),
}));

jest.mock('lodash', () => {
  const original = jest.requireActual('lodash');

  return {
    ...original,
    debounce: (fn: (...args: unknown[]) => unknown) => {
      const debounced = (...args: unknown[]) => fn(...args);

      debounced.cancel = () => {};

      return debounced;
    },
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

type MockItem = { id: string; label: string; supportingText?: string };

jest.mock('@openmetadata/ui-core-components', () => {
  const { useState } = jest.requireActual('react');

  const Autocomplete = ({
    items = [],
    selectedItems,
    onItemInserted,
    onItemCleared,
    onSearchChange,
    label,
    placeholder,
  }: {
    items?: MockItem[];
    label?: string;
    onItemCleared?: (key: string) => void;
    onItemInserted?: (key: string) => void;
    onSearchChange?: (value: string) => void;
    placeholder?: string;
    selectedItems: MockItem[];
  }) => {
    const listboxId = 'mock-autocomplete-listbox';
    const [open, setOpen] = useState(false);
    const [inputValue, setInputValue] = useState('');

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      setInputValue(e.target.value);
      onSearchChange?.(e.target.value);
    };

    const handleOptionClick = (id: string) => {
      onItemInserted?.(id);
      setOpen(false);
      setInputValue('');
    };

    return (
      <div>
        {label && <label>{label}</label>}
        <input
          aria-controls={listboxId}
          aria-expanded={open}
          placeholder={placeholder}
          role="combobox"
          value={inputValue}
          onChange={handleInputChange}
          onFocus={() => setOpen(true)}
          onMouseDown={() => setOpen(true)}
        />
        {selectedItems.map((item) => (
          <span data-testid="tag-chip" key={item.id}>
            {item.label}
            <button
              data-testid="tag-chip-delete"
              onClick={() => onItemCleared?.(item.id)}>
              x
            </button>
          </span>
        ))}
        {open && items.length > 0 && (
          <select multiple id={listboxId} size={items.length}>
            {items.map((item) => (
              <option
                data-testid={`tag-option-${item.id}`}
                key={item.id}
                value={item.id}
                onClick={() => handleOptionClick(item.id)}>
                {[item.label, item.supportingText].filter(Boolean).join(' | ')}
              </option>
            ))}
          </select>
        )}
      </div>
    );
  };

  Autocomplete.Item = ({
    id,
    label,
    supportingText,
  }: {
    id: string;
    label: string;
    supportingText?: string;
  }) => ({ id, label, supportingText });

  return { Autocomplete };
});

describe('TagSuggestion', () => {
  const mockOnChange = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    mockGetTags.mockResolvedValue({
      data: MOCK_TAG_OPTIONS,
      paging: { total: 3 },
    });
    mockFetchGlossaryList.mockResolvedValue({
      data: MOCK_GLOSSARY_OPTIONS,
      paging: { total: 2 },
    });
  });

  it('should render the component', async () => {
    render(<TagSuggestion onChange={mockOnChange} />);

    await waitFor(() => {
      expect(screen.getByTestId('tag-suggestion')).toBeInTheDocument();
    });
  });

  it('should render with custom label', async () => {
    render(<TagSuggestion label="Tags" onChange={mockOnChange} />);

    await waitFor(() => {
      expect(screen.getByText('Tags')).toBeInTheDocument();
    });
  });

  it('should fetch and display options when input is focused', async () => {
    render(<TagSuggestion onChange={mockOnChange} />);

    const input = screen.getByRole('combobox');

    fireEvent.mouseDown(input);

    await waitFor(() => {
      expect(screen.getByRole('listbox')).toBeInTheDocument();
    });

    expect(screen.getByText('Personal | Personal Data')).toBeInTheDocument();
    expect(
      screen.getByText('PII | Personally Identifiable Information')
    ).toBeInTheDocument();
    expect(screen.getByText('Sensitive | Sensitive Data')).toBeInTheDocument();
  });

  it('should call getTags with search text when input changes', async () => {
    mockGetTags.mockResolvedValue({
      data: [MOCK_TAG_OPTIONS[0], MOCK_TAG_OPTIONS[1]],
      paging: { total: 2 },
    });

    render(<TagSuggestion onChange={mockOnChange} />);

    const input = screen.getByRole('combobox');

    fireEvent.change(input, { target: { value: 'Personal' } });

    await waitFor(() => {
      expect(mockGetTags).toHaveBeenCalledWith('Personal', 1, true);
    });
  });

  it('should display options returned from server search', async () => {
    mockGetTags.mockResolvedValue({
      data: [MOCK_TAG_OPTIONS[2]],
      paging: { total: 1 },
    });

    render(<TagSuggestion onChange={mockOnChange} />);

    const input = screen.getByRole('combobox');

    fireEvent.change(input, { target: { value: 'Sensitive' } });

    await waitFor(() => {
      expect(mockGetTags).toHaveBeenCalledWith('Sensitive', 1, true);
    });

    fireEvent.mouseDown(input);

    await waitFor(() => {
      expect(screen.getByRole('listbox')).toBeInTheDocument();
    });

    expect(screen.getByText('Sensitive | Sensitive Data')).toBeInTheDocument();
  });

  it('should call onChange when a tag is selected', async () => {
    render(<TagSuggestion onChange={mockOnChange} />);

    const input = screen.getByRole('combobox');

    fireEvent.mouseDown(input);

    await waitFor(() => {
      expect(
        screen.getByTestId('tag-option-PersonalData.Personal')
      ).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('tag-option-PersonalData.Personal'));

    expect(mockOnChange).toHaveBeenCalled();

    const callArg = mockOnChange.mock.calls[0][0];

    expect(callArg).toHaveLength(1);
    expect(callArg[0].tagFQN).toBe('PersonalData.Personal');
  });

  it('should render supportingText (displayName) for options', async () => {
    render(<TagSuggestion onChange={mockOnChange} />);

    const input = screen.getByRole('combobox');

    fireEvent.mouseDown(input);

    await waitFor(() => {
      expect(screen.getByRole('listbox')).toBeInTheDocument();
    });

    expect(screen.getByText('Personal | Personal Data')).toBeInTheDocument();
    expect(
      screen.getByText('PII | Personally Identifiable Information')
    ).toBeInTheDocument();
  });

  it('should handle empty search results', async () => {
    mockGetTags.mockResolvedValue({
      data: [],
      paging: { total: 0 },
    });

    render(<TagSuggestion onChange={mockOnChange} />);

    const input = screen.getByRole('combobox');

    fireEvent.change(input, { target: { value: 'nonexistent' } });

    await waitFor(() => {
      expect(mockGetTags).toHaveBeenCalledWith('nonexistent', 1, true);
    });

    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  it('should handle API errors gracefully', async () => {
    mockGetTags.mockRejectedValue(new Error('API Error'));

    render(<TagSuggestion onChange={mockOnChange} />);

    const input = screen.getByRole('combobox');

    fireEvent.change(input, { target: { value: 'test' } });

    await waitFor(() => {
      expect(mockGetTags).toHaveBeenCalled();
    });

    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  it('should stamp source Classification on an inserted tag by default', async () => {
    render(<TagSuggestion onChange={mockOnChange} />);

    const input = screen.getByRole('combobox');

    fireEvent.mouseDown(input);

    await waitFor(() => {
      expect(
        screen.getByTestId('tag-option-PersonalData.Personal')
      ).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('tag-option-PersonalData.Personal'));

    expect(mockOnChange.mock.calls[0][0][0].source).toBe(
      TagSource.Classification
    );
  });

  describe('when tagType is Glossary', () => {
    it('should query fetchGlossaryList and never getTags', async () => {
      render(
        <TagSuggestion onChange={mockOnChange} tagType={TagSource.Glossary} />
      );

      const input = screen.getByRole('combobox');

      fireEvent.change(input, { target: { value: 'Revenue' } });

      await waitFor(() => {
        expect(mockFetchGlossaryList).toHaveBeenCalledWith('Revenue', 1);
      });

      expect(mockGetTags).not.toHaveBeenCalled();
    });

    it('should display glossary terms returned from the search', async () => {
      render(
        <TagSuggestion onChange={mockOnChange} tagType={TagSource.Glossary} />
      );

      const input = screen.getByRole('combobox');

      fireEvent.mouseDown(input);

      await waitFor(() => {
        expect(screen.getByRole('listbox')).toBeInTheDocument();
      });

      expect(
        screen.getByTestId('tag-option-Business.Revenue')
      ).toBeInTheDocument();
      expect(
        screen.getByTestId('tag-option-Business.Customer')
      ).toBeInTheDocument();
    });

    it('should stamp source Glossary on an inserted glossary term', async () => {
      render(
        <TagSuggestion onChange={mockOnChange} tagType={TagSource.Glossary} />
      );

      const input = screen.getByRole('combobox');

      fireEvent.mouseDown(input);

      await waitFor(() => {
        expect(
          screen.getByTestId('tag-option-Business.Revenue')
        ).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId('tag-option-Business.Revenue'));

      expect(mockOnChange).toHaveBeenCalled();

      const insertedTag = mockOnChange.mock.calls[0][0][0];

      expect(insertedTag.tagFQN).toBe('Business.Revenue');
      expect(insertedTag.source).toBe(TagSource.Glossary);
      expect(insertedTag.name).toBe('Revenue');
    });
  });
});
