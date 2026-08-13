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

// Deliberately does not mock @openmetadata/ui-core-components: the real Table
// collection is what rejects duplicate column ids.
import { render, screen, waitFor } from '@testing-library/react';
import { TestCase, TestCaseStatus } from '../../../../generated/tests/testCase';
import { getTestCaseFailedSampleData } from '../../../../rest/testAPI';
import FailedTestCaseSampleData from './FailedTestCaseSampleData.component';

jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  Link: jest
    .fn()
    .mockImplementation(({ children }) => <a href="/link">{children}</a>),
  useParams: jest.fn().mockReturnValue({}),
}));

jest.mock('../../../../context/PermissionProvider/PermissionProvider', () => ({
  usePermissionProvider: jest.fn().mockReturnValue({ permissions: {} }),
}));

jest.mock('../../../../utils/PermissionsUtils', () => ({
  checkPermission: jest.fn().mockReturnValue(true),
}));

jest.mock('../../../../utils/EntityPureUtils', () => ({
  ...jest.requireActual('../../../../utils/EntityPureUtils'),
  getColumnNameFromEntityLink: jest.fn().mockReturnValue('my_status'),
}));

jest.mock('../../../../utils/EntityDisplayPureUtils', () => ({
  getEntityDeleteMessage: jest.fn().mockReturnValue('delete-message'),
}));

jest.mock('../../../../utils/ToastUtils', () => ({
  showErrorToast: jest.fn(),
}));

jest.mock('../../../../rest/testAPI', () => ({
  getTestCaseFailedSampleData: jest.fn(),
  deleteTestCaseFailedSampleData: jest.fn(),
}));

jest.mock('../../../common/Loader/Loader', () =>
  jest.fn().mockImplementation(() => <div data-testid="loader">Loader</div>)
);

jest.mock(
  '../../../common/ManageButtonContentItem/ManageButtonContentItem.component',
  () => ({
    ManageButtonItemLabel: jest
      .fn()
      .mockImplementation(() => <div>ManageButtonItemLabel</div>),
  })
);

jest.mock('../../../Database/SampleDataTable/RowData', () => ({
  RowData: jest
    .fn()
    .mockImplementation(({ data }: { data: unknown }) => <>{String(data)}</>),
}));

jest.mock('../../../common/DeleteModal/DeleteModal', () =>
  jest.fn().mockImplementation(() => <div>DeleteModal</div>)
);

// A join projection repeats names; the second block re-introduces the join keys.
const SAMPLE_COLUMNS = [
  'my_id',
  'my_status',
  'my_amount',
  'my_id',
  'my_status',
];
const SAMPLE_ROW = ['id-1', 'open', '42', 'id-1-dup', 'closed-dup'];

const mockTestCase: TestCase = {
  id: 'tc-1',
  name: 'failing_test_case',
  fullyQualifiedName: 'svc.db.schema.table.failing_test_case',
  entityLink: '<#E::table::svc.db.schema.table>',
  testCaseResult: { testCaseStatus: TestCaseStatus.Failed },
} as TestCase;

describe('FailedTestCaseSampleData duplicate sample columns', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (getTestCaseFailedSampleData as jest.Mock).mockResolvedValue({
      columns: SAMPLE_COLUMNS,
      rows: [SAMPLE_ROW],
    });
  });

  it('should render a column and a cell per sample entry when names repeat', async () => {
    const { container } = render(
      <FailedTestCaseSampleData testCaseData={mockTestCase} />
    );

    await waitFor(() =>
      expect(screen.getByTestId('sample-data-table')).toBeInTheDocument()
    );

    expect(container.querySelectorAll('thead th')).toHaveLength(
      SAMPLE_COLUMNS.length
    );
    expect(container.querySelectorAll('tbody td')).toHaveLength(
      SAMPLE_ROW.length
    );
  });

  it('should keep each duplicated column bound to its own value', async () => {
    render(<FailedTestCaseSampleData testCaseData={mockTestCase} />);

    await waitFor(() =>
      expect(screen.getByTestId('sample-data-table')).toBeInTheDocument()
    );

    expect(screen.getByText('id-1')).toBeInTheDocument();
    expect(screen.getByText('id-1-dup')).toBeInTheDocument();
    expect(screen.getByText('closed-dup')).toBeInTheDocument();
  });
});
