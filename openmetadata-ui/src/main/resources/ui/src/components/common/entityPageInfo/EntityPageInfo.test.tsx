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
  queryByTestId,
  render,
  screen,
} from '@testing-library/react';
import { EntityTags, TagOption } from 'Models';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { TagLabel } from '../../../generated/type/tagLabel';
import { fetchTagsAndGlossaryTerms } from '../../../utils/TagsUtils';
import EntityPageInfo from './EntityPageInfo';

const mockEntityFieldThreads = [
  {
    entityLink: '<#E::table::bigquery_gcp.shopify.raw_product_catalog::tags>',
    count: 1,
    entityField: 'tags',
  },
];

const followHandler = jest.fn();
const versionHandler = jest.fn();
const onThreadLinkSelect = jest.fn();
const mockTier = {
  tagFQN: 'Tier:Tier1',
  description: '',
  source: 'Classification',
  labelType: 'Manual',
  state: 'Confirmed',
};

const mockInfoTags = [
  {
    tagFQN: 'User.Biometric',
    source: 'Classification',
    labelType: 'Manual',
    state: 'Confirmed',
  },
];

const mockEntityInfoProp = {
  titleLinks: [
    {
      name: 'bigquery_gcp',
      url: '/service/databaseServices/bigquery_gcp',
      imgSrc: '/service-icon-query.png',
    },
    {
      name: 'shopify',
      url: '/database/bigquery_gcp.shopify',
    },
    {
      name: 'raw_product_catalog',
      url: '',
      activeTitle: true,
    },
  ],
  hasEditAccess: false,
  isFollowing: false,
  isTagEditable: false,
  isVersionSelected: undefined,
  deleted: false,
  followHandler,
  followers: 0,
  extraInfo: [
    {
      key: 'Owner',
      value: '',
      placeholderText: '',
      isLink: false,
      openInNewTab: false,
    },
    {
      key: 'Tier',
      value: '',
    },
    {
      value: 'Usage - 0th pctile',
    },
    {
      value: '0 queries',
    },
    {
      key: 'Columns',
      value: '6 columns',
    },
  ],
  tier: {} as TagLabel,
  tags: mockInfoTags,
  owner: undefined,
  tagsHandler: jest.fn(),
  followersList: [],
  entityFqn: 'bigquery_gcp.shopify.raw_product_catalog',
  entityName: 'raw_product_catalog',
  entityType: 'table',
  version: 0.3,
  versionHandler,
  entityFieldThreads: [],
  onThreadLinkSelect,
};

jest.mock('../../../utils/EntityUtils', () => ({
  getEntityFeedLink: jest.fn(),
}));

jest.mock('utils/CommonUtils', () => ({
  sortTagsCaseInsensitive: jest.fn().mockImplementation(() => [mockTier]),
}));

jest.mock('../../../utils/TagsUtils', () => ({
  fetchTagsAndGlossaryTerms: jest.fn().mockResolvedValue([
    { fqn: 'PersonalData.Personal', source: 'Classification' },
    { fqn: 'Glossary.Tag1', source: 'Glossary' },
  ]),
}));

jest.mock('components/Tag/TagsContainer/tags-container', () => {
  return jest.fn().mockImplementation(({ tagList, selectedTags }) => {
    return (
      <>
        {tagList.map((tag: TagOption, idx: number) => (
          <p key={idx}>{tag.fqn}</p>
        ))}

        {selectedTags.map((tag: EntityTags, idx: number) => (
          <p data-testid={`tag-${tag.tagFQN}`} key={`tag-${idx}`}>
            {tag.tagFQN}
          </p>
        ))}
      </>
    );
  });
});

jest.mock('../EntitySummaryDetails/EntitySummaryDetails', () => {
  return jest
    .fn()
    .mockReturnValue(
      <p data-testid="entity-summary-details">EntitySummaryDetails component</p>
    );
});

jest.mock('../ProfilePicture/ProfilePicture', () => {
  return jest.fn().mockReturnValue(<p>ProfilePicture</p>);
});

jest.mock('./FollowersModal', () => {
  return jest.fn().mockReturnValue(<p>FollowModal</p>);
});

jest.mock('../title-breadcrumb/title-breadcrumb.component', () => {
  return jest.fn().mockReturnValue(<p>TitleBreadCrumb</p>);
});

jest.mock('./AnnouncementCard/AnnouncementCard', () => {
  return jest.fn().mockReturnValue(<div>AnnouncementCard</div>);
});

jest.mock('./AnnouncementDrawer/AnnouncementDrawer', () => {
  return jest.fn().mockReturnValue(<div>AnnouncementDrawer</div>);
});

jest.mock('rest/feedsAPI', () => ({
  getActiveAnnouncement: jest.fn().mockImplementation(() => Promise.resolve()),
}));

jest.mock('./ManageButton/ManageButton', () => {
  return jest
    .fn()
    .mockReturnValue(<button data-testid="manage-button">ManageButton</button>);
});

describe('Test EntityPageInfo component', () => {
  it('Check if it has all child elements', async () => {
    const { container } = render(<EntityPageInfo {...mockEntityInfoProp} />, {
      wrapper: MemoryRouter,
    });

    const entityPageInfoContainer = await findByTestId(
      container,
      'entity-page-info'
    );

    expect(entityPageInfoContainer).toBeInTheDocument();

    const titleBreadCrumb = await findByText(
      entityPageInfoContainer,
      /TitleBreadCrumb/i
    );

    expect(titleBreadCrumb).toBeInTheDocument();

    const versionButton = await findByTestId(
      entityPageInfoContainer,
      'version-button'
    );

    expect(versionButton).toBeInTheDocument();

    const versionValue = await findByTestId(
      entityPageInfoContainer,
      'version-value'
    );

    expect(versionValue).toBeInTheDocument();
    expect(versionValue).toHaveTextContent(mockEntityInfoProp.version + '');

    const deleteBadge = queryByTestId(entityPageInfoContainer, 'deleted-badge');

    expect(deleteBadge).not.toBeInTheDocument();

    const followButton = await findByTestId(
      entityPageInfoContainer,
      'follow-button'
    );

    expect(followButton).toBeInTheDocument();

    const followerValue = await findByTestId(
      entityPageInfoContainer,
      'follower-value'
    );

    expect(followerValue).toBeInTheDocument();
    expect(followerValue).toHaveTextContent(
      String(mockEntityInfoProp.followers)
    );

    const extraInfo = await findByTestId(entityPageInfoContainer, 'extrainfo');

    expect(extraInfo).toBeInTheDocument();

    const manageButton = await findByTestId(
      entityPageInfoContainer,
      'manage-button'
    );

    expect(manageButton).toBeInTheDocument();
  });

  it('Should call version handler on version button click', async () => {
    const { container } = render(<EntityPageInfo {...mockEntityInfoProp} />, {
      wrapper: MemoryRouter,
    });
    const entityPageInfoContainer = await findByTestId(
      container,
      'entity-page-info'
    );

    expect(entityPageInfoContainer).toBeInTheDocument();

    const versionButton = await findByTestId(
      entityPageInfoContainer,
      'version-button'
    );

    expect(versionButton).toBeInTheDocument();

    fireEvent.click(
      versionButton,
      new MouseEvent('click', { bubbles: true, cancelable: true })
    );

    expect(versionHandler).toHaveBeenCalled();
  });

  it('Should call follow handler on follow button click', async () => {
    const { container } = render(<EntityPageInfo {...mockEntityInfoProp} />, {
      wrapper: MemoryRouter,
    });

    const entityPageInfoContainer = await findByTestId(
      container,
      'entity-page-info'
    );

    expect(entityPageInfoContainer).toBeInTheDocument();

    const followButton = await findByTestId(
      entityPageInfoContainer,
      'follow-button'
    );

    expect(followButton).toBeInTheDocument();

    fireEvent.click(
      followButton,
      new MouseEvent('click', { bubbles: true, cancelable: true })
    );

    expect(followHandler).toHaveBeenCalled();
  });

  it('Should render all the extra info', async () => {
    const { container } = render(<EntityPageInfo {...mockEntityInfoProp} />, {
      wrapper: MemoryRouter,
    });

    const entityPageInfoContainer = await findByTestId(
      container,
      'entity-page-info'
    );

    expect(entityPageInfoContainer).toBeInTheDocument();

    const extraInfo = await findByTestId(entityPageInfoContainer, 'extrainfo');

    expect(extraInfo).toBeInTheDocument();

    for (let index = 0; index < mockEntityInfoProp.extraInfo.length; index++) {
      const info = mockEntityInfoProp.extraInfo[index];
      const key = await findByTestId(
        extraInfo,
        `${info.key ? info.key : `info${index}`}`
      );

      expect(key).toBeInTheDocument();
    }
  });

  it('Should render all the tags including tier tag', async () => {
    const { container } = render(
      <EntityPageInfo
        {...mockEntityInfoProp}
        isTagEditable
        tier={mockTier as TagLabel}
      />,
      {
        wrapper: MemoryRouter,
      }
    );

    const entityPageInfoContainer = await findByTestId(
      container,
      'entity-page-info'
    );

    expect(entityPageInfoContainer).toBeInTheDocument();

    const entityTags = await findByTestId(
      entityPageInfoContainer,
      'entity-tags'
    );

    expect(entityTags).toBeInTheDocument();

    const tierTag = await findByTestId(entityTags, 'tag-Tier:Tier1');

    expect(tierTag).toBeInTheDocument();
  });

  it('Check if it has isTagEditable as true and deleted as false value', async () => {
    const { container } = render(
      <EntityPageInfo {...mockEntityInfoProp} isTagEditable />,
      {
        wrapper: MemoryRouter,
      }
    );

    const entityPageInfoContainer = await findByTestId(
      container,
      'entity-page-info'
    );

    expect(entityPageInfoContainer).toBeInTheDocument();

    const tagAction = await findByTestId(
      entityPageInfoContainer,
      'tags-wrapper'
    );

    // should render tag action either add tag or edit tag
    expect(tagAction).toBeInTheDocument();
  });

  it('Should render start thread button', async () => {
    const { container } = render(
      <EntityPageInfo {...mockEntityInfoProp} isTagEditable />,
      {
        wrapper: MemoryRouter,
      }
    );

    const entityPageInfoContainer = await findByTestId(
      container,
      'entity-page-info'
    );

    expect(entityPageInfoContainer).toBeInTheDocument();

    const startThreadButton = await findByTestId(
      entityPageInfoContainer,
      'start-tag-thread'
    );

    expect(startThreadButton).toBeInTheDocument();

    fireEvent.click(
      startThreadButton,
      new MouseEvent('click', { bubbles: true, cancelable: true })
    );

    expect(onThreadLinkSelect).toHaveBeenCalled();
  });

  it('Should render tag thread button with count', async () => {
    const { container } = render(
      <EntityPageInfo
        {...mockEntityInfoProp}
        isTagEditable
        entityFieldThreads={mockEntityFieldThreads}
      />,
      {
        wrapper: MemoryRouter,
      }
    );

    const entityPageInfoContainer = await findByTestId(
      container,
      'entity-page-info'
    );

    expect(entityPageInfoContainer).toBeInTheDocument();

    const tagThreadButton = await findByTestId(
      entityPageInfoContainer,
      'tag-thread'
    );

    expect(tagThreadButton).toBeInTheDocument();

    const tagThreadCount = await findByTestId(
      tagThreadButton,
      'tag-thread-count'
    );

    expect(tagThreadCount).toBeInTheDocument();
    expect(tagThreadCount).toHaveTextContent(
      String(mockEntityFieldThreads[0].count)
    );

    await act(async () => {
      fireEvent.click(tagThreadButton);
    });

    expect(onThreadLinkSelect).toHaveBeenCalled();
  });

  it('Check if tags and glossary-terms are present', async () => {
    const { getByTestId, findByText } = render(
      <EntityPageInfo {...mockEntityInfoProp} isTagEditable />,
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

  it('Check that tags and glossary terms are not present', async () => {
    await act(async () => {
      (fetchTagsAndGlossaryTerms as jest.Mock).mockImplementationOnce(() =>
        Promise.reject()
      );

      render(<EntityPageInfo {...mockEntityInfoProp} isTagEditable />, {
        wrapper: MemoryRouter,
      });
      const tagWrapper = screen.getByTestId('tags-wrapper');

      await act(async () => {
        fireEvent.click(tagWrapper);
      });

      const tag1 = screen.queryByText('PersonalData.Personal');
      const glossaryTerm1 = screen.queryByText('Glossary.Tag1');

      expect(tag1).not.toBeInTheDocument();
      expect(glossaryTerm1).not.toBeInTheDocument();
    });
  });
});
