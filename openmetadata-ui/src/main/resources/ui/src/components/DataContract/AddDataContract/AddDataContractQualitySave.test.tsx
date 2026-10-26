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
import '@testing-library/jest-dom';
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { applyPatch } from 'fast-json-patch';
import { EntityType } from '../../../enums/entity.enum';
import { TestCaseType } from '../../../enums/TestSuite.enum';
import {
  DataContract,
  EntityStatus,
  SemanticsRule,
} from '../../../generated/entity/data/dataContract';
import { Table } from '../../../generated/entity/data/table';
import { EntityReference } from '../../../generated/entity/type';
import { TestCase } from '../../../generated/tests/testCase';
import { updateContract } from '../../../rest/contractAPI';
import { showSuccessToast } from '../../../utils/ToastUtils';
import AddDataContract from './AddDataContract';

// Mock the REST API for contracts
jest.mock('../../../rest/contractAPI', () => ({
  createContract: jest.fn().mockResolvedValue({}),
  updateContract: jest.fn().mockResolvedValue({}),
}));

// Mock ToastUtils (used by both AddDataContract and ContractQualityFormTab)
jest.mock('../../../utils/ToastUtils', () => ({
  showErrorToast: jest.fn(),
  showSuccessToast: jest.fn(),
}));

// Mock DataContractUtils — only the routing/tab helpers and the test-type
// label map used by the real ContractQualityFormTab; the contract filtering
// helpers are exercised for real so the save flow is authentic.
jest.mock('../../../utils/DataContract/DataContractUtils', () => ({
  getUpdatedContractDetails: jest.fn((contract, formValues) => ({
    ...contract,
    ...formValues,
  })),
  getDataContractTabByEntity: jest.fn().mockReturnValue([
    0, // CONTRACT_DETAIL
    1, // TERMS_OF_SERVICE
    2, // SCHEMA
    3, // SEMANTICS
    4, // SECURITY
    5, // QUALITY
    6, // SLA
  ]),
  getContractTabLabel: jest.fn(),
  ContractTestTypeLabelMap: {
    all: 'label.all',
    table: 'label.table',
    column: 'label.column',
  },
}));

// Mock the generic context to provide a table with an FQN (needed by
// ContractQualityFormTab.fetchAllTests via generateEntityLink)
jest.mock('../../Customization/GenericProvider/GenericContext', () => ({
  useGenericContext: jest.fn(() => ({
    data: {
      id: 'table-id',
      name: 'test-table',
      fullyQualifiedName: 'service.database.schema.table',
    } as Table,
  })),
}));

jest.mock('../../../utils/useRequiredParams', () => ({
  useRequiredParams: jest.fn().mockImplementation(() => ({
    entityType: 'table',
  })),
}));

// Mock the test-case REST API so the Quality tab's server-paged list is
// controlled. We return two on-page test cases; the off-page expectation
// (id "off-page-test") is deliberately NOT in the fetched list, mirroring a
// test case that lives on page 2, is excluded by a filter, or was deleted.
jest.mock('../../../rest/testAPI', () => ({
  getListTestCaseBySearch: jest.fn().mockResolvedValue({
    data: [
      {
        id: 'test-1',
        name: 'Test Case 1',
        testCaseType: TestCaseType.table,
        fullyQualifiedName: 'test.case.1',
        updatedAt: 1640995200000,
        testCaseResult: { result: 'Success', timestamp: 1640995200000 },
      },
      {
        id: 'test-2',
        name: 'Test Case 2',
        testCaseType: TestCaseType.column,
        fullyQualifiedName: 'test.case.2',
        updatedAt: 1640995200000,
        testCaseResult: { result: 'Failed', timestamp: 1640995200000 },
      },
    ] as unknown as TestCase[],
    paging: { total: 2 },
  }),
}));

// Mock usePaging (used by ContractQualityFormTab)
jest.mock('../../../hooks/paging/usePaging', () => ({
  usePaging: jest.fn(() => ({
    currentPage: 1,
    pageSize: 10,
    handlePageChange: jest.fn(),
    handlePageSizeChange: jest.fn(),
    showPagination: true,
    paging: { total: 2 },
    handlePagingChange: jest.fn(),
  })),
}));

// Mock TableV2 with preserveSelectedRowKeys support — mirrors the real
// TableV2.handleSelectionChange contract: off-page keys from
// selectedRowKeys survive while on-page toggles update the on-page subset.
jest.mock('../../common/Table/TableV2', () => {
  return function MockTable({
    columns,
    dataSource,
    loading,
    rowSelection,
    rowKey,
  }: {
    columns?: unknown[];
    dataSource?: Array<{ id: string; name: string; [key: string]: unknown }>;
    loading?: boolean;
    rowSelection?: {
      selectedRowKeys?: string[];
      onChange?: (keys: string[]) => void;
      preserveSelectedRowKeys?: boolean;
    };
    rowKey: string;
  }) {
    const handleSelect = (id: string) => {
      if (!rowSelection?.onChange) {
        return;
      }

      if (rowSelection.preserveSelectedRowKeys) {
        const currentPageKeys = new Set(
          (dataSource ?? []).map((item) => String(item[rowKey]))
        );
        const currentSelected = rowSelection.selectedRowKeys ?? [];
        const offPageSelected = currentSelected.filter(
          (key) => !currentPageKeys.has(String(key))
        );
        const onPageSelected = currentSelected.filter((key) =>
          currentPageKeys.has(String(key))
        );
        const isSelected = onPageSelected.includes(id);
        const newOnPage = isSelected
          ? onPageSelected.filter((key) => key !== id)
          : [...onPageSelected, id];

        rowSelection.onChange([...offPageSelected, ...newOnPage]);
      } else {
        rowSelection.onChange([id]);
      }
    };

    return (
      <div data-testid="mock-table">
        <div>Loading: {loading ? 'true' : 'false'}</div>
        <div>Row Selection: {rowSelection ? 'enabled' : 'disabled'}</div>
        <div>
          Preserve: {rowSelection?.preserveSelectedRowKeys ? 'true' : 'false'}
        </div>
        <div>Data Source Length: {dataSource?.length || 0}</div>
        <div>Columns: {columns?.length || 0}</div>
        {dataSource?.map((item) => (
          <div data-testid={`table-row-${item.id}`} key={String(item[rowKey])}>
            <button
              data-testid={`select-row-${item.id}`}
              onClick={() => handleSelect(item.id)}>
              Select {item.name}
            </button>
          </div>
        ))}
      </div>
    );
  };
});

// Mock the TestCaseFormDrawer (lazy-loaded by ContractQualityFormTab)
jest.mock(
  '../../DataQuality/AddDataQualityTest/components/TestCaseFormDrawer',
  () => {
    return function MockTestCaseFormDrawer({
      open,
      onClose,
    }: {
      open: boolean;
      onClose: () => void;
      onFormSubmit: () => void;
    }) {
      if (!open) {
        return null;
      }

      return (
        <div data-testid="test-case-form">
          <button data-testid="cancel-test-form" onClick={onClose}>
            Cancel
          </button>
        </div>
      );
    };
  }
);

// Mock the other form tabs so the test stays focused on the Quality tab
jest.mock('../ContractDetailFormTab/ContractDetailFormTab', () => ({
  ContractDetailFormTab: jest.fn().mockImplementation(({ onNext }) => (
    <div>
      <h2>Contract Details</h2>
      <button onClick={onNext}>Next</button>
    </div>
  )),
}));

jest.mock('../ContractSchemaFormTab/ContractScehmaFormTab', () => ({
  ContractSchemaFormTab: jest.fn().mockImplementation(({ onPrev, onNext }) => (
    <div>
      <h2>Contract Schema</h2>
      <button onClick={onPrev}>Previous</button>
      <button onClick={onNext}>Next</button>
    </div>
  )),
}));

jest.mock('../ContractSemanticFormTab/ContractSemanticFormTab', () => ({
  ContractSemanticFormTab: jest
    .fn()
    .mockImplementation(({ onPrev, onNext }) => (
      <div>
        <h2>Contract Semantics</h2>
        <button onClick={onPrev}>Previous</button>
        <button onClick={onNext}>Next</button>
      </div>
    )),
}));

jest.mock('../ContractSecurityFormTab/ContractSecurityFormTab', () => ({
  ContractSecurityFormTab: jest
    .fn()
    .mockImplementation(({ onPrev, onNext }) => (
      <div>
        <h2>Contract Security</h2>
        <button onClick={onPrev}>Previous</button>
        <button onClick={onNext}>Next</button>
      </div>
    )),
}));

jest.mock('../ContractSLAFormTab/ContractSLAFormTab', () => ({
  ContractSLAFormTab: jest.fn().mockImplementation(({ onPrev }) => (
    <div>
      <h2>Contract SLA</h2>
      <button onClick={onPrev}>Previous</button>
    </div>
  )),
}));

// NOTE: ContractQualityFormTab is NOT mocked — this file exercises the real
// component with a mocked TableV2 and test-case API, verifying the full
// AddDataContract → ContractQualityFormTab → onChange → save round-trip.

const mockOnCancel = jest.fn();
const mockOnSave = jest.fn();

const mockContract: DataContract = {
  id: 'contract-1',
  name: 'Test Contract',
  description: 'Test Description',
  entity: {
    id: 'table-id',
    type: EntityType.TABLE,
  } as EntityReference,
  entityStatus: EntityStatus.Approved,
  semantics: [] as SemanticsRule[],
  qualityExpectations: [] as EntityReference[],
  schema: [],
};

// An off-page quality expectation whose test case is NOT in the fetched list
// (lives on a later page, is excluded by a filter, or was deleted since save).
const offPageExpectation: EntityReference = {
  id: 'off-page-test',
  name: 'Off Page Test Case',
  description: 'A test case not in the current page/filter',
  type: EntityType.TEST_CASE,
};

const contractWithQuality: DataContract = {
  ...mockContract,
  qualityExpectations: [
    {
      id: 'test-1',
      name: 'Test Case 1',
      description: 'First test case',
      type: EntityType.TEST_CASE,
    },
    offPageExpectation,
  ],
};

describe('AddDataContract — Quality Tab save integration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('preserves off-page quality expectations through a real form toggle and save', async () => {
    render(
      <AddDataContract
        contract={contractWithQuality}
        onCancel={mockOnCancel}
        onSave={mockOnSave}
      />
    );

    // Navigate to the Quality tab so the real ContractQualityFormTab mounts
    const qualityTab = screen.getByRole('tab', { name: 'label.quality' });

    await act(async () => {
      fireEvent.click(qualityTab);
    });

    // Wait for the test cases to be fetched and the table to render
    await waitFor(() => {
      expect(screen.getByTestId('select-row-test-2')).toBeInTheDocument();
    });

    // The real ContractQualityFormTab should have loaded the two on-page test
    // cases. The off-page expectation ("off-page-test") is in selectedQuality
    // and initialValues but NOT in the fetched list.
    expect(screen.getByText('Preserve: true')).toBeInTheDocument();

    // Click a row that is in the fetched list but not currently selected.
    // The real TableV2 mock with preserveSelectedRowKeys will keep the
    // off-page key ("off-page-test") in the selection and add "test-2".
    await act(async () => {
      fireEvent.click(screen.getByTestId('select-row-test-2'));
    });

    // Save the contract — this triggers the update path (contract prop is set)
    const saveButton = screen.getByTestId('save-contract-btn');

    await act(async () => {
      fireEvent.click(saveButton);
    });

    // The updateContract call should include a JSON patch that, when applied
    // to the original contract, yields qualityExpectations preserving the
    // off-page expectation. This is the real save round-trip the review
    // asked for: the form toggled a checkbox, onChange flowed through
    // AddDataContract's formValues, and the patch sent to updateContract
    // preserves the off-page test case rather than dropping it.
    expect(updateContract).toHaveBeenCalledTimes(1);

    const [contractId, patch] = (updateContract as jest.Mock).mock.calls[0];

    expect(contractId).toBe('contract-1');

    // Apply the JSON patch to a deep clone of the original contract to
    // reconstruct what the server would receive.
    const patched = applyPatch(
      JSON.parse(JSON.stringify(contractWithQuality)),
      patch as Parameters<typeof applyPatch>[1]
    ).newDocument as DataContract;

    expect(patched.qualityExpectations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'test-1',
          type: EntityType.TEST_CASE,
        }),
        expect.objectContaining({
          id: 'test-2',
          type: EntityType.TEST_CASE,
        }),
        // The off-page expectation survives the toggle and save — the bug
        // being fixed was that it would be silently dropped.
        expect.objectContaining({
          id: 'off-page-test',
          name: 'Off Page Test Case',
          type: EntityType.TEST_CASE,
        }),
      ])
    );

    expect(showSuccessToast).toHaveBeenCalledWith(
      'message.data-contract-saved-successfully'
    );
    expect(mockOnSave).toHaveBeenCalled();
  });

  it('preserves off-page quality expectations when deselecting an on-page row and saving', async () => {
    render(
      <AddDataContract
        contract={contractWithQuality}
        onCancel={mockOnCancel}
        onSave={mockOnSave}
      />
    );

    const qualityTab = screen.getByRole('tab', { name: 'label.quality' });

    await act(async () => {
      fireEvent.click(qualityTab);
    });

    await waitFor(() => {
      expect(screen.getByTestId('select-row-test-1')).toBeInTheDocument();
    });

    // Deselect the on-page row "test-1" (it was seeded as selected).
    // The off-page "off-page-test" must survive in the saved qualityExpectations.
    await act(async () => {
      fireEvent.click(screen.getByTestId('select-row-test-1'));
    });

    const saveButton = screen.getByTestId('save-contract-btn');

    await act(async () => {
      fireEvent.click(saveButton);
    });

    expect(updateContract).toHaveBeenCalledTimes(1);

    const [, patch] = (updateContract as jest.Mock).mock.calls[0];

    // Apply the JSON patch to a deep clone to check the saved state.
    const patched = applyPatch(
      JSON.parse(JSON.stringify(contractWithQuality)),
      patch as Parameters<typeof applyPatch>[1]
    ).newDocument as DataContract;

    // The off-page expectation is preserved even though an on-page row was deselected
    expect(patched.qualityExpectations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'off-page-test',
          name: 'Off Page Test Case',
          type: EntityType.TEST_CASE,
        }),
      ])
    );
    // The deselected on-page row is gone
    expect(patched.qualityExpectations).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ id: 'test-1' })])
    );
  });
});
