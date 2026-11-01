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
import { OperationPermission } from '../../context/PermissionProvider/PermissionProvider.interface';
import { getTopicByFqn } from '../../rest/topicsAPI';
import { renderWithQueryClient } from '../../test/unit/test-utils';
import { getDerivedPermissionFlags } from '../../utils/PermissionDerivation';
import TopicDetailsPageComponent from './TopicDetailsPage.component';

jest.mock('../../components/Topic/TopicDetails/TopicDetails.component', () => {
  return jest.fn().mockReturnValue(<div>TopicDetails.component</div>);
});

// Mirrors TopicDetailsPage.test.tsx's setMockPermissions: the permission flags
// are produced by the REAL getDerivedPermissionFlags helper, so the divergent
// payload { ViewBasic: false, ViewAll: true } exercises the real prioritization
// (canViewBasic === false) and the raw OR (hasViewAccess === true) the bug hinges
// on — not a hand-stubbed flag value.
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

jest.mock('../../rest/topicsAPI', () => ({
  addFollower: jest.fn(),
  getTopicByFqn: jest.fn().mockImplementation(() => Promise.resolve({})),
  patchTopicDetails: jest.fn(),
  removeFollower: jest.fn(),
}));

const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => ({
  useNavigate: jest.fn().mockImplementation(() => mockNavigate),
}));

jest.mock('../../utils/useRequiredParams', () => ({
  useRequiredParams: jest.fn().mockImplementation(() => ({
    topicFQN: 'sample_kafka.sales',
    tab: 'schema',
  })),
}));

jest.mock('../../hooks/useFqn', () => ({
  useFqn: jest.fn().mockReturnValue({
    fqn: 'sample_kafka.sales',
    entityFqn: 'sample_kafka.sales',
  }),
}));

describe('TopicDetailsPage view-permission deny', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders the permission placeholder (not a stuck loader) when ViewBasic is explicitly denied but ViewAll is allowed', async () => {
    // The bug: canViewBasic (prioritized) is false → useQuery is disabled and
    // never fetches, yet hasViewAccess (raw OR) stayed true, so the old
    // `if (!hasViewAccess)` placeholder gate never tripped and the page fell
    // through to the unconditional <PageLoader />. Gating the placeholder on
    // the same prioritized `canViewBasic` flag as the query's `enabled`
    // (matching ContainerPage / TableDetailsPageV1) renders the placeholder.
    setMockPermissions({
      ViewBasic: false,
      ViewAll: true,
    } as OperationPermission);

    renderWithQueryClient(<TopicDetailsPageComponent />);

    await waitFor(() =>
      expect(
        screen.getByTestId('permission-error-placeholder')
      ).toBeInTheDocument()
    );

    // The query is disabled by the prioritized canViewBasic=false gate, so the
    // topic fetch must never fire — confirming the page is not silently waiting
    // on a fetch that will never resolve.
    expect(getTopicByFqn).not.toHaveBeenCalled();

    // The bug presented as an indefinite spinner; assert the loader is gone so a
    // regression that re-splits the flags is caught immediately rather than
    // masquerading as a slow API.
    expect(screen.queryByTestId('loader')).not.toBeInTheDocument();
  });

  it('renders the topic content when ViewBasic key is absent and ViewAll is allowed (prioritized fallback)', async () => {
    // Regression guard for the prioritization's fallback path (see
    // getPrioritizedViewPermission): when the ViewBasic key is ABSENT, the
    // prioritized canViewBasic falls back to ViewAll. With ViewAll true this
    // must yield canViewBasic === true → the query runs and the page renders
    // its content, NOT the permission placeholder. A raw read or a mismatched
    // flag would regress this case to a spurious placeholder.
    setMockPermissions({ ViewAll: true } as OperationPermission);

    renderWithQueryClient(<TopicDetailsPageComponent />);

    await waitFor(() =>
      expect(screen.getByText(/TopicDetails.component/i)).toBeInTheDocument()
    );

    expect(
      screen.queryByTestId('permission-error-placeholder')
    ).not.toBeInTheDocument();
  });
});
