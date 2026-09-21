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

import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { APIRequestMethod } from '../../../generated/api/data/createAPIEndpoint';
import { APIEndpoint } from '../../../generated/entity/data/apiEndpoint';
import { DEFAULT_ENTITY_PERMISSION } from '../../../utils/PermissionsUtils';
import PageLayoutV1 from '../../PageLayoutV1/PageLayoutV1';
import APIEndpointDetails from './APIEndpointDetails';
import { APIEndpointDetailsProps } from './APIEndpointDetails.interface';

const mockApiEndpointDetails: APIEndpoint = {
  id: 'test-apiendpoint-id',
  name: 'test-apiendpoint',
  displayName: 'Test API Endpoint',
  fullyQualifiedName: 'test.apiendpoint',
  description: 'Test API endpoint description',
  version: 0.1,
  updatedAt: 1234567890,
  updatedBy: 'test-user',
  href: 'http://test.com',
  endpointURL: 'http://api.test.com/endpoint',
  requestMethod: APIRequestMethod.Get,
  service: {
    id: 'test-service-id',
    type: 'apiService',
    name: 'test-service',
    fullyQualifiedName: 'test-service',
    deleted: false,
  },
};

const ENDPOINT_ROUTE =
  '/apiEndpoint/test-service.test-collection.test-apiendpoint';

const LocationProbe = () => {
  const { pathname } = useLocation();

  return <p data-testid="location-display">{pathname}</p>;
};

const mockProps: APIEndpointDetailsProps = {
  apiEndpointDetails: mockApiEndpointDetails,
  apiEndpointPermissions: DEFAULT_ENTITY_PERMISSION,
  fetchAPIEndpointDetails: jest.fn(),
  onFollowApiEndPoint: jest.fn(),
  onApiEndpointUpdate: jest.fn(),
  onToggleDelete: jest.fn(),
  onUnFollowApiEndPoint: jest.fn(),
  onUpdateApiEndpointDetails: jest.fn(),
  onVersionChange: jest.fn(),
  onUpdateVote: jest.fn(),
};

jest.mock('../../PageLayoutV1/PageLayoutV1', () => {
  return jest.fn().mockImplementation(({ children }) => <div>{children}</div>);
});

jest.mock('../../../utils/EntityNameUtils', () => ({
  getEntityName: jest.fn().mockReturnValue('testEntityName'),
}));

jest.mock('../../../hooks/useApplicationStore', () => ({
  useApplicationStore: jest.fn().mockReturnValue({
    currentUser: {
      id: 'testUser',
    },
  }),
}));

jest.mock('../../../hooks/useCustomPages', () => ({
  useCustomPages: jest.fn().mockReturnValue({
    customizedPage: undefined,
    isLoading: false,
  }),
}));

jest.mock('../../../hooks/useFqn', () => ({
  useFqn: jest.fn().mockReturnValue({
    fqn: 'test.apiendpoint',
    entityFqn: 'test-service.test-collection.test-apiendpoint',
  }),
}));

jest.mock('../../../utils/useRequiredParams', () => ({
  useRequiredParams: jest.fn().mockReturnValue({
    tab: 'schema',
  }),
}));

jest.mock('../../../utils/FeedUtilsPure', () => ({
  getFeedCounts: jest.fn(),
  fetchEntityTaskCountsInto: jest.fn(),
  fetchEntityActivityCountInto: jest.fn(),
}));

jest.mock('../../../utils/TablePureUtils', () => ({
  getTagsWithoutTier: jest.fn().mockReturnValue([]),
  getTierTags: jest.fn().mockReturnValue([]),
}));

jest.mock(
  '../../DataAssets/DataAssetsHeader/DataAssetsHeader.component',
  () => ({
    DataAssetsHeader: jest
      .fn()
      .mockImplementation(
        ({
          afterDeleteAction,
        }: {
          afterDeleteAction: (isSoftDelete?: boolean) => void;
        }) => (
          <div>
            DataAssetsHeader
            <button
              data-testid="hard-delete"
              onClick={() => afterDeleteAction(false)}>
              hardDelete
            </button>
            <button
              data-testid="soft-delete"
              onClick={() => afterDeleteAction(true)}>
              softDelete
            </button>
          </div>
        )
      ),
  })
);

jest.mock('../../Customization/GenericProvider/GenericProvider', () => ({
  GenericProvider: jest
    .fn()
    .mockImplementation(({ children }) => <div>{children}</div>),
}));

jest.mock('../../../hoc/LimitWrapper', () => {
  return jest.fn().mockImplementation(({ children }) => <div>{children}</div>);
});

jest.mock('../../AppRouter/withActivityFeed', () => ({
  withActivityFeed: jest.fn().mockImplementation((component) => component),
}));

jest.mock('../../../utils/APIEndpoints/APIEndpointClassBase', () => ({
  __esModule: true,
  default: {
    getAPIEndpointDetailPageTabs: jest.fn().mockReturnValue([]),
  },
}));

jest.mock('../../../utils/CustomizePage/CustomizePageEntityTabUtils', () => ({
  getTabLabelMapFromTabs: jest.fn().mockReturnValue({}),
  getDetailsTabWithNewLabel: jest.fn().mockReturnValue([]),
  checkIfExpandViewSupported: jest.fn().mockReturnValue(false),
}));

describe('APIEndpointDetails component', () => {
  it('should render successfully', () => {
    const { container } = render(<APIEndpointDetails {...mockProps} />, {
      wrapper: MemoryRouter,
    });

    expect(container).toBeInTheDocument();
  });

  it('should pass entity name as pageTitle to PageLayoutV1', () => {
    render(<APIEndpointDetails {...mockProps} />, {
      wrapper: MemoryRouter,
    });

    expect(PageLayoutV1).toHaveBeenCalledWith(
      expect.objectContaining({
        pageTitle: 'testEntityName',
      }),
      expect.anything()
    );
  });

  // A hard-deleted endpoint no longer exists, so the page sends the user to the
  // collection it belonged to.
  describe('post-delete redirect', () => {
    const renderEndpoint = (props: APIEndpointDetailsProps = mockProps) =>
      render(
        <MemoryRouter initialEntries={[ENDPOINT_ROUTE]}>
          <APIEndpointDetails {...props} />
          <LocationProbe />
        </MemoryRouter>
      );

    it('should land on the collection named by the entity reference', () => {
      renderEndpoint({
        ...mockProps,
        apiEndpointDetails: {
          ...mockApiEndpointDetails,
          apiCollection: {
            id: 'test-collection-id',
            type: 'apiCollection',
            fullyQualifiedName: 'other-service.other-collection',
          },
        },
      });

      fireEvent.click(screen.getByTestId('hard-delete'));

      expect(screen.getByTestId('location-display')).toHaveTextContent(
        '/apiCollection/other-service.other-collection'
      );
    });

    // The reference is absent on a partially-loaded endpoint; the collection FQN
    // is then sliced out of the endpoint's own service.collection.endpoint FQN.
    it('should derive the collection from the endpoint FQN when the reference is missing', () => {
      renderEndpoint();

      fireEvent.click(screen.getByTestId('hard-delete'));

      expect(screen.getByTestId('location-display')).toHaveTextContent(
        '/apiCollection/test-service.test-collection'
      );
    });

    it('should stay on the endpoint page after a soft delete', () => {
      renderEndpoint();

      fireEvent.click(screen.getByTestId('soft-delete'));

      expect(screen.getByTestId('location-display')).toHaveTextContent(
        ENDPOINT_ROUTE
      );
    });
  });
});
