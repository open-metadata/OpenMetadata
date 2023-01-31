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
  act,
  findByTestId,
  findByText,
  fireEvent,
  render,
} from '@testing-library/react';
import { mockGlossaryList } from 'mocks/Glossary.mock';
import { mockTagList } from 'mocks/Tags.mock';
import { TagOption } from 'Models';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { Dashboard } from '../../generated/entity/data/dashboard';
import { GlossaryTerm } from '../../generated/entity/data/glossaryTerm';
import { EntityLineage } from '../../generated/type/entityLineage';
import { EntityReference } from '../../generated/type/entityReference';
import { Paging } from '../../generated/type/paging';
import { TagLabel } from '../../generated/type/tagLabel';
import { fetchGlossaryTerms } from '../../utils/GlossaryUtils';
import { getClassifications } from '../../utils/TagsUtils';
import {
  LeafNodes,
  LoadingNodeState,
} from '../EntityLineage/EntityLineage.interface';
import DashboardDetails from './DashboardDetails.component';
import { ChartType } from './DashboardDetails.interface';

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
      id: '1',
      deleted: false,
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
  entityFieldTaskCount: [],
  createThread: jest.fn(),
  dashboardFQN: '',
  deletePostHandler: jest.fn(),
  paging: {} as Paging,
  fetchFeedHandler: jest.fn(),
  updateThreadHandler: jest.fn(),
  onExtensionUpdate: jest.fn(),
};

const mockObserve = jest.fn();
const mockunObserve = jest.fn();

window.IntersectionObserver = jest.fn().mockImplementation(() => ({
  observe: mockObserve,
  unobserve: mockunObserve,
}));

jest.mock('../common/description/Description', () => {
  return jest.fn().mockReturnValue(<p>Description Component</p>);
});
jest.mock('../common/rich-text-editor/RichTextEditorPreviewer', () => {
  return jest.fn().mockReturnValue(<p>RichTextEditorPreviwer</p>);
});

jest.mock('components/Tag/TagsContainer/tags-container', () => {
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

jest.mock('components/Tag/Tags/tags', () => {
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
jest.mock('../common/CustomPropertyTable/CustomPropertyTable', () => ({
  CustomPropertyTable: jest
    .fn()
    .mockReturnValue(<p>CustomPropertyTable.component</p>),
}));

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
  getOwnerValue: jest.fn().mockReturnValue('Owner'),
}));

jest.mock('../../utils/GlossaryUtils', () => ({
  fetchGlossaryTerms: jest.fn(() => Promise.resolve(mockGlossaryList)),
  getGlossaryTermlist: jest.fn((terms) => {
    return terms.map((term: GlossaryTerm) => term?.fullyQualifiedName);
  }),
}));

jest.mock('../../utils/TagsUtils', () => ({
  getClassifications: jest.fn(() => Promise.resolve({ data: mockTagList })),
  getTaglist: jest.fn(() =>
    Promise.resolve(['PersonalData.Personal', 'PersonalData.SpecialCategory'])
  ),
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
    const activityFeedTab = await findByTestId(tabs, 'Activity Feeds & Tasks');
    const lineageTab = await findByTestId(tabs, 'Lineage');

    expect(EntityPageInfo).toBeInTheDocument();
    expect(description).toBeInTheDocument();
    expect(tabs).toBeInTheDocument();
    expect(detailsTab).toBeInTheDocument();
    expect(activityFeedTab).toBeInTheDocument();
    expect(lineageTab).toBeInTheDocument();
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

  it('Check if active tab is custom properties', async () => {
    const { container } = render(
      <DashboardDetails {...DashboardDetailsProps} activeTab={4} />,
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
    await act(async () => {
      fireEvent.click(tagWrapper);
    });

    const tag1 = await findByText('PersonalData.Personal');
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
    await act(async () => {
      fireEvent.click(tagWrapper);
    });

    const tag1 = await findByText('PersonalData.Personal');
    const glossaryTerm1 = queryByText('Glossary.Tag1');

    expect(tag1).toBeInTheDocument();
    expect(glossaryTerm1).not.toBeInTheDocument();
  });

  it('Check if only glossary terms are present', async () => {
    (getClassifications as jest.Mock).mockImplementationOnce(() =>
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
    await act(async () => {
      (getClassifications as jest.Mock).mockImplementationOnce(() =>
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
});
