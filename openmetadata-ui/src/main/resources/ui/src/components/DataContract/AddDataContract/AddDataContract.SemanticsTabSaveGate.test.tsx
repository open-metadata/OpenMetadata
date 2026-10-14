/*
 *  Copyright 2026 Collate.
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
  EntityStatus,
  SemanticsRule,
} from '../../../generated/entity/data/dataContract';
import { Column, Table } from '../../../generated/entity/data/table';
import { EntityReference } from '../../../generated/entity/type';
import { createContract, updateContract } from '../../../rest/contractAPI';
import AddDataContract from './AddDataContract';

/**
 * This integration test renders the REAL `AddDataContract` with the REAL
 * `ContractSemanticFormTab` (only the sibling tabs, QueryBuilder, REST utils,
 * and context hooks are stubbed). It verifies the end-to-end regression:
 * merely visiting the Semantics tab must not enable the Save button nor inject
 * a spurious `semantics: []` op into the request body.
 */

jest.mock('../../../rest/contractAPI', () => ({
  createContract: jest.fn().mockResolvedValue({}),
  updateContract: jest.fn().mockResolvedValue({}),
}));

jest.mock('../../../utils/ToastUtils', () => ({
  showErrorToast: jest.fn(),
  showSuccessToast: jest.fn(),
}));

jest.mock('../../../utils/DataContract/DataContractUtils', () => ({
  getDataContractTabByEntity: jest.fn(() => [
    EDataContractTab.CONTRACT_DETAIL,
    EDataContractTab.TERMS_OF_SERVICE,
    EDataContractTab.SCHEMA,
    EDataContractTab.SEMANTICS,
    EDataContractTab.SECURITY,
    EDataContractTab.QUALITY,
    EDataContractTab.SLA,
  ]),
  getContractTabLabel: jest.fn(),
  getSematicRuleFields: jest.fn(() => ({
    testField: { label: 'Test Field', type: 'text' },
  })),
  semanticRuleValidator: jest.fn(),
}));

jest.mock('../../common/QueryBuilder/QueryBuilder', () => {
  return function MockQueryBuilder() {
    return <div data-testid="query-builder-widget">Query Builder Widget</div>;
  };
});

jest.mock('../../Customization/GenericProvider/GenericContext', () => ({
  useGenericContext: jest.fn(() => ({
    data: {
      id: 'table-id',
      name: 'test-table',
    } as Table,
  })),
}));

jest.mock('../../../utils/useRequiredParams', () => ({
  useRequiredParams: jest.fn(() => ({ entityType: 'table' })),
}));

// Stub the sibling tabs so only the real ContractSemanticFormTab is exercised.
jest.mock('../ContractDetailFormTab/ContractDetailFormTab', () => ({
  ContractDetailFormTab: jest.fn().mockImplementation(({ onChange }) => (
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
    </div>
  )),
}));
jest.mock('../ContractQualityFormTab/ContractQualityFormTab', () => ({
  ContractQualityFormTab: jest
    .fn()
    .mockImplementation(() => <div>Contract Quality</div>),
}));
jest.mock('../ContractSchemaFormTab/ContractScehmaFormTab', () => ({
  ContractSchemaFormTab: jest
    .fn()
    .mockImplementation(() => <div>Contract Schema</div>),
}));
jest.mock('../ContractSecurityFormTab/ContractSecurityFormTab', () => ({
  ContractSecurityFormTab: jest
    .fn()
    .mockImplementation(() => <div>Contract Security</div>),
}));
jest.mock('../ContractSLAFormTab/ContractSLAFormTab', () => ({
  ContractSLAFormTab: jest
    .fn()
    .mockImplementation(() => <div>Contract SLA</div>),
}));
jest.mock('../ContractTermOfService/ContractTermsOfService.component', () => ({
  __esModule: true,
  default: jest.fn().mockImplementation(() => <div>Contract Terms</div>),
}));

const mockOnCancel = jest.fn();
const mockOnSave = jest.fn();

const findPatchOpsForPath = (
  ops: { op: string; path: string; value?: unknown }[],
  path: string
) => ops.filter((op) => op.path === path);

const flushMount = () =>
  act(async () => {
    await Promise.resolve();
  });

const contractWithEmptyOwnSemantics: DataContract = {
  id: 'contract-1',
  name: 'Test Contract',
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

describe('AddDataContract Semantics-tab save-gate (regression)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('does not enable Save just by visiting the Semantics tab in create mode', async () => {
    render(<AddDataContract onCancel={mockOnCancel} onSave={mockOnSave} />);

    // Create mode with no edits: Save should be disabled.
    expect(screen.getByTestId('save-contract-btn')).toBeDisabled();

    // Navigate to the Semantics tab — mounts the real ContractSemanticFormTab,
    // whose seeding effect injects a placeholder rule.
    await act(async () => {
      fireEvent.click(
        screen.getByRole('tab', { name: 'label.semantic-plural' })
      );
    });

    // Flush the seeding effect + Form.useWatch re-resolution + watch effect.
    await flushMount();

    // Visiting the tab must be a no-op: Save stays disabled (no user edit).
    expect(screen.getByTestId('save-contract-btn')).toBeDisabled();
  });

  it('does not include semantics:[] in the create body after visiting the Semantics tab then editing the title', async () => {
    render(<AddDataContract onCancel={mockOnCancel} onSave={mockOnSave} />);

    // Visit the Semantics tab first (this is what trips the bug).
    await act(async () => {
      fireEvent.click(
        screen.getByRole('tab', { name: 'label.semantic-plural' })
      );
    });
    await flushMount();

    // Make a legitimate edit (title) to enable Save.
    await act(async () => {
      fireEvent.click(screen.getByTestId('edit-title'));
    });

    expect(screen.getByTestId('save-contract-btn')).not.toBeDisabled();

    await act(async () => {
      fireEvent.click(screen.getByTestId('save-contract-btn'));
    });

    expect(createContract).toHaveBeenCalledTimes(1);

    const [payload] = (createContract as jest.Mock).mock.calls[0] as [
      DataContract
    ];

    // The bug previously injected `semantics: []` into the create body even
    // though the user never authored a semantic rule.
    expect(payload.semantics).toBeUndefined();
  });

  it('does not emit a spurious /semantics add op in edit mode after visiting the Semantics tab', async () => {
    render(
      <AddDataContract
        contract={contractWithEmptyOwnSemantics}
        onCancel={mockOnCancel}
        onSave={mockOnSave}
      />
    );

    expect(screen.getByTestId('save-contract-btn')).toBeDisabled();

    await act(async () => {
      fireEvent.click(
        screen.getByRole('tab', { name: 'label.semantic-plural' })
      );
    });
    await flushMount();

    // Visiting Semantics must not enable Save on its own.
    expect(screen.getByTestId('save-contract-btn')).toBeDisabled();

    // Make a legitimate edit (description) to enable Save.
    await act(async () => {
      fireEvent.click(screen.getByTestId('edit-description-only'));
    });

    expect(screen.getByTestId('save-contract-btn')).not.toBeDisabled();

    await act(async () => {
      fireEvent.click(screen.getByTestId('save-contract-btn'));
    });

    expect(updateContract).toHaveBeenCalledTimes(1);

    const [, patch] = (updateContract as jest.Mock).mock.calls[0] as [
      string,
      { op: string; path: string; value?: unknown }[]
    ];

    // The bug previously bundled a spurious `add /semantics []` op.
    expect(findPatchOpsForPath(patch, '/semantics')).toEqual([]);

    // Sanity: the legitimate description edit is present.
    const descriptionOps = findPatchOpsForPath(patch, '/description');

    expect(descriptionOps).toHaveLength(1);
    expect(descriptionOps[0].value).toBe('Updated description');
  });
});
