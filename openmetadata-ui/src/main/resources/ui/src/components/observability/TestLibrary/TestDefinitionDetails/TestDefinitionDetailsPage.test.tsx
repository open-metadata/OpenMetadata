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
import { screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { TestCase } from '../../../../generated/tests/testCase';
import { TestDefinition } from '../../../../generated/tests/testDefinition';
import {
  getListTestCaseBySearch,
  getTestDefinitionByName,
} from '../../../../rest/testAPI';
import { renderWithQueryClient } from '../../../../test/unit/test-utils';
import TestDefinitionDetailsPage from './TestDefinitionDetailsPage';

const mockCheckPermission = jest.fn().mockReturnValue(true);
const mockCanEditAll = jest.fn().mockReturnValue(true);

const TEST_DEFINITION = {
  id: 'def-1',
  name: 'columnValuesToBeNotNull',
  fullyQualifiedName: 'columnValuesToBeNotNull',
  displayName: 'Column Values To Be Not Null',
  description: 'Ensures that all values in a column are not null',
  entityType: 'COLUMN',
  testPlatforms: ['OpenMetadata'],
  dataQualityDimension: 'Completeness',
  parameterDefinition: [
    {
      name: 'allowedNulls',
      displayName: 'Allowed Nulls',
      dataType: 'INT',
      required: false,
    },
  ],
} as unknown as TestDefinition;

const TEST_CASES = [
  { id: 'tc-1', name: 'orders_id_not_null' },
  { id: 'tc-2', name: 'customers_id_not_null' },
] as TestCase[];

const mockShowErrorToast = jest.fn();

jest.mock('../../../../utils/ToastUtils', () => ({
  showErrorToast: (error: unknown) => mockShowErrorToast(error),
}));

jest.mock('../../../../hooks/useFqn', () => ({
  useFqn: () => ({ fqn: 'columnValuesToBeNotNull' }),
}));

jest.mock('../../../../rest/testAPI', () => ({
  getTestDefinitionByName: jest.fn(),
  getListTestCaseBySearch: jest.fn(),
}));

jest.mock('../../../../context/PermissionProvider/PermissionProvider', () => ({
  usePermissionProvider: () => ({ permissions: {} }),
}));

jest.mock('../../../../utils/PermissionsUtils', () => ({
  checkPermission: () => mockCheckPermission(),
}));

jest.mock(
  '../../../../hooks/useEntityPermissions/useEntityPermissions',
  () => ({
    useEntityPermissions: () => ({ canEditAll: mockCanEditAll() }),
  })
);

jest.mock('../../../Database/Profiler/DataQualityTab/DataQualityTab', () => ({
  __esModule: true,
  default: ({ testCases }: { testCases: TestCase[] }) => (
    <ul data-testid="linked-test-cases">
      {testCases.map((testCase) => (
        <li key={testCase.id}>{testCase.name}</li>
      ))}
    </ul>
  ),
}));

jest.mock(
  '../../../TestLibrary/TestDefinitionForm/TestDefinitionForm.component',
  () => ({
    __esModule: true,
    default: () => null,
  })
);

jest.mock('../../../common/RichTextEditor/RichTextEditorPreviewNew', () => ({
  __esModule: true,
  default: ({ markdown }: { markdown: string }) => <span>{markdown}</span>,
}));

const renderPage = () =>
  renderWithQueryClient(
    <MemoryRouter>
      <TestDefinitionDetailsPage />
    </MemoryRouter>
  );

describe('TestDefinitionDetailsPage', () => {
  beforeEach(() => {
    mockCheckPermission.mockReturnValue(true);
    mockCanEditAll.mockReturnValue(true);
    (getTestDefinitionByName as jest.Mock).mockResolvedValue(TEST_DEFINITION);
    (getListTestCaseBySearch as jest.Mock).mockResolvedValue({
      data: TEST_CASES,
      paging: { total: TEST_CASES.length },
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should show the definition and the test cases that use it', async () => {
    renderPage();

    expect(
      await screen.findByText(TEST_DEFINITION.description as string)
    ).toBeInTheDocument();
    expect(screen.getByText('Completeness')).toBeInTheDocument();
    expect(screen.getByText('Allowed Nulls')).toBeInTheDocument();
    expect(await screen.findByText('orders_id_not_null')).toBeInTheDocument();
    expect(screen.getByText('customers_id_not_null')).toBeInTheDocument();
    expect(getTestDefinitionByName).toHaveBeenCalledWith(
      'columnValuesToBeNotNull'
    );
    expect(getListTestCaseBySearch).toHaveBeenCalledWith(
      expect.objectContaining({
        testDefinition: 'columnValuesToBeNotNull',
        offset: 0,
      })
    );
  });

  it('should hide the edit action without edit permission', async () => {
    mockCanEditAll.mockReturnValue(false);
    renderPage();

    expect(
      await screen.findByTestId('test-definition-overview')
    ).toBeInTheDocument();
    expect(
      screen.queryByTestId('edit-test-definition-button')
    ).not.toBeInTheDocument();
  });

  it('should not fetch anything without view permission', () => {
    mockCheckPermission.mockReturnValue(false);
    renderPage();

    expect(
      screen.queryByTestId('test-definition-overview')
    ).not.toBeInTheDocument();
    expect(getTestDefinitionByName).not.toHaveBeenCalled();
    expect(getListTestCaseBySearch).not.toHaveBeenCalled();
  });

  it('should report a failed definition load instead of showing no data', async () => {
    (getTestDefinitionByName as jest.Mock).mockRejectedValue({
      response: { status: 500 },
    });
    renderPage();

    expect(
      await screen.findByText('message.something-went-wrong')
    ).toBeInTheDocument();
  });

  it('should toast a failed test case load', async () => {
    const error = { response: { status: 500 } };
    (getListTestCaseBySearch as jest.Mock).mockRejectedValue(error);
    renderPage();

    await waitFor(() => expect(mockShowErrorToast).toHaveBeenCalledWith(error));
  });
});
