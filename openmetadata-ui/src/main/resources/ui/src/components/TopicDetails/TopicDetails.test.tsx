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

import {
  findByTestId,
  findByText,
  render,
  screen,
} from '@testing-library/react';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { EntityReference } from '../../generated/type/entityReference';
import { Paging } from '../../generated/type/paging';
import { TagLabel } from '../../generated/type/tagLabel';
import {
  LeafNodes,
  LoadingNodeState,
} from '../EntityLineage/EntityLineage.interface';
import TopicDetails from './TopicDetails.component';
import { TOPIC_DETAILS } from './TopicDetails.mock';

jest.mock('../common/EntitySummaryDetails/EntitySummaryDetails', () => {
  return jest
    .fn()
    .mockReturnValue(
      <p data-testid="entity-summary-details">EntitySummaryDetails component</p>
    );
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
  serviceType: '',
  users: [],
  topicDetails: TOPIC_DETAILS,
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
  isEntityThreadLoading: false,
  postFeedHandler: jest.fn(),
  feedCount: 0,
  entityFieldThreadCount: [],
  entityFieldTaskCount: [],
  createThread: jest.fn(),
  topicFQN: '',
  deletePostHandler: jest.fn(),
  paging: {} as Paging,
  fetchFeedHandler: jest.fn(),
  updateThreadHandler: jest.fn(),
  lineageTabData: {
    loadNodeHandler: jest.fn(),
    addLineageHandler: jest.fn(),
    removeLineageHandler: jest.fn(),
    entityLineageHandler: jest.fn(),
    isLineageLoading: false,
    entityLineage: { entity: { id: 'test', type: 'topic' } },
    lineageLeafNodes: {} as LeafNodes,
    isNodeLoading: { id: undefined, state: false },
  },
  onExtensionUpdate: jest.fn(),
};

const mockObserve = jest.fn();
const mockunObserve = jest.fn();

window.IntersectionObserver = jest.fn().mockImplementation(() => ({
  observe: mockObserve,
  unobserve: mockunObserve,
}));

jest.mock('../EntityLineage/EntityLineage.component', () => {
  return jest.fn().mockReturnValue(<p>EntityLineage.component</p>);
});

jest.mock('../common/description/Description', () => {
  return jest.fn().mockReturnValue(<p>Description Component</p>);
});
jest.mock('../common/rich-text-editor/RichTextEditorPreviewer', () => {
  return jest.fn().mockReturnValue(<p>RichTextEditorPreviwer</p>);
});

jest.mock('components/Tag/TagsContainer/tags-container', () => {
  return jest.fn().mockReturnValue(<p>Tag Container</p>);
});

jest.mock('components/Tag/Tags/tags', () => {
  return jest.fn().mockReturnValue(<p>Tags</p>);
});

jest.mock('../common/entityPageInfo/EntityPageInfo', () => {
  return jest.fn().mockReturnValue(<p>EntityPageInfo</p>);
});

jest.mock('../FeedEditor/FeedEditor', () => {
  return jest.fn().mockReturnValue(<p>FeedEditor</p>);
});

jest.mock('../common/CustomPropertyTable/CustomPropertyTable', () => ({
  CustomPropertyTable: jest
    .fn()
    .mockReturnValue(<p>CustomPropertyTable.component</p>),
}));

jest.mock('../ActivityFeed/ActivityFeedList/ActivityFeedList.tsx', () => {
  return jest.fn().mockReturnValue(<p>ActivityFeedList</p>);
});

jest.mock('../schema-editor/SchemaEditor', () => {
  return jest.fn().mockReturnValue(<p>SchemaEditor</p>);
});

jest.mock('./TopicSchema/TopicSchema', () => {
  return jest
    .fn()
    .mockReturnValue(<div data-testid="schema-fields">TopicSchema</div>);
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
  getOwnerValue: jest.fn().mockReturnValue('Owner'),
}));

describe('Test TopicDetails component', () => {
  it('Checks if the TopicDetails component has all the proper components rendered', async () => {
    const { container } = render(<TopicDetails {...TopicDetailsProps} />, {
      wrapper: MemoryRouter,
    });
    const EntityPageInfo = await findByText(container, /EntityPageInfo/i);
    const description = await findByText(container, /Description Component/i);
    const tabs = await findByTestId(container, 'tabs');
    const schemaTab = await findByTestId(tabs, 'label.schema');
    const activityFeedTab = await findByTestId(
      tabs,
      'label.activity-feed-and-task-plural'
    );
    const configTab = await findByTestId(tabs, 'label.config');

    expect(EntityPageInfo).toBeInTheDocument();
    expect(description).toBeInTheDocument();
    expect(tabs).toBeInTheDocument();
    expect(schemaTab).toBeInTheDocument();
    expect(activityFeedTab).toBeInTheDocument();
    expect(configTab).toBeInTheDocument();
  });

  it('Check if active tab is schema', async () => {
    const { container } = render(<TopicDetails {...TopicDetailsProps} />, {
      wrapper: MemoryRouter,
    });
    const schema = await findByTestId(container, 'label.schema');
    const schemaFields = await screen.findByTestId('schema-fields');

    expect(schema).toBeInTheDocument();
    expect(schemaFields).toBeInTheDocument();
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

  it('Check if active tab is sample data', async () => {
    const { container } = render(
      <TopicDetails {...TopicDetailsProps} activeTab={3} />,
      {
        wrapper: MemoryRouter,
      }
    );
    const sampleData = await findByTestId(container, 'sample-data');

    expect(sampleData).toBeInTheDocument();
  });

  it('Check if active tab is config', async () => {
    const { container } = render(
      <TopicDetails {...TopicDetailsProps} activeTab={4} />,
      {
        wrapper: MemoryRouter,
      }
    );
    const config = await findByTestId(container, 'config');

    expect(config).toBeInTheDocument();
  });

  it('Should render lineage tab', async () => {
    const { container } = render(
      <TopicDetails {...TopicDetailsProps} activeTab={5} />,
      {
        wrapper: MemoryRouter,
      }
    );

    const detailContainer = await findByTestId(container, 'lineage-details');

    expect(detailContainer).toBeInTheDocument();
  });

  it('Check if active tab is custom properties', async () => {
    const { container } = render(
      <TopicDetails {...TopicDetailsProps} activeTab={6} />,
      {
        wrapper: MemoryRouter,
      }
    );
    const customProperties = await findByText(
      container,
      'CustomPropertyTable.component'
    );

    expect(customProperties).toBeInTheDocument();
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
