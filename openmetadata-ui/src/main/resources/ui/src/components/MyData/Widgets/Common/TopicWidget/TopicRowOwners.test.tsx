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

import { render, screen, within } from '@testing-library/react';
import TopicRowOwners from './TopicRowOwners';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

const user = (name: string) => ({ id: name, name, type: 'user' });

describe('TopicRowOwners', () => {
  it('flags an entity with no owner', () => {
    render(<TopicRowOwners dataTestId="owners" owners={[]} />);

    expect(screen.getByTestId('owners')).toHaveTextContent('label.no-owner');
  });

  it('names a single owner beside their avatar', () => {
    render(<TopicRowOwners dataTestId="owners" owners={[user('Dale Kim')]} />);

    const owners = within(screen.getByTestId('owners'));

    expect(owners.getByText('Dale Kim')).toBeInTheDocument();
    expect(owners.queryByText('label.no-owner')).not.toBeInTheDocument();
  });

  // Only the first owner used to show; a row with several shows them all.
  it('shows every owner as an avatar, the rest behind +N', () => {
    render(
      <TopicRowOwners
        dataTestId="owners"
        owners={['A', 'B', 'C', 'D'].map((name) => user(name))}
      />
    );

    const owners = within(screen.getByTestId('owners'));

    expect(owners.getAllByTestId('avatar-group-item')).toHaveLength(3);
    expect(owners.getByTestId('avatar-group-overflow')).toHaveTextContent('+1');
  });

  // The row's title link is stretched over the row; the owners sit above it so
  // each keeps its own link and hover card.
  it('sits above the row link', () => {
    render(
      <TopicRowOwners
        dataTestId="owners"
        owners={[user('Dale Kim'), user('Teddy')]}
      />
    );

    expect(screen.getByTestId('owners')).toHaveClass('tw:relative', 'tw:z-10');
  });
});
