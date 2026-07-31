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
import { lazyTextEditor } from '../../components/common/DataGrid/LazyDataGrid';
import { DataAssetOption } from '../../components/DataAssets/DataAssetAsyncSelectList/DataAssetAsyncSelectList.interface';
import { EntityType } from '../../enums/entity.enum';
import { SearchIndex } from '../../enums/search.enum';
import csvUtilsClassBase, { CSVUtilsClassBase } from './CSVUtilsClassBase';

const mockSelectedReferenceOption: DataAssetOption = {
  displayName: 'Admin User',
  label: 'Admin User',
  reference: {
    fullyQualifiedName: 'admin',
    id: 'user-id',
    name: 'admin',
    type: EntityType.USER,
  },
  value: 'admin',
};

const mockDataAssetAsyncSelectList = jest.fn();

jest.mock(
  '../../components/DataAssets/DataAssetAsyncSelectList/DataAssetAsyncSelectList',
  () => ({
    __esModule: true,
    default: jest.fn(
      (props: {
        mode?: 'multiple';
        onChange?: (option: DataAssetOption | DataAssetOption[]) => void;
        searchIndex?: SearchIndex;
      }) => {
        mockDataAssetAsyncSelectList(props);

        return (
          <button
            data-testid={
              props.mode === 'multiple'
                ? 'asset-select-list-multiple'
                : 'asset-select-list-single'
            }
            type="button"
            onClick={() =>
              props.onChange?.(
                props.mode === 'multiple'
                  ? [mockSelectedReferenceOption]
                  : mockSelectedReferenceOption
              )
            }>
            asset-select-list
          </button>
        );
      }
    ),
  })
);

jest.mock(
  '../../components/common/AsyncSelectList/TreeAsyncSelectList',
  () => ({
    __esModule: true,
    default: jest.fn(),
  })
);

jest.mock(
  '../../components/common/DomainSelectableList/DomainSelectableList.component',
  () => ({
    __esModule: true,
    default: jest.fn(),
  })
);

jest.mock('../../components/common/InlineEdit/InlineEdit.component', () => ({
  __esModule: true,
  default: jest.fn(),
}));

jest.mock('../../components/common/TierCard/TierCard', () => ({
  __esModule: true,
  default: jest.fn(),
}));

jest.mock(
  '../../components/common/UserTeamSelectableList/UserTeamSelectableList.component',
  () => ({
    __esModule: true,
    UserTeamSelectableList: jest
      .fn()
      .mockReturnValue(<p>UserTeamSelectableList</p>),
  })
);

jest.mock(
  '../../components/Modals/ModalWithMarkdownEditor/ModalWithMarkdownEditor',
  () => ({
    __esModule: true,
    ModalWithMarkdownEditor: jest.fn(),
  })
);
jest.mock(
  '../../components/Modals/ModalWithCustomProperty/ModalWithCustomPropertyEditor.component',
  () => ({
    __esModule: true,
    ModalWithCustomPropertyEditor: jest.fn(),
  })
);

const mockGetTypeByFQN = jest.fn();
jest.mock('../../rest/metadataTypeAPI', () => ({
  getTypeByFQN: (typeFQN: string) => mockGetTypeByFQN(typeFQN),
}));

const mockGetMetrics = jest.fn();
jest.mock('../../rest/metricsAPI', () => ({
  getMetrics: (params: unknown) => mockGetMetrics(params),
}));

const mockSearchQuery = jest.fn();
jest.mock('../../rest/searchAPI', () => ({
  searchQuery: (params: unknown) => mockSearchQuery(params),
}));

const mockFetchDataProductsElasticSearch = jest.fn();
jest.mock('../../rest/dataProductAPI', () => ({
  fetchDataProductsElasticSearch: (searchText: string, domains: string[]) =>
    mockFetchDataProductsElasticSearch(searchText, domains),
}));

const mockGetDomainList = jest.fn();
jest.mock('../../rest/domainAPI', () => ({
  getDomainList: (params: unknown) => mockGetDomainList(params),
}));

const mockGetGlossariesList = jest.fn();
const mockGetGlossaryTerms = jest.fn();
jest.mock('../../rest/glossaryAPI', () => ({
  getGlossariesList: (params: unknown) => mockGetGlossariesList(params),
  getGlossaryTerms: (params: unknown) => mockGetGlossaryTerms(params),
}));

const mockGetAllClassifications = jest.fn();
const mockGetTags = jest.fn();
jest.mock('../../rest/tagAPI', () => ({
  getAllClassifications: (params: unknown) => mockGetAllClassifications(params),
  getTags: (params: unknown) => mockGetTags(params),
}));

const multipleOwner = {
  user: true,
  team: false,
};

describe('CSV utils ClassBase', () => {
  let csvUtils: CSVUtilsClassBase;

  beforeEach(() => {
    jest.clearAllMocks();
    csvUtils = new CSVUtilsClassBase();
    mockGetTypeByFQN.mockResolvedValue({
      customProperties: [
        {
          name: 'costCenter',
          displayName: 'Cost Center',
          description: '',
          propertyType: { name: 'string' },
        },
        {
          name: 'reviewCadence',
          displayName: 'Review Cadence',
          description: '',
          propertyType: { name: 'enum' },
          customPropertyConfig: {
            config: {
              values: ['Monthly', 'Quarterly', 'Annually'],
            },
          },
        },
      ],
    });
    mockFetchDataProductsElasticSearch.mockResolvedValue({
      data: [],
      paging: { total: 0 },
    });
    mockGetDomainList.mockResolvedValue({
      data: [],
      paging: { total: 0 },
    });
    mockGetGlossariesList.mockResolvedValue({
      data: [],
      paging: { total: 0 },
    });
    mockGetGlossaryTerms.mockResolvedValue({
      data: [],
      paging: { total: 0 },
    });
    mockGetAllClassifications.mockResolvedValue({
      data: [],
      paging: { total: 0 },
    });
    mockGetTags.mockResolvedValue({
      data: [],
      paging: { total: 0 },
    });
    mockGetMetrics.mockResolvedValue({
      data: [],
      paging: { total: 0 },
    });
    mockSearchQuery.mockResolvedValue({
      hits: {
        hits: [],
        total: { value: 0 },
      },
    });
  });

  describe('hideImportsColumnList', () => {
    it('should return array of columns to hide during import', () => {
      const result = csvUtils.hideImportsColumnList();

      expect(result).toEqual(['glossaryStatus', 'inspectionQuery']);
      expect(result).toHaveLength(2);
    });

    it('should return a new array instance each time', () => {
      const result1 = csvUtils.hideImportsColumnList();
      const result2 = csvUtils.hideImportsColumnList();

      expect(result1).toEqual(result2);
      expect(result1).not.toBe(result2);
    });

    it('should include glossaryStatus column', () => {
      const result = csvUtils.hideImportsColumnList();

      expect(result).toContain('glossaryStatus');
    });

    it('should include inspectionQuery column', () => {
      const result = csvUtils.hideImportsColumnList();

      expect(result).toContain('inspectionQuery');
    });
  });

  describe('columnsWithMultipleValuesEscapeNeeded', () => {
    it('should return array of columns that need escape handling', () => {
      const result = csvUtils.columnsWithMultipleValuesEscapeNeeded();

      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBeGreaterThan(0);
    });

    it('should include basic columns', () => {
      const result = csvUtils.columnsWithMultipleValuesEscapeNeeded();

      expect(result).toContain('parent');
      expect(result).toContain('extension');
      expect(result).toContain('synonyms');
      expect(result).toContain('description');
      expect(result).toContain('tags');
      expect(result).toContain('glossaryTerms');
      expect(result).toContain('relatedTerms');
    });

    it('should include column-specific fields', () => {
      const result = csvUtils.columnsWithMultipleValuesEscapeNeeded();

      expect(result).toContain('column.description');
      expect(result).toContain('column.tags');
      expect(result).toContain('column.glossaryTerms');
      expect(result).toContain('column.name*');
    });

    it('should include special fields', () => {
      const result = csvUtils.columnsWithMultipleValuesEscapeNeeded();

      expect(result).toContain('storedProcedure.code');
      expect(result).toContain('name*');
      expect(result).toContain('parameterValues');
    });

    it('should return correct number of columns', () => {
      const result = csvUtils.columnsWithMultipleValuesEscapeNeeded();

      expect(result.length).toBeGreaterThan(10);
    });
  });

  describe('getEditor', () => {
    it('should return the editor component for the specified column', () => {
      const column = 'owner';
      const editor = csvUtilsClassBase.getEditor(
        column,
        EntityType.GLOSSARY,
        multipleOwner
      );

      expect(editor).toBeDefined();
    });

    it('should return default lazyTextEditor for unknown columns', () => {
      const column = 'unknown';
      const editor = csvUtilsClassBase.getEditor(
        column,
        EntityType.GLOSSARY,
        multipleOwner
      );

      expect(editor).toBe(lazyTextEditor);
    });

    it('should return the unified code editor (not plain text) for expressionCode', () => {
      const editor = csvUtilsClassBase.getEditor(
        'expressionCode',
        EntityType.METRIC,
        multipleOwner
      );

      expect(editor).toBeDefined();
      expect(editor).not.toBe(lazyTextEditor);
    });

    it('should return the editor component for the "description" column', () => {
      const column = 'description';
      const editor = csvUtilsClassBase.getEditor(
        column,
        EntityType.GLOSSARY,
        multipleOwner
      );

      expect(editor).toBeDefined();
    });

    it('should return the editor component for the "tags" column', () => {
      const column = 'tags';
      const editor = csvUtilsClassBase.getEditor(
        column,
        EntityType.GLOSSARY,
        multipleOwner
      );

      expect(editor).toBeDefined();
    });

    it('should return the editor component for the "glossaryTerms" column', () => {
      const column = 'glossaryTerms';
      const editor = csvUtilsClassBase.getEditor(
        column,
        EntityType.GLOSSARY,
        multipleOwner
      );

      expect(editor).toBeDefined();
    });

    it('should return the editor component for the "tiers" column', () => {
      const column = 'tiers';
      const editor = csvUtilsClassBase.getEditor(
        column,
        EntityType.GLOSSARY,
        multipleOwner
      );

      expect(editor).toBeDefined();
    });

    it('should use compact select for metric tier rich grid cells', () => {
      const editor = csvUtils.getEditor(
        'tiers',
        EntityType.METRIC,
        multipleOwner,
        {
          usePlainTextEditor: true,
        }
      );

      if (!editor) {
        throw new Error('Expected tiers editor to be defined');
      }

      render(
        <>
          {editor({
            row: { tiers: 'Tier.Tier1' },
            column: { key: 'tiers' },
            onRowChange: jest.fn(),
            onClose: jest.fn(),
          } as unknown as Parameters<typeof editor>[0])}
        </>
      );

      expect(screen.getByTestId('tiers-select')).toBeInTheDocument();
    });

    it('should return the editor component for the "extension" column', () => {
      const column = 'extension';
      const editor = csvUtilsClassBase.getEditor(
        column,
        EntityType.GLOSSARY,
        multipleOwner
      );

      expect(editor).toBeDefined();
    });

    it('should return the editor component for the "reviewers" column', () => {
      const column = 'reviewers';
      const editor = csvUtilsClassBase.getEditor(
        column,
        EntityType.GLOSSARY,
        multipleOwner
      );

      expect(editor).toBeDefined();
    });

    it('should return the editor component for the "domains" column', () => {
      const column = 'domains';
      const editor = csvUtilsClassBase.getEditor(
        column,
        EntityType.GLOSSARY,
        multipleOwner
      );

      expect(editor).toBeDefined();
    });

    it('should return the editor component for the "relatedTerms" column', () => {
      const column = 'relatedTerms';
      const editor = csvUtilsClassBase.getEditor(
        column,
        EntityType.GLOSSARY,
        multipleOwner
      );

      expect(editor).toBeDefined();
    });

    it('should return editor for certification column', () => {
      const editor = csvUtils.getEditor(
        'certification',
        EntityType.TABLE,
        multipleOwner
      );

      expect(editor).toBeDefined();
    });

    it('should return editor for entityType* column', () => {
      const editor = csvUtils.getEditor(
        'entityType*',
        EntityType.TABLE,
        multipleOwner
      );

      expect(editor).toBeDefined();
    });

    it('should return editor for code column', () => {
      const editor = csvUtils.getEditor(
        'code',
        EntityType.TABLE,
        multipleOwner
      );

      expect(editor).toBeDefined();
    });

    it('should use inline editors for metric bulk edit rich fields', () => {
      const descriptionEditor = csvUtils.getEditor(
        'description',
        EntityType.METRIC,
        multipleOwner,
        { usePlainTextEditor: true }
      );
      const codeEditor = csvUtils.getEditor(
        'code',
        EntityType.METRIC,
        multipleOwner,
        { usePlainTextEditor: true }
      );

      expect(descriptionEditor).toBeDefined();
      expect(descriptionEditor).not.toBe(lazyTextEditor);
      expect(codeEditor).toBeDefined();
      expect(codeEditor).not.toBe(lazyTextEditor);
    });

    it('should commit metric bulk edit description changes from the inline editor', () => {
      const editor = csvUtils.getEditor(
        'description',
        EntityType.METRIC,
        multipleOwner,
        { usePlainTextEditor: true }
      );
      const onRowChange = jest.fn();
      const onClose = jest.fn();

      if (!editor) {
        throw new Error('Expected description editor to be defined');
      }

      render(
        <>
          {editor({
            row: { description: 'Current description' },
            column: { key: 'description' },
            onRowChange,
            onClose,
          } as unknown as Parameters<typeof editor>[0])}
        </>
      );

      const textarea = screen.getByRole('textbox');

      expect(
        screen.getByTestId('bulk-edit-description-editor')
      ).toBeInTheDocument();

      fireEvent.change(textarea, {
        target: { value: 'Updated description' },
      });
      fireEvent.blur(textarea);

      expect(onRowChange).toHaveBeenCalledWith(
        { description: 'Updated description' },
        true
      );
      expect(onClose).toHaveBeenCalledWith(true);
    });

    it('should use a normal text input for metric bulk edit text cells', () => {
      const editor = csvUtils.getEditor(
        'displayName',
        EntityType.METRIC,
        multipleOwner,
        { usePlainTextEditor: true }
      );
      const onRowChange = jest.fn();
      const onClose = jest.fn();

      if (!editor) {
        throw new Error('Expected displayName editor to be defined');
      }

      render(
        <>
          {editor({
            row: { displayName: 'Current display name' },
            column: { key: 'displayName' },
            onRowChange,
            onClose,
          } as unknown as Parameters<typeof editor>[0])}
        </>
      );

      const input = screen.getByTestId(
        'bulk-edit-text-cell-editor'
      ) as HTMLInputElement;

      expect(input).toHaveValue('Current display name');
      expect(input.selectionStart).toBe('Current display name'.length);

      fireEvent.change(input, {
        target: { value: 'Updated display name' },
      });
      fireEvent.blur(input);

      expect(onRowChange).toHaveBeenCalledWith(
        { displayName: 'Updated display name' },
        true
      );
      expect(onClose).toHaveBeenCalledWith(true);
    });

    it('should retain metric text edits when the grid closes the editor before blur', async () => {
      const editor = csvUtils.getEditor(
        'displayName',
        EntityType.METRIC,
        multipleOwner,
        { usePlainTextEditor: true }
      );
      const onRowChange = jest.fn();
      const onClose = jest.fn();

      if (!editor) {
        throw new Error('Expected displayName editor to be defined');
      }

      const { unmount } = render(
        <>
          {editor({
            row: { displayName: 'Current display name' },
            column: { key: 'displayName' },
            onRowChange,
            onClose,
          } as unknown as Parameters<typeof editor>[0])}
        </>
      );

      fireEvent.change(screen.getByTestId('bulk-edit-text-cell-editor'), {
        target: { value: 'Updated display name' },
      });

      unmount();

      await waitFor(() => {
        expect(onRowChange).toHaveBeenCalledWith(
          { displayName: 'Updated display name' },
          true
        );
      });

      expect(onClose).toHaveBeenCalledWith(true);
    });

    it('should use an inline custom properties editor for metric bulk edit extension cells', async () => {
      const editor = csvUtils.getEditor(
        'extension',
        EntityType.METRIC,
        multipleOwner,
        { usePlainTextEditor: true }
      );
      const onRowChange = jest.fn();
      const onClose = jest.fn();

      if (!editor) {
        throw new Error('Expected extension editor to be defined');
      }

      await act(async () => {
        render(
          <>
            {editor({
              row: {
                extension: 'costCenter:FIN-204;reviewCadence:Quarterly',
              },
              column: { key: 'extension' },
              onRowChange,
              onClose,
            } as unknown as Parameters<typeof editor>[0])}
          </>
        );
      });

      expect(
        await screen.findByTestId('bulk-edit-custom-property-editor')
      ).toBeInTheDocument();
      expect(await screen.findByText('Cost Center')).toBeInTheDocument();
      expect(screen.getByText('Review Cadence')).toBeInTheDocument();

      fireEvent.change(await screen.findByDisplayValue('FIN-204'), {
        target: { value: 'FIN-205' },
      });
      fireEvent.click(screen.getByRole('button', { name: /update/i }));

      await waitFor(() => {
        expect(onRowChange).toHaveBeenCalledWith(
          {
            extension: 'costCenter:FIN-205;reviewCadence:Quarterly',
          },
          true
        );
      });

      expect(onClose).toHaveBeenCalledWith(true);
    });

    it('should use configured entity reference indexes for bulk edit custom properties', async () => {
      mockGetTypeByFQN.mockResolvedValueOnce({
        customProperties: [
          {
            name: 'approver',
            displayName: 'Approver',
            description: '',
            propertyType: { name: 'entityReference' },
            customPropertyConfig: {
              config: [SearchIndex.USER],
            },
          },
          {
            name: 'reviewers',
            displayName: 'Reviewers',
            description: '',
            propertyType: { name: 'entityReferenceList' },
            customPropertyConfig: {
              config: [SearchIndex.USER],
            },
          },
        ],
      });

      const editor = csvUtils.getEditor(
        'extension',
        EntityType.METRIC,
        multipleOwner,
        { usePlainTextEditor: true }
      );
      const onRowChange = jest.fn();
      const onClose = jest.fn();

      if (!editor) {
        throw new Error('Expected extension editor to be defined');
      }

      await act(async () => {
        render(
          <>
            {editor({
              row: {
                extension: '',
              },
              column: { key: 'extension' },
              onRowChange,
              onClose,
            } as unknown as Parameters<typeof editor>[0])}
          </>
        );
      });

      expect(await screen.findByText('Approver')).toBeInTheDocument();
      expect(screen.getByText('Reviewers')).toBeInTheDocument();
      expect(mockDataAssetAsyncSelectList).toHaveBeenCalledWith(
        expect.objectContaining({
          searchIndex: SearchIndex.USER,
          value: undefined,
        })
      );
      expect(mockDataAssetAsyncSelectList).toHaveBeenCalledWith(
        expect.objectContaining({
          mode: 'multiple',
          searchIndex: SearchIndex.USER,
          value: undefined,
        })
      );

      fireEvent.click(screen.getByTestId('asset-select-list-single'));
      fireEvent.click(screen.getByTestId('asset-select-list-multiple'));
      fireEvent.click(screen.getByRole('button', { name: /update/i }));

      await waitFor(() => {
        expect(onRowChange).toHaveBeenCalledWith(
          {
            extension: 'approver:user:admin;reviewers:user:admin',
          },
          true
        );
      });

      expect(onClose).toHaveBeenCalledWith(true);
    });

    it('should render enum custom properties as single or multi select from config', async () => {
      mockGetTypeByFQN.mockResolvedValueOnce({
        customProperties: [
          {
            name: 'status',
            displayName: 'Status',
            description: '',
            propertyType: { name: 'enum' },
            customPropertyConfig: {
              config: {
                multiSelect: false,
                values: ['Draft', 'Approved'],
              },
            },
          },
          {
            name: 'markets',
            displayName: 'Markets',
            description: '',
            propertyType: { name: 'enum' },
            customPropertyConfig: {
              config: {
                multiSelect: true,
                values: ['US', 'EU', 'APAC'],
              },
            },
          },
        ],
      });

      const editor = csvUtils.getEditor(
        'extension',
        EntityType.METRIC,
        multipleOwner,
        { usePlainTextEditor: true }
      );

      if (!editor) {
        throw new Error('Expected extension editor to be defined');
      }

      await act(async () => {
        render(
          <>
            {editor({
              row: {
                extension: 'status:Draft;markets:US|EU',
              },
              column: { key: 'extension' },
              onRowChange: jest.fn(),
              onClose: jest.fn(),
            } as unknown as Parameters<typeof editor>[0])}
          </>
        );
      });

      expect(await screen.findByText('Status')).toBeInTheDocument();
      expect(screen.getByText('Markets')).toBeInTheDocument();
      expect(
        document.querySelectorAll('.bulk-edit-custom-property-enum-select')
      ).toHaveLength(2);
      expect(
        document.querySelectorAll(
          '.bulk-edit-custom-property-enum-select.ant-select-multiple'
        )
      ).toHaveLength(1);
      expect(
        document.querySelector('.bulk-edit-custom-property-option')
      ).not.toBeInTheDocument();
    });

    it('should refetch metric custom properties after an empty response', async () => {
      const editor = csvUtils.getEditor(
        'extension',
        EntityType.METRIC,
        multipleOwner,
        { usePlainTextEditor: true }
      );
      const onRowChange = jest.fn();
      const onClose = jest.fn();

      if (!editor) {
        throw new Error('Expected extension editor to be defined');
      }

      mockGetTypeByFQN
        .mockResolvedValueOnce({ customProperties: [] })
        .mockResolvedValueOnce({
          customProperties: [
            {
              name: 'priority',
              displayName: 'Priority',
              description: '',
              propertyType: { name: 'string' },
            },
          ],
        });

      const renderEditor = () =>
        render(
          <>
            {editor({
              row: { extension: '' },
              column: { key: 'extension' },
              onRowChange,
              onClose,
            } as unknown as Parameters<typeof editor>[0])}
          </>
        );

      const firstRender = renderEditor();

      expect(
        await screen.findByText('label.no-custom-properties-defined')
      ).toBeInTheDocument();
      expect(
        screen.queryByText('label.add-custom-properties-placeholder')
      ).not.toBeInTheDocument();
      expect(
        screen.queryByText('label.custom-property-plural')
      ).not.toBeInTheDocument();

      firstRender.unmount();

      renderEditor();

      expect(await screen.findByText('Priority')).toBeInTheDocument();
      expect(mockGetTypeByFQN).toHaveBeenCalledTimes(2);
      expect(mockGetTypeByFQN).toHaveBeenNthCalledWith(1, EntityType.METRIC);
      expect(mockGetTypeByFQN).toHaveBeenNthCalledWith(2, EntityType.METRIC);
    });

    it('should render the metric domains picker empty state from the design', async () => {
      const editor = csvUtils.getEditor(
        'domains',
        EntityType.METRIC,
        multipleOwner,
        { usePlainTextEditor: true }
      );
      const onRowChange = jest.fn();
      const onClose = jest.fn();

      if (!editor) {
        throw new Error('Expected domains editor to be defined');
      }

      await act(async () => {
        render(
          <>
            {editor({
              row: { domains: '' },
              column: { key: 'domains' },
              onRowChange,
              onClose,
            } as unknown as Parameters<typeof editor>[0])}
          </>
        );
      });

      expect(
        await screen.findByTestId('bulk-edit-domains-picker-editor')
      ).toBeInTheDocument();
      expect(
        await screen.findByText('message.bulk-edit-no-domains-available')
      ).toBeInTheDocument();
      expect(
        screen.getAllByText('message.bulk-edit-domains-placeholder')
      ).toHaveLength(1);
      expect(
        screen.getByPlaceholderText(
          'message.bulk-edit-domains-search-placeholder'
        )
      ).toBeVisible();
      expect(
        screen.getByText('message.bulk-edit-domains-empty-description')
      ).toBeInTheDocument();
      expect(
        screen.getByText('message.bulk-edit-open-domains-settings')
      ).toBeInTheDocument();
      expect(
        screen.getByText('message.bulk-edit-domains-empty-hint')
      ).toBeInTheDocument();
      expect(
        screen.queryByRole('button', { name: /update/i })
      ).not.toBeInTheDocument();
    });

    it.each([
      [
        'dataProducts',
        'message.bulk-edit-data-products-placeholder',
        'message.bulk-edit-data-products-search-placeholder',
        'message.bulk-edit-no-data-products-available',
        'message.bulk-edit-open-data-products',
      ],
      [
        'tags',
        'message.bulk-edit-tags-placeholder',
        'message.bulk-edit-tags-search-placeholder',
        'message.bulk-edit-no-tags-yet',
        'message.bulk-edit-create-a-tag',
      ],
      [
        'glossaryTerms',
        'message.bulk-edit-glossary-terms-placeholder',
        'message.bulk-edit-glossary-terms-search-placeholder',
        'message.bulk-edit-no-glossary-terms-yet',
        'message.bulk-edit-create-glossary-term',
      ],
    ])(
      'should render the metric %s picker empty state',
      async (
        column,
        placeholder,
        searchPlaceholder,
        emptyTitle,
        actionLabel
      ) => {
        const editor = csvUtils.getEditor(
          column,
          EntityType.METRIC,
          multipleOwner,
          { usePlainTextEditor: true }
        );
        const onRowChange = jest.fn();
        const onClose = jest.fn();

        if (!editor) {
          throw new Error(`Expected ${column} editor to be defined`);
        }

        await act(async () => {
          render(
            <>
              {editor({
                row: { [column]: '' },
                column: { key: column },
                onRowChange,
                onClose,
              } as unknown as Parameters<typeof editor>[0])}
            </>
          );
        });

        expect(await screen.findByText(emptyTitle)).toBeInTheDocument();
        expect(screen.getAllByText(placeholder)).toHaveLength(1);
        expect(screen.getByPlaceholderText(searchPlaceholder)).toBeVisible();
        expect(screen.getByText(actionLabel)).toBeInTheDocument();
        expect(
          screen.queryByRole('button', { name: /update/i })
        ).not.toBeInTheDocument();
      }
    );

    it('should not show tier or certification tags in the metric tags picker', async () => {
      mockGetAllClassifications.mockResolvedValueOnce({
        data: [{ name: 'Business' }],
        paging: { total: 1 },
      });
      mockGetTags.mockResolvedValueOnce({
        data: [
          {
            description: 'Critical business tag.',
            displayName: 'Business Critical',
            fullyQualifiedName: 'Business.Critical',
            id: 'business-critical',
            name: 'Critical',
            style: { color: '#5925dc' },
          },
          {
            classification: { name: 'Certification' },
            description: 'Gold certified Data Asset.',
            displayName: 'Gold',
            id: 'certification-gold',
            name: 'Gold',
            style: { color: '#f79009' },
          },
          {
            description: 'Tier one.',
            displayName: 'Tier1',
            fullyQualifiedName: 'Tier.Tier1',
            id: 'tier-one',
            name: 'Tier1',
            style: { color: '#7a5af8' },
          },
        ],
        paging: { total: 3 },
      });

      const editor = csvUtils.getEditor(
        'tags',
        EntityType.METRIC,
        multipleOwner,
        { usePlainTextEditor: true }
      );

      if (!editor) {
        throw new Error('Expected tags editor to be defined');
      }

      await act(async () => {
        render(
          <>
            {editor({
              row: { tags: '' },
              column: { key: 'tags' },
              onClose: jest.fn(),
              onRowChange: jest.fn(),
            } as unknown as Parameters<typeof editor>[0])}
          </>
        );
      });

      expect(await screen.findByText('Business Critical')).toBeInTheDocument();
      expect(screen.queryByText('Gold')).not.toBeInTheDocument();
      expect(screen.queryByText('Tier1')).not.toBeInTheDocument();
    });

    it('should show metric glossary terms as hierarchy paths in the picker', async () => {
      mockGetGlossariesList.mockResolvedValueOnce({
        data: [{ name: 'BusinessGlossary' }],
        paging: { total: 1 },
      });
      mockGetGlossaryTerms.mockResolvedValueOnce({
        data: [
          {
            displayName: 'Net Sales',
            fullyQualifiedName: 'BusinessGlossary.Revenue.NetSales',
            glossary: {
              displayName: 'Business Glossary',
              name: 'BusinessGlossary',
            },
            name: 'NetSales',
            style: { color: '#1570ef' },
          },
        ],
        paging: { total: 1 },
      });

      const editor = csvUtils.getEditor(
        'glossaryTerms',
        EntityType.METRIC,
        multipleOwner,
        { usePlainTextEditor: true }
      );
      const onRowChange = jest.fn();
      const onClose = jest.fn();

      if (!editor) {
        throw new Error('Expected glossaryTerms editor to be defined');
      }

      await act(async () => {
        render(
          <>
            {editor({
              row: { glossaryTerms: '' },
              column: { key: 'glossaryTerms' },
              onClose,
              onRowChange,
            } as unknown as Parameters<typeof editor>[0])}
          </>
        );
      });

      fireEvent.click(
        await screen.findByRole('button', {
          name: /BusinessGlossary \/ Revenue \/ NetSales/i,
        })
      );
      fireEvent.click(screen.getByRole('button', { name: 'label.update' }));

      expect(onRowChange).toHaveBeenCalledWith(
        { glossaryTerms: 'BusinessGlossary.Revenue.NetSales' },
        true
      );
      expect(onClose).toHaveBeenCalledWith(true);
    });

    it('should commit selected metric domains from the picker', async () => {
      mockGetDomainList.mockResolvedValueOnce({
        data: [
          {
            displayName: 'Marketing',
            fullyQualifiedName: 'Marketing',
            name: 'Marketing',
          },
        ],
        paging: { total: 1 },
      });

      const editor = csvUtils.getEditor(
        'domains',
        EntityType.METRIC,
        multipleOwner,
        { usePlainTextEditor: true }
      );
      const onRowChange = jest.fn();
      const onClose = jest.fn();

      if (!editor) {
        throw new Error('Expected domains editor to be defined');
      }

      await act(async () => {
        render(
          <>
            {editor({
              row: { domains: '' },
              column: { key: 'domains' },
              onRowChange,
              onClose,
            } as unknown as Parameters<typeof editor>[0])}
          </>
        );
      });

      fireEvent.click(
        await screen.findByRole('button', { name: /Marketing/i })
      );
      fireEvent.click(screen.getByRole('button', { name: 'label.update' }));

      expect(onRowChange).toHaveBeenCalledWith(
        { domains: '"Marketing"' },
        true
      );
      expect(onClose).toHaveBeenCalledWith(true);
    });

    it('should commit selected metric reviewers from the compact picker', async () => {
      mockSearchQuery.mockResolvedValueOnce({
        hits: {
          hits: [
            {
              _source: {
                displayName: 'Aiden Brooks',
                email: 'aiden@example.com',
                entityType: EntityType.USER,
                id: 'aiden-id',
                name: 'aiden',
              },
            },
          ],
          total: { value: 1 },
        },
      });

      const editor = csvUtils.getEditor(
        'reviewers',
        EntityType.METRIC,
        multipleOwner,
        { usePlainTextEditor: true }
      );
      const onRowChange = jest.fn();
      const onClose = jest.fn();

      if (!editor) {
        throw new Error('Expected reviewers editor to be defined');
      }

      await act(async () => {
        render(
          <>
            {editor({
              row: { reviewers: '' },
              column: { key: 'reviewers' },
              onRowChange,
              onClose,
            } as unknown as Parameters<typeof editor>[0])}
          </>
        );
      });

      fireEvent.click(
        await screen.findByRole('button', { name: /Aiden Brooks/i })
      );
      fireEvent.click(screen.getByRole('button', { name: 'label.update' }));

      expect(onRowChange).toHaveBeenCalledWith(
        { reviewers: 'user:aiden' },
        true
      );
      expect(onClose).toHaveBeenCalledWith(true);
    });

    it('should handle different entity types', () => {
      const tableEditor = csvUtils.getEditor(
        'owner',
        EntityType.TABLE,
        multipleOwner
      );
      const databaseEditor = csvUtils.getEditor(
        'owner',
        EntityType.DATABASE,
        multipleOwner
      );
      const dashboardEditor = csvUtils.getEditor(
        'owner',
        EntityType.DASHBOARD,
        multipleOwner
      );

      expect(tableEditor).toBeDefined();
      expect(databaseEditor).toBeDefined();
      expect(dashboardEditor).toBeDefined();
    });

    it('should handle multiple owner configurations', () => {
      const userOnly = csvUtils.getEditor('owner', EntityType.TABLE, {
        user: true,
        team: false,
      });
      const teamOnly = csvUtils.getEditor('owner', EntityType.TABLE, {
        user: false,
        team: true,
      });
      const both = csvUtils.getEditor('owner', EntityType.TABLE, {
        user: true,
        team: true,
      });

      expect(userOnly).toBeDefined();
      expect(teamOnly).toBeDefined();
      expect(both).toBeDefined();
    });
  });

  describe('singleton instance', () => {
    it('should export a singleton instance', () => {
      expect(csvUtilsClassBase).toBeInstanceOf(CSVUtilsClassBase);
    });

    it('should have all methods available on singleton', () => {
      expect(csvUtilsClassBase.hideImportsColumnList).toBeDefined();
      expect(
        csvUtilsClassBase.columnsWithMultipleValuesEscapeNeeded
      ).toBeDefined();
      expect(csvUtilsClassBase.getEditor).toBeDefined();
    });
  });
});
