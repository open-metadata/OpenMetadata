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
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { UseFormReturn } from 'react-hook-form';
import { Table } from '../../../../generated/entity/data/table';
import { createTestCase } from '../../../../rest/testAPI';
import TestCaseFormDrawer from './TestCaseFormDrawer';
import {
  FormValues,
  TestCaseFormBodyProps,
  TestCaseFormContext,
  TestLevel,
} from './TestCaseFormV1.interface';

const mockGetResourceLimit = jest.fn().mockResolvedValue(undefined);

jest.mock('../../../../rest/testAPI', () => ({
  createTestCase: jest.fn(),
}));

jest.mock('../../../../rest/ingestionPipelineAPI', () => ({
  addIngestionPipeline: jest.fn().mockResolvedValue({ id: 'pipeline-id' }),
  deployIngestionPipelineById: jest.fn().mockResolvedValue({}),
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
    getResourceLimit: (...args: unknown[]) => mockGetResourceLimit(...args),
  }),
}));

jest.mock('../../../../context/PermissionProvider/PermissionProvider', () => ({
  usePermissionProvider: () => ({
    permissions: { ingestionPipeline: { Create: false, EditAll: false } },
  }),
}));

jest.mock('../../../../utils/ToastUtils', () => ({
  showSuccessToast: jest.fn(),
  showErrorToast: jest.fn(),
}));

jest.mock('../../../common/ServiceDocPanel/ServiceDocPanel', () =>
  jest.fn().mockImplementation(() => <div data-testid="service-doc-panel" />)
);

// NOTE: transformTestCaseFormData is intentionally NOT mocked — this test
// exercises the real values -> payload transform so it guards the contract
// (testDefinition string, parameterValues [{name,value}]) end to end.

const selectedDefinition = {
  fullyQualifiedName: 'columnValuesToBeInSet',
  name: 'columnValuesToBeInSet',
  parameterDefinition: [{ name: 'allowedValues' }],
} as TestCaseFormContext['selectedDefinition'];

const mockContext: TestCaseFormContext = {
  selectedDefinition,
  selectedTableData: {
    id: 'table-id',
    name: 'table',
    fullyQualifiedName: 'service.db.schema.table',
    columns: [],
  } as Table,
  selectedColumn: 'email',
  selectedTestLevel: TestLevel.COLUMN,
  generateName: () => 'generated_name',
  canCreatePipeline: false,
};

let seedRealisticFormValues: (() => void) | undefined;
let emitContextFn: ((ctx: TestCaseFormContext) => void) | undefined;

jest.mock('./TestCaseFormBody', () =>
  jest
    .fn()
    .mockImplementation(({ form, onContextChange }: TestCaseFormBodyProps) => {
      const typedForm = form as UseFormReturn<FormValues>;
      emitContextFn = onContextChange;
      seedRealisticFormValues = () => {
        // Real RHF select fields store FormSelectItem objects, not raw strings.
        typedForm.setValue('testTypeId', {
          id: 'columnValuesToBeInSet',
          label: 'Column Values To Be In Set',
        } as never);
        typedForm.setValue('testName', 'my_email_test');
        typedForm.setValue('params', {
          allowedValues: { id: 'admin@example.com', label: 'admin' },
        } as never);
      };

      return <div data-testid="test-case-form-body" />;
    })
);

const mockCreateTestCase = createTestCase as jest.Mock;

const mockTable = {
  id: 'table-id',
  name: 'table',
  fullyQualifiedName: 'service.db.schema.table',
} as Table;

describe('TestCaseForm integration (real transform)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    seedRealisticFormValues = undefined;
    emitContextFn = undefined;
    mockCreateTestCase.mockResolvedValue({
      name: 'my_email_test',
      id: 'created-id',
    });
  });

  it('submits a payload with a string testDefinition and well-formed parameterValues', async () => {
    render(<TestCaseFormDrawer open table={mockTable} onClose={jest.fn()} />);

    await screen.findByTestId('test-case-form-body');

    await act(async () => {
      emitContextFn?.(mockContext);
      seedRealisticFormValues?.();
    });

    const submitBtn = await screen.findByTestId('save-btn');

    await act(async () => {
      fireEvent.click(submitBtn);
    });

    await waitFor(() => {
      expect(mockCreateTestCase).toHaveBeenCalledTimes(1);
    });

    const payload = mockCreateTestCase.mock.calls[0][0];

    expect(typeof payload.testDefinition).toBe('string');
    expect(payload.testDefinition).toBe('columnValuesToBeInSet');

    expect(Array.isArray(payload.parameterValues)).toBe(true);
    expect(payload.parameterValues).toEqual([
      { name: 'allowedValues', value: 'admin@example.com' },
    ]);

    const serialized = JSON.stringify(payload);

    expect(serialized).not.toContain('[object Object]');
  });
});
