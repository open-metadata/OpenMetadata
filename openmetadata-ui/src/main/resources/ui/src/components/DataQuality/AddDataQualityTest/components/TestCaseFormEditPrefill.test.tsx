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

/**
 * Render-level regression guard for DQ edit-form prefill.
 *
 * Unit tests around `buildEditDefaults`/`transformTestCaseFormData` assert on
 * `form.getValues(...)` shapes; they can't catch a class of bug where the RHF
 * value is shaped correctly but the field component that's supposed to
 * *display* it never renders that value (a mismatched `id`, a field that
 * reads the wrong RHF path, a missing options list, etc). This file mounts
 * the REAL `TestCaseFormDrawer` (real `TestCaseFormBody`, `ParameterFields`,
 * `TableDiffFields`, `buildEditDefaults` — nothing under test is mocked) with
 * a `testCase` prop across a matrix of representative test types, and asserts
 * the actual displayed DOM value for each prefilled field. Only external
 * boundaries (REST, tag suggestion search, permission/limit/airflow context
 * providers) are mocked so option lists resolve in jsdom.
 */
import { render, screen, waitFor, within } from '@testing-library/react';
import { Table } from '../../../../generated/entity/data/table';
import { TestCase } from '../../../../generated/tests/testCase';
import {
  TestDataType,
  TestDefinition,
} from '../../../../generated/tests/testDefinition';
import { getIngestionPipelines } from '../../../../rest/ingestionPipelineAPI';
import { searchQuery } from '../../../../rest/searchAPI';
import { getTableDetailsByFQN } from '../../../../rest/tableAPI';
import {
  getListTestCaseBySearch,
  getListTestDefinitions,
  getTestDefinitionById,
} from '../../../../rest/testAPI';
import TestCaseFormDrawer from './TestCaseFormDrawer';
import { TestCaseFormDrawerProps } from './TestCaseFormV1.interface';

jest.mock('../../../../rest/testAPI', () => ({
  getTestDefinitionById: jest.fn(),
  getListTestDefinitions: jest.fn(),
  getListTestCaseBySearch: jest.fn(),
  createTestCase: jest.fn(),
  updateTestCaseById: jest.fn(),
}));

jest.mock('../../../../rest/searchAPI', () => ({
  searchQuery: jest.fn(),
}));

jest.mock('../../../../rest/tableAPI', () => ({
  getTableDetailsByFQN: jest.fn(),
}));

jest.mock('../../../../rest/ingestionPipelineAPI', () => ({
  getIngestionPipelines: jest.fn(),
  addIngestionPipeline: jest.fn(),
  deployIngestionPipelineById: jest.fn(),
}));

jest.mock(
  '../../../../context/AirflowStatusProvider/AirflowStatusProvider',
  () => ({
    useAirflowStatus: jest.fn().mockReturnValue({ isAirflowAvailable: true }),
  })
);

jest.mock('../../../../context/LimitsProvider/useLimitsStore', () => ({
  useLimitStore: jest.fn().mockReturnValue({
    config: {},
    getResourceLimit: jest.fn().mockResolvedValue(undefined),
  }),
}));

jest.mock('../../../../context/PermissionProvider/PermissionProvider', () => ({
  usePermissionProvider: () => ({
    permissions: {
      ingestionPipeline: { Create: true, EditAll: true },
      testCase: { Create: true },
    },
    getEntityPermissionByFqn: jest
      .fn()
      .mockResolvedValue({ EditAll: true, EditTests: true }),
  }),
}));

jest.mock('../../../../utils/ToastUtils', () => ({
  showSuccessToast: jest.fn(),
  showErrorToast: jest.fn(),
}));

// ServiceDocPanel pulls in EntitySummaryPanel, which calls useNavigate() and
// needs a <Router> ancestor this harness doesn't provide. The doc/hint panel
// is not part of the prefill surface under test (TestCaseFormBody/
// ParameterFields/TableDiffFields are), so it's stubbed the same way
// TestCaseFormDrawer.test.tsx and TestCaseForm.integration.test.tsx do.
jest.mock('../../../common/ServiceDocPanel/ServiceDocPanel', () =>
  jest
    .fn()
    .mockImplementation(() => (
      <div data-testid="service-doc-panel">doc-panel</div>
    ))
);

// RichTextEditor wraps a lazy BlockEditor (TipTap) that does not render its
// content synchronously in jsdom. Mock it to a plain div carrying the
// initialValue so the description field's prefilled value is still
// display-assertable without pulling in the real editor.
jest.mock('../../../common/RichTextEditor/RichTextEditor', () => ({
  __esModule: true,
  default: function MockRichTextEditor({
    initialValue,
  }: {
    initialValue?: string;
  }) {
    return <div data-testid="rich-text-editor">{initialValue}</div>;
  },
}));

const mockSearchQuery = searchQuery as jest.MockedFunction<typeof searchQuery>;
const mockGetTableDetailsByFQN = getTableDetailsByFQN as jest.MockedFunction<
  typeof getTableDetailsByFQN
>;
const mockGetTestDefinitionById = getTestDefinitionById as jest.MockedFunction<
  typeof getTestDefinitionById
>;
const mockGetListTestDefinitions =
  getListTestDefinitions as jest.MockedFunction<typeof getListTestDefinitions>;
const mockGetListTestCaseBySearch =
  getListTestCaseBySearch as jest.MockedFunction<
    typeof getListTestCaseBySearch
  >;
const mockGetIngestionPipelines = getIngestionPipelines as jest.MockedFunction<
  typeof getIngestionPipelines
>;

const emptySearchResponse = {
  hits: { total: { value: 0 }, hits: [] },
} as unknown as Awaited<ReturnType<typeof searchQuery>>;

const renderDrawer = (props: Partial<TestCaseFormDrawerProps>) =>
  render(<TestCaseFormDrawer open onClose={jest.fn()} {...props} />);

const PARAM_FIELD_TIMEOUT = { timeout: 5000 };

/**
 * NOTE on the table-less edit path (historically a suspected prefill race):
 *
 * When `TestCaseFormDrawer` is opened in edit mode WITHOUT a `table` prop —
 * how `DataQualityTab.tsx`, `IncidentManagerDetailPage.tsx`, and
 * `TestCaseResultTab.tsx` invoke it — the table's columns load asynchronously
 * via `getTableDetailsByFQN`, so `selectedTableData` transitions
 * undefined -> table after mount.
 *
 * A prior concern was that this transition could re-fire the effect that
 * resets `selectedTestDefinition` to `undefined` (via `fetchTestDefinitions`
 * changing identity) with nothing left to re-derive it, leaving
 * `showParameterFields` stuck `false` and the parameter fields never
 * rendering. Case 9's "renders parameter fields after the async table
 * resolves (no table prop)" exercises exactly that ordering and passes — the
 * parameters do render — so that race does not manifest on the natural path.
 *
 * Most cases below still pass an explicit `table` prop (matching
 * `TableProfilerProvider.tsx` and the existing `TestCaseFormBody.test.tsx`
 * suite) to keep the matrix focused on per-type prefill display rather than
 * the async-load ordering, which case 9 covers on its own.
 */

describe('TestCaseFormEditPrefill (render-level regression matrix)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSearchQuery.mockResolvedValue(emptySearchResponse);
    mockGetListTestCaseBySearch.mockResolvedValue({
      data: [],
      paging: { total: 0 },
    } as never);
    mockGetIngestionPipelines.mockResolvedValue({
      data: [],
      paging: { total: 0 },
    } as never);
  });

  describe('1. Table-level scalar (tableRowCountToBeBetween)', () => {
    const TABLE_FQN = 'service.db.schema.orders';

    const definition = {
      id: 'def-table-scalar',
      name: 'tableRowCountToBeBetween',
      fullyQualifiedName: 'tableRowCountToBeBetween',
      parameterDefinition: [
        { name: 'minValue', displayName: 'Min', dataType: TestDataType.Int },
        { name: 'maxValue', displayName: 'Max', dataType: TestDataType.Int },
      ],
    } as unknown as TestDefinition;

    const testCase = {
      id: 'tc-1',
      name: 'orders_row_count_between',
      displayName: 'Orders Row Count Between',
      entityLink: `<#E::table::${TABLE_FQN}>`,
      testDefinition: {
        id: 'def-table-scalar',
        fullyQualifiedName: 'tableRowCountToBeBetween',
      },
      parameterValues: [
        { name: 'minValue', value: '10' },
        { name: 'maxValue', value: '1000' },
      ],
      tags: [],
    } as unknown as TestCase;

    const table = {
      id: 'table-1',
      name: 'orders',
      fullyQualifiedName: TABLE_FQN,
      columns: [],
    } as unknown as Table;

    beforeEach(() => {
      mockGetTestDefinitionById.mockResolvedValue(definition);
      mockGetTableDetailsByFQN.mockResolvedValue(table);
      mockGetListTestDefinitions.mockResolvedValue({
        data: [definition],
        paging: { total: 1 },
      } as never);
    });

    it('displays the disabled table FQN, the test name, and the numeric param values', async () => {
      // `table` is passed explicitly — see the FINDING note above the
      // describe block: without it, selectedTestDefinition can get reset
      // after being correctly derived and the param fields never render.
      renderDrawer({ testCase, table });

      await waitFor(() => {
        expect(mockGetTestDefinitionById).toHaveBeenCalledWith(
          'def-table-scalar'
        );
      });

      const tableSelect = await screen.findByTestId('selectedTable');
      // The table field is FieldTypes.ASYNC_SELECT (Autocomplete); its
      // selected item is rendered as a chip carrying the FQN as its label —
      // this is the exact display path the selectedTable prefill bug broke.
      await waitFor(() => {
        expect(within(tableSelect).getByText(TABLE_FQN)).toBeInTheDocument();
      });

      expect(tableSelect.querySelector('input')).toBeDisabled();

      const nameField = await screen.findByTestId('test-case-name');

      expect(nameField.querySelector('input')).toHaveValue(
        'orders_row_count_between'
      );

      const minValueField = await screen.findByTestId(
        'parameter-minValue',
        {},
        PARAM_FIELD_TIMEOUT
      );

      expect(minValueField.querySelector('input')).toHaveValue(10);

      const maxValueField = await screen.findByTestId('parameter-maxValue');

      expect(maxValueField.querySelector('input')).toHaveValue(1000);
    });
  });

  describe('2. Column-level with a Set param (columnValuesToBeInSet) — PRIORITY CASE', () => {
    const TABLE_FQN = 'service.db.schema.customers';

    const definition = {
      id: 'def-col-set',
      name: 'columnValuesToBeInSet',
      fullyQualifiedName: 'columnValuesToBeInSet',
      parameterDefinition: [
        {
          name: 'allowedValues',
          displayName: 'Allowed Values',
          dataType: TestDataType.Set,
        },
      ],
    } as unknown as TestDefinition;

    const testCase = {
      id: 'tc-2',
      name: 'email_domain_in_set',
      entityLink: `<#E::table::${TABLE_FQN}::columns::email_domain>`,
      testDefinition: {
        id: 'def-col-set',
        fullyQualifiedName: 'columnValuesToBeInSet',
      },
      parameterValues: [
        {
          name: 'allowedValues',
          value: JSON.stringify(['gmail.com', 'yahoo.com']),
        },
      ],
      tags: [],
    } as unknown as TestCase;

    const table = {
      id: 'table-2',
      name: 'customers',
      fullyQualifiedName: TABLE_FQN,
      columns: [
        { name: 'id', dataType: 'BIGINT' },
        { name: 'email_domain', dataType: 'VARCHAR' },
      ],
    } as unknown as Table;

    beforeEach(() => {
      mockGetTestDefinitionById.mockResolvedValue(definition);
      mockGetTableDetailsByFQN.mockResolvedValue(table);
      mockGetListTestDefinitions.mockResolvedValue({
        data: [definition],
        paging: { total: 1 },
      } as never);
    });

    it('displays the table, the saved column, and every allowed-value row', async () => {
      // `table` passed explicitly — see the FINDING note above the describe
      // block.
      renderDrawer({ testCase, table });

      await waitFor(() => {
        expect(mockGetTestDefinitionById).toHaveBeenCalledWith('def-col-set');
      });

      const tableSelect = await screen.findByTestId('selectedTable');
      await waitFor(() => {
        expect(within(tableSelect).getByText(TABLE_FQN)).toBeInTheDocument();
      });

      // This is the exact bug class this file guards against: selectedColumn
      // is a FieldTypes.SELECT whose RHF value must be a FormSelectItem
      // ({ id, label }) to match `selectedKey` against `items` — a bare
      // string id fails silently and the trigger renders blank even though
      // form.getValues('selectedColumn') looks correct.
      //
      // FieldTypes.SELECT (react-aria Select) renders both a visible trigger
      // button (selected item's label as a <p>) and a visually-hidden native
      // <select> a11y mirror whose <option> carries the same text — scope to
      // the trigger button so the assertion reflects what a user actually
      // sees, not the shadow a11y select.
      const columnSelect = await screen.findByTestId('selectedColumn');
      await waitFor(() => {
        const trigger = within(columnSelect).getByRole('button');

        expect(within(trigger).getByText('email_domain')).toBeInTheDocument();
      });

      const row0 = await screen.findByTestId(
        'parameter-allowedValues-0',
        {},
        PARAM_FIELD_TIMEOUT
      );
      const row1 = await screen.findByTestId('parameter-allowedValues-1');

      expect(row0.querySelector('input')).toHaveValue('gmail.com');
      expect(row1.querySelector('input')).toHaveValue('yahoo.com');
    });
  });

  describe('3. Dimension-level (COLUMN_DIMENSION)', () => {
    const TABLE_FQN = 'service.db.schema.events';

    const definition = {
      id: 'def-dimension',
      name: 'columnValuesToBeNotNull',
      fullyQualifiedName: 'columnValuesToBeNotNull',
      parameterDefinition: [],
    } as unknown as TestDefinition;

    const testCase = {
      id: 'tc-3',
      name: 'events_country_dimension',
      entityLink: `<#E::table::${TABLE_FQN}::columns::user_id>`,
      testDefinition: {
        id: 'def-dimension',
        fullyQualifiedName: 'columnValuesToBeNotNull',
      },
      parameterValues: [],
      dimensionColumns: ['country', 'region'],
      topDimensions: 7,
      tags: [],
    } as unknown as TestCase;

    beforeEach(() => {
      mockGetTestDefinitionById.mockResolvedValue(definition);
      mockGetTableDetailsByFQN.mockResolvedValue({
        id: 'table-3',
        name: 'events',
        fullyQualifiedName: TABLE_FQN,
        columns: [
          { name: 'user_id', dataType: 'VARCHAR' },
          { name: 'country', dataType: 'VARCHAR' },
          { name: 'region', dataType: 'VARCHAR' },
        ],
      } as unknown as Table);
      mockGetListTestDefinitions.mockResolvedValue({
        data: [definition],
        paging: { total: 1 },
      } as never);
    });

    it('displays the dimension-column chips and the top-dimensions value', async () => {
      renderDrawer({ testCase });

      await waitFor(() => {
        expect(mockGetTestDefinitionById).toHaveBeenCalledWith('def-dimension');
      });

      // dimensionColumns is a FieldTypes.MULTI_SELECT (Autocomplete);
      // selected chips render each item's label as text.
      const dimensionColumnsField = await screen.findByTestId(
        'dimensionColumns'
      );
      await waitFor(() => {
        expect(
          within(dimensionColumnsField).getByText('country')
        ).toBeInTheDocument();
      });

      expect(
        within(dimensionColumnsField).getByText('region')
      ).toBeInTheDocument();

      const topDimensionsField = await screen.findByTestId('topDimensions');

      expect(topDimensionsField.querySelector('input')).toHaveValue(7);
    });
  });

  describe('4. tableDiff', () => {
    const TABLE_FQN = 'service.db.schema.orders';
    const TABLE2_FQN = 'service.db.schema.orders_backup';

    const definition = {
      id: 'def-table-diff',
      name: 'tableDiff',
      fullyQualifiedName: 'tableDiff',
      parameterDefinition: [
        {
          name: 'table2',
          displayName: 'Table 2',
          dataType: TestDataType.String,
        },
        {
          name: 'keyColumns',
          displayName: 'Key Columns',
          dataType: TestDataType.Array,
        },
      ],
    } as unknown as TestDefinition;

    const testCase = {
      id: 'tc-4',
      name: 'orders_vs_backup_diff',
      entityLink: `<#E::table::${TABLE_FQN}>`,
      testDefinition: { id: 'def-table-diff', fullyQualifiedName: 'tableDiff' },
      parameterValues: [
        { name: 'table2', value: TABLE2_FQN },
        { name: 'keyColumns', value: JSON.stringify(['order_id']) },
      ],
      tags: [],
    } as unknown as TestCase;

    const table = {
      id: 'table-4',
      name: 'orders',
      fullyQualifiedName: TABLE_FQN,
      columns: [
        { name: 'order_id', dataType: 'BIGINT' },
        { name: 'amount', dataType: 'DECIMAL' },
      ],
    } as unknown as Table;

    beforeEach(() => {
      mockGetTestDefinitionById.mockResolvedValue(definition);
      mockGetTableDetailsByFQN.mockResolvedValue(table);
      mockGetListTestDefinitions.mockResolvedValue({
        data: [definition],
        paging: { total: 1 },
      } as never);
      // TableDiffFields fetches its own table2 options via searchQuery,
      // independent of the selectedTable search above.
      mockSearchQuery.mockResolvedValue({
        hits: {
          total: { value: 1 },
          hits: [
            {
              _source: {
                name: 'orders_backup',
                fullyQualifiedName: TABLE2_FQN,
                columns: [{ name: 'order_id', dataType: 'BIGINT' }],
              },
            },
          ],
        },
      } as unknown as Awaited<ReturnType<typeof searchQuery>>);
    });

    it('displays the Table 2 FQN and the saved key-column row', async () => {
      // `table` passed explicitly — see the FINDING note above the describe
      // block.
      renderDrawer({ testCase, table });

      await waitFor(() => {
        expect(mockGetTestDefinitionById).toHaveBeenCalledWith(
          'def-table-diff'
        );
      });

      const table2Field = await screen.findByTestId(
        'table2',
        {},
        PARAM_FIELD_TIMEOUT
      );
      await waitFor(() => {
        expect(within(table2Field).getByText(TABLE2_FQN)).toBeInTheDocument();
      });

      // keyColumns row renders as a FieldTypes.SELECT (react-aria Select)
      // per ColumnArrayField in TableDiffFields.tsx — its saved row value
      // must be a FormSelectItem, matching the columnValuesToBeInSet case.
      const keyColumnsRow = await screen.findByTestId('parameter-keyColumns-0');
      await waitFor(() => {
        const trigger = within(keyColumnsRow).getByRole('button');

        expect(within(trigger).getByText('order_id')).toBeInTheDocument();
      });
    });
  });

  describe('5. Enum param via optionValues (SELECT param)', () => {
    const TABLE_FQN = 'service.db.schema.payments';

    const definition = {
      id: 'def-enum',
      name: 'columnValueLengthsToBeBetween',
      fullyQualifiedName: 'columnValueLengthsToBeBetween',
      parameterDefinition: [
        {
          name: 'matchEnum',
          displayName: 'Match Type',
          dataType: TestDataType.String,
          optionValues: ['ANY', 'ALL', 'NONE'],
        },
      ],
    } as unknown as TestDefinition;

    const testCase = {
      id: 'tc-5',
      name: 'payments_status_match',
      entityLink: `<#E::table::${TABLE_FQN}::columns::status>`,
      testDefinition: {
        id: 'def-enum',
        fullyQualifiedName: 'columnValueLengthsToBeBetween',
      },
      parameterValues: [{ name: 'matchEnum', value: 'ALL' }],
      tags: [],
    } as unknown as TestCase;

    const table = {
      id: 'table-5',
      name: 'payments',
      fullyQualifiedName: TABLE_FQN,
      columns: [{ name: 'status', dataType: 'VARCHAR' }],
    } as unknown as Table;

    beforeEach(() => {
      mockGetTestDefinitionById.mockResolvedValue(definition);
      mockGetTableDetailsByFQN.mockResolvedValue(table);
      mockGetListTestDefinitions.mockResolvedValue({
        data: [definition],
        paging: { total: 1 },
      } as never);
    });

    it('displays the saved enum option selected in the trigger', async () => {
      // `table` passed explicitly — see the FINDING note above the describe
      // block.
      renderDrawer({ testCase, table });

      await waitFor(() => {
        expect(mockGetTestDefinitionById).toHaveBeenCalledWith('def-enum');
      });

      const matchEnumField = await screen.findByTestId(
        'parameter-matchEnum',
        {},
        PARAM_FIELD_TIMEOUT
      );

      // The field renders both a visible react-aria trigger button (its
      // selected item's label as a <p>) and a visually-hidden native
      // <select> mirror (for form semantics) whose <option> also has text
      // "ALL" — scope to the trigger button to assert what a user actually
      // sees, not the a11y-only shadow select.
      await waitFor(() => {
        const trigger = within(matchEnumField).getByRole('button');

        expect(within(trigger).getByText('ALL')).toBeInTheDocument();
      });
    });
  });

  describe('6. Tags/glossary', () => {
    const TABLE_FQN = 'service.db.schema.accounts';

    const definition = {
      id: 'def-tags',
      name: 'tableRowCountToEqual',
      fullyQualifiedName: 'tableRowCountToEqual',
      parameterDefinition: [{ name: 'value', dataType: TestDataType.Int }],
    } as unknown as TestDefinition;

    const testCase = {
      id: 'tc-6',
      name: 'accounts_row_count',
      entityLink: `<#E::table::${TABLE_FQN}>`,
      testDefinition: {
        id: 'def-tags',
        fullyQualifiedName: 'tableRowCountToEqual',
      },
      parameterValues: [{ name: 'value', value: '5' }],
      tags: [
        {
          tagFQN: 'PII.Sensitive',
          source: 'Classification',
          labelType: 'Manual',
          state: 'Confirmed',
        },
        {
          tagFQN: 'GlossaryTerm.AccountBalance',
          name: 'AccountBalance',
          source: 'Glossary',
          labelType: 'Manual',
          state: 'Confirmed',
        },
      ],
    } as unknown as TestCase;

    beforeEach(() => {
      mockGetTestDefinitionById.mockResolvedValue(definition);
      mockGetTableDetailsByFQN.mockResolvedValue({
        id: 'table-6',
        name: 'accounts',
        fullyQualifiedName: TABLE_FQN,
        columns: [],
      } as unknown as Table);
      mockGetListTestDefinitions.mockResolvedValue({
        data: [definition],
        paging: { total: 1 },
      } as never);
    });

    it('displays the saved classification tag and glossary term as chips', async () => {
      renderDrawer({ testCase });

      await waitFor(() => {
        expect(mockGetTestDefinitionById).toHaveBeenCalledWith('def-tags');
      });

      const tagsSelector = await screen.findByTestId('tags-selector');
      await waitFor(() => {
        expect(
          within(tagsSelector).getByText('PII.Sensitive')
        ).toBeInTheDocument();
      });

      const glossarySelector = await screen.findByTestId(
        'glossary-terms-selector'
      );

      expect(
        within(glossarySelector).getByText('AccountBalance')
      ).toBeInTheDocument();
    });
  });

  describe('7. Custom-SQL sqlExpression param (optional, cheap)', () => {
    const TABLE_FQN = 'service.db.schema.orders';

    const definition = {
      id: 'def-sql',
      name: 'tableCustomSQLQuery',
      fullyQualifiedName: 'tableCustomSQLQuery',
      parameterDefinition: [
        {
          name: 'sqlExpression',
          displayName: 'SQL Expression',
          dataType: TestDataType.String,
          required: true,
        },
      ],
    } as unknown as TestDefinition;

    const testCase = {
      id: 'tc-7',
      name: 'orders_custom_sql',
      entityLink: `<#E::table::${TABLE_FQN}>`,
      testDefinition: {
        id: 'def-sql',
        fullyQualifiedName: 'tableCustomSQLQuery',
      },
      parameterValues: [
        { name: 'sqlExpression', value: 'SELECT * FROM orders' },
      ],
      tags: [],
    } as unknown as TestCase;

    const table = {
      id: 'table-7',
      name: 'orders',
      fullyQualifiedName: TABLE_FQN,
      columns: [],
    } as unknown as Table;

    beforeEach(() => {
      mockGetTestDefinitionById.mockResolvedValue(definition);
      mockGetTableDetailsByFQN.mockResolvedValue(table);
      mockGetListTestDefinitions.mockResolvedValue({
        data: [definition],
        paging: { total: 1 },
      } as never);
    });

    it('renders the sqlExpression field for the saved custom-SQL test case', async () => {
      // `table` passed explicitly — see the FINDING note above the describe
      // block.
      renderDrawer({ testCase, table });

      await waitFor(() => {
        expect(mockGetTestDefinitionById).toHaveBeenCalledWith('def-sql');
      });

      // NOTE: SqlExpressionField's CodeEditor is a lazily-loaded CodeMirror
      // instance; CodeMirror renders its editable content into its own
      // internal DOM structure that RTL's text queries do not reliably
      // resolve in JSDOM (no real layout/measurement). The RHF value shape
      // for sqlExpression (plain string) is already covered at the unit
      // level by transformTestCaseFormData.test.ts, so this case is limited
      // to confirming the field mounts for a custom-SQL edit.
      const sqlField = await screen.findByTestId(
        'parameter-sqlExpression',
        {},
        PARAM_FIELD_TIMEOUT
      );

      expect(sqlField).toBeInTheDocument();
    });
  });

  describe('8. Plain column param (optional, cheap)', () => {
    const TABLE_FQN = 'service.db.schema.orders';

    const definition = {
      id: 'def-column-param',
      name: 'tableRowInsertedCountToBeBetween',
      fullyQualifiedName: 'tableRowInsertedCountToBeBetween',
      parameterDefinition: [
        {
          name: 'columnName',
          displayName: 'Column Name',
          dataType: TestDataType.String,
        },
      ],
    } as unknown as TestDefinition;

    const testCase = {
      id: 'tc-8',
      name: 'orders_inserted_count',
      entityLink: `<#E::table::${TABLE_FQN}>`,
      testDefinition: {
        id: 'def-column-param',
        fullyQualifiedName: 'tableRowInsertedCountToBeBetween',
      },
      parameterValues: [{ name: 'columnName', value: 'created_at' }],
      tags: [],
    } as unknown as TestCase;

    const table = {
      id: 'table-8',
      name: 'orders',
      fullyQualifiedName: TABLE_FQN,
      columns: [{ name: 'created_at', dataType: 'DATE' }],
    } as unknown as Table;

    beforeEach(() => {
      mockGetTestDefinitionById.mockResolvedValue(definition);
      mockGetTableDetailsByFQN.mockResolvedValue(table);
      mockGetListTestDefinitions.mockResolvedValue({
        data: [definition],
        paging: { total: 1 },
      } as never);
    });

    it('displays the saved partition column selected', async () => {
      // `table` passed explicitly — see the FINDING note above the describe
      // block.
      renderDrawer({ testCase, table });

      await waitFor(() => {
        expect(mockGetTestDefinitionById).toHaveBeenCalledWith(
          'def-column-param'
        );
      });

      const columnNameField = await screen.findByTestId(
        'parameter-columnName',
        {},
        PARAM_FIELD_TIMEOUT
      );

      // columnName is classified as a partition-column FieldTypes.SELECT for
      // this definition (see isSelectParam's PARTITION_TEST_DEFINITION_NAME
      // check) once `selectedTableData`/`table` resolves with columns.
      await waitFor(() => {
        const trigger = within(columnNameField).getByRole('button');

        expect(within(trigger).getByText('created_at')).toBeInTheDocument();
      });
    });
  });

  describe('9. Column-level edit without table prop (async columns)', () => {
    const TABLE_FQN = 'service.db.schema.customers';

    const definition = {
      id: 'def-col-set-async',
      name: 'columnValuesToBeInSet',
      fullyQualifiedName: 'columnValuesToBeInSet',
      parameterDefinition: [
        {
          name: 'allowedValues',
          displayName: 'Allowed Values',
          dataType: TestDataType.Set,
        },
      ],
    } as unknown as TestDefinition;

    const testCase = {
      id: 'tc-9',
      name: 'email_domain_in_set_async',
      entityLink: `<#E::table::${TABLE_FQN}::columns::email_domain>`,
      testDefinition: {
        id: 'def-col-set-async',
        fullyQualifiedName: 'columnValuesToBeInSet',
      },
      parameterValues: [
        {
          name: 'allowedValues',
          value: JSON.stringify(['gmail.com']),
        },
      ],
      tags: [],
    } as unknown as TestCase;

    beforeEach(() => {
      mockGetTestDefinitionById.mockResolvedValue(definition);
      mockGetListTestDefinitions.mockResolvedValue({
        data: [definition],
        paging: { total: 1 },
      } as never);
    });

    // Regression guard: opened without a `table` prop (incident manager,
    // data-quality page, result tab), the table's columns load asynchronously
    // via getTableDetailsByFQN. The saved `selectedColumn` is prefilled
    // immediately, so with the fetch still pending the column-options list is
    // empty. TestCaseFormBody folds the prefilled column into `columnOptions`
    // so the react-aria Select keeps the selection; without that, the trigger
    // renders the placeholder because its selectedKey has no matching option.
    it('keeps the prefilled column visible while columns are still loading', async () => {
      // Never-resolving fetch pins the "columns not loaded yet" window open.
      mockGetTableDetailsByFQN.mockReturnValue(
        new Promise(() => undefined) as never
      );

      renderDrawer({ testCase });

      const columnSelect = await screen.findByTestId('selectedColumn');
      await waitFor(() => {
        const trigger = within(columnSelect).getByRole('button');

        expect(within(trigger).getByText('email_domain')).toBeInTheDocument();
      });
    });

    // Guards the table-less param-render path: opened in edit mode without a
    // `table` prop, `selectedTableData` transitions undefined -> table when
    // getTableDetailsByFQN resolves. The parameter fields (gated on
    // `selectedTestDefinition`) must still render after that transition — i.e.
    // the resolve must not leave `selectedTestDefinition` reset to undefined.
    it('renders parameter fields after the async table resolves (no table prop)', async () => {
      mockGetTableDetailsByFQN.mockResolvedValue({
        id: 'table-9',
        name: 'customers',
        fullyQualifiedName: TABLE_FQN,
        columns: [
          { name: 'id', dataType: 'BIGINT' },
          { name: 'email_domain', dataType: 'VARCHAR' },
        ],
      } as unknown as Table);

      renderDrawer({ testCase });

      const row0 = await screen.findByTestId(
        'parameter-allowedValues-0',
        {},
        PARAM_FIELD_TIMEOUT
      );

      expect(row0.querySelector('input')).toHaveValue('gmail.com');
    });
  });
});
