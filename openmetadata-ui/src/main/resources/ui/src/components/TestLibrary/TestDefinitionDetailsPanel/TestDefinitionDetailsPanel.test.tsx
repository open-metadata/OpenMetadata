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
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { TestCase } from '../../../generated/tests/testCase';
import { TestDefinition } from '../../../generated/tests/testDefinition';
import { getListTestCaseBySearch } from '../../../rest/testAPI';
import { renderWithQueryClient } from '../../../test/unit/test-utils';
import TestDefinitionDetailsPanel, {
  TestDefinitionDetailsPanelProps,
} from './TestDefinitionDetailsPanel';

const mockShowErrorToast = jest.fn();

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

jest.mock('../../../rest/testAPI', () => ({
  getListTestCaseBySearch: jest.fn(),
}));

jest.mock('../../../utils/ToastUtils', () => ({
  showErrorToast: (error: unknown) => mockShowErrorToast(error),
}));

jest.mock('../../Database/Profiler/DataQualityTab/DataQualityTab', () => ({
  __esModule: true,
  default: ({ testCases }: { testCases: TestCase[] }) => (
    <ul data-testid="linked-test-cases">
      {testCases.map((testCase) => (
        <li key={testCase.id}>{testCase.name}</li>
      ))}
    </ul>
  ),
}));

jest.mock('../../common/RichTextEditor/RichTextEditorPreviewNew', () => ({
  __esModule: true,
  default: ({ markdown }: { markdown: string }) => <span>{markdown}</span>,
}));

const renderPanel = (props: Partial<TestDefinitionDetailsPanelProps> = {}) =>
  renderWithQueryClient(
    <MemoryRouter>
      <TestDefinitionDetailsPanel
        canEdit
        testDefinition={TEST_DEFINITION}
        onClose={jest.fn()}
        onEdit={jest.fn()}
        {...props}
      />
    </MemoryRouter>
  );

describe('TestDefinitionDetailsPanel', () => {
  beforeEach(() => {
    (getListTestCaseBySearch as jest.Mock).mockResolvedValue({
      data: TEST_CASES,
      paging: { total: TEST_CASES.length },
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should show the definition and the test cases that use it', async () => {
    renderPanel();

    expect(
      screen.getByTestId('test-definition-details-name')
    ).toHaveTextContent('Column Values To Be Not Null');
    expect(
      screen.getByText(TEST_DEFINITION.description as string)
    ).toBeInTheDocument();
    expect(screen.getByText('Completeness')).toBeInTheDocument();
    expect(screen.getByText('Allowed Nulls')).toBeInTheDocument();
    expect(await screen.findByText('orders_id_not_null')).toBeInTheDocument();
    expect(screen.getByText('customers_id_not_null')).toBeInTheDocument();
    expect(getListTestCaseBySearch).toHaveBeenCalledWith(
      expect.objectContaining({
        testDefinition: 'columnValuesToBeNotNull',
        offset: 0,
      })
    );
  });

  it('should stay closed and fetch nothing without a definition', () => {
    renderPanel({ testDefinition: undefined });

    expect(
      screen.queryByTestId('test-definition-overview')
    ).not.toBeInTheDocument();
    expect(getListTestCaseBySearch).not.toHaveBeenCalled();
  });

  it('should hand the definition to onEdit from the edit action', () => {
    const onEdit = jest.fn();
    renderPanel({ onEdit });

    fireEvent.click(screen.getByTestId('edit-test-definition-button'));

    expect(onEdit).toHaveBeenCalledWith(TEST_DEFINITION);
  });

  it('should hide the edit action without edit permission', () => {
    renderPanel({ canEdit: false });

    expect(
      screen.queryByTestId('edit-test-definition-button')
    ).not.toBeInTheDocument();
  });

  it('should toast a failed test case load', async () => {
    const error = { response: { status: 500 } };
    (getListTestCaseBySearch as jest.Mock).mockRejectedValue(error);
    renderPanel();

    await waitFor(() => expect(mockShowErrorToast).toHaveBeenCalledWith(error));
  });
});
