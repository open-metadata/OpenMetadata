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
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { TagLabel } from '../../../generated/type/tagLabel';
import EntityPageInfo from './EntityPageInfo';

const mockEntityFieldThreads = [
  {
    entityLink: '<#E/table/bigquery_gcp.shopify.raw_product_catalog/tags>',
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

jest.mock('../../../utils/CommonUtils', () => ({
  getHtmlForNonAdminAction: jest.fn(),
}));

jest.mock('../../../utils/EntityUtils', () => ({
  getEntityFeedLink: jest.fn(),
  getInfoElements: jest.fn(),
}));

jest.mock('../../../utils/GlossaryUtils', () => ({
  fetchGlossaryTerms: jest.fn(),
  getGlossaryTermlist: jest.fn(),
}));

jest.mock('../../../utils/TableUtils', () => ({
  getFollowerDetail: jest.fn(),
}));

jest.mock('../../../utils/TagsUtils', () => ({
  getTagCategories: jest.fn(),
  getTaglist: jest.fn(),
}));

jest.mock('../non-admin-action/NonAdminAction', () => {
  return jest
    .fn()
    .mockReturnValue(<p data-testid="tag-action">NonAdminAction</p>);
});

jest.mock('../../tags-container/tags-container', () => {
  return jest.fn().mockReturnValue(<p>TagContainer</p>);
});

jest.mock('../../tags-viewer/tags-viewer', () => {
  return jest.fn().mockReturnValue(<p data-testid="info-tags">TagViewer</p>);
});

jest.mock('../../tags/tags', () => {
  return jest.fn().mockReturnValue(<p data-testid="tier-tag">Tag</p>);
});

jest.mock('../avatar/Avatar', () => {
  return jest.fn().mockReturnValue(<p>Avatar</p>);
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
});
