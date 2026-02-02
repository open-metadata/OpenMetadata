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

import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
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

jest.mock('../../../utils/EntityUtils', () => ({
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
  }),
}));

jest.mock('../../../utils/useRequiredParams', () => ({
  useRequiredParams: jest.fn().mockReturnValue({
    tab: 'schema',
  }),
}));

jest.mock('../../../utils/CommonUtils', () => ({
  getFeedCounts: jest.fn(),
}));

jest.mock('../../../utils/TableUtils', () => ({
  getTagsWithoutTier: jest.fn().mockReturnValue([]),
  getTierTags: jest.fn().mockReturnValue([]),
}));

jest.mock(
  '../../DataAssets/DataAssetsHeader/DataAssetsHeader.component',
  () => ({
    DataAssetsHeader: jest.fn().mockReturnValue(<div>DataAssetsHeader</div>),
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

jest.mock('../../../utils/CustomizePage/CustomizePageUtils', () => ({
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
});
