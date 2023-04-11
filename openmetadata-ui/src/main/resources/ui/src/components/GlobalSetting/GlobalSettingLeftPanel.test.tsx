/*
 *  Copyright 2023 Collate.
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
import { render, screen, waitForElement } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PERMISSIONS } from 'mocks/Permissions.mock';
import React from 'react';
import { MemoryRouter, Route } from 'react-router-dom';
import GlobalSettingLeftPanel from './GlobalSettingLeftPanel';

jest.mock('../PermissionProvider/PermissionProvider', () => ({
  usePermissionProvider: jest.fn().mockImplementation(() => ({
    permissions: PERMISSIONS,
    getEntityPermission: jest.fn().mockResolvedValue({
      Create: true,
      Delete: true,
      EditAll: true,
      EditCustomFields: true,
      EditDataProfile: true,
      EditDescription: true,
      EditDisplayName: true,
      EditLineage: true,
      EditOwner: true,
      EditQueries: true,
      EditSampleData: true,
      EditTags: true,
      EditTests: true,
      EditTier: true,
      ViewAll: true,
      ViewDataProfile: true,
      ViewQueries: true,
      ViewSampleData: true,
      ViewTests: true,
      ViewUsage: true,
    }),
  })),
}));

const selectedCategory = 'services';
const selectedOption = 'objectStores';
const url = `/settings/${selectedCategory}/${selectedOption}`;

describe('GlobalSettingLeftPanel', () => {
  it('Should render global settings menu with correct selected item', () => {
    render(
      <MemoryRouter initialEntries={[url]}>
        <Route path="/settings/:settingCategory/:tab">
          <GlobalSettingLeftPanel />
        </Route>
      </MemoryRouter>
    );

    expect(screen.getByText('label.service-plural')).toBeInTheDocument();
    expect(screen.getByText('label.storage-plural')).toBeInTheDocument();
  });

  it('Should change the location path on user click', () => {
    render(
      <MemoryRouter initialEntries={[url]}>
        <Route path="/settings/:settingCategory/:tab">
          <GlobalSettingLeftPanel />
        </Route>
      </MemoryRouter>
    );

    userEvent.click(screen.getByText('label.team-plural'));

    waitForElement(() =>
      expect(window.location.pathname).toEqual('/teams/organizations')
    );
  });
});
