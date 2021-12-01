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

import { getAllByTestId, getByTestId, render } from '@testing-library/react';
import { TableDetail } from 'Models';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { Dashboard } from '../../generated/entity/data/dashboard';
import DashboardDetails from './DashboardDetails.component';

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
  charts: [],
  serviceType: '',
  dashboardUrl: '',
  tagList: [],
  users: [],
  dashboardDetails: {} as Dashboard,
  entityName: '',
  activeTab: 1,
  owner: {} as TableDetail['owner'],
  description: '',
  tier: '',
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
};

jest.mock('../ManageTab/ManageTab.component', () => {
  return jest.fn().mockReturnValue(<p>ManageTab</p>);
});

jest.mock('../../components/common/description/Description', () => {
  return jest.fn().mockReturnValue(<p>Description</p>);
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

jest.mock('../../utils/CommonUtils', () => ({
  addToRecentViewed: jest.fn(),
  getCurrentUserId: jest.fn().mockReturnValue('CurrentUserId'),
  getPartialNameFromFQN: jest.fn().mockReturnValue('PartialNameFromFQN'),
  getUserTeams: () => mockUserTeam,
  getHtmlForNonAdminAction: jest.fn(),
}));

describe('Test DashboardDetails component', () => {
  it('Checks if the DashboardDetails component has all the proper components rendered', () => {
    const { container } = render(
      <DashboardDetails {...DashboardDetailsProps} />,
      {
        wrapper: MemoryRouter,
      }
    );
    const followButton = getByTestId(container, 'follow-button');
    const tabs = getAllByTestId(container, 'tab');

    expect(followButton).toBeInTheDocument();
    expect(tabs.length).toBe(2);
  });
});
