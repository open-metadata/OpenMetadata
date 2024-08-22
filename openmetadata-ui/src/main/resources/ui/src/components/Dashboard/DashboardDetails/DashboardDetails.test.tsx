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
  findAllByTestId,
  findByTestId,
  findByText,
  render,
} from '@testing-library/react';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { EntityTabs } from '../../../enums/entity.enum';
import { ChartType } from '../../../generated/entity/data/chart';
import { Dashboard } from '../../../generated/entity/data/dashboard';
import { mockGlossaryList } from '../../../mocks/Glossary.mock';
import { mockTagList } from '../../../mocks/Tags.mock';
import DashboardDetails from './DashboardDetails.component';
import { DashboardDetailsProps } from './DashboardDetails.interface';

const mockUserTeam = [
  {
    description: 'description',
    displayName: 'displayName',
    href: 'href',
    id: 'id',
    name: 'name',
    type: 'type',
  },
  {
    description: 'description',
    displayName: 'displayName',
    href: 'href',
    id: 'id',
    name: 'name',
    type: 'type',
  },
];

const dashboardDetailsProps: DashboardDetailsProps = {
  charts: [
    {
      sourceUrl: 'http://localhost',
      chartType: ChartType.Area,
      displayName: 'Test chart',
      id: '1',
      deleted: false,
      name: '',
      service: { id: '', type: '' },
    },
  ],
  dashboardDetails: {} as Dashboard,
  followDashboardHandler: jest.fn(),
  unFollowDashboardHandler: jest.fn(),
  chartDescriptionUpdateHandler: jest.fn(),
  chartTagUpdateHandler: jest.fn(),
  onDashboardUpdate: jest.fn(),
  versionHandler: jest.fn(),
  createThread: jest.fn(),
  fetchDashboard: jest.fn(),
  handleToggleDelete: jest.fn(),
};

const mockEntityPermissions = {
  Create: true,
  Delete: true,
  ViewAll: true,
  ViewBasic: true,
  EditAll: true,
  EditTags: true,
  EditDescription: true,
  EditDisplayName: true,
  EditCustomFields: true,
};

const mockParams = {
  dashboardFQN: 'test',
  tab: EntityTabs.DETAILS,
};

jest.mock('react-router-dom', () => ({
  useHistory: jest.fn(),
  useLocation: jest.fn().mockReturnValue({ pathname: 'dashboard' }),
  useParams: jest.fn().mockImplementation(() => mockParams),
}));

jest.mock('../../common/TabsLabel/TabsLabel.component', () => {
  return jest.fn().mockImplementation(({ name }) => <p>{name}</p>);
});

jest.mock('../../common/EntityDescription/DescriptionV1', () => {
  return jest.fn().mockReturnValue(<p>Description Component</p>);
});
jest.mock('../../common/RichTextEditor/RichTextEditorPreviewer', () => {
  return jest.fn().mockReturnValue(<p>RichTextEditorPreviwer</p>);
});

jest.mock('../../../context/PermissionProvider/PermissionProvider', () => ({
  usePermissionProvider: jest.fn().mockImplementation(() => ({
    getEntityPermission: jest
      .fn()
      .mockImplementation(() => mockEntityPermissions),
  })),
}));

jest.mock('../../Database/TableTags/TableTags.component', () =>
  jest
    .fn()
    .mockImplementation(() => (
      <div data-testid="table-tag-container">Table Tag Container</div>
    ))
);

jest.mock('../../Lineage/Lineage.component', () => {
  return jest.fn().mockReturnValue(<p data-testid="lineage">Lineage</p>);
});
jest.mock('../../common/CustomPropertyTable/CustomPropertyTable', () => ({
  CustomPropertyTable: jest
    .fn()
    .mockReturnValue(<p>CustomPropertyTable.component</p>),
}));

jest.mock('../../PageLayoutV1/PageLayoutV1', () => {
  return jest.fn().mockImplementation(({ children }) => <div>{children}</div>);
});

jest.mock('../../ActivityFeed/FeedEditor/FeedEditor', () => {
  return jest.fn().mockReturnValue(<p>FeedEditor.component</p>);
});

jest.mock('../../../utils/CommonUtils', () => ({
  addToRecentViewed: jest.fn(),
  getCountBadge: jest.fn(),
  getPartialNameFromFQN: jest.fn().mockReturnValue('PartialNameFromFQN'),
  getUserTeams: () => mockUserTeam,
  getHtmlForNonAdminAction: jest.fn(),
  getEntityPlaceHolder: jest.fn().mockReturnValue('value'),
  getEntityName: jest.fn().mockReturnValue('entityName'),
  pluralize: jest.fn().mockReturnValue('2 charts'),
  getEntityDeleteMessage: jest.fn(),
  getOwnerValue: jest.fn().mockReturnValue('Owner'),
}));

jest.mock('../../../utils/TagsUtils', () => ({
  getAllTagsList: jest.fn(() => Promise.resolve(mockTagList)),
  getTagsHierarchy: jest.fn().mockReturnValue([]),
}));

jest.mock('../../../utils/GlossaryUtils', () => ({
  getGlossaryTermsList: jest.fn(() => Promise.resolve(mockGlossaryList)),
  getGlossaryTermHierarchy: jest.fn().mockReturnValue([]),
}));

describe.skip('Test DashboardDetails component', () => {
  it('Checks if the DashboardDetails component has all the proper components rendered', async () => {
    const { container } = render(
      <DashboardDetails {...dashboardDetailsProps} />,
      {
        wrapper: MemoryRouter,
      }
    );

    const tabs = await findByTestId(container, 'tabs');
    const detailsTab = await findByText(tabs, 'label.detail-plural');
    const activityFeedTab = await findByText(
      tabs,
      'label.activity-feed-and-task-plural'
    );
    const lineageTab = await findByText(tabs, 'label.lineage');
    const tagsContainer = await findAllByTestId(
      container,
      'table-tag-container'
    );

    expect(tabs).toBeInTheDocument();
    expect(detailsTab).toBeInTheDocument();
    expect(activityFeedTab).toBeInTheDocument();
    expect(lineageTab).toBeInTheDocument();
    expect(tagsContainer).toHaveLength(2);
  });

  it('Check if active tab is details', async () => {
    const { container } = render(
      <DashboardDetails {...dashboardDetailsProps} />,
      {
        wrapper: MemoryRouter,
      }
    );
    const activityFeedList = await findByTestId(container, 'charts-table');

    expect(activityFeedList).toBeInTheDocument();
  });

  it('Check if active tab is activity feed', async () => {
    mockParams.tab = EntityTabs.ACTIVITY_FEED;
    const { container } = render(
      <DashboardDetails {...dashboardDetailsProps} />,
      {
        wrapper: MemoryRouter,
      }
    );
    const activityFeedList = await findByText(container, /ActivityFeedList/i);

    expect(activityFeedList).toBeInTheDocument();
  });

  it('Check if active tab is lineage', async () => {
    mockParams.tab = EntityTabs.LINEAGE;
    const { container } = render(
      <DashboardDetails {...dashboardDetailsProps} />,
      {
        wrapper: MemoryRouter,
      }
    );
    const lineage = await findByTestId(container, 'lineage');

    expect(lineage).toBeInTheDocument();
  });

  it('Check if active tab is custom properties', async () => {
    mockParams.tab = EntityTabs.CUSTOM_PROPERTIES;
    const { container } = render(
      <DashboardDetails {...dashboardDetailsProps} />,
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
    mockParams.tab = EntityTabs.CUSTOM_PROPERTIES;
    const { container } = render(
      <DashboardDetails {...dashboardDetailsProps} />,
      {
        wrapper: MemoryRouter,
      }
    );

    const obServerElement = await findByTestId(container, 'observer-element');

    expect(obServerElement).toBeInTheDocument();
  });
});
