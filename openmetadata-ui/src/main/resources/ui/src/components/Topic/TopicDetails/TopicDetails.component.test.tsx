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
import { Topic } from '../../../generated/entity/data/topic';
import { DEFAULT_ENTITY_PERMISSION } from '../../../utils/PermissionsUtils';
import PageLayoutV1 from '../../PageLayoutV1/PageLayoutV1';
import TopicDetails from './TopicDetails.component';
import { TopicDetailsProps } from './TopicDetails.interface';

const mockTopicDetails: Topic = {
  id: 'test-topic-id',
  name: 'test-topic',
  displayName: 'Test Topic',
  fullyQualifiedName: 'test.topic',
  description: 'Test topic description',
  version: 0.1,
  updatedAt: 1234567890,
  updatedBy: 'test-user',
  href: 'http://test.com',
  service: {
    id: 'test-service-id',
    type: 'messagingService',
    name: 'test-service',
    fullyQualifiedName: 'test-service',
    deleted: false,
  },
  messageSchema: {
    schemaFields: [],
  },
  partitions: 3,
};

const mockProps: TopicDetailsProps = {
  topicDetails: mockTopicDetails,
  topicPermissions: DEFAULT_ENTITY_PERMISSION,
  updateTopicDetailsState: jest.fn(),
  fetchTopic: jest.fn(),
  followTopicHandler: jest.fn(),
  unFollowTopicHandler: jest.fn(),
  versionHandler: jest.fn(),
  onTopicUpdate: jest.fn(),
  handleToggleDelete: jest.fn(),
  onUpdateVote: jest.fn(),
};

jest.mock('../../PageLayoutV1/PageLayoutV1', () => {
  return jest.fn().mockImplementation(({ children }) => <div>{children}</div>);
});

jest.mock('../../../utils/EntityUtils', () => ({
  getEntityName: jest.fn().mockReturnValue('testEntityName'),
  getEntityReferenceFromEntity: jest.fn(),
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
    fqn: 'test.topic',
    entityFqn: 'test.topic',
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

jest.mock('../../../utils/TopicClassBase', () => ({
  __esModule: true,
  default: {
    getTopicDetailPageTabs: jest.fn().mockReturnValue([]),
  },
}));

jest.mock('../../../utils/CustomizePage/CustomizePageUtils', () => ({
  getTabLabelMapFromTabs: jest.fn().mockReturnValue({}),
  getDetailsTabWithNewLabel: jest.fn().mockReturnValue([]),
  checkIfExpandViewSupported: jest.fn().mockReturnValue(false),
}));

jest.mock(
  '../../ActivityFeed/ActivityFeedTab/ActivityFeedTab.component',
  () => ({
    ActivityFeedTab: jest.fn().mockReturnValue(<div>ActivityFeedTab</div>),
  })
);

jest.mock(
  '../../Database/SampleDataWithMessages/SampleDataWithMessages',
  () => {
    return jest.fn().mockReturnValue(<div>SampleDataWithMessages</div>);
  }
);

jest.mock('../../common/QueryViewer/QueryViewer.component', () => {
  return jest.fn().mockReturnValue(<div>QueryViewer</div>);
});

jest.mock('../../Lineage/EntityLineageTab/EntityLineageTab', () => ({
  EntityLineageTab: jest.fn().mockReturnValue(<div>EntityLineageTab</div>),
}));

jest.mock('../../common/CustomPropertyTable/CustomPropertyTable', () => ({
  CustomPropertyTable: jest
    .fn()
    .mockReturnValue(<div>CustomPropertyTable</div>),
}));

describe('TopicDetails component', () => {
  it('should render successfully', () => {
    const { container } = render(<TopicDetails {...mockProps} />, {
      wrapper: MemoryRouter,
    });

    expect(container).toBeInTheDocument();
  });

  it('should pass entity name as pageTitle to PageLayoutV1', () => {
    render(<TopicDetails {...mockProps} />, {
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
