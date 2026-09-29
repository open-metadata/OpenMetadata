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
import { ProfileNavItem } from './profileNavConfig';
import ProfileSideNav from './ProfileSideNav';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

const Icon = ({ className }: { className?: string }) => (
  <svg className={className} data-testid="nav-icon" />
);

const items: ProfileNavItem[] = [
  {
    id: 'profile',
    group: 'account',
    label: 'label.profile',
    description: 'message.profile',
    icon: Icon,
    render: () => null,
  },
  {
    id: 'permissions',
    group: 'account',
    label: 'label.permission-plural',
    description: 'message.permissions',
    icon: Icon,
    render: () => null,
  },
  {
    id: 'access-token',
    group: 'credentials',
    label: 'label.access-token',
    description: 'message.access-token',
    icon: Icon,
    render: () => null,
  },
];

describe('ProfileSideNav', () => {
  it('renders both group headers and every item under its group', () => {
    render(
      <ProfileSideNav items={items} selectedId="profile" onSelect={jest.fn()} />
    );

    expect(screen.getByText('label.account')).toBeInTheDocument();
    expect(screen.getByText('label.credential-plural')).toBeInTheDocument();
    expect(screen.getByTestId('profile-nav-profile')).toBeInTheDocument();
    expect(screen.getByTestId('profile-nav-permissions')).toBeInTheDocument();
    expect(screen.getByTestId('profile-nav-access-token')).toBeInTheDocument();
    expect(screen.getAllByTestId('nav-icon')).toHaveLength(3);
  });

  it('marks only the selected item as the current page', () => {
    render(
      <ProfileSideNav
        items={items}
        selectedId="access-token"
        onSelect={jest.fn()}
      />
    );

    expect(screen.getByTestId('profile-nav-access-token')).toHaveAttribute(
      'aria-current',
      'page'
    );
    expect(screen.getByTestId('profile-nav-profile')).not.toHaveAttribute(
      'aria-current'
    );
  });

  it('skips a group header when it has no items', () => {
    render(
      <ProfileSideNav
        items={items.filter((item) => item.group === 'account')}
        selectedId="profile"
        onSelect={jest.fn()}
      />
    );

    expect(screen.getByText('label.account')).toBeInTheDocument();
    expect(
      screen.queryByText('label.credential-plural')
    ).not.toBeInTheDocument();
  });

  it('reports the clicked item id', () => {
    const onSelect = jest.fn();
    render(
      <ProfileSideNav items={items} selectedId="profile" onSelect={onSelect} />
    );

    fireEvent.click(screen.getByTestId('profile-nav-permissions'));

    expect(onSelect).toHaveBeenCalledWith('permissions');
  });
});
