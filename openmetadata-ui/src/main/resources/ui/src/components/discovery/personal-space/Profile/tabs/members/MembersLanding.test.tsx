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

import { fireEvent, render, screen } from '@testing-library/react';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, params?: Record<string, unknown>) =>
      params ? `${key}${JSON.stringify(params)}` : key,
  }),
}));

import MembersLanding from './MembersLanding';

describe('MembersLanding', () => {

  it('renders 4 landing cards', () => {
    const onNavigate = jest.fn();
    render(<MembersLanding onNavigate={onNavigate} />);

    expect(screen.getByTestId('members-card-teams')).toBeInTheDocument();
    expect(screen.getByTestId('members-card-users')).toBeInTheDocument();
    expect(screen.getByTestId('members-card-admins')).toBeInTheDocument();
    expect(
      screen.getByTestId('members-card-online-users')
    ).toBeInTheDocument();
  });

  it('calls onNavigate with correct view when a card is clicked', () => {
    const onNavigate = jest.fn();
    render(<MembersLanding onNavigate={onNavigate} />);

    fireEvent.click(screen.getByTestId('members-card-teams'));

    expect(onNavigate).toHaveBeenCalledWith({ type: 'teams' });
  });

});
