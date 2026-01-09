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
import { createTheme, Theme, ThemeProvider } from '@mui/material/styles';
import { ThemeColors } from '@openmetadata/ui-core-components';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { AxiosError } from 'axios';
import React from 'react';
import { EntityType } from '../../../enums/entity.enum';
import {
  LabelType,
  State,
  TagLabel,
  TagSource,
} from '../../../generated/type/tagLabel';
import TagsSection from './TagsSection';

const mockThemeColors: ThemeColors = {
  white: '#FFFFFF',
  blue: {
    50: '#E6F4FF',
    100: '#BAE0FF',
    200: '#91D5FF',
    300: '#69C0FF',
    600: '#1677FF',
    700: '#0958D9',
  },
  blueGray: {
    50: '#F8FAFC',
  },
  gray: {
    200: '#E5E7EB',
    300: '#D1D5DB',
    500: '#6B7280',
    700: '#374151',
    800: '#1F2937',
    900: '#111827',
  },
} as ThemeColors;

const theme: Theme = createTheme({
  palette: {
    allShades: mockThemeColors,
    primary: {
      main: '#1677FF',
      dark: '#0958D9',
    },
    background: {
      paper: '#FFFFFF',
    },
  },
});

const Wrapper = ({ children }: { children: React.ReactNode }) => (
  <ThemeProvider theme={theme}>{children}</ThemeProvider>
);

// Mock @react-awesome-query-builder/antd
jest.mock('@react-awesome-query-builder/antd', () => ({
  ...jest.requireActual('@react-awesome-query-builder/antd'),
  Config: {},
  Utils: {
    loadFromJsonLogic: jest.fn(),
    loadTree: jest.fn(),
  },
}));

// Mock react-router-dom
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useLocation: jest.fn().mockReturnValue({
    pathname: '/test',
    search: '',
    hash: '',
    state: null,
  }),
  useParams: jest.fn().mockReturnValue({}),
  useNavigate: jest.fn().mockReturnValue(jest.fn()),
}));

// Mock custom location hook
jest.mock('../../../hooks/useCustomLocation/useCustomLocation', () => ({
  __esModule: true,
  default: jest.fn().mockReturnValue({
    pathname: '/test',
    search: '',
    hash: '',
    state: null,
  }),
}));

// Mock react-i18next
jest.mock('react-i18next', () => ({
  useTranslation: jest.fn().mockReturnValue({
    t: (key: string, options?: Record<string, unknown>) => {
      if (options) {
        return `${key} - ${JSON.stringify(options)}`;
      }

      return key;
    },
  }),
}));

// Mock antd components
jest.mock('antd', () => ({
  ...jest.requireActual('antd'),
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
jest.mock('../../../assets/svg/edit-new.svg', () => ({
  ReactComponent: () => <div data-testid="edit-icon-svg">EditIcon</div>,
}));

jest.mock('../../../../assets/svg/close-icon.svg', () => ({
  ReactComponent: () => <div data-testid="close-icon-svg">CloseIcon</div>,
}));

jest.mock('../../../../assets/svg/tick.svg', () => ({
  ReactComponent: () => <div data-testid="tick-icon-svg">TickIcon</div>,
}));

jest.mock('../../../assets/svg/classification.svg', () => ({
  ReactComponent: ({ className }: { className?: string }) => (
    <div className={className} data-testid="classification-icon-svg">
      ClassificationIcon
    </div>
  ),
}));

// Mock TagSelectableList component
jest.mock('../TagSelectableList/TagSelectableList.component', () => ({
  TagSelectableList: jest
    .fn()
    .mockImplementation(
      ({
        onCancel,
        onUpdate,
        selectedTags,
        children,
      }: {
        onCancel?: () => void;
        onUpdate?: (tags: TagLabel[]) => void;
        selectedTags: TagLabel[];
        children: React.ReactNode;
      }) => {
        const [inputValue, setInputValue] = React.useState(
          selectedTags.map((t) => t.tagFQN).join(', ')
        );

        React.useEffect(() => {
          setInputValue(selectedTags.map((t) => t.tagFQN).join(', '));
        }, [selectedTags]);

        return (
          <div data-testid="tag-selectable-list">
            <div className="tag-selector" data-testid="async-select-list">
              <input
                data-testid="tag-selector-input"
                value={inputValue}
                onChange={(e) => {
                  setInputValue(e.target.value);
                  const tagFQNs = e.target.value
                    .split(',')
                    .map((t: string) => t.trim())
                    .filter(Boolean);
                  const newTags = tagFQNs.map((fqn: string) => ({
                    tagFQN: fqn,
                    name: fqn,
                    displayName: fqn,
                    source: TagSource.Classification,
                    labelType: 'Manual' as LabelType,
                    state: 'Confirmed' as State,
                  }));
                  onUpdate?.(newTags);
                }}
              />
            </div>
            <button data-testid="tag-cancel" onClick={() => onCancel?.()}>
              Cancel
            </button>
            <button
              data-testid="tag-update"
              onClick={() =>
                onUpdate?.([
                  {
                    tagFQN: 'newTag',
                    name: 'New Tag',
                    displayName: 'New Tag',
                    source: TagSource.Classification,
                    labelType: 'Manual' as LabelType,
                    state: 'Confirmed' as State,
                  },
                ])
              }>
              Update
            </button>
            {children}
          </div>
        );
      }
    ),
}));

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

// Mock EditIconButton
jest.mock('../IconButtons/EditIconButton', () => ({
  EditIconButton: jest.fn().mockImplementation(({ onClick, ...props }) => (
    <button
      className="edit-icon"
      data-testid="edit-icon-button"
      onClick={onClick}
      {...props}>
      Edit
    </button>
  )),
}));

// Mock Loader
jest.mock('../Loader/Loader', () => ({
  __esModule: true,
  default: jest.fn().mockImplementation(() => (
    <div className="tags-loading-container" data-testid="loader">
      Loading...
    </div>
  )),
}));

// Mock all patch API functions
jest.mock('../../../rest/tableAPI', () => ({
  patchTableDetails: jest.fn(),
}));
jest.mock('../../../utils/EntityUtils', () => ({
  getEntityName: jest
    .fn()
    .mockImplementation(
      (entity) => entity.displayName || entity.name || entity.tagFQN
    ),
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
    labelType: LabelType.Manual,
    state: State.Confirmed,
  },
  {
    tagFQN: 'tag2',
    displayName: 'Tag 2',
    name: 'Tag 2',
    source: TagSource.Classification,
    labelType: LabelType.Manual,
    state: State.Confirmed,
  },
  {
    tagFQN: 'tag3',
    displayName: 'Tag 3',
    name: 'Tag 3',
    source: TagSource.Classification,
    labelType: LabelType.Manual,
    state: State.Confirmed,
  },
  {
    tagFQN: 'tag4',
    displayName: 'Tag 4',
    name: 'Tag 4',
    source: TagSource.Classification,
    labelType: LabelType.Manual,
    state: State.Confirmed,
  },
  {
    tagFQN: 'tag5',
    displayName: 'Tag 5',
    name: 'Tag 5',
    source: TagSource.Classification,
    labelType: LabelType.Manual,
    state: State.Confirmed,
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

// Helper to click the edit control
const clickEditControl = () => {
  const el = screen.getByTestId('edit-icon-tags');
  fireEvent.click(el);
};

const enterEditMode = async () => {
  clickEditControl();
  await waitFor(() => {
    expect(screen.getByTestId('async-select-list')).toBeInTheDocument();
  });
};

// No explicit save button anymore; saving occurs on selection change
const clickSave = () => {
  // intentional no-op: kept for backward-compatible test calls
  return;
};

describe('TagsSection', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Component Rendering', () => {
    it('should render without crashing', () => {
      render(<TagsSection {...defaultProps} />, { wrapper: Wrapper });

      expect(screen.getByText('label.tag-plural')).toBeInTheDocument();
    });

    it('should render with correct structure', () => {
      render(<TagsSection {...defaultProps} />, { wrapper: Wrapper });

      expect(screen.getByText('label.tag-plural')).toBeInTheDocument();
      expect(screen.getByText('Tag 1')).toBeInTheDocument();
    });

    it('should render tags title', () => {
      render(<TagsSection {...defaultProps} />, { wrapper: Wrapper });

      expect(screen.getByText('label.tag-plural')).toBeInTheDocument();
    });
  });

  describe('Tags Display', () => {
    it('should render all tags when expanded', () => {
      render(<TagsSection {...defaultProps} />, { wrapper: Wrapper });

      // Click show more button to expand
      const showMoreButton = screen.getByText('+2 label.more-lowercase');
      fireEvent.click(showMoreButton);

      expect(screen.getByText('Tag 1')).toBeInTheDocument();
      expect(screen.getByText('Tag 2')).toBeInTheDocument();
      expect(screen.getByText('Tag 3')).toBeInTheDocument();
      expect(screen.getByText('Tag 4')).toBeInTheDocument();
      expect(screen.getByText('Tag 5')).toBeInTheDocument();
    });

    it('should render limited tags by default', () => {
      render(<TagsSection {...defaultProps} />, { wrapper: Wrapper });

      expect(screen.getByText('Tag 1')).toBeInTheDocument();
      expect(screen.getByText('Tag 2')).toBeInTheDocument();
      expect(screen.getByText('Tag 3')).toBeInTheDocument();
      expect(screen.queryByText('Tag 4')).not.toBeInTheDocument();
      expect(screen.queryByText('Tag 5')).not.toBeInTheDocument();
    });

    it('should show show more button when there are more tags', () => {
      render(<TagsSection {...defaultProps} />, { wrapper: Wrapper });

      expect(screen.getByText('+2 label.more-lowercase')).toBeInTheDocument();
    });

    it('should show show less button when expanded', () => {
      render(<TagsSection {...defaultProps} />, { wrapper: Wrapper });

      // Click show more button to expand
      const showMoreButton = screen.getByText('+2 label.more-lowercase');
      fireEvent.click(showMoreButton);

      expect(screen.getByText('label.less')).toBeInTheDocument();
    });

    it('should use custom maxDisplayCount', () => {
      render(<TagsSection {...defaultProps} maxVisibleTags={2} />, {
        wrapper: Wrapper,
      });

      expect(screen.getByText('Tag 1')).toBeInTheDocument();
      expect(screen.getByText('Tag 2')).toBeInTheDocument();
      expect(screen.queryByText('Tag 3')).not.toBeInTheDocument();
      expect(screen.getByText('+3 label.more-lowercase')).toBeInTheDocument();
    });

    it('should render tag items with correct structure', () => {
      render(<TagsSection {...defaultProps} />, { wrapper: Wrapper });

      expect(screen.getByTestId('tag-tag1')).toBeInTheDocument();
      expect(screen.getByTestId('tag-tag2')).toBeInTheDocument();
      expect(screen.getByTestId('tag-tag3')).toBeInTheDocument();
    });
  });

  describe('No Tags State', () => {
    it('should render no data found message when no tags', () => {
      render(<TagsSection {...defaultProps} tags={[]} />, { wrapper: Wrapper });

      expect(
        screen.getByText(
          'label.no-entity-assigned - {"entity":"label.tag-plural"}'
        )
      ).toBeInTheDocument();
    });

    it('should render with correct CSS classes when no tags', () => {
      render(<TagsSection {...defaultProps} tags={[]} />, { wrapper: Wrapper });

      expect(
        screen.getByText(
          'label.no-entity-assigned - {"entity":"label.tag-plural"}'
        )
      ).toBeInTheDocument();
    });
  });

  describe('Edit Button', () => {
    it('should show edit button when showEditButton is true and hasPermission is true', async () => {
      render(<TagsSection {...defaultProps} />, { wrapper: Wrapper });

      // If component is in edit mode, cancel first to get to normal state
      const closeIcon = screen.queryByTestId('close-icon');
      if (closeIcon) {
        fireEvent.click(closeIcon);
      }

      // Wait for the component to update after canceling edit mode
      await waitFor(() => {
        expect(screen.getByTestId('edit-icon-tags')).toBeInTheDocument();
      });
    });

    it('should not show edit button when showEditButton is false', () => {
      render(<TagsSection {...defaultProps} showEditButton={false} />, {
        wrapper: Wrapper,
      });

      expect(screen.queryByTestId('edit-icon-tags')).not.toBeInTheDocument();
    });

    it('should not show edit button when hasPermission is false', () => {
      render(<TagsSection {...defaultProps} hasPermission={false} />, {
        wrapper: Wrapper,
      });

      expect(screen.queryByTestId('edit-icon-tags')).not.toBeInTheDocument();
    });

    it('should not show edit button when no tags and no permission', () => {
      render(
        <TagsSection {...defaultProps} hasPermission={false} tags={[]} />,
        {
          wrapper: Wrapper,
        }
      );

      expect(screen.queryByTestId('edit-icon-tags')).not.toBeInTheDocument();
    });
  });

  describe('Edit Mode', () => {
    it('should enter edit mode when edit button is clicked', () => {
      render(<TagsSection {...defaultProps} />, { wrapper: Wrapper });

      clickEditControl();

      expect(screen.getByTestId('async-select-list')).toBeInTheDocument();
    });

    it('should show AsyncSelectList with correct props in edit mode', () => {
      render(<TagsSection {...defaultProps} />, { wrapper: Wrapper });

      clickEditControl();

      const asyncSelectList = screen.getByTestId('async-select-list');

      expect(asyncSelectList).toBeInTheDocument();
      expect(asyncSelectList).toHaveClass('tag-selector');
    });
  });

  describe('Tag Selection', () => {
    it('should handle tag selection in edit mode', async () => {
      render(<TagsSection {...defaultProps} />, { wrapper: Wrapper });

      await enterEditMode();

      const tagInput = screen.getByTestId('tag-selector-input');
      fireEvent.change(tagInput, { target: { value: 'new-tag1, new-tag2' } });

      expect(tagInput).toHaveValue('new-tag1, new-tag2');
    });

    it('should initialize with current tags in edit mode', async () => {
      render(<TagsSection {...defaultProps} />, { wrapper: Wrapper });

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

      render(
        <TagsSection {...defaultProps} onTagsUpdate={mockOnTagsUpdate} />,
        {
          wrapper: Wrapper,
        }
      );

      await enterEditMode();

      // Modify tags
      const tagInput = screen.getByTestId('tag-selector-input');
      fireEvent.change(tagInput, { target: { value: 'new-tag1, new-tag2' } });

      // Save happens on selection change automatically

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

      render(<TagsSection {...defaultProps} />, { wrapper: Wrapper });

      await enterEditMode();

      // Modify tags to ensure a non-empty JSON patch
      const tagInput = screen.getByTestId('tag-selector-input');
      fireEvent.change(tagInput, { target: { value: 'changed-tag' } });

      // Save happens on selection change automatically

      await waitFor(() => {
        expect(showErrorToast).toHaveBeenCalledWith(
          mockError,
          'server.entity-updating-error - {"entity":"label.tag-plural"}'
        );
      });
    });

    it('should not save when no changes are made', async () => {
      const { patchTableDetails } = jest.requireMock('../../../rest/tableAPI');

      render(<TagsSection {...defaultProps} />, { wrapper: Wrapper });

      await enterEditMode();

      // Save without changes: no selection change, so no API call

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

      render(<TagsSection {...defaultProps} />, { wrapper: Wrapper });

      await enterEditMode();

      // Modify tags
      const tagInput = screen.getByTestId('tag-selector-input');
      fireEvent.change(tagInput, { target: { value: 'new-tag' } });

      // Save happens on selection change automatically

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

      render(<TagsSection {...defaultProps} entityType={EntityType.TABLE} />, {
        wrapper: Wrapper,
      });

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
        <TagsSection {...defaultProps} entityType={EntityType.DASHBOARD} />,
        { wrapper: Wrapper }
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
        />,
        { wrapper: Wrapper }
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

      render(<TagsSection {...defaultProps} entityId={undefined} />, {
        wrapper: Wrapper,
      });

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
  });

  describe('Tag Display Name Handling', () => {
    it('should use displayName when available', () => {
      const tagsWithDisplayName = [
        {
          tagFQN: 'tag1',
          displayName: 'Custom Display Name',
          name: 'Tag 1',
          source: TagSource.Classification,
          labelType: LabelType.Manual,
          state: State.Confirmed,
        },
      ];

      render(<TagsSection {...defaultProps} tags={tagsWithDisplayName} />, {
        wrapper: Wrapper,
      });

      expect(screen.getByText('Custom Display Name')).toBeInTheDocument();
    });

    it('should fallback to name when displayName is not available', () => {
      const tagsWithoutDisplayName = [
        {
          tagFQN: 'tag1',
          name: 'Tag 1',
          source: TagSource.Classification,
          labelType: LabelType.Manual,
          state: State.Confirmed,
        },
      ];

      render(<TagsSection {...defaultProps} tags={tagsWithoutDisplayName} />, {
        wrapper: Wrapper,
      });

      expect(screen.getByText('Tag 1')).toBeInTheDocument();
    });

    it('should fallback to tagFQN when displayName and name are not available', () => {
      const tagsWithOnlyFQN = [
        {
          tagFQN: 'tag1',
          name: 'tag1',
          source: TagSource.Classification,
          labelType: LabelType.Manual,
          state: State.Confirmed,
        },
      ];

      render(<TagsSection {...defaultProps} tags={tagsWithOnlyFQN} />, {
        wrapper: Wrapper,
      });

      expect(screen.getByText('tag1')).toBeInTheDocument();
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty tags array', () => {
      render(<TagsSection {...defaultProps} tags={[]} />, { wrapper: Wrapper });

      expect(
        screen.getByText(
          'label.no-entity-assigned - {"entity":"label.tag-plural"}'
        )
      ).toBeInTheDocument();
    });

    it('should handle undefined tags', () => {
      render(<TagsSection {...defaultProps} tags={undefined} />, {
        wrapper: Wrapper,
      });

      expect(
        screen.getByText(
          'label.no-entity-assigned - {"entity":"label.tag-plural"}'
        )
      ).toBeInTheDocument();
    });

    it('should handle tags with missing properties', () => {
      const incompleteTags = [
        {
          tagFQN: 'tag1',
          name: 'tag1',
          source: TagSource.Classification,
          labelType: LabelType.Manual,
          state: State.Confirmed,
        },
        {
          tagFQN: 'tag2',
          name: 'tag2',
          source: TagSource.Classification,
          labelType: LabelType.Manual,
          state: State.Confirmed,
        },
        {
          tagFQN: 'tag3',
          displayName: 'tag3',
          source: TagSource.Classification,
          labelType: LabelType.Manual,
          state: State.Confirmed,
        },
      ];

      render(<TagsSection {...defaultProps} tags={incompleteTags} />, {
        wrapper: Wrapper,
      });

      expect(screen.getByText('tag1')).toBeInTheDocument();
      expect(screen.getByText('tag2')).toBeInTheDocument();
      expect(screen.getByText('tag3')).toBeInTheDocument();
    });

    it('should handle maxDisplayCount greater than tags length', () => {
      render(<TagsSection {...defaultProps} maxVisibleTags={10} />, {
        wrapper: Wrapper,
      });

      expect(screen.getByText('Tag 1')).toBeInTheDocument();
      expect(screen.getByText('Tag 2')).toBeInTheDocument();
      expect(screen.getByText('Tag 3')).toBeInTheDocument();
      expect(screen.getByText('Tag 4')).toBeInTheDocument();
      expect(screen.getByText('Tag 5')).toBeInTheDocument();
      expect(
        screen.queryByText('label.more-lowercase')
      ).not.toBeInTheDocument();
    });

    it('should handle maxDisplayCount of 0', () => {
      render(<TagsSection {...defaultProps} maxVisibleTags={0} />, {
        wrapper: Wrapper,
      });

      expect(screen.queryByText('Tag 1')).not.toBeInTheDocument();
      expect(screen.getByText('+5 label.more-lowercase')).toBeInTheDocument();
    });
  });

  describe('Loading State', () => {
    it('should show loading spinner during save', async () => {
      const { patchTableDetails } = jest.requireMock('../../../rest/tableAPI');

      // Mock a delayed response
      patchTableDetails.mockImplementation(
        () => new Promise((resolve) => setTimeout(resolve, 100))
      );

      render(<TagsSection {...defaultProps} />, { wrapper: Wrapper });

      await enterEditMode();

      // Modify tags
      const tagInput = screen.getByTestId('tag-selector-input');
      fireEvent.change(tagInput, { target: { value: 'new-tag' } });

      // Save happens on selection change automatically

      // Check loading state
      await waitFor(() => {
        expect(
          document.querySelector('.tags-loading-container')
        ).toBeInTheDocument();
      });
    });
  });
});
