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
import { OperationPermission } from '../../../context/PermissionProvider/PermissionProvider.interface';
import { Topic } from '../../../generated/entity/data/topic';
import { DEFAULT_ENTITY_PERMISSION } from '../../../utils/PermissionsUtils';
import topicClassBase from '../../../utils/TopicClassBase';
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

jest.mock('../../../utils/EntityNameUtils', () => ({
  getEntityName: jest.fn().mockReturnValue('testEntityName'),
}));

jest.mock('../../../utils/EntityReferenceUtils', () => ({
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

jest.mock('../../../utils/FeedUtilsPure', () => ({
  fetchEntityActivityCountInto: jest.fn(),
  fetchEntityTaskCountsInto: jest.fn(),
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

jest.mock('../../../utils/CustomizePage/CustomizePageEntityTabUtils', () => ({
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
  beforeEach(() => {
    (topicClassBase.getTopicDetailPageTabs as jest.Mock).mockClear();
  });

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

  // Consumer via prop (Task 8 rule 2): `topicPermissions` stays raw (Task 7A
  // precedent) — only the internal derivation, now a single `deleted`-gated
  // getDerivedPermissionFlags(topicPermissions, deleted) call, converts. This
  // covers the whole derivation swap (9 fields collapsed into 1 call, including
  // the 2 flagged raw `EditAll`/`ViewAll` reads) via the fields that actually
  // reach a consumer: `lineageTab`'s hasEditAccess (editLineagePermission) and
  // `customPropertiesTab`'s hasEditAccess/hasPermission (editCustomAttribute/
  // viewCustomPropertiesPermission) — asserted on the config object passed to
  // the mocked topicClassBase.getTopicDetailPageTabs, since the actual tab
  // content is never rendered (the mock returns `[]`).
  it('derives edit/view flags correctly and passes them into the tabs config', () => {
    const permissions: OperationPermission = {
      ...DEFAULT_ENTITY_PERMISSION,
      EditLineage: true,
      EditCustomFields: false,
      EditAll: true,
      ViewCustomFields: true,
    } as OperationPermission;

    render(<TopicDetails {...mockProps} topicPermissions={permissions} />, {
      wrapper: MemoryRouter,
    });

    const mockGetTabs = topicClassBase.getTopicDetailPageTabs as jest.Mock;
    const config = mockGetTabs.mock.calls[0][0];

    // EditLineage explicit true wins (prioritized over EditAll).
    expect(config.lineageTab.props.hasEditAccess).toBe(true);
    // EditCustomFields explicit false wins over a granted EditAll —
    // explicit-deny-wins semantics preserved by getDerivedPermissionFlags.
    expect(config.customPropertiesTab.props.hasEditAccess).toBe(false);
    expect(config.customPropertiesTab.props.hasPermission).toBe(true);
  });

  it('gates edit flags on deleted while leaving view flags ungated', () => {
    const permissions: OperationPermission = {
      ...DEFAULT_ENTITY_PERMISSION,
      EditLineage: true,
      ViewCustomFields: true,
    } as OperationPermission;

    render(
      <TopicDetails
        {...mockProps}
        topicDetails={{ ...mockTopicDetails, deleted: true }}
        topicPermissions={permissions}
      />,
      { wrapper: MemoryRouter }
    );

    const mockGetTabs = topicClassBase.getTopicDetailPageTabs as jest.Mock;
    const config = mockGetTabs.mock.calls[0][0];

    expect(config.lineageTab.props.hasEditAccess).toBe(false);
    expect(config.customPropertiesTab.props.hasPermission).toBe(true);
  });
});
