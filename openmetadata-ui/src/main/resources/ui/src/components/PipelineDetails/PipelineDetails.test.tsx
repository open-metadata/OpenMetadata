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
import { LeafNodes, LoadingNodeState, TableDetail } from 'Models';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { Pipeline } from '../../generated/entity/data/pipeline';
import { EntityLineage } from '../../generated/type/entityLineage';
import { Paging } from '../../generated/type/paging';
import { TagLabel } from '../../generated/type/tagLabel';
import PipelineDetails from './PipelineDetails.component';

jest.mock('../../auth-provider/AuthProvider', () => {
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

const PipelineDetailsProps = {
  pipelineUrl: '',
  tasks: [],
  serviceType: '',
  users: [],
  pipelineDetails: {} as Pipeline,
  entityLineage: {} as EntityLineage,
  entityName: '',
  activeTab: 1,
  owner: {} as TableDetail['owner'],
  description: '',
  tier: {} as TagLabel,
  followers: [],
  pipelineTags: [],
  slashedPipelineName: [],
  taskUpdateHandler: jest.fn(),
  setActiveTabHandler: jest.fn(),
  followPipelineHandler: jest.fn(),
  unfollowPipelineHandler: jest.fn(),
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
  pipelineFQN: '',
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

jest.mock('../EntityLineage/EntityLineage.component', () => {
  return jest.fn().mockReturnValue(<p>EntityLineage</p>);
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

jest.mock('../EntityLineage/EntityLineage.component', () => {
  return jest.fn().mockReturnValue(<p data-testid="lineage">Lineage</p>);
});

jest.mock('../../utils/CommonUtils', () => ({
  addToRecentViewed: jest.fn(),
  getCountBadge: jest.fn(),
  getCurrentUserId: jest.fn().mockReturnValue('CurrentUserId'),
  getPartialNameFromFQN: jest.fn().mockReturnValue('PartialNameFromFQN'),
  getUserTeams: () => mockUserTeam,
  getHtmlForNonAdminAction: jest.fn(),
}));

describe('Test PipelineDetails component', () => {
  it('Checks if the PipelineDetails component has all the proper components rendered', async () => {
    const { container } = render(
      <PipelineDetails {...PipelineDetailsProps} />,
      {
        wrapper: MemoryRouter,
      }
    );
    const EntityPageInfo = await findByText(container, /EntityPageInfo/i);
    const description = await findByText(container, /Description Component/i);
    const tabs = await findByTestId(container, 'tabs');
    const detailsTab = await findByTestId(tabs, 'Details');
    const activityFeedTab = await findByTestId(tabs, 'Activity Feed');
    const lineageTab = await findByTestId(tabs, 'Lineage');
    const manageTab = await findByTestId(tabs, 'Manage');

    expect(EntityPageInfo).toBeInTheDocument();
    expect(description).toBeInTheDocument();
    expect(tabs).toBeInTheDocument();
    expect(detailsTab).toBeInTheDocument();
    expect(activityFeedTab).toBeInTheDocument();
    expect(lineageTab).toBeInTheDocument();
    expect(manageTab).toBeInTheDocument();
  });

  it('Check if active tab is details', async () => {
    const { container } = render(
      <PipelineDetails {...PipelineDetailsProps} />,
      {
        wrapper: MemoryRouter,
      }
    );
    const taskDetail = await findByTestId(container, 'tasks-table');

    expect(taskDetail).toBeInTheDocument();
  });

  it('Check if active tab is activity feed', async () => {
    const { container } = render(
      <PipelineDetails {...PipelineDetailsProps} activeTab={2} />,
      {
        wrapper: MemoryRouter,
      }
    );
    const activityFeedList = await findByText(container, /ActivityFeedList/i);

    expect(activityFeedList).toBeInTheDocument();
  });

  it('Check if active tab is lineage', async () => {
    const { container } = render(
      <PipelineDetails {...PipelineDetailsProps} activeTab={3} />,
      {
        wrapper: MemoryRouter,
      }
    );
    const lineage = await findByTestId(container, 'lineage');

    expect(lineage).toBeInTheDocument();
  });

  it('Check if active tab is manage', async () => {
    const { container } = render(
      <PipelineDetails {...PipelineDetailsProps} activeTab={4} />,
      {
        wrapper: MemoryRouter,
      }
    );
    const manage = await findByTestId(container, 'manage');

    expect(manage).toBeInTheDocument();
  });

  it('Should create an observer if IntersectionObserver is available', async () => {
    const { container } = render(
      <PipelineDetails {...PipelineDetailsProps} activeTab={4} />,
      {
        wrapper: MemoryRouter,
      }
    );

    const obServerElement = await findByTestId(container, 'observer-element');

    expect(obServerElement).toBeInTheDocument();

    expect(mockObserve).toHaveBeenCalled();
  });
});
