/*
 *  Copyright 2026 Collate.
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

import { render, screen } from '@testing-library/react';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, params?: Record<string, unknown>) =>
      params ? `${key}${JSON.stringify(params)}` : key,
  }),
}));

jest.mock(
  '../../../../../../context/PermissionProvider/PermissionProvider',
  () => ({
    usePermissionProvider: () => ({ permissions: {} }),
  })
);

jest.mock('./MembersLanding', () => () => (
  <div data-testid="members-landing" />
));

jest.mock('./MembersTeamDetail', () => () => (
  <div data-testid="members-team-detail" />
));

jest.mock('./MembersUsersPanel', () => () => (
  <div data-testid="members-users-panel" />
));

jest.mock('./MembersAdminsPanel', () => () => (
  <div data-testid="members-admins-panel" />
));

jest.mock('./MembersOnlineUsersPanel', () => () => (
  <div data-testid="members-online-users-panel" />
));

import MembersPanel from './MembersPanel';

describe('MembersPanel', () => {

  it('renders landing view by default', () => {
    render(
      <MemoryRouter>
        <MembersPanel />
      </MemoryRouter>
    );

    expect(screen.getByTestId('members-landing')).toBeInTheDocument();
  });

});
