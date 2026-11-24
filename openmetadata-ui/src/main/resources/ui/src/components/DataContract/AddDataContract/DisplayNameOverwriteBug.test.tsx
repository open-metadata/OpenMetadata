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
import { act, fireEvent, render, screen } from '@testing-library/react';
import { EDataContractTab } from '../../../constants/DataContract.constants';
import { EntityType } from '../../../enums/entity.enum';
import {
  DataContract,
  SemanticsRule,
} from '../../../generated/entity/data/dataContract';
import { Column, Table } from '../../../generated/entity/data/table';
import { EntityStatus } from '../../../generated/entity/domains/dataProduct';
import { EntityReference } from '../../../generated/entity/type';
import { createContract, updateContract } from '../../../rest/contractAPI';
import { showErrorToast, showSuccessToast } from '../../../utils/ToastUtils';
import AddDataContract from './AddDataContract';

jest.mock('../../../rest/contractAPI', () => ({
  createContract: jest.fn().mockResolvedValue({}),
  updateContract: jest.fn().mockResolvedValue({}),
}));

jest.mock('../../../utils/ToastUtils', () => ({
  showErrorToast: jest.fn(),
  showSuccessToast: jest.fn(),
}));

jest.mock('../../../utils/DataContract/DataContractUtils', () => ({
  getUpdatedContractDetails: jest.fn((contract, formValues) => ({
    ...contract,
    ...formValues,
  })),
  getDataContractTabByEntity: jest
    .fn()
    .mockReturnValue([
      EDataContractTab.CONTRACT_DETAIL,
      EDataContractTab.TERMS_OF_SERVICE,
      EDataContractTab.SCHEMA,
      EDataContractTab.SEMANTICS,
      EDataContractTab.SECURITY,
      EDataContractTab.QUALITY,
      EDataContractTab.SLA,
    ]),
  getContractTabLabel: jest.fn(),
}));

jest.mock('../../Customization/GenericProvider/GenericContext', () => ({
  useGenericContext: jest.fn(() => ({
    data: {
      id: 'table-id',
      name: 'test-table',
    } as Table,
  })),
}));

jest.mock('../../../utils/useRequiredParams', () => ({
  useRequiredParams: jest.fn().mockImplementation(() => ({
    entityType: 'table',
  })),
}));

/**
 * ContractDetailFormTab stub: mirrors the real component's contract-title field,
 * which is initialized from `getEntityName(initialValues)` (i.e. `displayName || name`).
 * The user-facing "title" field is what would, on edit, push `onChange({ name })`.
 * To exercise the bug we expose two distinct buttons — one that simulates the user
 * editing ONLY an unrelated field (description), and one that simulates the user
 * editing the contract title — so each test can choose the precise edit shape.
 *
 * NOTE: We intentionally do NOT fire `onChange({ name })` until the user explicitly
 * clicks the "Edit title" button — this mirrors the real Ant Design behavior where
 * `Form.setFieldsValue` does not trigger `onValuesChange`.
 */
jest.mock('../ContractDetailFormTab/ContractDetailFormTab', () => ({
  ContractDetailFormTab: jest
    .fn()
    .mockImplementation(({ onChange, onNext }) => (
      <div>
        <h2>Contract Details</h2>
        <button
          data-testid="edit-description-only"
          onClick={() => onChange({ description: 'Updated description' })}>
          Edit Description Only
        </button>
        <button
          data-testid="edit-title"
          onClick={() => onChange({ name: 'New Contract Title' })}>
          Edit Title
        </button>
        <button onClick={onNext}>Next</button>
      </div>
    )),
}));

jest.mock('../ContractQualityFormTab/ContractQualityFormTab', () => ({
  ContractQualityFormTab: jest
    .fn()
    .mockImplementation(({ onChange, onNext }) => (
      <div>
        <h2>Contract Quality</h2>
        <button onClick={() => onChange({ qualityExpectations: [] })}>
          Change
        </button>
        <button onClick={onNext}>Next</button>
      </div>
    )),
}));
jest.mock('../ContractSchemaFormTab/ContractScehmaFormTab', () => ({
  ContractSchemaFormTab: jest
    .fn()
    .mockImplementation(({ onChange, onNext, onPrev }) => (
      <div>
        <h2>Contract Schema</h2>
        <button onClick={onPrev}>Previous</button>
        <button onClick={() => onChange({ schema: [] })}>Change</button>
        <button onClick={onNext}>Next</button>
      </div>
    )),
}));

jest.mock('../ContractSemanticFormTab/ContractSemanticFormTab', () => ({
  ContractSemanticFormTab: jest
    .fn()
    .mockImplementation(({ onChange, onNext, onPrev }) => (
      <div>
        <h2>Contract Semantics</h2>
        <button onClick={onPrev}>Previous</button>
        <button onClick={() => onChange({ semantics: [] })}>Change</button>
        <button onClick={onNext}>Next</button>
      </div>
    )),
}));

jest.mock('../ContractSecurityFormTab/ContractSecurityFormTab', () => ({
  ContractSecurityFormTab: jest
    .fn()
    .mockImplementation(({ onChange, onNext, onPrev }) => (
      <div>
        <h2>Contract Security</h2>
        <button onClick={onPrev}>Previous</button>
        <button onClick={() => onChange({ security: undefined })}>
          Change
        </button>
        <button onClick={onNext}>Next</button>
      </div>
    )),
}));

jest.mock('../ContractSLAFormTab/ContractSLAFormTab', () => ({
  ContractSLAFormTab: jest
    .fn()
    .mockImplementation(({ onChange, onNext, onPrev }) => (
      <div>
        <h2>Contract SLA</h2>
        <button onClick={onPrev}>Previous</button>
        <button onClick={() => onChange({ sla: [] })}>Change</button>
        <button onClick={onNext}>Next</button>
      </div>
    )),
}));

const mockOnCancel = jest.fn();
const mockOnSave = jest.fn();

/**
 * A contract whose sanitized `name` differs from its human-readable `displayName`.
 * This is the shape produced by the OM-YAML import path or direct REST creates
 * with distinct `name` and `displayName`. The bug silently overwrote `displayName`
 * with `name` on every save of an unrelated field.
 */
const divergentContract: DataContract = {
  id: 'contract-1',
  name: 'customer_orders_contract',
  displayName: 'Customer Orders Contract',
  description: 'Original description',
  entity: {
    id: 'table-id',
    type: EntityType.TABLE,
  } as EntityReference,
  entityStatus: EntityStatus.Approved,
  semantics: [] as SemanticsRule[],
  qualityExpectations: [] as EntityReference[],
  schema: [] as Column[],
};

/** Contract where `name === displayName` (the UI-create-flow case). */
const alignedContract: DataContract = {
  ...divergentContract,
  name: 'Customer Orders Contract',
  displayName: 'Customer Orders Contract',
};

const findPatchOpsForPath = (
  ops: { op: string; path: string; value?: unknown }[],
  path: string
) => ops.filter((op) => op.path === path);

describe('AddDataContract displayName overwrite bug (regression)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('does NOT emit a /displayName replace when only description is edited', async () => {
    render(
      <AddDataContract
        contract={divergentContract}
        onCancel={mockOnCancel}
        onSave={mockOnSave}
      />
    );

    // Simulate the user editing ONLY the description field (not the title).
    await act(async () => {
      fireEvent.click(screen.getByTestId('edit-description-only'));
    });

    await act(async () => {
      fireEvent.click(screen.getByTestId('save-contract-btn'));
    });

    expect(updateContract).toHaveBeenCalledTimes(1);

    const [contractId, patch] = (updateContract as jest.Mock).mock.calls[0] as [
      string,
      { op: string; path: string; value?: unknown }[]
    ];

    expect(contractId).toBe('contract-1');
    expect(Array.isArray(patch)).toBe(true);

    // The bug previously emitted a spurious /displayName replace here. The fix
    // must ensure only the legitimately-edited field is in the patch.
    const displayNameOps = findPatchOpsForPath(patch, '/displayName');

    expect(displayNameOps).toEqual([]);

    // Sanity: the description edit is present.
    const descriptionOps = findPatchOpsForPath(patch, '/description');

    expect(descriptionOps).toHaveLength(1);
    expect(descriptionOps[0].op).toBe('replace');
    expect(descriptionOps[0].value).toBe('Updated description');

    // And no /name replace either (user did not touch the title).
    const nameOps = findPatchOpsForPath(patch, '/name');

    expect(nameOps).toEqual([]);

    expect(showSuccessToast).toHaveBeenCalledWith(
      'message.data-contract-saved-successfully'
    );
    expect(mockOnSave).toHaveBeenCalled();
  });

  it('emits a /displayName replace with the new title when the user edits the contract title', async () => {
    render(
      <AddDataContract
        contract={divergentContract}
        onCancel={mockOnCancel}
        onSave={mockOnSave}
      />
    );

    // User edits the title (which the form wires to the `name` field).
    await act(async () => {
      fireEvent.click(screen.getByTestId('edit-title'));
    });

    await act(async () => {
      fireEvent.click(screen.getByTestId('save-contract-btn'));
    });

    expect(updateContract).toHaveBeenCalledTimes(1);

    const [, patch] = (updateContract as jest.Mock).mock.calls[0] as [
      string,
      { op: string; path: string; value?: unknown }[]
    ];

    // Editing the title must propagate to /displayName (this preserves the
    // intended behavior of title edits — the fix does NOT remove this).
    const displayNameOps = findPatchOpsForPath(patch, '/displayName');

    expect(displayNameOps).toHaveLength(1);
    expect(displayNameOps[0].op).toBe('replace');
    expect(displayNameOps[0].value).toBe('New Contract Title');
  });

  it('does NOT emit a /displayName replace when name === displayName and only description is edited', async () => {
    render(
      <AddDataContract
        contract={alignedContract}
        onCancel={mockOnCancel}
        onSave={mockOnSave}
      />
    );

    await act(async () => {
      fireEvent.click(screen.getByTestId('edit-description-only'));
    });

    await act(async () => {
      fireEvent.click(screen.getByTestId('save-contract-btn'));
    });

    expect(updateContract).toHaveBeenCalledTimes(1);

    const [, patch] = (updateContract as jest.Mock).mock.calls[0] as [
      string,
      { op: string; path: string; value?: unknown }[]
    ];

    // With name === displayName, an unrelated-field edit must not touch
    // /displayName. (This case was already a no-op before the fix, but pin it
    // so that the conditional displayName logic never regresses for the common
    // UI-created-contract shape.)
    const displayNameOps = findPatchOpsForPath(patch, '/displayName');

    expect(displayNameOps).toEqual([]);

    const descriptionOps = findPatchOpsForPath(patch, '/description');

    expect(descriptionOps).toHaveLength(1);
    expect(descriptionOps[0].value).toBe('Updated description');
  });

  it('preserves create-branch behavior: still sets displayName from formValues.name on create', async () => {
    // No `contract` prop => create branch.
    render(<AddDataContract onCancel={mockOnCancel} onSave={mockOnSave} />);

    // On create, the title field is the only source of both names; the user
    // always enters a title to enable save.
    await act(async () => {
      fireEvent.click(screen.getByTestId('edit-title'));
    });

    await act(async () => {
      fireEvent.click(screen.getByTestId('save-contract-btn'));
    });

    expect(createContract).toHaveBeenCalledTimes(1);

    const [payload] = (createContract as jest.Mock).mock.calls[0] as [
      DataContract
    ];

    // Create branch intentionally unconditionally mirrors the title to
    // displayName — the fix must NOT touch this branch.
    expect(payload.displayName).toBe('New Contract Title');
    expect(payload.name).toBe('New Contract Title');
  });

  it('shows an error toast and does not call onSave when updateContract fails', async () => {
    const mockError = new Error('Update failed');
    (updateContract as jest.Mock).mockRejectedValueOnce(mockError);

    render(
      <AddDataContract
        contract={divergentContract}
        onCancel={mockOnCancel}
        onSave={mockOnSave}
      />
    );

    await act(async () => {
      fireEvent.click(screen.getByTestId('edit-description-only'));
    });

    await act(async () => {
      fireEvent.click(screen.getByTestId('save-contract-btn'));
    });

    expect(showErrorToast).toHaveBeenCalledWith(mockError);
    expect(mockOnSave).not.toHaveBeenCalled();
  });
});
