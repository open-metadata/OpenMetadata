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
import { ClientErrors } from '../../enums/Axios.enum';
import { getTopicByFqn } from '../../rest/topicsAPI';
import { renderWithQueryClient } from '../../test/unit/test-utils';
import { getDerivedPermissionFlags } from '../../utils/PermissionDerivation';
import { showErrorToast } from '../../utils/ToastUtils';
import TopicDetailsPageComponent from './TopicDetailsPage.component';

jest.mock('../../components/Topic/TopicDetails/TopicDetails.component', () => {
  return jest.fn().mockReturnValue(<div>TopicDetails.component</div>);
});

// The page now reads permissions via useEntityPermissions rather than the raw
// PermissionProvider context — see TableDetailsPageV1.test.tsx's setMockPermissions for
// the full rationale (partial-object fidelity, mockReturnValue over mockImplementationOnce,
// the `deleted`-gating blind spot), mirrored here without repeating it.
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

describe('Test TopicDetailsPage component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setMockPermissions({
      Create: true,
      Delete: true,
      EditAll: true,
      EditCustomFields: true,
      EditDataProfile: true,
      EditDescription: true,
      EditDisplayName: true,
      EditLineage: true,
      EditOwners: true,
      EditQueries: true,
      EditSampleData: true,
      EditTags: true,
      EditTests: true,
      EditTier: true,
      ViewAll: true,
      ViewDataProfile: true,
      ViewQueries: true,
      ViewSampleData: true,
      ViewTests: true,
      ViewUsage: true,
    });
  });

  // Guardrail: this page owns the single useEntityPermissions call whose raw
  // `topicPermissions` prop TopicDetails.component.tsx consumes downstream — see the
  // "page-owner converts, child stays raw" precedent recorded in the Task 7A report. A
  // future conversion that accidentally calls the hook more than once, or with a
  // different identifier on a later render, would silently diverge from that raw prop's
  // cache entry. See TableDetailsPageV1.test.tsx's afterEach for the general rationale.
  afterEach(() => {
    const calls = mockUseEntityPermissions.mock.calls;
    if (calls.length === 0) {
      return;
    }
    const [expectedResource, expectedIdentifier] = calls[0];
    calls.forEach(([resource, identifier]) => {
      expect(resource).toBe(expectedResource);
      expect(identifier).toBe(expectedIdentifier);
    });
  });

  it('should fetch permissions for the topic fqn', () => {
    renderWithQueryClient(<TopicDetailsPageComponent />);

    expect(mockUseEntityPermissions).toHaveBeenCalledWith(
      ResourceEntity.TOPIC,
      'sample_kafka.sales'
    );
  });

  it('TopicDetailsPage component should render properly', async () => {
    renderWithQueryClient(<TopicDetailsPageComponent />);

    await waitFor(() =>
      expect(screen.getByText(/TopicDetails.component/i)).toBeInTheDocument()
    );
  });

  it('Should extract topic FQN from field-level deep link URL', async () => {
    (getTopicByFqn as jest.Mock).mockImplementation((fqn) => {
      if (fqn === 'sample_kafka.sales') {
        return Promise.resolve({});
      }

      return Promise.reject({
        response: { status: 404 },
      });
    });

    renderWithQueryClient(<TopicDetailsPageComponent />);

    await waitFor(() =>
      expect(getTopicByFqn).toHaveBeenCalledWith(
        'sample_kafka.sales',
        expect.any(Object)
      )
    );
  });

  it('renders the entity-missing placeholder (not a stuck loader) when the topic fetch returns 404', async () => {
    (getTopicByFqn as jest.Mock).mockImplementation(() =>
      Promise.reject({ response: { status: ClientErrors.NOT_FOUND } })
    );

    renderWithQueryClient(<TopicDetailsPageComponent />);

    await waitFor(() =>
      expect(screen.getByTestId('no-data-placeholder')).toBeInTheDocument()
    );

    expect(screen.getByText('sample_kafka.sales')).toBeInTheDocument();
    expect(screen.getByText(/label\.not-found-lowercase/)).toBeInTheDocument();
    expect(
      screen.queryByText('server.entity-details-fetch-error')
    ).not.toBeInTheDocument();

    expect(showErrorToast).not.toHaveBeenCalled();
    expect(mockNavigate).not.toHaveBeenCalled();
    expect(screen.queryByTestId('loader')).not.toBeInTheDocument();
  });

  it('renders a fetch-error placeholder (not a stuck loader) when the topic fetch fails with a sustained 5xx', async () => {
    (getTopicByFqn as jest.Mock).mockImplementation(() =>
      Promise.reject({ response: { status: 503 } })
    );

    renderWithQueryClient(<TopicDetailsPageComponent />);

    await waitFor(() =>
      expect(screen.getByTestId('no-data-placeholder')).toBeInTheDocument()
    );

    expect(
      screen.getByText('server.entity-details-fetch-error')
    ).toBeInTheDocument();
    expect(showErrorToast).toHaveBeenCalledTimes(1);
    expect(mockNavigate).not.toHaveBeenCalled();
    expect(screen.queryByTestId('loader')).not.toBeInTheDocument();
  });

  it('renders a fetch-error placeholder and fires the toast when the topic fetch fails with a transport error (no status)', async () => {
    (getTopicByFqn as jest.Mock).mockImplementation(() =>
      Promise.reject(new Error('Network Error'))
    );

    renderWithQueryClient(<TopicDetailsPageComponent />);

    await waitFor(() =>
      expect(screen.getByTestId('no-data-placeholder')).toBeInTheDocument()
    );

    expect(
      screen.getByText('server.entity-details-fetch-error')
    ).toBeInTheDocument();
    expect(showErrorToast).toHaveBeenCalledTimes(1);
    expect(mockNavigate).not.toHaveBeenCalled();
    expect(screen.queryByTestId('loader')).not.toBeInTheDocument();
  });
});
