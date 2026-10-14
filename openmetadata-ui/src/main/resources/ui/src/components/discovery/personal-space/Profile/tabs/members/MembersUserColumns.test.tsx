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
import type { User } from '../../../../../../generated/entity/teams/user';
import type { EntityReference } from '../../../../../../generated/entity/type';
import { EntityLinksCell, UserNameCell } from './MembersUserColumns';
import { profileHash } from './profileHash.utils';

jest.mock(
  '../../../../../common/PopOverCard/UserPopOverCard',
  () =>
    ({
      userName,
      onTitleClick,
    }: {
      userName: string;
      onTitleClick: () => void;
    }) =>
      (
        <button data-testid={userName} onClick={onTitleClick}>
          {userName}
        </button>
      )
);

describe('UserNameCell', () => {
  it('navigates a username to that user’s profile', () => {
    const goTo = jest.fn();
    render(<UserNameCell goTo={goTo} record={{ name: 'jane.doe' } as User} />);

    fireEvent.click(screen.getByTestId('jane.doe'));

    expect(goTo).toHaveBeenCalledWith(profileHash.user('jane.doe'));
  });
});

describe('EntityLinksCell', () => {
  it.each([
    ['team', profileHash.team, 'Organization'],
    ['role', profileHash.role, 'DataConsumer'],
  ])('navigates a %s link to its detail', (_, targetFn, fqn) => {
    const goTo = jest.fn();
    const item = {
      id: fqn,
      type: 'team',
      name: fqn,
      fullyQualifiedName: fqn,
    } as EntityReference;

    render(
      <MemoryRouter>
        <EntityLinksCell
          emptyLabel="-"
          goTo={goTo}
          items={[item]}
          targetFn={targetFn}
        />
      </MemoryRouter>
    );

    fireEvent.click(screen.getByRole('link', { name: fqn }));

    expect(goTo).toHaveBeenCalledWith(targetFn(fqn));
  });
});
