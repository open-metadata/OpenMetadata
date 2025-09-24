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
import { AxiosError } from 'axios';
import { EntityType } from '../../../enums/entity.enum';
import { TagLabel, TagSource } from '../../../generated/type/tagLabel';
import TagsSection from './TagsSection';

// Mock react-i18next
jest.mock('react-i18next', () => ({
  useTranslation: jest.fn().mockReturnValue({
    t: (key: string, options?: any) => {
      if (options) {
        return `${key} - ${JSON.stringify(options)}`;
      }

      return key;
    },
  }),
}));

// Mock antd components
jest.mock('antd', () => ({
  Button: jest
    .fn()
    .mockImplementation(
      ({ children, onClick, className, size, type, ...props }) => (
        <button
          className={className}
          data-size={size}
          data-testid="button"
          data-type={type}
          onClick={onClick}
          {...props}>
          {children}
        </button>
      )
    ),
  Typography: {
    Text: jest.fn().mockImplementation(({ children, className, ...props }) => (
      <span className={className} data-testid="typography-text" {...props}>
        {children}
      </span>
    )),
  },
}));

// Mock SVG components
jest.mock('../../../../assets/svg/edit.svg', () => ({
  ReactComponent: () => <div data-testid="edit-icon-svg">EditIcon</div>,
}));

jest.mock('../../../../assets/svg/close-icon.svg', () => ({
  ReactComponent: () => <div data-testid="close-icon-svg">CloseIcon</div>,
}));

jest.mock('../../../../assets/svg/tick.svg', () => ({
  ReactComponent: () => <div data-testid="tick-icon-svg">TickIcon</div>,
}));

// Mock AsyncSelectList component
jest.mock('../AsyncSelectList/AsyncSelectList', () => {
  return jest
    .fn()
    .mockImplementation(({ onChange, value, placeholder, ...props }) => (
      <div data-testid="async-select-list" {...props}>
        <input
          data-testid="tag-selector-input"
          placeholder={placeholder}
          value={Array.isArray(value) ? value.join(', ') : value}
          onChange={(e) => {
            const values = e.target.value.split(', ').filter(Boolean);
            onChange?.(
              values.map((v) => ({
                value: v,
                label: v,
                data: { displayName: v },
              }))
            );
          }}
        />
      </div>
    ));
});

// Mock utility functions
jest.mock('../../../utils/TagClassBase', () => ({
  getTags: jest.fn().mockResolvedValue([
    { value: 'tag1', label: 'Tag 1', data: { displayName: 'Tag 1' } },
    { value: 'tag2', label: 'Tag 2', data: { displayName: 'Tag 2' } },
    { value: 'tag3', label: 'Tag 3', data: { displayName: 'Tag 3' } },
  ]),
}));

jest.mock('../../../utils/ToastUtils', () => ({
  showErrorToast: jest.fn(),
  showSuccessToast: jest.fn(),
}));

// Mock all patch API functions
jest.mock('../../../rest/tableAPI', () => ({
  patchTableDetails: jest.fn(),
}));

jest.mock('../../../rest/dashboardAPI', () => ({
  patchDashboardDetails: jest.fn(),
}));

jest.mock('../../../rest/topicsAPI', () => ({
  patchTopicDetails: jest.fn(),
}));

jest.mock('../../../rest/pipelineAPI', () => ({
  patchPipelineDetails: jest.fn(),
}));

jest.mock('../../../rest/mlModelAPI', () => ({
  patchMlModelDetails: jest.fn(),
}));

jest.mock('../../../rest/chartsAPI', () => ({
  patchChartDetails: jest.fn(),
}));

jest.mock('../../../rest/apiCollectionsAPI', () => ({
  patchApiCollection: jest.fn(),
}));

jest.mock('../../../rest/apiEndpointsAPI', () => ({
  patchApiEndPoint: jest.fn(),
}));

jest.mock('../../../rest/databaseAPI', () => ({
  patchDatabaseDetails: jest.fn(),
  patchDatabaseSchemaDetails: jest.fn(),
}));

jest.mock('../../../rest/storedProceduresAPI', () => ({
  patchStoredProceduresDetails: jest.fn(),
}));

jest.mock('../../../rest/storageAPI', () => ({
  patchContainerDetails: jest.fn(),
}));

jest.mock('../../../rest/dataModelsAPI', () => ({
  patchDataModelDetails: jest.fn(),
}));

jest.mock('../../../rest/SearchIndexAPI', () => ({
  patchSearchIndexDetails: jest.fn(),
}));

jest.mock('../../../rest/dataProductAPI', () => ({
  patchDataProduct: jest.fn(),
}));

// Mock data
const mockTags: TagLabel[] = [
  {
    tagFQN: 'tag1',
    displayName: 'Tag 1',
    name: 'Tag 1',
    source: TagSource.Classification,
    labelType: 'Manual' as any,
    state: 'Confirmed' as any,
  },
  {
    tagFQN: 'tag2',
    displayName: 'Tag 2',
    name: 'Tag 2',
    source: TagSource.Classification,
    labelType: 'Manual' as any,
    state: 'Confirmed' as any,
  },
  {
    tagFQN: 'tag3',
    displayName: 'Tag 3',
    name: 'Tag 3',
    source: TagSource.Classification,
    labelType: 'Manual' as any,
    state: 'Confirmed' as any,
  },
  {
    tagFQN: 'tag4',
    displayName: 'Tag 4',
    name: 'Tag 4',
    source: TagSource.Classification,
    labelType: 'Manual' as any,
    state: 'Confirmed' as any,
  },
  {
    tagFQN: 'tag5',
    displayName: 'Tag 5',
    name: 'Tag 5',
    source: TagSource.Classification,
    labelType: 'Manual' as any,
    state: 'Confirmed' as any,
  },
];

const defaultProps = {
  tags: mockTags,
  showEditButton: true,
  maxDisplayCount: 3,
  hasPermission: true,
  entityId: '123e4567-e89b-12d3-a456-426614174000',
  entityType: EntityType.TABLE,
  onTagsUpdate: jest.fn(),
};

// Helper to click the edit control regardless of icon mock
const clickEditControl = () => {
  const el =
    screen.queryByTestId('edit-icon') || screen.queryByTestId('tick-icon');
  fireEvent.click(el!);
};

const enterEditMode = async () => {
  clickEditControl();
  await waitFor(() => {
    expect(screen.getByTestId('async-select-list')).toBeInTheDocument();
  });
};

const clickSave = () => {
  const candidates = screen.getAllByTestId('tick-icon');
  const span =
    candidates.find((el) => el.tagName.toLowerCase() === 'span') ||
    candidates[0];
  fireEvent.click(span);
};

describe('TagsSection', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Component Rendering', () => {
    it('should render without crashing', () => {
      render(<TagsSection {...defaultProps} />);

      expect(screen.getByTestId('typography-text')).toBeInTheDocument();
      expect(screen.getByText('label.tag-plural')).toBeInTheDocument();
    });

    it('should render with correct CSS classes', () => {
      const { container } = render(<TagsSection {...defaultProps} />);

      expect(container.querySelector('.tags-section')).toBeInTheDocument();
      expect(container.querySelector('.tags-header')).toBeInTheDocument();
      expect(container.querySelector('.tags-content')).toBeInTheDocument();
    });

    it('should render tags title', () => {
      render(<TagsSection {...defaultProps} />);

      expect(screen.getByText('label.tag-plural')).toBeInTheDocument();
    });
  });

  describe('Tags Display', () => {
    it('should render all tags when expanded', () => {
      render(<TagsSection {...defaultProps} />);

      // Click show more button to expand
      const showMoreButton = screen.getByText(
        'label.plus-count-more - {"count":2}'
      );
      fireEvent.click(showMoreButton);

      expect(screen.getByText('Tag 1')).toBeInTheDocument();
      expect(screen.getByText('Tag 2')).toBeInTheDocument();
      expect(screen.getByText('Tag 3')).toBeInTheDocument();
      expect(screen.getByText('Tag 4')).toBeInTheDocument();
      expect(screen.getByText('Tag 5')).toBeInTheDocument();
    });

    it('should render limited tags by default', () => {
      render(<TagsSection {...defaultProps} />);

      expect(screen.getByText('Tag 1')).toBeInTheDocument();
      expect(screen.getByText('Tag 2')).toBeInTheDocument();
      expect(screen.getByText('Tag 3')).toBeInTheDocument();
      expect(screen.queryByText('Tag 4')).not.toBeInTheDocument();
      expect(screen.queryByText('Tag 5')).not.toBeInTheDocument();
    });

    it('should show show more button when there are more tags', () => {
      render(<TagsSection {...defaultProps} />);

      expect(
        screen.getByText('label.plus-count-more - {"count":2}')
      ).toBeInTheDocument();
    });

    it('should show show less button when expanded', () => {
      render(<TagsSection {...defaultProps} />);

      // Click show more button to expand
      const showMoreButton = screen.getByText(
        'label.plus-count-more - {"count":2}'
      );
      fireEvent.click(showMoreButton);

      expect(screen.getByText('label.show-less-lowercase')).toBeInTheDocument();
    });

    it('should use custom maxDisplayCount', () => {
      render(<TagsSection {...defaultProps} maxDisplayCount={2} />);

      expect(screen.getByText('Tag 1')).toBeInTheDocument();
      expect(screen.getByText('Tag 2')).toBeInTheDocument();
      expect(screen.queryByText('Tag 3')).not.toBeInTheDocument();
      expect(
        screen.getByText('label.plus-count-more - {"count":3}')
      ).toBeInTheDocument();
    });

    it('should render tag items with correct structure', () => {
      const { container } = render(<TagsSection {...defaultProps} />);

      const tagItems = container.querySelectorAll('.tag-item');

      expect(tagItems).toHaveLength(3); // maxDisplayCount

      tagItems.forEach((item) => {
        expect(item.querySelector('.tag-icon')).toBeInTheDocument();
        expect(item.querySelector('.tag-minus-icon')).toBeInTheDocument();
        expect(item.querySelector('.tag-name')).toBeInTheDocument();
      });
    });
  });

  describe('No Tags State', () => {
    it('should render no data found message when no tags', () => {
      render(<TagsSection {...defaultProps} tags={[]} />);

      expect(screen.getByText('label.no-data-found')).toBeInTheDocument();
    });

    it('should render with correct CSS classes when no tags', () => {
      const { container } = render(<TagsSection {...defaultProps} tags={[]} />);

      expect(container.querySelector('.tags-section')).toBeInTheDocument();
      expect(container.querySelector('.tags-header')).toBeInTheDocument();
      expect(container.querySelector('.tags-content')).toBeInTheDocument();
    });
  });

  describe('Edit Button', () => {
    it('should show edit button when showEditButton is true and hasPermission is true', async () => {
      render(<TagsSection {...defaultProps} />);

      // If component is in edit mode, cancel first to get to normal state
      const closeIcon = screen.queryByTestId('close-icon');
      if (closeIcon) {
        fireEvent.click(closeIcon);
      }

      // Wait for the component to update after canceling edit mode
      await waitFor(() => {
        expect(screen.getByTestId('edit-icon')).toBeInTheDocument();
      });
    });

    it('should not show edit button when showEditButton is false', () => {
      render(<TagsSection {...defaultProps} showEditButton={false} />);

      expect(screen.queryByTestId('edit-icon')).not.toBeInTheDocument();
    });

    it('should not show edit button when hasPermission is false', () => {
      render(<TagsSection {...defaultProps} hasPermission={false} />);

      expect(screen.queryByTestId('edit-icon')).not.toBeInTheDocument();
    });

    it('should not show edit button when no tags and no permission', () => {
      render(<TagsSection {...defaultProps} hasPermission={false} tags={[]} />);

      expect(screen.queryByTestId('edit-icon')).not.toBeInTheDocument();
    });
  });

  describe('Edit Mode', () => {
    it('should enter edit mode when edit button is clicked', () => {
      render(<TagsSection {...defaultProps} />);

      clickEditControl();

      expect(screen.getByTestId('async-select-list')).toBeInTheDocument();
      expect(screen.getByTestId('close-icon')).toBeInTheDocument();
      expect(screen.getByTestId('tick-icon')).toBeInTheDocument();
      expect(screen.queryByTestId('edit-icon')).not.toBeInTheDocument();
    });

    it('should show AsyncSelectList with correct props in edit mode', () => {
      render(<TagsSection {...defaultProps} />);

      clickEditControl();

      const asyncSelectList = screen.getByTestId('async-select-list');

      expect(asyncSelectList).toBeInTheDocument();
      expect(asyncSelectList).toHaveClass('tag-selector');
    });

    it('should show save and cancel buttons in edit mode', () => {
      render(<TagsSection {...defaultProps} />);

      clickEditControl();

      expect(screen.getByTestId('close-icon')).toBeInTheDocument();
      expect(screen.getByTestId('tick-icon')).toBeInTheDocument();
    });

    it('should exit edit mode when cancel button is clicked', () => {
      render(<TagsSection {...defaultProps} />);

      // Enter edit mode
      clickEditControl();

      // Exit edit mode
      const cancelButton = screen.getByTestId('close-icon');
      fireEvent.click(cancelButton);

      expect(screen.getByTestId('edit-icon')).toBeInTheDocument();
      expect(screen.queryByTestId('async-select-list')).not.toBeInTheDocument();
    });
  });

  describe('Tag Selection', () => {
    it('should handle tag selection in edit mode', async () => {
      render(<TagsSection {...defaultProps} />);

      await enterEditMode();

      const tagInput = screen.getByTestId('tag-selector-input');
      fireEvent.change(tagInput, { target: { value: 'new-tag1, new-tag2' } });

      expect(tagInput).toHaveValue('new-tag1, new-tag2');
    });

    it('should initialize with current tags in edit mode', async () => {
      render(<TagsSection {...defaultProps} />);

      await enterEditMode();

      const tagInput = screen.getByTestId('tag-selector-input');

      expect(tagInput).toHaveValue('tag1, tag2, tag3, tag4, tag5');
    });
  });

  describe('Save Functionality', () => {
    it('should save tags successfully', async () => {
      const { patchTableDetails } = jest.requireMock('../../../rest/tableAPI');
      const { showSuccessToast } = jest.requireMock(
        '../../../utils/ToastUtils'
      );
      const mockOnTagsUpdate = jest.fn();

      patchTableDetails.mockResolvedValue({});

      render(<TagsSection {...defaultProps} onTagsUpdate={mockOnTagsUpdate} />);

      await enterEditMode();

      // Modify tags
      const tagInput = screen.getByTestId('tag-selector-input');
      fireEvent.change(tagInput, { target: { value: 'new-tag1, new-tag2' } });

      // Save
      clickSave();

      await waitFor(() => {
        expect(patchTableDetails).toHaveBeenCalled();
        expect(showSuccessToast).toHaveBeenCalled();
        expect(mockOnTagsUpdate).toHaveBeenCalled();
      });
    });

    it('should handle save error', async () => {
      const { patchTableDetails } = jest.requireMock('../../../rest/tableAPI');
      const { showErrorToast } = jest.requireMock('../../../utils/ToastUtils');

      const mockError = new Error('Save failed') as AxiosError;
      patchTableDetails.mockRejectedValue(mockError);

      render(<TagsSection {...defaultProps} />);

      await enterEditMode();

      // Modify tags to ensure a non-empty JSON patch
      const tagInput = screen.getByTestId('tag-selector-input');
      fireEvent.change(tagInput, { target: { value: 'changed-tag' } });

      // Save
      clickSave();

      await waitFor(() => {
        expect(showErrorToast).toHaveBeenCalledWith(
          mockError,
          'server.entity-updating-error - {"entity":"label.tag-lowercase-plural"}'
        );
      });
    });

    it('should not save when no changes are made', async () => {
      const { patchTableDetails } = jest.requireMock('../../../rest/tableAPI');

      render(<TagsSection {...defaultProps} />);

      await enterEditMode();

      // Save without changes
      clickSave();

      await waitFor(() => {
        expect(patchTableDetails).not.toHaveBeenCalled();
      });
    });

    it('should show loading state during save', async () => {
      const { patchTableDetails } = jest.requireMock('../../../rest/tableAPI');

      // Mock a delayed response
      patchTableDetails.mockImplementation(
        () => new Promise((resolve) => setTimeout(resolve, 100))
      );

      render(<TagsSection {...defaultProps} />);

      await enterEditMode();

      // Modify tags
      const tagInput = screen.getByTestId('tag-selector-input');
      fireEvent.change(tagInput, { target: { value: 'new-tag' } });

      // Save
      clickSave();

      // Check loading state
      await waitFor(() => {
        expect(
          document.querySelector('.tags-loading-container')
        ).toBeInTheDocument();
      });
    });
  });

  describe('Entity Type Handling', () => {
    it('should use correct patch API for TABLE entity', async () => {
      const { patchTableDetails } = jest.requireMock('../../../rest/tableAPI');

      patchTableDetails.mockResolvedValue({});

      render(<TagsSection {...defaultProps} entityType={EntityType.TABLE} />);

      await enterEditMode();

      const tagInput = screen.getByTestId('tag-selector-input');
      fireEvent.change(tagInput, { target: { value: 'new-tag' } });

      clickSave();

      await waitFor(() => {
        expect(patchTableDetails).toHaveBeenCalledWith(
          expect.any(String),
          expect.any(Array)
        );
      });
    });

    it('should use correct patch API for DASHBOARD entity', async () => {
      const { patchDashboardDetails } = jest.requireMock(
        '../../../rest/dashboardAPI'
      );

      patchDashboardDetails.mockResolvedValue({});

      render(
        <TagsSection {...defaultProps} entityType={EntityType.DASHBOARD} />
      );

      await enterEditMode();

      const tagInput = screen.getByTestId('tag-selector-input');
      fireEvent.change(tagInput, { target: { value: 'new-tag' } });

      clickSave();

      await waitFor(() => {
        expect(patchDashboardDetails).toHaveBeenCalledWith(
          expect.any(String),
          expect.any(Array)
        );
      });
    });

    it('should throw error for unsupported entity type', async () => {
      const { showErrorToast } = jest.requireMock('../../../utils/ToastUtils');

      render(
        <TagsSection
          {...defaultProps}
          entityType={'UNSUPPORTED' as EntityType}
        />
      );

      await enterEditMode();

      const tagInput = screen.getByTestId('tag-selector-input');
      fireEvent.change(tagInput, { target: { value: 'new-tag' } });

      clickSave();

      await waitFor(() => {
        expect(showErrorToast).toHaveBeenCalled();
      });
    });
  });

  describe('Entity ID Validation', () => {
    it('should show error when entityId is missing', async () => {
      const { showErrorToast } = jest.requireMock('../../../utils/ToastUtils');

      render(<TagsSection {...defaultProps} entityId={undefined} />);

      await enterEditMode();

      const tagInput = screen.getByTestId('tag-selector-input');
      fireEvent.change(tagInput, { target: { value: 'new-tag' } });

      clickSave();

      await waitFor(() => {
        expect(showErrorToast).toHaveBeenCalledWith(
          'message.entity-id-required'
        );
      });
    });

    it('should show error when entityId is not a valid UUID', async () => {
      const { showErrorToast } = jest.requireMock('../../../utils/ToastUtils');

      render(<TagsSection {...defaultProps} entityId="invalid-id" />);

      await enterEditMode();

      const tagInput = screen.getByTestId('tag-selector-input');
      fireEvent.change(tagInput, { target: { value: 'new-tag' } });

      clickSave();

      await waitFor(() => {
        expect(showErrorToast).toHaveBeenCalledWith(
          'message.invalid-entity-id'
        );
      });
    });
  });

  describe('Tag Display Name Handling', () => {
    it('should use displayName when available', () => {
      const tagsWithDisplayName = [
        {
          tagFQN: 'tag1',
          displayName: 'Custom Display Name',
          name: 'Tag 1',
          source: TagSource.Classification,
          labelType: 'Manual' as any,
          state: 'Confirmed' as any,
        },
      ];

      render(<TagsSection {...defaultProps} tags={tagsWithDisplayName} />);

      expect(screen.getByText('Custom Display Name')).toBeInTheDocument();
    });

    it('should fallback to name when displayName is not available', () => {
      const tagsWithoutDisplayName = [
        {
          tagFQN: 'tag1',
          name: 'Tag 1',
          source: TagSource.Classification,
          labelType: 'Manual' as any,
          state: 'Confirmed' as any,
        },
      ];

      render(<TagsSection {...defaultProps} tags={tagsWithoutDisplayName} />);

      expect(screen.getByText('Tag 1')).toBeInTheDocument();
    });

    it('should fallback to tagFQN when displayName and name are not available', () => {
      const tagsWithOnlyFQN = [
        {
          tagFQN: 'tag1',
          source: TagSource.Classification,
          labelType: 'Manual' as any,
          state: 'Confirmed' as any,
        },
      ];

      render(<TagsSection {...defaultProps} tags={tagsWithOnlyFQN} />);

      expect(screen.getByText('tag1')).toBeInTheDocument();
    });

    it('should show unknown when no name is available', () => {
      const tagsWithoutName = [
        {
          tagFQN: '',
          source: TagSource.Classification,
          labelType: 'Manual' as any,
          state: 'Confirmed' as any,
        },
      ];

      render(<TagsSection {...defaultProps} tags={tagsWithoutName} />);

      expect(screen.getByText('label.unknown')).toBeInTheDocument();
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty tags array', () => {
      render(<TagsSection {...defaultProps} tags={[]} />);

      expect(screen.getByText('label.no-data-found')).toBeInTheDocument();
    });

    it('should handle undefined tags', () => {
      render(<TagsSection {...defaultProps} tags={undefined} />);

      expect(screen.getByText('label.no-data-found')).toBeInTheDocument();
    });

    it('should handle tags with missing properties', () => {
      const incompleteTags = [
        {
          tagFQN: 'tag1',
          source: TagSource.Classification,
          labelType: 'Manual' as any,
          state: 'Confirmed' as any,
        },
        {
          tagFQN: 'tag2',
          name: 'tag2',
          source: TagSource.Classification,
          labelType: 'Manual' as any,
          state: 'Confirmed' as any,
        },
        {
          tagFQN: 'tag3',
          displayName: 'tag3',
          source: TagSource.Classification,
          labelType: 'Manual' as any,
          state: 'Confirmed' as any,
        },
      ];

      render(<TagsSection {...defaultProps} tags={incompleteTags} />);

      expect(screen.getByText('tag1')).toBeInTheDocument();
      expect(screen.getByText('tag2')).toBeInTheDocument();
      expect(screen.getByText('tag3')).toBeInTheDocument();
    });

    it('should handle maxDisplayCount greater than tags length', () => {
      render(<TagsSection {...defaultProps} maxDisplayCount={10} />);

      expect(screen.getByText('Tag 1')).toBeInTheDocument();
      expect(screen.getByText('Tag 2')).toBeInTheDocument();
      expect(screen.getByText('Tag 3')).toBeInTheDocument();
      expect(screen.getByText('Tag 4')).toBeInTheDocument();
      expect(screen.getByText('Tag 5')).toBeInTheDocument();
      expect(
        screen.queryByText('label.plus-count-more')
      ).not.toBeInTheDocument();
    });

    it('should handle maxDisplayCount of 0', () => {
      render(<TagsSection {...defaultProps} maxDisplayCount={0} />);

      expect(screen.queryByText('Tag 1')).not.toBeInTheDocument();
      expect(
        screen.getByText('label.plus-count-more - {"count":5}')
      ).toBeInTheDocument();
    });
  });

  describe('Loading State', () => {
    it('should show loading spinner during save', async () => {
      const { patchTableDetails } = jest.requireMock('../../../rest/tableAPI');

      // Mock a delayed response
      patchTableDetails.mockImplementation(
        () => new Promise((resolve) => setTimeout(resolve, 100))
      );

      render(<TagsSection {...defaultProps} />);

      await enterEditMode();

      // Modify tags
      const tagInput = screen.getByTestId('tag-selector-input');
      fireEvent.change(tagInput, { target: { value: 'new-tag' } });

      // Save
      clickSave();

      // Check loading state
      await waitFor(() => {
        expect(
          document.querySelector('.tags-loading-container')
        ).toBeInTheDocument();
      });
    });
  });
});
