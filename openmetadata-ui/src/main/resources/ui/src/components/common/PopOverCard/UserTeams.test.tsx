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
import { UserTeams } from './UserTeams.component';

const mockUserData = {
  name: 'testUser',
  displayName: 'Test User',
  teams: [
    { id: '1', name: 'Team 1', deleted: false },
    { id: '2', name: 'Team 2', deleted: false },
  ],
};

jest.mock('../../../hooks/useApplicationStore', () => ({
  useApplicationStore: jest.fn().mockImplementation(() => ({
    userProfilePics: { testUser: mockUserData },
  })),
}));

jest.mock('../../../utils/EntityNameUtils', () => ({
  getEntityName: jest
    .fn()
    .mockImplementation((entity) => entity?.displayName || entity?.name || ''),
}));

describe('UserTeams Component', () => {
  it('should render teams when teams are available', () => {
    render(<UserTeams userName="testUser" />);

    expect(screen.getByText('label.team-plural')).toBeInTheDocument();
    expect(screen.getByText('Team 1')).toBeInTheDocument();
    expect(screen.getByText('Team 2')).toBeInTheDocument();
  });

  it('should not render when no teams are available', () => {
    const { container } = render(<UserTeams userName="nonExistentUser" />);

    expect(container).toBeEmptyDOMElement();
  });
});
