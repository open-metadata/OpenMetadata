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
import { ReactNode } from 'react';
import {
  LabelType,
  State,
  TagLabel,
  TagSource,
} from '../../../generated/type/tagLabel';
import { SelectableListProps } from '../SelectableList/SelectableList.interface';
import { GlossaryTermSelectableList } from './GlossaryTermSelectableList.component';

jest.mock('react-i18next', () => ({
  useTranslation: jest.fn().mockReturnValue({
    t: (key: string) => key,
  }),
}));

jest.mock('../../../assets/svg/glossary.svg', () => ({
  ReactComponent: () => <div data-testid="glossary-icon">G</div>,
}));

const mockSelectableList = jest
  .fn()
  .mockImplementation(
    ({ onUpdate, onCancel, selectedItems }: SelectableListProps) => (
      <div data-testid="selectable-list">
        <div data-testid="selected-count">{selectedItems?.length || 0}</div>
        <button
          data-testid="update-button"
          onClick={() =>
            onUpdate?.([
              {
                id: 'term1',
                name: 'Term1',
                displayName: 'Glossary Term 1',
                fullyQualifiedName: 'Glossary.Term1',
                type: 'glossaryTerm',
              },
            ])
          }>
          Update
        </button>
        <button data-testid="cancel-button" onClick={() => onCancel?.()}>
          Cancel
        </button>
      </div>
    )
  );

const mockFetchGlossaryList = jest.fn();

jest.mock('../SelectableList/SelectableList.component', () => ({
  SelectableList: (props: SelectableListProps) => mockSelectableList(props),
}));

jest.mock('../../../utils/TagsUtils', () => ({
  fetchGlossaryList: (searchQueryParam: string, page: number) =>
    mockFetchGlossaryList(searchQueryParam, page),
}));

jest.mock('../FocusTrap/FocusTrapWithContainer', () => ({
  FocusTrapWithContainer: ({ children }: { children: ReactNode }) => (
    <div>{children}</div>
  ),
}));

const mockGlossaryTerms: TagLabel[] = [
  {
    tagFQN: 'Glossary.Term1',
    name: 'Term1',
    displayName: 'Glossary Term 1',
    source: TagSource.Glossary,
    labelType: LabelType.Manual,
    state: State.Confirmed,
  },
];

const mockOnUpdate = jest.fn();

const defaultProps = {
  selectedTerms: mockGlossaryTerms,
  onUpdate: mockOnUpdate,
  children: <button data-testid="trigger-button">Open</button>,
  popoverProps: {},
  onCancel: jest.fn(),
};

describe('GlossaryTermSelectableListV1', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFetchGlossaryList.mockResolvedValue({
      data: [
        {
          label: 'Glossary.Term2',
          value: 'Glossary.Term2',
          data: {
            name: 'Term2',
            displayName: 'Glossary Term 2',
            description: 'Test glossary term',
          },
        },
      ],
      paging: { total: 1 },
    });
  });

  it('should render the trigger children', () => {
    render(<GlossaryTermSelectableList {...defaultProps} />);

    expect(screen.getByTestId('trigger-button')).toBeInTheDocument();
    expect(screen.getByText('Open')).toBeInTheDocument();
  });

  it('should open popover when trigger is clicked', async () => {
    render(<GlossaryTermSelectableList {...defaultProps} />);

    const trigger = screen.getByTestId('trigger-button');
    fireEvent.click(trigger);

    await waitFor(() => {
      expect(screen.getByTestId('selectable-list')).toBeInTheDocument();
    });
  });

  it('should pass selected terms count to SelectableList', async () => {
    render(<GlossaryTermSelectableList {...defaultProps} />);

    fireEvent.click(screen.getByTestId('trigger-button'));

    await waitFor(() => {
      expect(screen.getByTestId('selected-count')).toHaveTextContent('1');
    });
  });

  it('should call onUpdate with converted glossary terms when update is clicked', async () => {
    render(<GlossaryTermSelectableList {...defaultProps} />);

    fireEvent.click(screen.getByTestId('trigger-button'));

    await waitFor(() => {
      expect(screen.getByTestId('update-button')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('update-button'));

    await waitFor(() => {
      expect(mockOnUpdate).toHaveBeenCalledWith([
        expect.objectContaining({
          tagFQN: 'Glossary.Term1',
          name: 'Term1',
          displayName: 'Glossary Term 1',
          source: TagSource.Glossary,
          labelType: LabelType.Manual,
          state: State.Confirmed,
        }),
      ]);
    });
  });

  it('should close popover after successful update', async () => {
    render(<GlossaryTermSelectableList {...defaultProps} />);

    fireEvent.click(screen.getByTestId('trigger-button'));

    await waitFor(() => {
      expect(screen.getByTestId('update-button')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('update-button'));

    await waitFor(() => {
      expect(screen.queryByTestId('selectable-list')).not.toBeInTheDocument();
    });
  });

  it('should call onCancel when cancel is clicked', async () => {
    render(<GlossaryTermSelectableList {...defaultProps} />);

    fireEvent.click(screen.getByTestId('trigger-button'));

    await waitFor(() => {
      expect(screen.getByTestId('cancel-button')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('cancel-button'));

    await waitFor(() => {
      expect(defaultProps.onCancel).toHaveBeenCalled();
    });
  });

  it('should fetch glossary terms with pagination', async () => {
    mockFetchGlossaryList.mockResolvedValue({
      data: [
        { label: 'Term1', value: 'Term1', data: { name: 'Term1' } },
        { label: 'Term2', value: 'Term2', data: { name: 'Term2' } },
      ],
      paging: { total: 20, after: 'cursor' },
    });

    render(<GlossaryTermSelectableList {...defaultProps} />);

    fireEvent.click(screen.getByTestId('trigger-button'));

    await waitFor(() => {
      expect(mockSelectableList).toHaveBeenCalled();
    });

    const fetchOptions = mockSelectableList.mock.calls[0][0].fetchOptions;
    const result = await fetchOptions('test', '1');

    expect(mockFetchGlossaryList).toHaveBeenCalledWith('test', 1);
    expect(result.data).toHaveLength(2);
    expect(result.paging.total).toBe(20);
  });

  it('should handle empty glossary terms list', () => {
    render(<GlossaryTermSelectableList {...defaultProps} selectedTerms={[]} />);

    expect(screen.getByTestId('trigger-button')).toBeInTheDocument();
  });

  it('should handle fetch errors gracefully', async () => {
    mockFetchGlossaryList.mockRejectedValue(new Error('Network error'));

    render(<GlossaryTermSelectableList {...defaultProps} />);

    fireEvent.click(screen.getByTestId('trigger-button'));

    await waitFor(() => {
      expect(mockSelectableList).toHaveBeenCalled();
    });

    const fetchOptions = mockSelectableList.mock.calls[0][0].fetchOptions;
    const result = await fetchOptions('test', '1');

    expect(result.data).toEqual([]);
    expect(result.paging.total).toBe(0);
  });

  it('should use popoverProps when provided', () => {
    const customPopoverProps = {
      placement: 'bottomRight' as const,
      open: true,
      onOpenChange: jest.fn(),
    };

    render(
      <GlossaryTermSelectableList
        {...defaultProps}
        popoverProps={customPopoverProps}
      />
    );

    expect(screen.getByTestId('selectable-list')).toBeInTheDocument();
  });
});
