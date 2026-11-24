/*
 *  Copyright 2024 Collate.
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
import { MemoryRouter } from 'react-router-dom';
import { MASKED_EMAIL } from '../constants/User.constants';
import { User } from '../generated/entity/teams/user';
import { useApplicationStore } from '../hooks/useApplicationStore';
import { getUserByName } from '../rest/userAPI';
import { userCellRenderer } from './Users.util';
import { getUserIdentifier, isMaskedEmail } from './UsersPureUtils';

jest.mock('../rest/userAPI', () => ({
  getUserByName: jest.fn(),
}));

const mockGetUserByName = getUserByName as jest.MockedFunction<
  typeof getUserByName
>;

describe('User Utils -- userCellRenderer', () => {
  beforeEach(() => {
    useApplicationStore.setState({ userProfilePics: {} });
    mockGetUserByName.mockReset();
  });

  it('shows the display name once the user loads, in the real card', async () => {
    mockGetUserByName.mockResolvedValue({
      id: '1',
      name: 'jdoe',
      displayName: 'John Doe',
      email: 'jdoe@example.com',
    } as User);

    render(<>{userCellRenderer({ id: '1', name: 'jdoe', type: 'user' })}</>, {
      wrapper: MemoryRouter,
    });

    expect(await screen.findByText('John Doe')).toBeInTheDocument();
    expect(screen.getByTestId('jdoe')).toHaveAttribute(
      'href',
      expect.stringContaining('jdoe')
    );
  });

  it('falls back to the login when the user has no display name', async () => {
    mockGetUserByName.mockRejectedValue({ response: { status: 404 } });

    render(<>{userCellRenderer({ id: '1', name: 'jdoe', type: 'user' })}</>, {
      wrapper: MemoryRouter,
    });

    expect(await screen.findByTestId('jdoe')).toHaveTextContent('jdoe');
  });
});

describe('User Utils -- getUserIdentifier', () => {
  it('returns the email when it is visible', () => {
    expect(getUserIdentifier({ name: 'jdoe', email: 'jdoe@example.com' })).toBe(
      'jdoe@example.com'
    );
  });

  it('falls back to the login when the email is masked or missing', () => {
    expect(getUserIdentifier({ name: 'jdoe', email: MASKED_EMAIL })).toBe(
      'jdoe'
    );
    expect(getUserIdentifier({ name: 'jdoe', email: '' })).toBe('jdoe');
  });
});

describe('User Utils -- isMaskedEmail', () => {
  it('should return true for masked email', () => {
    const email = '********@masked.com';
    const result = isMaskedEmail(email);

    expect(result).toBe(true);
  });

  it('should return false for non-masked email', () => {
    const email = 'test@example.com';
    const result = isMaskedEmail(email);

    expect(result).toBe(false);
  });
});
