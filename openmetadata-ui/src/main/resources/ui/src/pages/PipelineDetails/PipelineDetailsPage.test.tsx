/*
 *  Copyright 2022 Collate.
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
import {
  OperationPermission,
  ResourceEntity,
} from '../../context/PermissionProvider/PermissionProvider.interface';
import { renderWithQueryClient } from '../../test/unit/test-utils';
import { getDerivedPermissionFlags } from '../../utils/PermissionDerivation';
import PipelineDetailsPage from './PipelineDetailsPage.component';

jest.mock('react-router-dom', () => ({
  useParams: jest.fn().mockReturnValue({
    fqn: 'sample_airflow.snowflake_etl',
    tab: 'details',
  }),
  useNavigate: jest.fn().mockImplementation(() => jest.fn()),
}));

jest.mock('../../rest/miscAPI', () => ({
  addLineage: jest.fn(),
  deleteLineageEdge: jest.fn(),
}));

jest.mock('../../rest/pipelineAPI', () => ({
  addFollower: jest.fn(),
  patchPipelineDetails: jest.fn(),
  removeFollower: jest.fn(),
  getPipelineByFqn: jest.fn().mockImplementation(() => Promise.resolve({})),
}));

jest.mock(
  '../../components/Pipeline/PipelineDetails/PipelineDetails.component',
  () => {
    return jest.fn().mockReturnValue(<div>PipelineDetails.component</div>);
  }
);

jest.mock(
  '../../components/common/ErrorWithPlaceholder/ErrorPlaceHolder',
  () => {
    return jest.fn().mockReturnValue(<div>ErrorPlaceHolder.component</div>);
  }
);

// Permissions now come from useEntityPermissions (Task 8 Batch 10) rather than an
// imperative usePermissionProvider().getEntityPermissionByFqn call — mock the hook
// directly, mirroring DataModelPage.test.tsx's approach.
const mockUseEntityPermissions = jest.fn();

const setMockPermissions = (
  overrides: Partial<OperationPermission> = {},
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

describe('Test PipelineDetailsPage component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setMockPermissions({ ViewAll: true, ViewBasic: true, ViewUsage: true });
  });

  it('PipelineDetailsPage component should render properly', async () => {
    renderWithQueryClient(<PipelineDetailsPage />);

    await waitFor(() =>
      expect(screen.getByText(/PipelineDetails.component/i)).toBeInTheDocument()
    );
  });

  it('calls useEntityPermissions with the resource and decoded fqn', async () => {
    renderWithQueryClient(<PipelineDetailsPage />);

    await waitFor(() =>
      expect(mockUseEntityPermissions).toHaveBeenCalledWith(
        ResourceEntity.PIPELINE,
        'sample_airflow.snowflake_etl',
        expect.objectContaining({ enabled: true })
      )
    );
  });

  it('shows the permission placeholder when view access is denied', async () => {
    setMockPermissions({});

    renderWithQueryClient(<PipelineDetailsPage />);

    expect(
      await screen.findByText(/ErrorPlaceHolder.component/i)
    ).toBeInTheDocument();
  });
});
