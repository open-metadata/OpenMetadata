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
import { act, fireEvent, render, waitFor } from '@testing-library/react';
import { AxiosError } from 'axios';
import { lowerCase } from 'lodash';
import { EntityType } from '../../../enums/entity.enum';
import { Column } from '../../../generated/entity/data/table';
import { DataType } from '../../../generated/tests/testDefinition';
import { TagSource } from '../../../generated/type/tagLabel';
import { ColumnDetailPanel } from './ColumnDetailPanel.component';

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
  Drawer: jest
    .fn()
    .mockImplementation(({ children, open, title, footer, ...props }) => (
      <div data-testid="drawer" data-open={open} {...props}>
        {title && <div data-testid="drawer-title">{title}</div>}
        <div data-testid="drawer-content">{children}</div>
        {footer && <div data-testid="drawer-footer">{footer}</div>}
      </div>
    )),
  Button: jest
    .fn()
    .mockImplementation(({ children, onClick, disabled, ...props }) => (
      <button
        data-testid={props['data-testid'] || 'button'}
        onClick={onClick}
        disabled={disabled}
        {...props}>
        {children}
      </button>
    )),
  Card: jest.fn().mockImplementation(({ children, ...props }) => (
    <div data-testid="card" {...props}>
      {children}
    </div>
  )),
  Space: jest.fn().mockImplementation(({ children, ...props }) => (
    <div data-testid="space" {...props}>
      {children}
    </div>
  )),
  Tooltip: jest.fn().mockImplementation(({ children, ...props }) => (
    <div data-testid="tooltip" {...props}>
      {children}
    </div>
  )),
  Typography: {
    Text: jest.fn().mockImplementation(({ children, ...props }) => (
      <span data-testid="typography-text" {...props}>
        {children}
      </span>
    )),
  },
}));

// Mock @mui/material
jest.mock('@mui/material', () => ({
  Chip: jest.fn().mockImplementation(({ label, ...props }) => (
    <div data-testid="chip" {...props}>
      {label}
    </div>
  )),
}));

// Mock SVG components
jest.mock('../../../assets/svg/down-arrow-icon.svg', () => ({
  ReactComponent: () => <div data-testid="arrow-down-icon">ArrowDown</div>,
}));

jest.mock('../../../assets/svg/up-arrow-icon.svg', () => ({
  ReactComponent: () => <div data-testid="arrow-up-icon">ArrowUp</div>,
}));

jest.mock('../../../assets/svg/ic-column-new.svg', () => ({
  ReactComponent: () => <div data-testid="column-icon">ColumnIcon</div>,
}));

jest.mock('../../../assets/svg/icon-key.svg', () => ({
  ReactComponent: () => <div data-testid="key-icon">KeyIcon</div>,
}));

jest.mock('@ant-design/icons', () => ({
  CloseOutlined: () => <div data-testid="close-icon">CloseIcon</div>,
}));

// Mock child components
jest.mock('../../common/DescriptionSection/DescriptionSection', () => ({
  __esModule: true,
  default: jest
    .fn()
    .mockImplementation(({ onDescriptionUpdate, description }) => (
      <div data-testid="description-section">
        <span>Description: {description || 'No description'}</span>
        {onDescriptionUpdate && (
          <button
            data-testid="update-description"
            onClick={async () => {
              await onDescriptionUpdate('Updated description');
            }}>
            Update Description
          </button>
        )}
      </div>
    )),
}));

jest.mock('../../common/TagsSection/TagsSection', () => ({
  __esModule: true,
  default: jest.fn().mockImplementation(({ onTagsUpdate, tags }) => (
    <div data-testid="tags-section">
      <span>Tags: {tags?.length || 0}</span>
      {onTagsUpdate && (
        <button
          data-testid="update-tags"
          onClick={() =>
            onTagsUpdate([
              {
                tagFQN: 'tag1',
                source: TagSource.Classification,
              },
            ])
          }>
          Update Tags
        </button>
      )}
    </div>
  )),
}));

jest.mock('../../common/GlossaryTermsSection/GlossaryTermsSection', () => ({
  __esModule: true,
  default: jest.fn().mockImplementation(({ onGlossaryTermsUpdate, tags }) => (
    <div data-testid="glossary-terms-section">
      <span>Glossary Terms: {tags?.length || 0}</span>
      {onGlossaryTermsUpdate && (
        <button
          data-testid="update-glossary-terms"
          onClick={() =>
            onGlossaryTermsUpdate([
              {
                tagFQN: 'glossary1',
                source: TagSource.Glossary,
              },
            ])
          }>
          Update Glossary Terms
        </button>
      )}
    </div>
  )),
}));

jest.mock('../../common/DataQualitySection/DataQualitySection', () => ({
  __esModule: true,
  default: jest
    .fn()
    .mockImplementation(() => (
      <div data-testid="data-quality-section">Data Quality</div>
    )),
}));

jest.mock('../../common/Loader/Loader', () => ({
  __esModule: true,
  default: jest.fn().mockImplementation(({ size }) => (
    <div data-testid="loader" data-size={size}>
      Loading...
    </div>
  )),
}));

jest.mock('../../Entity/EntityRightPanel/EntityRightPanelVerticalNav', () => ({
  __esModule: true,
  default: jest
    .fn()
    .mockImplementation(() => (
      <div data-testid="vertical-nav">Vertical Nav</div>
    )),
}));

jest.mock(
  '../../Explore/EntitySummaryPanel/CustomPropertiesSection/CustomPropertiesSection',
  () => ({
    __esModule: true,
    default: jest
      .fn()
      .mockImplementation(() => (
        <div data-testid="custom-properties-section">Custom Properties</div>
      )),
  })
);

jest.mock(
  '../../Explore/EntitySummaryPanel/DataQualityTab/DataQualityTab',
  () => ({
    __esModule: true,
    default: jest
      .fn()
      .mockImplementation(() => (
        <div data-testid="data-quality-tab">Data Quality Tab</div>
      )),
  })
);

jest.mock('../../Explore/EntitySummaryPanel/LineageTab', () => ({
  LineageTabContent: jest
    .fn()
    .mockImplementation(() => <div data-testid="lineage-tab">Lineage Tab</div>),
}));

// Mock utility functions
jest.mock('../../../utils/ToastUtils', () => ({
  showErrorToast: jest.fn(),
  showSuccessToast: jest.fn(),
}));

jest.mock('../../../rest/tableAPI', () => ({
  updateTableColumn: jest.fn(),
}));

jest.mock('../../../rest/testAPI', () => ({
  listTestCases: jest.fn().mockResolvedValue({
    data: [],
  }),
}));

jest.mock('../../../utils/DataQuality/DataQualityUtils', () => ({
  calculateTestCaseStatusCounts: jest
    .fn()
    .mockImplementation(
      (testCases: Array<{ testCaseResult?: { testCaseStatus?: string } }>) => {
        return (testCases || []).reduce(
          (
            acc: {
              success: number;
              failed: number;
              aborted: number;
              total: number;
            },
            testCase: { testCaseResult?: { testCaseStatus?: string } }
          ) => {
            const status = lowerCase(testCase.testCaseResult?.testCaseStatus);
            if (status) {
              switch (status) {
                case 'success':
                  acc.success++;
                  break;
                case 'failed':
                  acc.failed++;
                  break;
                case 'aborted':
                  acc.aborted++;
                  break;
              }
              acc.total++;
            }
            return acc;
          },
          { success: 0, failed: 0, aborted: 0, total: 0 }
        );
      }
    ),
}));

jest.mock('../../../utils/EntityUtils', () => ({
  getEntityName: jest
    .fn()
    .mockImplementation((entity) => entity?.displayName || entity?.name || ''),
}));

jest.mock('../../../utils/StringsUtils', () => ({
  stringToHTML: jest.fn().mockImplementation((str) => str),
}));

jest.mock('../../../utils/TableUtils', () => ({
  flattenColumns: jest.fn().mockImplementation((columns) => columns || []),
  generateEntityLink: jest.fn().mockImplementation((fqn) => fqn),
  getDataTypeDisplay: jest.fn().mockReturnValue('VARCHAR'),
  mergeTagsWithGlossary: jest
    .fn()
    .mockImplementation(
      (
        columnTags: Array<{ source: TagSource }> | undefined,
        updatedTags: Array<{ source: TagSource }> | undefined
      ) => {
        const existingGlossaryTags =
          columnTags?.filter((tag) => tag.source === TagSource.Glossary) || [];
        const updatedTagsWithoutGlossary =
          updatedTags?.filter((tag) => tag.source !== TagSource.Glossary) || [];
        return [...updatedTagsWithoutGlossary, ...existingGlossaryTags];
      }
    ),
  mergeGlossaryWithTags: jest
    .fn()
    .mockImplementation(
      (
        columnTags: Array<{ source: TagSource }> | undefined,
        updatedGlossaryTerms: Array<{ source: TagSource }> | undefined
      ) => {
        const nonGlossaryTags =
          columnTags?.filter((tag) => tag.source !== TagSource.Glossary) || [];
        return [...nonGlossaryTags, ...(updatedGlossaryTerms || [])];
      }
    ),
  findOriginalColumnIndex: jest
    .fn()
    .mockImplementation((column: Column, allColumns: Column[]) => {
      return allColumns.findIndex(
        (col: Column) => col.fullyQualifiedName === column.fullyQualifiedName
      );
    }),
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

describe('ColumnDetailPanel', () => {
  const mockColumn: Column = {
    name: 'test_column',
    displayName: 'Test Column',
    fullyQualifiedName: 'test_db.test_schema.test_table.test_column',
    dataType: DataType.String,
    description: 'Test description',
    tags: [],
  };

  const mockProps = {
    column: mockColumn,
    tableFqn: 'test_db.test_schema.test_table',
    isOpen: true,
    onClose: jest.fn(),
    onColumnUpdate: jest.fn(),
    hasEditPermission: {
      description: true,
      tags: true,
      glossaryTerms: true,
      customProperties: true,
    },
    allColumns: [mockColumn],
    tableConstraints: [],
    entityType: EntityType.TABLE,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    // Ensure listTestCases resolves immediately to avoid initial loading state
    const { listTestCases } = require('../../../rest/testAPI');
    listTestCases.mockResolvedValue({
      data: [],
    });
  });

  describe('Individual Section Loaders', () => {
    it('should show loader only for description section when updating description', async () => {
      const updateColumnDescription = jest
        .fn()
        .mockImplementation(
          () =>
            new Promise((resolve) => setTimeout(() => resolve(mockColumn), 100))
        );

      const { getByTestId, queryByTestId } = render(
        <ColumnDetailPanel
          {...mockProps}
          updateColumnDescription={updateColumnDescription}
        />
      );

      // Wait for initial async operations to complete
      await waitFor(() => {
        expect(getByTestId('description-section')).toBeInTheDocument();
      });

      // Find and click the update description button
      const updateButton = getByTestId('update-description');

      await act(async () => {
        fireEvent.click(updateButton);
      });

      // Wait for loader to appear
      await waitFor(
        () => {
          const loader = getByTestId('loader');
          expect(loader).toBeInTheDocument();
          expect(loader).toHaveAttribute('data-size', 'small');
        },
        { timeout: 100 }
      );

      // Verify description section is replaced by loader
      expect(queryByTestId('description-section')).not.toBeInTheDocument();

      // Verify other sections are still visible
      expect(getByTestId('tags-section')).toBeInTheDocument();
      expect(getByTestId('glossary-terms-section')).toBeInTheDocument();

      // Wait for update to complete
      await waitFor(
        () => {
          expect(queryByTestId('loader')).not.toBeInTheDocument();
          expect(getByTestId('description-section')).toBeInTheDocument();
        },
        { timeout: 200 }
      );
    });

    it('should not show loader for tags section when updating tags', async () => {
      const updateColumnTags = jest.fn().mockResolvedValue(mockColumn);

      const { getByTestId } = render(
        <ColumnDetailPanel {...mockProps} updateColumnTags={updateColumnTags} />
      );

      // Find and click the update tags button
      const updateButton = getByTestId('update-tags');
      fireEvent.click(updateButton);

      // Tags section manages its own loading state internally
      // So we should not see a loader at the panel level
      await waitFor(() => {
        expect(updateColumnTags).toHaveBeenCalled();
      });

      // Description section should remain visible
      expect(getByTestId('description-section')).toBeInTheDocument();
    });

    it('should not show loader for glossary terms section when updating glossary terms', async () => {
      const updateColumnTags = jest.fn().mockResolvedValue(mockColumn);

      const { getByTestId } = render(
        <ColumnDetailPanel {...mockProps} updateColumnTags={updateColumnTags} />
      );

      // Find and click the update glossary terms button
      const updateButton = getByTestId('update-glossary-terms');
      fireEvent.click(updateButton);

      // Glossary terms section manages its own loading state internally
      // So we should not see a loader at the panel level
      await waitFor(() => {
        expect(updateColumnTags).toHaveBeenCalled();
      });

      // Description section should remain visible
      expect(getByTestId('description-section')).toBeInTheDocument();
    });

    it('should show loader for description section and hide it on error', async () => {
      const { showErrorToast } = require('../../../utils/ToastUtils');
      const updateColumnDescription = jest.fn().mockImplementation(
        () =>
          new Promise((_, reject) => {
            // Delay rejection to allow loader to show
            setTimeout(() => {
              reject(new Error('Update failed') as AxiosError);
            }, 100);
          })
      );

      const { getByTestId } = render(
        <ColumnDetailPanel
          {...mockProps}
          updateColumnDescription={updateColumnDescription}
        />
      );

      // Wait for initial async operations to complete
      await waitFor(() => {
        expect(getByTestId('description-section')).toBeInTheDocument();
      });

      // Find and click the update description button
      const updateButton = getByTestId('update-description');

      await act(async () => {
        fireEvent.click(updateButton);
      });

      // Wait for error to be handled and description section to be restored
      await waitFor(
        () => {
          expect(updateColumnDescription).toHaveBeenCalled();
          expect(showErrorToast).toHaveBeenCalled();
          expect(getByTestId('description-section')).toBeInTheDocument();
        },
        { timeout: 300 }
      );
    });

    it('should allow multiple sections to be updated independently', async () => {
      const updateColumnDescription = jest
        .fn()
        .mockImplementation(
          () =>
            new Promise((resolve) => setTimeout(() => resolve(mockColumn), 100))
        );
      const updateColumnTags = jest.fn().mockResolvedValue(mockColumn);

      const { getByTestId, queryByTestId } = render(
        <ColumnDetailPanel
          {...mockProps}
          updateColumnDescription={updateColumnDescription}
          updateColumnTags={updateColumnTags}
        />
      );

      // Wait for initial async operations to complete
      await waitFor(() => {
        expect(getByTestId('description-section')).toBeInTheDocument();
      });

      // Start updating description
      const updateDescriptionButton = getByTestId('update-description');

      await act(async () => {
        fireEvent.click(updateDescriptionButton);
      });

      // Wait for description loader
      await waitFor(
        () => {
          expect(getByTestId('loader')).toBeInTheDocument();
        },
        { timeout: 100 }
      );

      // Tags and glossary sections should still be visible
      expect(getByTestId('tags-section')).toBeInTheDocument();
      expect(getByTestId('glossary-terms-section')).toBeInTheDocument();

      // Update tags while description is loading
      const updateTagsButton = getByTestId('update-tags');

      await act(async () => {
        fireEvent.click(updateTagsButton);
      });

      // Tags section should still be visible (manages own loading)
      expect(getByTestId('tags-section')).toBeInTheDocument();

      // Wait for description update to complete
      await waitFor(
        () => {
          expect(queryByTestId('loader')).not.toBeInTheDocument();
        },
        { timeout: 200 }
      );

      // All sections should be visible
      expect(getByTestId('description-section')).toBeInTheDocument();
      expect(getByTestId('tags-section')).toBeInTheDocument();
      expect(getByTestId('glossary-terms-section')).toBeInTheDocument();
    });

    it('should not show loader when description section is not being updated', async () => {
      const { getByTestId } = render(<ColumnDetailPanel {...mockProps} />);

      // Wait for initial async operations (test cases fetching) to complete
      await waitFor(
        () => {
          expect(getByTestId('description-section')).toBeInTheDocument();
        },
        { timeout: 1000 }
      );

      // Description section should be visible (not replaced by description loader)
      // Note: There might be a loader for test cases, but the description section should be visible
      expect(getByTestId('description-section')).toBeInTheDocument();
      expect(getByTestId('tags-section')).toBeInTheDocument();
      expect(getByTestId('glossary-terms-section')).toBeInTheDocument();
    });
  });

  describe('Component Rendering', () => {
    it('should render drawer when isOpen is true', async () => {
      const { getByTestId } = render(<ColumnDetailPanel {...mockProps} />);

      expect(getByTestId('drawer')).toBeInTheDocument();
      expect(getByTestId('drawer')).toHaveAttribute('data-open', 'true');

      // Wait for initial async operations
      await waitFor(() => {
        expect(getByTestId('description-section')).toBeInTheDocument();
      });
    });

    it('should not render drawer when isOpen is false', () => {
      const { getByTestId } = render(
        <ColumnDetailPanel {...mockProps} isOpen={false} />
      );

      // When isOpen is false, drawer should still exist but be closed
      expect(getByTestId('drawer')).toHaveAttribute('data-open', 'false');
    });

    it('should render all sections in overview tab', async () => {
      const { getByTestId } = render(<ColumnDetailPanel {...mockProps} />);

      // Wait for initial async operations
      await waitFor(() => {
        expect(getByTestId('description-section')).toBeInTheDocument();
      });

      expect(getByTestId('description-section')).toBeInTheDocument();
      expect(getByTestId('tags-section')).toBeInTheDocument();
      expect(getByTestId('glossary-terms-section')).toBeInTheDocument();
    });
  });

  describe('Error Handling', () => {
    it('should handle description update error gracefully', async () => {
      const { showErrorToast } = require('../../../utils/ToastUtils');
      const updateColumnDescription = jest.fn().mockImplementation(
        () =>
          new Promise((_, reject) => {
            // Delay rejection to allow loader to show
            setTimeout(() => {
              reject(new Error('Network error') as AxiosError);
            }, 100);
          })
      );

      const { getByTestId } = render(
        <ColumnDetailPanel
          {...mockProps}
          updateColumnDescription={updateColumnDescription}
        />
      );

      // Wait for initial async operations to complete
      await waitFor(() => {
        expect(getByTestId('description-section')).toBeInTheDocument();
      });

      const updateButton = getByTestId('update-description');

      await act(async () => {
        fireEvent.click(updateButton);
      });

      // Wait for error to be handled and description section to be restored
      await waitFor(
        () => {
          expect(updateColumnDescription).toHaveBeenCalled();
          expect(showErrorToast).toHaveBeenCalled();
          expect(getByTestId('description-section')).toBeInTheDocument();
        },
        { timeout: 300 }
      );
    });
  });
});
