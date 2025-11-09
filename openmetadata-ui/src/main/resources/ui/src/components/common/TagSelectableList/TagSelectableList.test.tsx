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
import { EntityReference } from '../../../generated/entity/type';
import {
  LabelType,
  State,
  TagLabel,
  TagSource,
} from '../../../generated/type/tagLabel';
import { SelectableListProps } from '../SelectableList/SelectableList.interface';
import { TagSelectableList } from './TagSelectableList.component';

jest.mock('react-i18next', () => ({
  useTranslation: jest.fn().mockReturnValue({
    t: (key: string) => key,
  }),
}));

jest.mock('../../../assets/svg/classification.svg', () => ({
  ReactComponent: () => <div data-testid="classification-icon">C</div>,
}));

const mockSelectableList = jest
  .fn()
  .mockImplementation(
    ({
      onUpdate,
      onCancel,
      selectedItems,
    }: {
      onUpdate?: (tags: EntityReference[]) => void;
      onCancel?: () => void;
      selectedItems?: EntityReference[];
    }) => (
      <div data-testid="selectable-list">
        <div data-testid="selected-count">{selectedItems?.length || 0}</div>
        <button
          data-testid="update-button"
          onClick={() =>
            onUpdate?.([
              {
                id: 'tag1',
                name: 'Tag1',
                displayName: 'Tag 1',
                fullyQualifiedName: 'PII.Tag1',
                type: 'tag',
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

const mockGetTags = jest.fn();

jest.mock('../SelectableList/SelectableList.component', () => ({
  SelectableList: (props: SelectableListProps) => mockSelectableList(props),
}));

jest.mock('../../../utils/TagClassBase', () => ({
  __esModule: true,
  default: {
    getTags: (...args: Parameters<typeof mockGetTags>) => mockGetTags(...args),
  },
}));

jest.mock('../FocusTrap/FocusTrapWithContainer', () => ({
  FocusTrapWithContainer: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
}));

const mockTags: TagLabel[] = [
  {
    tagFQN: 'PII.Sensitive',
    name: 'Sensitive',
    displayName: 'Sensitive Data',
    source: TagSource.Classification,
    labelType: LabelType.Manual,
    state: State.Confirmed,
  },
];

const mockOnUpdate = jest.fn();
const mockOnCancel = jest.fn();

const defaultProps = {
  selectedTags: mockTags,
  onUpdate: mockOnUpdate,
  onCancel: mockOnCancel,
  hasPermission: true,
  children: <button data-testid="trigger-button">Open</button>,
  popoverProps: {},
};

describe('TagSelectableList', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetTags.mockResolvedValue({
      data: [
        {
          label: 'PII.Tag1',
          value: 'PII.Tag1',
          data: {
            name: 'Tag1',
            displayName: 'Tag 1',
            description: 'Test tag',
          },
        },
      ],
      paging: { total: 1 },
    });
  });

  it('should render the trigger children', () => {
    render(<TagSelectableList {...defaultProps} />);

    expect(screen.getByTestId('trigger-button')).toBeInTheDocument();
    expect(screen.getByText('Open')).toBeInTheDocument();
  });

  it('should open popover when trigger is clicked', async () => {
    render(<TagSelectableList {...defaultProps} />);

    const trigger = screen.getByTestId('trigger-button');
    fireEvent.click(trigger);

    await waitFor(() => {
      expect(screen.getByTestId('selectable-list')).toBeInTheDocument();
    });
  });

  it('should pass selected tags count to SelectableList', async () => {
    render(<TagSelectableList {...defaultProps} />);

    fireEvent.click(screen.getByTestId('trigger-button'));

    await waitFor(() => {
      expect(screen.getByTestId('selected-count')).toHaveTextContent('1');
    });
  });

  it('should call onUpdate with converted tags when update is clicked', async () => {
    render(<TagSelectableList {...defaultProps} />);

    fireEvent.click(screen.getByTestId('trigger-button'));

    await waitFor(() => {
      expect(screen.getByTestId('update-button')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('update-button'));

    await waitFor(() => {
      expect(mockOnUpdate).toHaveBeenCalledWith([
        expect.objectContaining({
          tagFQN: 'PII.Tag1',
          name: 'Tag1',
          displayName: 'Tag 1',
          source: TagSource.Classification,
          labelType: LabelType.Manual,
          state: State.Confirmed,
        }),
      ]);
    });
  });

  it('should close popover after successful update', async () => {
    render(<TagSelectableList {...defaultProps} />);

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
    render(<TagSelectableList {...defaultProps} />);

    fireEvent.click(screen.getByTestId('trigger-button'));

    await waitFor(() => {
      expect(screen.getByTestId('cancel-button')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('cancel-button'));

    await waitFor(() => {
      expect(mockOnCancel).toHaveBeenCalled();
    });
  });

  it('should fetch tags with pagination', async () => {
    mockGetTags.mockResolvedValue({
      data: [
        { label: 'Tag1', value: 'Tag1', data: { name: 'Tag1' } },
        { label: 'Tag2', value: 'Tag2', data: { name: 'Tag2' } },
      ],
      paging: { total: 20 },
    });

    render(<TagSelectableList {...defaultProps} />);

    fireEvent.click(screen.getByTestId('trigger-button'));

    await waitFor(() => {
      expect(mockSelectableList).toHaveBeenCalled();
    });

    const fetchOptions = mockSelectableList.mock.calls[0][0].fetchOptions;
    const result = await fetchOptions('test', '1');

    expect(mockGetTags).toHaveBeenCalledWith('test', 1);
    expect(result.data).toHaveLength(2);
    expect(result.paging.total).toBe(20);
  });

  it('should handle empty tags list', () => {
    render(<TagSelectableList {...defaultProps} selectedTags={[]} />);

    expect(screen.getByTestId('trigger-button')).toBeInTheDocument();
  });

  it('should use popoverProps when provided', () => {
    const customPopoverProps = {
      placement: 'bottomRight' as const,
      open: true,
      onOpenChange: jest.fn(),
    };

    render(
      <TagSelectableList {...defaultProps} popoverProps={customPopoverProps} />
    );

    expect(screen.getByTestId('selectable-list')).toBeInTheDocument();
  });
});
