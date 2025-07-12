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

import { render, waitFor } from '@testing-library/react';
import { useParams } from 'react-router-dom';
import { EntityType, TabSpecificField } from '../../enums/entity.enum';
import { Include } from '../../generated/type/include';
import { useFqn } from '../../hooks/useFqn';
import { getApiCollectionByFQN } from '../../rest/apiCollectionsAPI';
import { getApiEndPoints } from '../../rest/apiEndpointsAPI';
import { getFeedCounts } from '../../utils/CommonUtils';
import APICollectionPage from './APICollectionPage';

jest.mock('../../rest/apiCollectionsAPI', () => ({
  getApiCollectionByFQN: jest.fn().mockResolvedValue({}),
  restoreApiCollection: jest.fn().mockResolvedValue({ version: 1 }),
  patchApiCollection: jest.fn().mockResolvedValue({}),
  updateApiCollectionVote: jest.fn().mockResolvedValue({}),
}));

jest.mock('../../rest/apiEndpointsAPI', () => ({
  getApiEndPoints: jest.fn().mockResolvedValue({ paging: { total: 0 } }),
}));

jest.mock('../../utils/CommonUtils', () => ({
  getFeedCounts: jest.fn(),
  getEntityMissingError: jest.fn(),
  showErrorToast: jest.fn(),
  showSuccessToast: jest.fn(),
  getCountBadge: jest.fn().mockImplementation((count) => <span>{count}</span>),
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

jest.mock('../../context/PermissionProvider/PermissionProvider', () => ({
  usePermissionProvider: jest.fn().mockReturnValue({
    getEntityPermissionByFqn: jest.fn().mockResolvedValue({
      ViewAll: true,
      EditAll: true,
    }),
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

jest.mock('../../components/common/Loader/Loader', () =>
  jest.fn().mockImplementation(() => <div>Loader</div>)
);

jest.mock('../../components/AppRouter/withActivityFeed', () => ({
  withActivityFeed: jest.fn().mockImplementation((Component) => Component),
}));

jest.mock('../../components/common/DocumentTitle/DocumentTitle', () =>
  jest.fn().mockImplementation(() => <div>DocumentTitle</div>)
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
  const renderComponent = () => {
    return render(<APICollectionPage />);
  };

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
      expect(getFeedCounts).toHaveBeenCalledWith(
        EntityType.API_COLLECTION,
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
      expect(getFeedCounts).toHaveBeenCalledWith(
        EntityType.API_COLLECTION,
        'api.collection.v2',
        expect.any(Function)
      );
    });

    // Verify each API was called exactly once with new FQN
    expect(getApiCollectionByFQN).toHaveBeenCalledTimes(1);
    expect(getApiEndPoints).toHaveBeenCalledTimes(1);
    expect(getFeedCounts).toHaveBeenCalledTimes(1);
  });
});
