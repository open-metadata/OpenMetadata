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

import { act, render, screen } from '@testing-library/react';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import WebAnalyticsProvider from './WebAnalyticsProvider';

jest.mock('../../AppState', () => {
  const mockUser = {
    id: '011bdb24-90a7-4a97-ba66-24002adb2b12',
    type: 'user',
    name: 'aaron_johnson0',
    fullyQualifiedName: 'aaron_johnson0',
    displayName: 'Aaron Johnson',
    deleted: false,
    isAdmin: true,
    href: 'http://localhost:8585/api/v1/users/011bdb24-90a7-4a97-ba66-24002adb2b12',
    teams: [{ id: '8754b53f-15cd-4d9a-af52-bdb3a2abffss' }],
  };

  return {
    getCurrentUserDetails: jest.fn().mockReturnValue(mockUser),
    userDetails: undefined,
    nonSecureUserDetails: mockUser,
  };
});

describe('Test WebAnalytics Component', () => {
  it('Should render the child component', async () => {
    await act(async () => {
      render(
        <WebAnalyticsProvider>
          <div data-testid="mock-children">Mock Children</div>
        </WebAnalyticsProvider>,
        {
          wrapper: MemoryRouter,
        }
      );
    });

    const children = await screen.findByTestId('mock-children');

    expect(children).toBeInTheDocument();
  });
});
