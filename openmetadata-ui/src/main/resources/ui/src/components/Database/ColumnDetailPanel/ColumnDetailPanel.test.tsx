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
import { Column, State, Table } from '../../../generated/entity/data/table';
import { LabelType } from '../../../generated/tests/testCase';
import { DataType } from '../../../generated/tests/testDefinition';
import { TagSource } from '../../../generated/type/tagLabel';
import { getColumnByFQN } from '../../../rest/tableAPI';
import { listTestCases } from '../../../rest/testAPI';
import { ColumnDetailPanel } from './ColumnDetailPanel.component';

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

jest.mock('antd', () => ({
  ...jest.requireActual('antd'),
  Drawer: jest
    .fn()
    .mockImplementation(({ children, open, title, footer, ...props }) => (
      <div data-open={open} data-testid="drawer" {...props}>
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
        disabled={disabled}
        onClick={onClick}
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

jest.mock('@openmetadata/ui-core-components', () => ({
  Button: jest.fn().mockImplementation(
    ({
      children,
      onClick,
      'data-testid': testId,
      isDisabled,
    }: React.PropsWithChildren<{
      onClick?: React.MouseEventHandler;
      'data-testid'?: string;
      isDisabled?: boolean;
      [key: string]: unknown;
    }>) => (
      <button data-testid={testId} disabled={isDisabled} onClick={onClick}>
        {children}
      </button>
    )
  ),
}));

jest.mock('@ant-design/icons', () => ({
  CloseOutlined: () => <div data-testid="close-icon">CloseIcon</div>,
}));

jest.mock('../../../assets/svg/down-arrow-icon.svg', () => ({
  ReactComponent: () => <div data-testid="arrow-down-icon">ArrowDown</div>,
}));

jest.mock('../../../assets/svg/up-arrow-icon.svg', () => ({
  ReactComponent: () => <div data-testid="arrow-up-icon">ArrowUp</div>,
}));

jest.mock('../../../assets/svg/ic-column.svg', () => ({
  ReactComponent: () => <div data-testid="column-icon">ColumnIcon</div>,
}));

jest.mock('../../../assets/svg/icon-key.svg', () => ({
  ReactComponent: () => <div data-testid="key-icon">KeyIcon</div>,
}));

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
          onClick={async () => {
            try {
              await onTagsUpdate([
                {
                  tagFQN: 'tag1',
                  source: TagSource.Classification,
                },
              ]);
            } catch {
              // Error is handled by the component
            }
          }}>
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
          onClick={async () => {
            try {
              await onGlossaryTermsUpdate([
                {
                  tagFQN: 'glossary1',
                  source: TagSource.Glossary,
                },
              ]);
            } catch {
              // Error is handled by the component
            }
          }}>
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
    <div data-size={size} data-testid="loader">
      Loading...
    </div>
  )),
}));

jest.mock('../../AlertBar/AlertBar', () => ({
  __esModule: true,
  default: jest.fn().mockImplementation(({ message, type }) => (
    <div data-testid="alert-bar" data-type={type}>
      {message}
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

jest.mock('./KeyProfileMetrics', () => ({
  KeyProfileMetrics: jest
    .fn()
    .mockImplementation(() => (
      <div data-testid="key-profile-metrics">Key Profile Metrics</div>
    )),
}));

jest.mock('../../../utils/ToastUtils', () => ({
  showErrorToast: jest.fn(),
  showSuccessToast: jest.fn(),
}));

jest.mock('../../../rest/tableAPI', () => ({
  updateTableColumn: jest.fn(),
  getColumnByFQN: jest.fn().mockResolvedValue({
    name: 'test_column',
    dataType: 'VARCHAR',
    fullyQualifiedName: 'test_db.test_schema.test_table.test_column',
    tags: [],
  }),
}));

jest.mock('../../../rest/testAPI', () => ({
  listTestCases: jest.fn().mockResolvedValue({
    data: [],
  }),
}));

jest.mock('../../../rest/metadataTypeAPI', () => ({
  getTypeByFQN: jest.fn().mockResolvedValue({
    id: 'test-type-id',
    name: 'column',
    fullyQualifiedName: 'column',
  }),
}));

jest.mock('../../Customization/GenericProvider/GenericProvider', () => ({
  useGenericContext: jest.fn().mockReturnValue({
    permissions: {
      EditTags: true,
      EditGlossaryTerms: true,
      EditDescription: true,
      EditAll: false,
      ViewAll: true,
      ViewCustomFields: true,
    },
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

jest.mock('../../../utils/EntitySummaryPanelUtils', () => ({
  toEntityData: jest.fn().mockImplementation((column) => {
    if (!column) {
      return undefined;
    }

    const extension =
      'extension' in column &&
      typeof column.extension === 'object' &&
      column.extension !== null
        ? (column.extension as Table['extension'])
        : undefined;

    const entityData: {
      extension?: Table['extension'];
      [key: string]: unknown;
    } = {};
    if (extension) {
      entityData.extension = extension;
    }

    return entityData;
  }),
}));

jest.mock('../../../utils/StringUtils', () => ({
  stringToHTML: jest.fn().mockImplementation((str) => str),
  getErrorText: jest
    .fn()
    .mockImplementation(
      (error: Error, defaultMessage: string) =>
        error?.message || defaultMessage || 'Error'
    ),
  getEncodedFqn: jest.fn().mockImplementation((fqn: string) => fqn),
  getDecodedFqn: jest.fn().mockImplementation((fqn: string) => fqn),
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
  buildColumnBreadcrumbPath: jest
    .fn()
    .mockImplementation((column: Column | null) => {
      if (!column?.fullyQualifiedName) {
        return [];
      }

      return [column];
    }),
  normalizeTags: jest
    .fn()
    .mockImplementation((tags: Array<{ source: TagSource }> | undefined) => {
      if (!tags || tags.length === 0) {
        return [];
      }

      // Remove style property from glossary terms
      return tags.map((tag) => {
        if (tag.source === TagSource.Glossary) {
          const { style: _style, ...tagWithoutStyle } = tag as {
            source: TagSource;
            style?: unknown;
          };

          return tagWithoutStyle;
        }

        return tag;
      });
    }),
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
    allColumns: [mockColumn],
    tableConstraints: [],
    entityType: EntityType.TABLE,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (listTestCases as jest.Mock).mockResolvedValue({
      data: [],
    });
  });

  describe('Component Rendering', () => {
    it('should render drawer when isOpen is true', async () => {
      const { getByTestId } = render(<ColumnDetailPanel {...mockProps} />);

      expect(getByTestId('drawer')).toBeInTheDocument();
      expect(getByTestId('drawer')).toHaveAttribute('data-open', 'true');

      await waitFor(() => {
        expect(getByTestId('description-section')).toBeInTheDocument();
      });
    });

    it('should not render drawer when isOpen is false', () => {
      const { getByTestId } = render(
        <ColumnDetailPanel {...mockProps} isOpen={false} />
      );

      expect(getByTestId('drawer')).toHaveAttribute('data-open', 'false');
    });

    it('should render all sections in overview tab', async () => {
      const { getByTestId } = render(<ColumnDetailPanel {...mockProps} />);

      await waitFor(() => {
        expect(getByTestId('description-section')).toBeInTheDocument();
      });

      expect(getByTestId('description-section')).toBeInTheDocument();
      expect(getByTestId('tags-section')).toBeInTheDocument();
      expect(getByTestId('glossary-terms-section')).toBeInTheDocument();
    });
  });

  describe('Data Fetching', () => {
    it('should call getColumnByFQN with column FQN when panel opens', async () => {
      const mockGetColumnByFQN = getColumnByFQN as jest.Mock;
      mockGetColumnByFQN.mockResolvedValueOnce({
        ...mockColumn,
        tags: [],
      });

      await act(async () => {
        render(
          <ColumnDetailPanel
            {...mockProps}
            isOpen
            entityType={EntityType.TABLE}
          />
        );
      });

      await waitFor(() => {
        expect(mockGetColumnByFQN).toHaveBeenCalledWith(
          mockColumn.fullyQualifiedName,
          expect.objectContaining({
            fields: 'tags,customMetrics,extension,profile',
          })
        );
      });
    });

    it('should pass entityType=table in request params', async () => {
      const mockGetColumnByFQN = getColumnByFQN as jest.Mock;
      mockGetColumnByFQN.mockResolvedValueOnce({ ...mockColumn, tags: [] });

      await act(async () => {
        render(<ColumnDetailPanel {...mockProps} />);
      });

      await waitFor(() => {
        expect(mockGetColumnByFQN).toHaveBeenCalledWith(
          mockColumn.fullyQualifiedName,
          {
            entityType: EntityType.TABLE,
            fields: 'tags,customMetrics,extension,profile',
          }
        );
      });
    });

    it('should not call getColumnByFQN for DASHBOARD_DATA_MODEL entityType', async () => {
      const mockGetColumnByFQN = getColumnByFQN as jest.Mock;

      await act(async () => {
        render(
          <ColumnDetailPanel
            {...mockProps}
            entityType={EntityType.DASHBOARD_DATA_MODEL}
          />
        );
      });

      await waitFor(() => {
        expect(mockGetColumnByFQN).not.toHaveBeenCalled();
      });
    });

    it('should not call getColumnByFQN when isOpen is false', async () => {
      const mockGetColumnByFQN = getColumnByFQN as jest.Mock;

      await act(async () => {
        render(<ColumnDetailPanel {...mockProps} isOpen={false} />);
      });

      expect(mockGetColumnByFQN).not.toHaveBeenCalled();
    });

    it('should not call getColumnByFQN when tableFqn is missing', async () => {
      const mockGetColumnByFQN = getColumnByFQN as jest.Mock;

      await act(async () => {
        render(<ColumnDetailPanel {...mockProps} tableFqn={undefined} />);
      });

      expect(mockGetColumnByFQN).not.toHaveBeenCalled();
    });

    it('should not call getColumnByFQN when column FQN is missing', async () => {
      const mockGetColumnByFQN = getColumnByFQN as jest.Mock;

      await act(async () => {
        render(
          <ColumnDetailPanel
            {...mockProps}
            column={{ ...mockColumn, fullyQualifiedName: undefined }}
          />
        );
      });

      expect(mockGetColumnByFQN).not.toHaveBeenCalled();
    });

    it('should merge fetched fields into activeColumn', async () => {
      const mockGetColumnByFQN = getColumnByFQN as jest.Mock;
      mockGetColumnByFQN.mockResolvedValueOnce({
        ...mockColumn,
        tags: [{ tagFQN: 'PII.Sensitive', source: TagSource.Classification }],
      });

      const { getByTestId } = render(<ColumnDetailPanel {...mockProps} />);

      await waitFor(() => {
        expect(mockGetColumnByFQN).toHaveBeenCalled();
      });

      await waitFor(() => {
        expect(getByTestId('tags-section')).toHaveTextContent('Tags: 1');
      });
    });

    it('should not refetch when the same FQN re-renders', async () => {
      const mockGetColumnByFQN = getColumnByFQN as jest.Mock;
      mockGetColumnByFQN.mockResolvedValue({ ...mockColumn, tags: [] });

      const { rerender } = render(<ColumnDetailPanel {...mockProps} />);

      await waitFor(() => {
        expect(mockGetColumnByFQN).toHaveBeenCalledTimes(1);
      });

      rerender(<ColumnDetailPanel {...mockProps} />);

      await act(async () => {
        await Promise.resolve();
      });

      expect(mockGetColumnByFQN).toHaveBeenCalledTimes(1);
    });

    it('should refetch when column FQN changes', async () => {
      const mockGetColumnByFQN = getColumnByFQN as jest.Mock;
      mockGetColumnByFQN.mockResolvedValue({ ...mockColumn, tags: [] });

      const { rerender } = render(<ColumnDetailPanel {...mockProps} />);

      await waitFor(() => {
        expect(mockGetColumnByFQN).toHaveBeenCalledTimes(1);
      });

      const nextColumn: Column = {
        ...mockColumn,
        name: 'next_column',
        fullyQualifiedName: 'test_db.test_schema.test_table.next_column',
      };

      rerender(<ColumnDetailPanel {...mockProps} column={nextColumn} />);

      await waitFor(() => {
        expect(mockGetColumnByFQN).toHaveBeenCalledTimes(2);
      });

      expect(mockGetColumnByFQN).toHaveBeenLastCalledWith(
        nextColumn.fullyQualifiedName,
        expect.objectContaining({
          fields: 'tags,customMetrics,extension,profile',
        })
      );
    });

    it('should refetch after close-then-reopen', async () => {
      const mockGetColumnByFQN = getColumnByFQN as jest.Mock;
      mockGetColumnByFQN.mockResolvedValue({ ...mockColumn, tags: [] });

      const { rerender } = render(<ColumnDetailPanel {...mockProps} />);

      await waitFor(() => {
        expect(mockGetColumnByFQN).toHaveBeenCalledTimes(1);
      });

      rerender(<ColumnDetailPanel {...mockProps} isOpen={false} />);

      await act(async () => {
        await Promise.resolve();
      });

      rerender(<ColumnDetailPanel {...mockProps} isOpen />);

      await waitFor(() => {
        expect(mockGetColumnByFQN).toHaveBeenCalledTimes(2);
      });
    });

    it('should show loader while fetch is in flight and hide sections', async () => {
      const mockGetColumnByFQN = getColumnByFQN as jest.Mock;
      let resolveFetch: (value: Column) => void = () => undefined;
      mockGetColumnByFQN.mockImplementationOnce(
        () =>
          new Promise<Column>((resolve) => {
            resolveFetch = resolve;
          })
      );

      const { getByTestId, queryByTestId } = render(
        <ColumnDetailPanel {...mockProps} />
      );

      await waitFor(() => {
        expect(getByTestId('loader')).toBeInTheDocument();
      });

      expect(queryByTestId('description-section')).not.toBeInTheDocument();

      await act(async () => {
        resolveFetch({ ...mockColumn, tags: [] });
      });

      await waitFor(() => {
        expect(queryByTestId('loader')).not.toBeInTheDocument();
      });

      expect(getByTestId('description-section')).toBeInTheDocument();
    });

    it('should show error toast and clear loading when fetch fails', async () => {
      const { showErrorToast } = jest.requireMock('../../../utils/ToastUtils');
      const mockGetColumnByFQN = getColumnByFQN as jest.Mock;
      const fetchError = new Error('Network error') as AxiosError;
      mockGetColumnByFQN.mockRejectedValueOnce(fetchError);

      const { getByTestId, queryByTestId } = render(
        <ColumnDetailPanel {...mockProps} />
      );

      await waitFor(() => {
        expect(showErrorToast).toHaveBeenCalledWith(fetchError);
      });

      await waitFor(() => {
        expect(queryByTestId('loader')).not.toBeInTheDocument();
      });

      expect(getByTestId('description-section')).toBeInTheDocument();
    });

    it('should ignore stale response when active column FQN changed mid-flight', async () => {
      const mockGetColumnByFQN = getColumnByFQN as jest.Mock;
      let resolveStale: (value: Column) => void = () => undefined;
      mockGetColumnByFQN.mockImplementationOnce(
        () =>
          new Promise<Column>((resolve) => {
            resolveStale = resolve;
          })
      );

      const nextColumn: Column = {
        ...mockColumn,
        name: 'next_column',
        fullyQualifiedName: 'test_db.test_schema.test_table.next_column',
      };
      mockGetColumnByFQN.mockResolvedValueOnce({ ...nextColumn, tags: [] });

      const { getByTestId, rerender } = render(
        <ColumnDetailPanel {...mockProps} />
      );

      await waitFor(() => {
        expect(mockGetColumnByFQN).toHaveBeenCalledTimes(1);
      });

      rerender(<ColumnDetailPanel {...mockProps} column={nextColumn} />);

      await waitFor(() => {
        expect(mockGetColumnByFQN).toHaveBeenCalledTimes(2);
      });

      await act(async () => {
        resolveStale({
          ...mockColumn,
          tags: [
            {
              tagFQN: 'Stale.Tag',
              source: TagSource.Classification,
              labelType: LabelType.Manual,
              state: State.Confirmed,
            },
          ],
        });
      });

      await waitFor(() => {
        expect(getByTestId('tags-section')).toHaveTextContent('Tags: 0');
      });
    });
  });

  describe('Individual Section Loaders', () => {
    it('should show loader only for description section when updating description', async () => {
      const onColumnFieldUpdate = jest
        .fn()
        .mockImplementation(
          (_fqn: string, _update: { description: string }) =>
            new Promise((resolve) => setTimeout(() => resolve(mockColumn), 100))
        );

      const { getByTestId, queryByTestId } = render(
        <ColumnDetailPanel
          {...mockProps}
          onColumnFieldUpdate={onColumnFieldUpdate}
        />
      );

      await waitFor(() => {
        expect(getByTestId('description-section')).toBeInTheDocument();
      });

      const updateButton = getByTestId('update-description');

      await act(async () => {
        fireEvent.click(updateButton);
      });

      await waitFor(
        () => {
          const loader = getByTestId('loader');

          expect(loader).toBeInTheDocument();
          expect(loader).toHaveAttribute('data-size', 'small');
        },
        { timeout: 100 }
      );

      expect(queryByTestId('description-section')).not.toBeInTheDocument();
      expect(getByTestId('tags-section')).toBeInTheDocument();
      expect(getByTestId('glossary-terms-section')).toBeInTheDocument();

      await waitFor(
        () => {
          expect(queryByTestId('loader')).not.toBeInTheDocument();
          expect(getByTestId('description-section')).toBeInTheDocument();
        },
        { timeout: 200 }
      );
    });

    it('should not show loader for tags section when updating tags', async () => {
      const onColumnFieldUpdate = jest.fn().mockResolvedValue(mockColumn);

      const { getByTestId } = render(
        <ColumnDetailPanel
          {...mockProps}
          onColumnFieldUpdate={onColumnFieldUpdate}
        />
      );

      await waitFor(() => {
        expect(getByTestId('tags-section')).toBeInTheDocument();
      });

      const updateButton = getByTestId('update-tags');
      fireEvent.click(updateButton);

      await waitFor(() => {
        expect(onColumnFieldUpdate).toHaveBeenCalled();
      });

      expect(getByTestId('description-section')).toBeInTheDocument();
    });

    it('should not show loader for glossary terms section when updating glossary terms', async () => {
      const onColumnFieldUpdate = jest.fn().mockResolvedValue(mockColumn);

      const { getByTestId } = render(
        <ColumnDetailPanel
          {...mockProps}
          onColumnFieldUpdate={onColumnFieldUpdate}
        />
      );

      await waitFor(() => {
        expect(getByTestId('glossary-terms-section')).toBeInTheDocument();
      });

      const updateButton = getByTestId('update-glossary-terms');
      fireEvent.click(updateButton);

      await waitFor(() => {
        expect(onColumnFieldUpdate).toHaveBeenCalled();
      });

      expect(getByTestId('description-section')).toBeInTheDocument();
    });

    it('should show loader for description section and hide it on error', async () => {
      const onColumnFieldUpdate = jest.fn().mockImplementation(
        () =>
          new Promise((_, reject) => {
            setTimeout(() => {
              reject(new Error('Update failed') as AxiosError);
            }, 100);
          })
      );

      const { getByTestId } = render(
        <ColumnDetailPanel
          {...mockProps}
          onColumnFieldUpdate={onColumnFieldUpdate}
        />
      );

      await waitFor(() => {
        expect(getByTestId('description-section')).toBeInTheDocument();
      });

      const updateButton = getByTestId('update-description');

      await act(async () => {
        fireEvent.click(updateButton);
      });

      await waitFor(
        () => {
          expect(onColumnFieldUpdate).toHaveBeenCalled();
          expect(getByTestId('alert-bar')).toBeInTheDocument();
          expect(getByTestId('alert-bar')).toHaveTextContent('Update failed');
          expect(getByTestId('description-section')).toBeInTheDocument();
        },
        { timeout: 300 }
      );
    });

    it('should allow multiple sections to be updated independently', async () => {
      const onColumnFieldUpdate = jest
        .fn()
        .mockImplementation(
          (_fqn: string, _update: { description?: string; tags?: unknown[] }) =>
            new Promise((resolve) => setTimeout(() => resolve(mockColumn), 100))
        );

      const { getByTestId, queryByTestId } = render(
        <ColumnDetailPanel
          {...mockProps}
          onColumnFieldUpdate={onColumnFieldUpdate}
        />
      );

      await waitFor(() => {
        expect(getByTestId('description-section')).toBeInTheDocument();
      });

      const updateDescriptionButton = getByTestId('update-description');

      await act(async () => {
        fireEvent.click(updateDescriptionButton);
      });

      await waitFor(
        () => {
          expect(getByTestId('loader')).toBeInTheDocument();
        },
        { timeout: 100 }
      );

      expect(getByTestId('tags-section')).toBeInTheDocument();
      expect(getByTestId('glossary-terms-section')).toBeInTheDocument();

      const updateTagsButton = getByTestId('update-tags');

      await act(async () => {
        fireEvent.click(updateTagsButton);
      });

      expect(getByTestId('tags-section')).toBeInTheDocument();

      await waitFor(
        () => {
          expect(queryByTestId('loader')).not.toBeInTheDocument();
        },
        { timeout: 200 }
      );

      expect(getByTestId('description-section')).toBeInTheDocument();
      expect(getByTestId('tags-section')).toBeInTheDocument();
      expect(getByTestId('glossary-terms-section')).toBeInTheDocument();
    });

    it('should not show loader when description section is not being updated', async () => {
      const { getByTestId } = render(<ColumnDetailPanel {...mockProps} />);

      await waitFor(
        () => {
          expect(getByTestId('description-section')).toBeInTheDocument();
        },
        { timeout: 1000 }
      );

      expect(getByTestId('description-section')).toBeInTheDocument();
      expect(getByTestId('tags-section')).toBeInTheDocument();
      expect(getByTestId('glossary-terms-section')).toBeInTheDocument();
    });
  });

  describe('Error Handling', () => {
    it('should handle description update error gracefully', async () => {
      const onColumnFieldUpdate = jest.fn().mockImplementation(
        () =>
          new Promise((_, reject) => {
            setTimeout(() => {
              reject(new Error('Network error') as AxiosError);
            }, 100);
          })
      );

      const { getByTestId } = render(
        <ColumnDetailPanel
          {...mockProps}
          onColumnFieldUpdate={onColumnFieldUpdate}
        />
      );

      await waitFor(() => {
        expect(getByTestId('description-section')).toBeInTheDocument();
      });

      const updateButton = getByTestId('update-description');

      await act(async () => {
        fireEvent.click(updateButton);
      });

      await waitFor(
        () => {
          expect(onColumnFieldUpdate).toHaveBeenCalled();
          expect(getByTestId('alert-bar')).toBeInTheDocument();
          expect(getByTestId('alert-bar')).toHaveTextContent('Network error');
          expect(getByTestId('description-section')).toBeInTheDocument();
        },
        { timeout: 300 }
      );
    });

    it('should handle tags update error gracefully', async () => {
      const onColumnFieldUpdate = jest
        .fn()
        .mockRejectedValue(new Error('Tags update failed'));

      const { getByTestId } = render(
        <ColumnDetailPanel
          {...mockProps}
          onColumnFieldUpdate={onColumnFieldUpdate}
        />
      );

      await waitFor(() => {
        expect(getByTestId('tags-section')).toBeInTheDocument();
      });

      const updateButton = getByTestId('update-tags');

      await act(async () => {
        fireEvent.click(updateButton);
      });

      await waitFor(() => {
        expect(onColumnFieldUpdate).toHaveBeenCalled();
        expect(getByTestId('alert-bar')).toBeInTheDocument();
        expect(getByTestId('alert-bar')).toHaveTextContent(
          'Tags update failed'
        );
      });
    });

    it('should handle glossary terms update error gracefully', async () => {
      const onColumnFieldUpdate = jest
        .fn()
        .mockRejectedValue(new Error('Glossary terms update failed'));

      const { getByTestId } = render(
        <ColumnDetailPanel
          {...mockProps}
          onColumnFieldUpdate={onColumnFieldUpdate}
        />
      );

      await waitFor(() => {
        expect(getByTestId('glossary-terms-section')).toBeInTheDocument();
      });

      const updateButton = getByTestId('update-glossary-terms');

      await act(async () => {
        fireEvent.click(updateButton);
      });

      await waitFor(() => {
        expect(onColumnFieldUpdate).toHaveBeenCalled();
        expect(getByTestId('alert-bar')).toBeInTheDocument();
        expect(getByTestId('alert-bar')).toHaveTextContent(
          'Glossary terms update failed'
        );
      });
    });
  });

  describe('AlertBar Functionality', () => {
    it('should show success alert on successful description update', async () => {
      const onColumnFieldUpdate = jest.fn().mockResolvedValue(mockColumn);

      const { getByTestId } = render(
        <ColumnDetailPanel
          {...mockProps}
          onColumnFieldUpdate={onColumnFieldUpdate}
        />
      );

      await waitFor(() => {
        expect(getByTestId('description-section')).toBeInTheDocument();
      });

      const updateButton = getByTestId('update-description');

      await act(async () => {
        fireEvent.click(updateButton);
      });

      await waitFor(() => {
        expect(onColumnFieldUpdate).toHaveBeenCalled();
        expect(getByTestId('alert-bar')).toBeInTheDocument();
        expect(getByTestId('alert-bar')).toHaveTextContent(
          'server.update-entity-success - {"entity":"label.description"}'
        );
      });
    });

    it('should show success alert on successful tags update', async () => {
      const onColumnFieldUpdate = jest.fn().mockResolvedValue(mockColumn);

      const { getByTestId } = render(
        <ColumnDetailPanel
          {...mockProps}
          onColumnFieldUpdate={onColumnFieldUpdate}
        />
      );

      await waitFor(() => {
        expect(getByTestId('tags-section')).toBeInTheDocument();
      });

      const updateButton = getByTestId('update-tags');

      await act(async () => {
        fireEvent.click(updateButton);
      });

      await waitFor(() => {
        expect(onColumnFieldUpdate).toHaveBeenCalled();
        expect(getByTestId('alert-bar')).toBeInTheDocument();
        expect(getByTestId('alert-bar')).toHaveTextContent(
          'server.update-entity-success - {"entity":"label.tag-plural"}'
        );
      });
    });

    it('should show error alert with correct message on update failure', async () => {
      const errorMessage = 'Custom error message';
      const onColumnFieldUpdate = jest.fn().mockImplementation(
        () =>
          new Promise((_, reject) => {
            setTimeout(() => {
              reject(new Error(errorMessage) as AxiosError);
            }, 50);
          })
      );

      const { getByTestId } = render(
        <ColumnDetailPanel
          {...mockProps}
          onColumnFieldUpdate={onColumnFieldUpdate}
        />
      );

      await waitFor(() => {
        expect(getByTestId('description-section')).toBeInTheDocument();
      });

      const updateButton = getByTestId('update-description');

      await act(async () => {
        fireEvent.click(updateButton);
      });

      await waitFor(
        () => {
          const alertBar = getByTestId('alert-bar');

          expect(alertBar).toBeInTheDocument();
          expect(alertBar).toHaveAttribute('data-type', 'error');
          expect(alertBar).toHaveTextContent(errorMessage);
        },
        { timeout: 200 }
      );
    });

    it('should not show alert bar initially', async () => {
      const { queryByTestId, getByTestId } = render(
        <ColumnDetailPanel {...mockProps} />
      );

      await waitFor(() => {
        expect(getByTestId('description-section')).toBeInTheDocument();
      });

      expect(queryByTestId('alert-bar')).not.toBeInTheDocument();
    });
  });
});
