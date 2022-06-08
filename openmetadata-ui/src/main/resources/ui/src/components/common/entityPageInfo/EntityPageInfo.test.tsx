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
  queryByTestId,
  render,
} from '@testing-library/react';
import { flatten } from 'lodash';
import { FormattedGlossaryTermData, TagOption } from 'Models';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import {
  TagCategory,
  TagClass,
} from '../../../generated/entity/tags/tagCategory';
import { TagLabel } from '../../../generated/type/tagLabel';
import { fetchGlossaryTerms } from '../../../utils/GlossaryUtils';
import { getTagCategories } from '../../../utils/TagsUtils';
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
  source: 'Tag',
  labelType: 'Manual',
  state: 'Confirmed',
};

const mockInfoTags = [
  {
    tagFQN: 'User.Biometric',
    source: 'Tag',
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
  version: '0.3',
  versionHandler,
  entityFieldThreads: [],
  onThreadLinkSelect,
};

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

jest.mock('../../../utils/CommonUtils', () => ({
  getHtmlForNonAdminAction: jest.fn(),
}));

jest.mock('../../../utils/EntityUtils', () => ({
  getEntityFeedLink: jest.fn(),
  getInfoElements: jest.fn(),
}));

jest.mock('../../../utils/GlossaryUtils', () => ({
  fetchGlossaryTerms: jest.fn(() => Promise.resolve(mockGlossaryList)),
  getGlossaryTermlist: jest.fn((terms) => {
    return terms.map(
      (term: FormattedGlossaryTermData) => term?.fullyQualifiedName
    );
  }),
}));

jest.mock('../../../utils/TableUtils', () => ({
  getFollowerDetail: jest.fn(),
}));

jest.mock('../../../utils/TagsUtils', () => ({
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

jest.mock('../non-admin-action/NonAdminAction', () => {
  return jest
    .fn()
    .mockImplementation(({ children }) => (
      <p data-testid="tag-action">{children}</p>
    ));
});

jest.mock('../../tags-container/tags-container', () => {
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

jest.mock('../../tags-viewer/tags-viewer', () => {
  return jest.fn().mockReturnValue(<p data-testid="info-tags">TagViewer</p>);
});

jest.mock('../../tags/tags', () => {
  return jest.fn().mockReturnValue(<p data-testid="tier-tag">Tag</p>);
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
    expect(versionValue).toHaveTextContent(mockEntityInfoProp.version);

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

    expect(versionHandler).toBeCalled();
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

    expect(followHandler).toBeCalled();
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
      <EntityPageInfo {...mockEntityInfoProp} tier={mockTier as TagLabel} />,
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

    const tierTag = await findByTestId(entityTags, 'tier-tag');

    expect(tierTag).toBeInTheDocument();

    const infoTags = await findByTestId(entityTags, 'info-tags');

    expect(infoTags).toBeInTheDocument();
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

    const tagAction = await findByTestId(entityPageInfoContainer, 'tag-action');

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

    expect(onThreadLinkSelect).toBeCalled();
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

    fireEvent.click(
      tagThreadButton,
      new MouseEvent('click', { bubbles: true, cancelable: true })
    );

    expect(onThreadLinkSelect).toBeCalled();
  });

  it('Check if tags and glossary-terms are present', async () => {
    const { getByTestId, findByText } = render(
      <EntityPageInfo {...mockEntityInfoProp} isTagEditable />,
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
      <EntityPageInfo {...mockEntityInfoProp} isTagEditable />,
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
      <EntityPageInfo {...mockEntityInfoProp} isTagEditable />,
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
      <EntityPageInfo {...mockEntityInfoProp} isTagEditable />,
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
