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
import { EntityTabs } from '../../../enums/entity.enum';
import { DEFAULT_ENTITY_PERMISSION } from '../../../utils/PermissionsUtils';
import TopicDetails from './TopicDetails.component';
import { TopicDetailsProps } from './TopicDetails.interface';
import { TOPIC_DETAILS } from './TopicDetails.mock';

jest.mock('../../common/EntitySummaryDetails/EntitySummaryDetails', () => {
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

const topicDetailsProps: TopicDetailsProps = {
  topicDetails: TOPIC_DETAILS,
  fetchTopic: jest.fn(),
  followTopicHandler: jest.fn(),
  unFollowTopicHandler: jest.fn(),
  onTopicUpdate: jest.fn(),
  versionHandler: jest.fn(),
  createThread: jest.fn(),
  topicPermissions: DEFAULT_ENTITY_PERMISSION,
  handleToggleDelete: jest.fn(),
  onUpdateVote: jest.fn(),
};

const mockParams = {
  topicFQN: 'test',
  tab: EntityTabs.SCHEMA,
};

jest.mock('react-router-dom', () => ({
  useHistory: jest.fn(),
  useLocation: jest.fn().mockReturnValue({ pathname: 'topic' }),
  useParams: jest.fn().mockImplementation(() => mockParams),
}));

jest.mock('../../Lineage/Lineage.component', () => {
  return jest.fn().mockReturnValue(<p>EntityLineage.component</p>);
});

jest.mock('../../common/EntityDescription/DescriptionV1', () => {
  return jest.fn().mockReturnValue(<p>Description Component</p>);
});

jest.mock('../../common/TitleBreadcrumb/TitleBreadcrumb.component', () => {
  return jest.fn().mockReturnValue(<p>Breadcrumb</p>);
});

jest.mock('../../PageLayoutV1/PageLayoutV1', () => {
  return jest.fn().mockImplementation(({ children }) => <div>{children}</div>);
});

jest.mock('../../common/RichTextEditor/RichTextEditorPreviewer', () => {
  return jest.fn().mockReturnValue(<p>RichTextEditorPreviwer</p>);
});

jest.mock('../../common/CustomPropertyTable/CustomPropertyTable', () => ({
  CustomPropertyTable: jest
    .fn()
    .mockReturnValue(<p>CustomPropertyTable.component</p>),
}));

jest.mock('../../ActivityFeed/FeedEditor/FeedEditor', () => {
  return jest.fn().mockReturnValue(<p>FeedEditor.component</p>);
});

jest.mock('../TopicSchema/TopicSchema', () => {
  return jest
    .fn()
    .mockReturnValue(<div data-testid="schema-fields">TopicSchema</div>);
});

jest.mock(
  '../../Database/SampleDataWithMessages/SampleDataWithMessages',
  () => {
    return jest.fn().mockReturnValue(<div>SampleDataWithMessages</div>);
  }
);

jest.mock('../../../utils/CommonUtils', () => ({
  addToRecentViewed: jest.fn(),
  getCountBadge: jest.fn(),
  getPartialNameFromFQN: jest.fn().mockReturnValue('PartialNameFromFQN'),
  getUserTeams: () => mockUserTeam,
  getHtmlForNonAdminAction: jest.fn(),
  getEntityPlaceHolder: jest.fn().mockReturnValue('value'),
  getEntityName: jest.fn().mockReturnValue('entityName'),
  getOwnerValue: jest.fn().mockReturnValue('Owner'),
}));

describe.skip('Test TopicDetails component', () => {
  it('Checks if the TopicDetails component has all the proper components rendered', async () => {
    const { container } = render(<TopicDetails {...topicDetailsProps} />, {
      wrapper: MemoryRouter,
    });

    const tabs = await findByTestId(container, 'tabs');
    const schemaTab = await findByTestId(tabs, 'schema');
    const activityFeedTab = await findByTestId(tabs, 'activity_feed');
    const configTab = await findByTestId(tabs, 'config');

    expect(tabs).toBeInTheDocument();
    expect(schemaTab).toBeInTheDocument();
    expect(activityFeedTab).toBeInTheDocument();
    expect(configTab).toBeInTheDocument();
  });

  it('Check if active tab is schema', async () => {
    const { container } = render(<TopicDetails {...topicDetailsProps} />, {
      wrapper: MemoryRouter,
    });
    const schema = await findByTestId(container, 'schema');
    const schemaFields = await screen.findByTestId('schema-fields');

    expect(schema).toBeInTheDocument();
    expect(schemaFields).toBeInTheDocument();
  });

  it('Check if active tab is activity feed', async () => {
    mockParams.tab = EntityTabs.ACTIVITY_FEED;
    const { container } = render(<TopicDetails {...topicDetailsProps} />, {
      wrapper: MemoryRouter,
    });
    const activityFeedList = await findByText(container, /ActivityFeedList/i);

    expect(activityFeedList).toBeInTheDocument();
  });

  it('Check if active tab is sample data', async () => {
    mockParams.tab = EntityTabs.SAMPLE_DATA;
    const { container } = render(<TopicDetails {...topicDetailsProps} />, {
      wrapper: MemoryRouter,
    });
    const sampleData = await findByText(container, 'SampleDataWithMessages');

    expect(sampleData).toBeInTheDocument();
  });

  it('Check if active tab is config', async () => {
    mockParams.tab = EntityTabs.CONFIG;
    const { container } = render(<TopicDetails {...topicDetailsProps} />, {
      wrapper: MemoryRouter,
    });
    const config = await findByTestId(container, 'config-details');

    expect(config).toBeInTheDocument();
  });

  it('Should render lineage tab', async () => {
    mockParams.tab = EntityTabs.LINEAGE;
    const { container } = render(<TopicDetails {...topicDetailsProps} />, {
      wrapper: MemoryRouter,
    });

    const detailContainer = await findByTestId(container, 'lineage-details');

    expect(detailContainer).toBeInTheDocument();
  });

  it('Check if active tab is custom properties', async () => {
    mockParams.tab = EntityTabs.CUSTOM_PROPERTIES;
    const { container } = render(<TopicDetails {...topicDetailsProps} />, {
      wrapper: MemoryRouter,
    });
    const customProperties = await findByText(
      container,
      'CustomPropertyTable.component'
    );

    expect(customProperties).toBeInTheDocument();
  });

  it('Should create an observer if IntersectionObserver is available', async () => {
    mockParams.tab = EntityTabs.ACTIVITY_FEED;
    const { container } = render(<TopicDetails {...topicDetailsProps} />, {
      wrapper: MemoryRouter,
    });

    const obServerElement = await findByTestId(container, 'observer-element');

    expect(obServerElement).toBeInTheDocument();
  });
});
