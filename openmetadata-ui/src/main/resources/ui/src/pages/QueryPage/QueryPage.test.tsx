/*
 *  Copyright 2023 Collate.
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

import { act, render, screen } from '@testing-library/react';
import { OperationPermission } from '../../context/PermissionProvider/PermissionProvider.interface';
import { MOCK_QUERIES } from '../../mocks/Queries.mock';
import { MOCK_TABLE } from '../../mocks/TableData.mock';
import { getDerivedPermissionFlags } from '../../utils/PermissionDerivation';
import QueryPage from './QueryPage.component';

jest.mock('../../hooks/useCustomLocation/useCustomLocation', () => {
  return jest.fn().mockImplementation(() => ({ search: '' }));
});

jest.mock('react-router-dom', () => ({
  useParams: jest.fn().mockImplementation(() => ({
    fqn: 'testDatasetFQN',
    queryId: 'queryId',
  })),
  useNavigate: jest.fn().mockImplementation(() => jest.fn()),
}));

// Permissions now come from useEntityPermissions (Task 8 Batch 10) rather than an
// imperative usePermissionProvider().getEntityPermission call — mock the hook directly,
// mirroring DataModelPage.test.tsx's approach.
const mockUseEntityPermissions = jest.fn();

const setMockPermissions = (
  overrides: Partial<OperationPermission> = { ViewAll: true, EditAll: true },
  {
    isLoading = false,
    error = null as unknown,
  }: { isLoading?: boolean; error?: unknown } = {}
) => {
  const permissions = overrides as OperationPermission;
  mockUseEntityPermissions.mockReturnValue({
    permissions,
    isLoading,
    error,
    refresh: jest.fn(),
    ...getDerivedPermissionFlags(permissions, false),
  });
};

jest.mock('../../hooks/useEntityPermissions/useEntityPermissions', () => ({
  useEntityPermissions: (...args: unknown[]) =>
    mockUseEntityPermissions(...args),
}));

jest.mock('../../components/PageLayoutV1/PageLayoutV1', () => {
  return jest.fn().mockImplementation(({ children }) => <div>{children}</div>);
});
jest.mock(
  '../../components/common/TitleBreadcrumb/TitleBreadcrumb.component',
  () => {
    return jest.fn().mockImplementation(() => <div>TitleBreadcrumb</div>);
  }
);
jest.mock('../../components/common/Loader/Loader', () => {
  return jest.fn().mockImplementation(() => <div>Loader</div>);
});
jest.mock('../../components/Database/TableQueries/QueryCard', () => {
  return jest.fn().mockImplementation(({ permission }) => (
    <div>
      QueryCard
      <span data-testid="query-edit-all">{String(permission?.EditAll)}</span>
    </div>
  ));
});
jest.mock('../../rest/queryAPI', () => ({
  ...jest.requireActual('../../rest/queryAPI'),
  getQueryById: jest
    .fn()
    .mockImplementation(() => Promise.resolve(MOCK_QUERIES[0])),
}));
jest.mock('../../rest/tableAPI', () => ({
  ...jest.requireActual('../../rest/queryAPI'),
  getTableDetailsByFQN: jest
    .fn()
    .mockImplementation(() => Promise.resolve(MOCK_TABLE)),
}));

describe('QueryFilters component test', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setMockPermissions();
  });

  it('Component should render', async () => {
    await act(async () => {
      render(<QueryPage />);
    });

    expect(await screen.findByText('TitleBreadcrumb')).toBeInTheDocument();
    expect(await screen.findByText('QueryCard')).toBeInTheDocument();
  });

  it('calls useEntityPermissions with the resource and by-id identifier', async () => {
    await act(async () => {
      render(<QueryPage />);
    });

    expect(mockUseEntityPermissions).toHaveBeenCalledWith(
      'query',
      { id: 'queryId' },
      expect.objectContaining({ enabled: true })
    );
  });

  it('passes the raw permissions object through to QueryCard', async () => {
    setMockPermissions({ ViewAll: true, EditAll: true });

    await act(async () => {
      render(<QueryPage />);
    });

    expect(await screen.findByTestId('query-edit-all')).toHaveTextContent(
      'true'
    );
  });

  it('shows the permission placeholder when view access is denied', async () => {
    setMockPermissions({});

    await act(async () => {
      render(<QueryPage />);
    });

    expect(
      await screen.findByTestId('permission-error-placeholder')
    ).toBeInTheDocument();
    expect(screen.queryByText('QueryCard')).not.toBeInTheDocument();
  });

  // Regression coverage for the getDerivedPermissionFlags conversion (Task 8 Batch 10): the
  // old 3-term OR (`ViewAll || ViewBasic || ViewQueries`) must still grant access via
  // ViewQueries alone, even when neither ViewAll nor ViewBasic is granted.
  it('grants view access via ViewQueries alone (N-term-OR)', async () => {
    setMockPermissions({ ViewQueries: true });

    await act(async () => {
      render(<QueryPage />);
    });

    expect(await screen.findByText('QueryCard')).toBeInTheDocument();
  });
});
