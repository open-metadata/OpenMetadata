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

import {
  findByTestId,
  findByText,
  fireEvent,
  render,
} from '@testing-library/react';
import { flatten } from 'lodash';
import {
  FormattedGlossaryTermData,
  LeafNodes,
  LoadingNodeState,
  TagOption,
} from 'Models';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { Dashboard } from '../../generated/entity/data/dashboard';
import { TagCategory, TagClass } from '../../generated/entity/tags/tagCategory';
import { EntityLineage } from '../../generated/type/entityLineage';
import { EntityReference } from '../../generated/type/entityReference';
import { Paging } from '../../generated/type/paging';
import { TagLabel } from '../../generated/type/tagLabel';
import { fetchGlossaryTerms } from '../../utils/GlossaryUtils';
import { getTagCategories } from '../../utils/TagsUtils';
import DashboardDetails from './DashboardDetails.component';
import { ChartType } from './DashboardDetails.interface';

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

const DashboardDetailsProps = {
  charts: [
    {
      chartUrl: 'http://localhost',
      chartType: 'Area',
      displayName: 'Test chart',
    },
  ] as ChartType[],
  serviceType: '',
  dashboardUrl: '',
  tagList: [],
  users: [],
  dashboardDetails: {} as Dashboard,
  entityLineage: {} as EntityLineage,
  entityName: '',
  activeTab: 1,
  owner: {} as EntityReference,
  description: '',
  tier: {} as TagLabel,
  followers: [],
  dashboardTags: [],
  slashedDashboardName: [],
  setActiveTabHandler: jest.fn(),
  followDashboardHandler: jest.fn(),
  unfollowDashboardHandler: jest.fn(),
  settingsUpdateHandler: jest.fn(),
  descriptionUpdateHandler: jest.fn(),
  chartDescriptionUpdateHandler: jest.fn(),
  chartTagUpdateHandler: jest.fn(),
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
  dashboardFQN: '',
  deletePostHandler: jest.fn(),
  paging: {} as Paging,
  fetchFeedHandler: jest.fn(),
};

const mockObserve = jest.fn();
const mockunObserve = jest.fn();

const mockTagList = [
  {
    id: 'tagCatId1',
    name: 'TagCat1',
    description: '',
    categoryType: 'Classification',
    children: [
      {
        id: 'tagId1',
        name: 'Tag1',
        fullyQualifiedName: 'TagCat1.Tag1',
        description: '',
        deprecated: false,
        deleted: false,
      },
    ],
  },
  {
    id: 'tagCatId2',
    name: 'TagCat2',
    description: '',
    categoryType: 'Classification',
    children: [
      {
        id: 'tagId2',
        name: 'Tag2',
        fullyQualifiedName: 'TagCat2.Tag2',
        description: '',
        deprecated: false,
        deleted: false,
      },
    ],
  },
];

const mockGlossaryList = [
  {
    name: 'Tag1',
    displayName: 'Tag1',
    fullyQualifiedName: 'Glossary.Tag1',
    type: 'glossaryTerm',
    id: 'glossaryTagId1',
  },
  {
    name: 'Tag2',
    displayName: 'Tag2',
    fullyQualifiedName: 'Glossary.Tag2',
    type: 'glossaryTerm',
    id: 'glossaryTagId2',
  },
];

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
  return jest.fn().mockImplementation(({ tagList }) => {
    return (
      <>
        {tagList.map((tag: TagOption, idx: number) => (
          <p key={idx}>{tag.fqn}</p>
        ))}
      </>
    );
  });
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

jest.mock('../common/non-admin-action/NonAdminAction', () => {
  return jest
    .fn()
    .mockImplementation(({ children }) => (
      <p data-testid="tag-action">{children}</p>
    ));
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
  pluralize: jest.fn().mockReturnValue('2 charts'),
  isEven: jest.fn().mockReturnValue(true),
  getEntityDeleteMessage: jest.fn(),
}));

jest.mock('../../utils/GlossaryUtils', () => ({
  fetchGlossaryTerms: jest.fn(() => Promise.resolve(mockGlossaryList)),
  getGlossaryTermlist: jest.fn((terms) => {
    return terms.map(
      (term: FormattedGlossaryTermData) => term?.fullyQualifiedName
    );
  }),
}));

jest.mock('../../utils/TagsUtils', () => ({
  getTagCategories: jest.fn(() => Promise.resolve({ data: mockTagList })),
  getTaglist: jest.fn((categories) => {
    const children = categories.map((category: TagCategory) => {
      return category.children || [];
    });
    const allChildren = flatten(children);
    const tagList = (allChildren as unknown as TagClass[]).map((tag) => {
      return tag?.fullyQualifiedName || '';
    });

    return tagList;
  }),
}));

describe('Test DashboardDetails component', () => {
  it('Checks if the DashboardDetails component has all the proper components rendered', async () => {
    const { container } = render(
      <DashboardDetails {...DashboardDetailsProps} />,
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
      <DashboardDetails {...DashboardDetailsProps} />,
      {
        wrapper: MemoryRouter,
      }
    );
    const activityFeedList = await findByTestId(container, 'charts-table');

    expect(activityFeedList).toBeInTheDocument();
  });

  it('Check if active tab is activity feed', async () => {
    const { container } = render(
      <DashboardDetails {...DashboardDetailsProps} activeTab={2} />,
      {
        wrapper: MemoryRouter,
      }
    );
    const activityFeedList = await findByText(container, /ActivityFeedList/i);

    expect(activityFeedList).toBeInTheDocument();
  });

  it('Check if active tab is lineage', async () => {
    const { container } = render(
      <DashboardDetails {...DashboardDetailsProps} activeTab={3} />,
      {
        wrapper: MemoryRouter,
      }
    );
    const lineage = await findByTestId(container, 'lineage');

    expect(lineage).toBeInTheDocument();
  });

  it('Check if active tab is manage', async () => {
    const { container } = render(
      <DashboardDetails {...DashboardDetailsProps} activeTab={4} />,
      {
        wrapper: MemoryRouter,
      }
    );
    const manage = await findByTestId(container, 'manage');

    expect(manage).toBeInTheDocument();
  });

  it('Should create an observer if IntersectionObserver is available', async () => {
    const { container } = render(
      <DashboardDetails {...DashboardDetailsProps} activeTab={4} />,
      {
        wrapper: MemoryRouter,
      }
    );

    const obServerElement = await findByTestId(container, 'observer-element');

    expect(obServerElement).toBeInTheDocument();

    expect(mockObserve).toHaveBeenCalled();
  });

  it('Check if tags and glossary-terms are present', async () => {
    const { getByTestId, findByText } = render(
      <DashboardDetails {...DashboardDetailsProps} />,
      {
        wrapper: MemoryRouter,
      }
    );

    const tagWrapper = getByTestId('tags-wrapper');
    fireEvent.click(
      tagWrapper,
      new MouseEvent('click', { bubbles: true, cancelable: true })
    );

    const tag1 = await findByText('TagCat1.Tag1');
    const glossaryTerm1 = await findByText('Glossary.Tag1');

    expect(tag1).toBeInTheDocument();
    expect(glossaryTerm1).toBeInTheDocument();
  });

  it('Check if only tags are present', async () => {
    (fetchGlossaryTerms as jest.Mock).mockImplementationOnce(() =>
      Promise.reject()
    );
    const { getByTestId, findByText, queryByText } = render(
      <DashboardDetails {...DashboardDetailsProps} />,
      {
        wrapper: MemoryRouter,
      }
    );

    const tagWrapper = getByTestId('tags-wrapper');
    fireEvent.click(
      tagWrapper,
      new MouseEvent('click', { bubbles: true, cancelable: true })
    );

    const tag1 = await findByText('TagCat1.Tag1');
    const glossaryTerm1 = queryByText('Glossary.Tag1');

    expect(tag1).toBeInTheDocument();
    expect(glossaryTerm1).not.toBeInTheDocument();
  });

  it('Check if only glossary terms are present', async () => {
    (getTagCategories as jest.Mock).mockImplementationOnce(() =>
      Promise.reject()
    );
    const { getByTestId, findByText, queryByText } = render(
      <DashboardDetails {...DashboardDetailsProps} />,
      {
        wrapper: MemoryRouter,
      }
    );

    const tagWrapper = getByTestId('tags-wrapper');
    fireEvent.click(
      tagWrapper,
      new MouseEvent('click', { bubbles: true, cancelable: true })
    );

    const tag1 = queryByText('TagCat1.Tag1');
    const glossaryTerm1 = await findByText('Glossary.Tag1');

    expect(tag1).not.toBeInTheDocument();
    expect(glossaryTerm1).toBeInTheDocument();
  });

  it('Check that tags and glossary terms are not present', async () => {
    (getTagCategories as jest.Mock).mockImplementationOnce(() =>
      Promise.reject()
    );
    (fetchGlossaryTerms as jest.Mock).mockImplementationOnce(() =>
      Promise.reject()
    );
    const { getByTestId, queryByText } = render(
      <DashboardDetails {...DashboardDetailsProps} />,
      {
        wrapper: MemoryRouter,
      }
    );

    const tagWrapper = getByTestId('tags-wrapper');
    fireEvent.click(
      tagWrapper,
      new MouseEvent('click', { bubbles: true, cancelable: true })
    );

    const tag1 = queryByText('TagCat1.Tag1');
    const glossaryTerm1 = queryByText('Glossary.Tag1');

    expect(tag1).not.toBeInTheDocument();
    expect(glossaryTerm1).not.toBeInTheDocument();
  });
});
