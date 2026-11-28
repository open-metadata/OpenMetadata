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
import { act, fireEvent, render, screen, within } from '@testing-library/react';
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
 * `ContractSecurityFormTab` (only the sibling tabs, REST utils, and context
 * hooks are stubbed). It verifies the regression: editing only the data
 * classification on the Security tab (and never authoring a policy) must not
 * persist the seeded placeholder policy in the create/update payload.
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
      columns: [{ name: 'column1', dataType: 'STRING' }] as Column[],
    } as Table,
  })),
}));

jest.mock('../../../utils/useRequiredParams', () => ({
  useRequiredParams: jest.fn(() => ({ entityType: 'table' })),
}));

// Stub the sibling tabs so only the real ContractSecurityFormTab is exercised.
jest.mock('../ContractDetailFormTab/ContractDetailFormTab', () => ({
  ContractDetailFormTab: jest.fn().mockImplementation(({ onChange }) => (
    <div>
      <h2>Contract Details</h2>
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
jest.mock('../ContractSemanticFormTab/ContractSemanticFormTab', () => ({
  ContractSemanticFormTab: jest
    .fn()
    .mockImplementation(() => <div>Contract Semantics</div>),
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

const getTextInput = (testId: string) =>
  within(screen.getByTestId(testId)).getByRole('textbox');

const contractWithNoSecurity: DataContract = {
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

describe('AddDataContract Security-tab phantom-policy (regression)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('does not enable Save just by visiting the Security tab in create mode', async () => {
    render(<AddDataContract onCancel={mockOnCancel} onSave={mockOnSave} />);

    expect(screen.getByTestId('save-contract-btn')).toBeDisabled();

    await act(async () => {
      fireEvent.click(screen.getByRole('tab', { name: 'label.security' }));
    });
    await flushMount();

    // Visiting the tab seeds a placeholder policy card, but the watch effect
    // only fires on user changes (type === 'change'), so Save stays disabled.
    expect(screen.getByTestId('save-contract-btn')).toBeDisabled();
  });

  it('does not persist a placeholder policy when only data classification is typed (create mode)', async () => {
    render(<AddDataContract onCancel={mockOnCancel} onSave={mockOnSave} />);

    await act(async () => {
      fireEvent.click(screen.getByRole('tab', { name: 'label.security' }));
    });
    await flushMount();

    // Type only the data classification — never add or fill in a policy.
    const classificationInput = getTextInput('data-classification-input');
    await act(async () => {
      fireEvent.change(classificationInput, { target: { value: 'T1' } });
    });

    expect(screen.getByTestId('save-contract-btn')).not.toBeDisabled();

    await act(async () => {
      fireEvent.click(screen.getByTestId('save-contract-btn'));
    });

    expect(createContract).toHaveBeenCalledTimes(1);

    const payload = (createContract as jest.Mock).mock
      .calls[0][0] as DataContract;

    // dataClassification must be preserved, but NO policy may be persisted.
    expect(payload.security).toBeDefined();
    expect(payload.security?.dataClassification).toBe('T1');
    expect(payload.security?.policies).toEqual([]);
  });

  it('does not emit a spurious /security add op with an empty policy in edit mode', async () => {
    render(
      <AddDataContract
        contract={contractWithNoSecurity}
        onCancel={mockOnCancel}
        onSave={mockOnSave}
      />
    );

    expect(screen.getByTestId('save-contract-btn')).toBeDisabled();

    await act(async () => {
      fireEvent.click(screen.getByRole('tab', { name: 'label.security' }));
    });
    await flushMount();

    // Edit only the data classification on the Security tab.
    const classificationInput = getTextInput('data-classification-input');
    await act(async () => {
      fireEvent.change(classificationInput, { target: { value: 'T1' } });
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

    // A /security op is expected (the user authored a classification), but its
    // value must not contain any empty/placeholder policy.
    const securityOps = findPatchOpsForPath(patch, '/security');

    expect(securityOps).toHaveLength(1);

    const securityValue = securityOps[0].value as {
      dataClassification?: string;
      policies?: unknown[];
    };

    expect(securityValue.dataClassification).toBe('T1');
    expect(securityValue.policies).toEqual([]);
  });

  it('persists an authored policy together with data classification', async () => {
    render(<AddDataContract onCancel={mockOnCancel} onSave={mockOnSave} />);

    await act(async () => {
      fireEvent.click(screen.getByRole('tab', { name: 'label.security' }));
    });
    await flushMount();

    // Type data classification.
    const classificationInput = getTextInput('data-classification-input');
    await act(async () => {
      fireEvent.change(classificationInput, { target: { value: 'T1' } });
    });

    // Author a real policy (fill the seeded card's access policy field).
    const accessPolicyInput = getTextInput('access-policy-input-0');
    await act(async () => {
      fireEvent.change(accessPolicyInput, { target: { value: 'My Policy' } });
    });

    await act(async () => {
      fireEvent.click(screen.getByTestId('save-contract-btn'));
    });

    expect(createContract).toHaveBeenCalledTimes(1);

    const payload = (createContract as jest.Mock).mock
      .calls[0][0] as DataContract;

    expect(payload.security?.dataClassification).toBe('T1');
    expect(payload.security?.policies).toEqual([
      expect.objectContaining({ accessPolicy: 'My Policy' }),
    ]);
  });
});
