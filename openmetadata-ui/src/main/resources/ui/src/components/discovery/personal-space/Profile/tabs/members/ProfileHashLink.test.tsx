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
import { MemoryRouter } from 'react-router-dom';
import ProfileHashLink from './ProfileHashLink';
import { ProfileHashTarget } from './profileHash.utils';

const target: ProfileHashTarget = { tab: 'members', subPath: 'teams/Org' };

const renderLink = (onNavigate = jest.fn()) => {
  render(
    <MemoryRouter>
      <ProfileHashLink target={target} onNavigate={onNavigate}>
        Go to team
      </ProfileHashLink>
    </MemoryRouter>
  );

  return onNavigate;
};

describe('ProfileHashLink', () => {
  it('renders an href built from the target for middle-click/open-in-new-tab', () => {
    renderLink();

    expect(screen.getByRole('link', { name: 'Go to team' })).toHaveAttribute(
      'href',
      '/#members/teams/Org'
    );
  });

  it('calls onNavigate with the target and prevents the default navigation', () => {
    const onNavigate = renderLink();

    const clickEvent = fireEvent.click(
      screen.getByRole('link', { name: 'Go to team' })
    );

    expect(onNavigate).toHaveBeenCalledWith(target);
    // fireEvent.click returns false when preventDefault was called.
    expect(clickEvent).toBe(false);
  });
});
