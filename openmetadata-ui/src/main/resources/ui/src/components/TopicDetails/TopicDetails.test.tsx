/*
 *  Copyright 2021 Collate
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

import { findByTestId, findByText, render } from '@testing-library/react';
import { LeafNodes, LoadingNodeState } from 'Models';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { Topic } from '../../generated/entity/data/topic';
import { EntityReference } from '../../generated/type/entityReference';
import { Paging } from '../../generated/type/paging';
import { TagLabel } from '../../generated/type/tagLabel';
import TopicDetails from './TopicDetails.component';

jest.mock('../../authentication/auth-provider/AuthProvider', () => {
  return {
    useAuthContext: jest.fn(() => ({
      isAuthDisabled: false,
      isAuthenticated: true,
      isProtectedRoute: jest.fn().mockReturnValue(true),
      isTourRoute: jest.fn().mockReturnValue(false),
      onLogoutHandler: jest.fn(),
    })),
  };
});

const mockUserTeam = [
  {
    description: 'description',
    displayName: 'Cloud_Infra',
    id: 'id1',
    name: 'Cloud_infra',
    type: 'team',
  },
  {
    description: 'description',
    displayName: 'Finance',
    id: 'id2',
    name: 'Finance',
    type: 'team',
  },
];

const TopicDetailsProps = {
  partitions: 0,
  cleanupPolicies: [],
  maximumMessageSize: 0,
  replicationFactor: 0,
  retentionSize: 0,
  schemaText: '',
  schemaType: 'Avro',
  serviceType: '',
  users: [],
  topicDetails: {} as Topic,
  entityName: '',
  activeTab: 1,
  owner: {} as EntityReference,
  description: '',
  tier: {} as TagLabel,
  followers: [],
  topicTags: [],
  slashedTopicName: [],
  setActiveTabHandler: jest.fn(),
  followTopicHandler: jest.fn(),
  unfollowTopicHandler: jest.fn(),
  settingsUpdateHandler: jest.fn(),
  descriptionUpdateHandler: jest.fn(),
  tagUpdateHandler: jest.fn(),
  loadNodeHandler: jest.fn(),
  lineageLeafNodes: {} as LeafNodes,
  isNodeLoading: {} as LoadingNodeState,
  version: '',
  versionHandler: jest.fn(),
  addLineageHandler: jest.fn(),
  removeLineageHandler: jest.fn(),
  entityLineageHandler: jest.fn(),
  entityThread: [],
  isentityThreadLoading: false,
  postFeedHandler: jest.fn(),
  feedCount: 0,
  entityFieldThreadCount: [],
  createThread: jest.fn(),
  topicFQN: '',
  deletePostHandler: jest.fn(),
  paging: {} as Paging,
  fetchFeedHandler: jest.fn(),
};

const mockObserve = jest.fn();
const mockunObserve = jest.fn();

window.IntersectionObserver = jest.fn().mockImplementation(() => ({
  observe: mockObserve,
  unobserve: mockunObserve,
}));

jest.mock('../ManageTab/ManageTab.component', () => {
  return jest.fn().mockReturnValue(<p data-testid="manage">ManageTab</p>);
});

jest.mock('../common/description/Description', () => {
  return jest.fn().mockReturnValue(<p>Description Component</p>);
});
jest.mock('../common/rich-text-editor/RichTextEditorPreviewer', () => {
  return jest.fn().mockReturnValue(<p>RichTextEditorPreviwer</p>);
});

jest.mock('../tags-container/tags-container', () => {
  return jest.fn().mockReturnValue(<p>Tag Container</p>);
});

jest.mock('../tags/tags', () => {
  return jest.fn().mockReturnValue(<p>Tags</p>);
});

jest.mock('../common/entityPageInfo/EntityPageInfo', () => {
  return jest.fn().mockReturnValue(<p>EntityPageInfo</p>);
});

jest.mock('../FeedEditor/FeedEditor', () => {
  return jest.fn().mockReturnValue(<p>FeedEditor</p>);
});

jest.mock('../ActivityFeed/ActivityFeedList/ActivityFeedList.tsx', () => {
  return jest.fn().mockReturnValue(<p>ActivityFeedList</p>);
});

jest.mock('../schema-editor/SchemaEditor', () => {
  return jest.fn().mockReturnValue(<p>SchemaEditor</p>);
});

jest.mock('../../utils/CommonUtils', () => ({
  addToRecentViewed: jest.fn(),
  getCountBadge: jest.fn(),
  getCurrentUserId: jest.fn().mockReturnValue('CurrentUserId'),
  getPartialNameFromFQN: jest.fn().mockReturnValue('PartialNameFromFQN'),
  getUserTeams: () => mockUserTeam,
  getHtmlForNonAdminAction: jest.fn(),
  getEntityPlaceHolder: jest.fn().mockReturnValue('value'),
  getEntityName: jest.fn().mockReturnValue('entityName'),
}));

describe('Test TopicDetails component', () => {
  it('Checks if the TopicDetails component has all the proper components rendered', async () => {
    const { container } = render(<TopicDetails {...TopicDetailsProps} />, {
      wrapper: MemoryRouter,
    });
    const EntityPageInfo = await findByText(container, /EntityPageInfo/i);
    const description = await findByText(container, /Description Component/i);
    const tabs = await findByTestId(container, 'tabs');
    const schemaTab = await findByTestId(tabs, 'Schema');
    const activityFeedTab = await findByTestId(tabs, 'Activity Feed');
    const configTab = await findByTestId(tabs, 'Config');
    const manageTab = await findByTestId(tabs, 'Manage');

    expect(EntityPageInfo).toBeInTheDocument();
    expect(description).toBeInTheDocument();
    expect(tabs).toBeInTheDocument();
    expect(schemaTab).toBeInTheDocument();
    expect(activityFeedTab).toBeInTheDocument();
    expect(configTab).toBeInTheDocument();
    expect(manageTab).toBeInTheDocument();
  });

  it('Check if active tab is schema', async () => {
    const { container } = render(<TopicDetails {...TopicDetailsProps} />, {
      wrapper: MemoryRouter,
    });
    const schema = await findByTestId(container, 'schema');

    expect(schema).toBeInTheDocument();
  });

  it('Check if active tab is activity feed', async () => {
    const { container } = render(
      <TopicDetails {...TopicDetailsProps} activeTab={2} />,
      {
        wrapper: MemoryRouter,
      }
    );
    const activityFeedList = await findByText(container, /ActivityFeedList/i);

    expect(activityFeedList).toBeInTheDocument();
  });

  it('Check if active tab is config', async () => {
    const { container } = render(
      <TopicDetails {...TopicDetailsProps} activeTab={3} />,
      {
        wrapper: MemoryRouter,
      }
    );
    const config = await findByTestId(container, 'config');

    expect(config).toBeInTheDocument();
  });

  it('Check if active tab is manage', async () => {
    const { container } = render(
      <TopicDetails {...TopicDetailsProps} activeTab={4} />,
      {
        wrapper: MemoryRouter,
      }
    );
    const manage = await findByTestId(container, 'manage');

    expect(manage).toBeInTheDocument();
  });

  it('Should create an observer if IntersectionObserver is available', async () => {
    const { container } = render(
      <TopicDetails {...TopicDetailsProps} activeTab={4} />,
      {
        wrapper: MemoryRouter,
      }
    );

    const obServerElement = await findByTestId(container, 'observer-element');

    expect(obServerElement).toBeInTheDocument();

    expect(mockObserve).toHaveBeenCalled();
  });
});
