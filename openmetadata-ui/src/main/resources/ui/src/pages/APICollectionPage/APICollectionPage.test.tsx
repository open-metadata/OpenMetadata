/*
 *  Copyright 2024 Collate.
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

import { waitFor } from '@testing-library/react';
import { useParams } from 'react-router-dom';
import PageLayoutV1 from '../../components/PageLayoutV1/PageLayoutV1';
import {
  OperationPermission,
  ResourceEntity,
} from '../../context/PermissionProvider/PermissionProvider.interface';
import { TabSpecificField } from '../../enums/entity.enum';
import { Include } from '../../generated/type/include';
import { useFqn } from '../../hooks/useFqn';
import { getApiCollectionByFQN } from '../../rest/apiCollectionsAPI';
import { getApiEndPoints } from '../../rest/apiEndpointsAPI';
import { renderWithQueryClient } from '../../test/unit/test-utils';
import { fetchEntityTaskCountsInto } from '../../utils/FeedUtilsPure';
import { getDerivedPermissionFlags } from '../../utils/PermissionDerivation';
import { showErrorToast } from '../../utils/ToastUtils';
import APICollectionPage from './APICollectionPage';

// The page now reads permissions via useEntityPermissions rather than the raw
// PermissionProvider context — see TableDetailsPageV1.test.tsx's setMockPermissions for the
// full rationale (partial-object fidelity, mockReturnValue over mockImplementationOnce, the
// `deleted`-gating blind spot), mirrored here without repeating it.
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

jest.mock('../../rest/apiCollectionsAPI', () => ({
  getApiCollectionByFQN: jest.fn().mockResolvedValue({}),
  restoreApiCollection: jest.fn().mockResolvedValue({ version: 1 }),
  patchApiCollection: jest.fn().mockResolvedValue({}),
  updateApiCollectionVote: jest.fn().mockResolvedValue({}),
}));

jest.mock('../../rest/apiEndpointsAPI', () => ({
  getApiEndPoints: jest.fn().mockResolvedValue({ paging: { total: 0 } }),
}));

jest.mock('../../utils/ToastUtils', () => ({
  showErrorToast: jest.fn(),
  showSuccessToast: jest.fn(),
}));

jest.mock('../../utils/EntityDisplayPureUtils', () => ({
  ...jest.requireActual('../../utils/EntityDisplayPureUtils'),
  getEntityMissingError: jest.fn(),
  getCountBadge: jest.fn().mockImplementation((count) => <span>{count}</span>),
}));
jest.mock('../../utils/EntityNameUtils', () => ({
  getEntityName: jest.fn().mockReturnValue('test-api-collection'),
}));
jest.mock('../../utils/FeedUtilsPure', () => ({
  fetchEntityActivityCountInto: jest.fn(),
  fetchEntityTaskCountsInto: jest.fn(),
  getFeedCounts: jest.fn(),
}));

jest.mock('../../hooks/useFqn', () => ({
  useFqn: jest.fn().mockReturnValue({ fqn: 'api.collection.v1' }),
}));

jest.mock('../../hooks/useCustomPages', () => ({
  useCustomPages: jest.fn().mockReturnValue({
    customizedPage: null,
    isLoading: false,
  }),
}));

jest.mock('../../hooks/useTableFilters', () => ({
  useTableFilters: jest.fn().mockReturnValue({
    filters: { showDeletedEndpoints: false },
    setFilters: jest.fn(),
  }),
}));

jest.mock('react-router-dom', () => ({
  useNavigate: jest.fn().mockReturnValue({ push: jest.fn() }),
  useParams: jest
    .fn()
    .mockReturnValue({ fqn: 'api.collection.v1', tab: 'api_endpoint' }),
  useLocation: jest.fn().mockReturnValue({ pathname: '/test' }),
}));

jest.mock('../../components/common/ErrorWithPlaceholder/ErrorPlaceHolder', () =>
  jest.fn().mockImplementation(() => <div>ErrorPlaceHolder</div>)
);

jest.mock('../../components/common/Loader/Loader', () => ({
  __esModule: true,
  default: jest.fn().mockImplementation(() => <div>Loader</div>),
  PageLoader: jest.fn().mockImplementation(() => <div>Loader</div>),
}));

jest.mock('../../components/AppRouter/withActivityFeed', () => ({
  withActivityFeed: jest.fn().mockImplementation((Component) => Component),
}));

jest.mock('../../components/common/DocumentTitle/DocumentTitle', () =>
  jest.fn().mockImplementation(() => <div>DocumentTitle</div>)
);

jest.mock('../../components/PageLayoutV1/PageLayoutV1', () =>
  jest.fn().mockImplementation(({ children }) => <div>{children}</div>)
);

jest.mock(
  '../../components/DataAssets/DataAssetsHeader/DataAssetsHeader.component',
  () => ({
    DataAssetsHeader: jest
      .fn()
      .mockImplementation(() => <div>DataAssetsHeader</div>),
  })
);

jest.mock(
  '../../components/Customization/GenericProvider/GenericProvider',
  () => ({
    GenericProvider: jest
      .fn()
      .mockImplementation(({ children }) => <div>{children}</div>),
  })
);

jest.mock('../../utils/AdvancedSearchClassBase', () => {
  const mockAutocomplete = () => async () => ({
    data: [],
    paging: { total: 0 },
  });

  const AdvancedSearchClassBase = Object.assign(
    jest.fn().mockImplementation(() => ({
      baseConfig: {
        types: {
          multiselect: {
            widgets: {},
          },
          select: {
            widgets: {
              text: {
                operators: ['like', 'not_like', 'regexp'],
              },
            },
          },
        },
      },
    })),
    {
      autocomplete: mockAutocomplete,
    }
  );

  return {
    AdvancedSearchClassBase,
    __esModule: true,
    default: AdvancedSearchClassBase,
  };
});

describe('APICollectionPage', () => {
  beforeEach(() => {
    setMockPermissions({ ViewAll: true, EditAll: true });
  });

  // Guardrail for the two-call pattern (view-tier gates the entity useQuery's `enabled`;
  // edit-tier is deleted-gated once `apiCollection` exists — see the comments on the two
  // useEntityPermissions call sites in APICollectionPage.tsx): the page must call the hook
  // with the IDENTICAL (resource, identifier) pair both times. See
  // SearchIndexDetailsPage.test.tsx's afterEach for the general rationale.
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

  const renderComponent = () => {
    return renderWithQueryClient(<APICollectionPage />);
  };

  it('should fetch permissions for the api collection fqn', async () => {
    renderComponent();

    await waitFor(() => {
      expect(mockUseEntityPermissions).toHaveBeenCalledWith(
        ResourceEntity.API_COLLECTION,
        'api.collection.v1'
      );
    });
  });

  it('shows the permission-fetch error toast when the hook reports an error', async () => {
    const permissionError = new Error('permission fetch failed');
    setMockPermissions(
      { ViewAll: true, EditAll: true },
      { error: permissionError }
    );

    renderComponent();

    // Old fetchAPICollectionPermission's catch passed the raw error straight to
    // showErrorToast with no translated message — preserved verbatim.
    await waitFor(() => {
      expect(showErrorToast).toHaveBeenCalledWith(permissionError);
    });
  });

  it('should call APIs with updated FQN when FQN changes', async () => {
    // Set initial FQN
    (useParams as jest.Mock).mockReturnValue({
      fqn: 'api.collection.v1',
      tab: 'api_endpoint',
    });

    const { rerender } = renderComponent();

    // Verify initial API calls
    await waitFor(() => {
      expect(getApiCollectionByFQN).toHaveBeenCalledWith('api.collection.v1', {
        fields: `${TabSpecificField.OWNERS},${TabSpecificField.TAGS},${TabSpecificField.DOMAINS},${TabSpecificField.VOTES},${TabSpecificField.EXTENSION},${TabSpecificField.DATA_PRODUCTS}`,
        include: Include.All,
      });
      expect(getApiEndPoints).toHaveBeenCalledWith({
        apiCollection: 'api.collection.v1',
        service: '',
        paging: { limit: 0 },
        include: Include.NonDeleted,
      });
      expect(fetchEntityTaskCountsInto).toHaveBeenCalledWith(
        'api.collection.v1',
        expect.any(Function)
      );
    });

    // Clear mocks to track new calls
    jest.clearAllMocks();

    // Change FQN
    (useParams as jest.Mock).mockReturnValue({
      fqn: 'api.collection.v2',
      tab: 'api_endpoint',
    });
    (useFqn as jest.Mock).mockReturnValue({ fqn: 'api.collection.v2' });

    // Rerender with new FQN
    rerender(<APICollectionPage />);

    // Verify APIs are called with new FQN
    await waitFor(() => {
      expect(getApiCollectionByFQN).toHaveBeenCalledWith('api.collection.v2', {
        fields: `${TabSpecificField.OWNERS},${TabSpecificField.TAGS},${TabSpecificField.DOMAINS},${TabSpecificField.VOTES},${TabSpecificField.EXTENSION},${TabSpecificField.DATA_PRODUCTS}`,
        include: Include.All,
      });
      expect(getApiEndPoints).toHaveBeenCalledWith({
        apiCollection: 'api.collection.v2',
        service: '',
        paging: { limit: 0 },
        include: Include.NonDeleted,
      });
      expect(fetchEntityTaskCountsInto).toHaveBeenCalledWith(
        'api.collection.v2',
        expect.any(Function)
      );
    });

    // Verify each API was called exactly once with new FQN
    expect(getApiCollectionByFQN).toHaveBeenCalledTimes(1);
    expect(getApiEndPoints).toHaveBeenCalledTimes(1);
    expect(fetchEntityTaskCountsInto).toHaveBeenCalledTimes(1);
  });

  it('should pass entity name as pageTitle to PageLayoutV1', async () => {
    const mockApiCollectionDetails = {
      name: 'test-api-collection',
      id: '123',
    };

    (getApiCollectionByFQN as jest.Mock).mockResolvedValueOnce(
      mockApiCollectionDetails
    );

    renderComponent();

    await waitFor(() => {
      expect(PageLayoutV1).toHaveBeenCalledWith(
        expect.objectContaining({
          pageTitle: 'test-api-collection',
        }),
        expect.anything()
      );
    });
  });
});
