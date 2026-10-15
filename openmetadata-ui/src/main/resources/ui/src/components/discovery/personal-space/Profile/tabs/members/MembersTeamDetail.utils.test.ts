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
import { ReactElement } from 'react';
import { Team, TeamType } from '../../../../../../generated/entity/teams/team';
import { EntityReference } from '../../../../../../generated/entity/type';
import {
  getAvailableTabs,
  getChildTeamColumns,
  getEntityRefColumns,
  getTabLabel,
  updateTeamsHierarchy,
  withTeamChildrenPlaceholder,
} from './MembersTeamDetail.utils';
import { profileHash } from './profileHash.utils';

const team = (fqn: string, childrenCount = 0): Team =>
  ({ name: fqn, fullyQualifiedName: fqn, childrenCount } as Team);

describe('withTeamChildrenPlaceholder', () => {
  it('adds an empty children array to teams that have sub-teams', () => {
    const [withKids, leaf] = withTeamChildrenPlaceholder([
      team('a', 2),
      team('b', 0),
    ]);

    expect(withKids.children).toEqual([]);
    expect(leaf.children).toBeUndefined();
  });
});

describe('updateTeamsHierarchy', () => {
  it('grafts children onto the matching parent at any depth', () => {
    const tree = withTeamChildrenPlaceholder([team('a', 1)]);
    (tree[0].children as unknown as Team[]) = withTeamChildrenPlaceholder([
      team('a.b', 1),
    ]);

    updateTeamsHierarchy(tree, 'a.b', [team('a.b.c')]);

    const child = tree[0].children?.[0] as unknown as Team;

    expect(child.children?.[0].fullyQualifiedName).toBe('a.b.c');
  });

  it('leaves the tree untouched when the parent is absent', () => {
    const tree = withTeamChildrenPlaceholder([team('a', 1)]);

    updateTeamsHierarchy(tree, 'missing', [team('x')]);

    expect(tree[0].children).toEqual([]);
  });
});

describe('getAvailableTabs', () => {
  it.each([
    [TeamType.Organization],
    [TeamType.Group],
    [TeamType.Department],
    [undefined],
  ])('offers custom properties for team type %s', (teamType) => {
    expect(getAvailableTabs(teamType)).toContain('custom-properties');
  });

  it('keeps the first tab stable so the default selection is unchanged', () => {
    expect(getAvailableTabs(TeamType.Organization)[0]).toBe('teams');
    expect(getAvailableTabs(TeamType.Group)[0]).toBe('users');
  });
});

describe('getTabLabel', () => {
  const t = (key: string) => key;

  it('labels custom properties without a count', () => {
    const label = getTabLabel('custom-properties', t, {} as Team, 0, 0);

    expect(label).toBe('label.custom-property-plural');
  });

  it('still counts the native tabs', () => {
    expect(getTabLabel('roles', t, { defaultRoles: [{}] } as Team, 0, 0)).toBe(
      'label.role-plural (1)'
    );
  });

  it('shows the asset count on the assets tab', () => {
    expect(getTabLabel('assets', t, {} as Team, 0, 3)).toBe(
      'label.asset-plural (3)'
    );
  });
});

describe('getChildTeamColumns', () => {
  it('navigates a child team link to that team’s detail', () => {
    const onNavigate = jest.fn();
    const [nameColumn] = getChildTeamColumns((key) => key, onNavigate);
    const child = {
      name: 'finance',
      displayName: 'Finance',
      fullyQualifiedName: 'Organization.finance',
    } as Team;

    render(nameColumn.render?.(undefined, child, 0) as ReactElement);
    fireEvent.click(screen.getByTestId('team-link-finance'));

    expect(onNavigate).toHaveBeenCalledWith({
      type: 'team-detail',
      fqn: 'Organization.finance',
      name: 'Finance',
    });
  });
});

describe('getEntityRefColumns', () => {
  it.each([
    ['role', profileHash.role],
    ['policy', profileHash.policy],
  ])('navigates a team %s to its access-control detail', (_, hashOf) => {
    const goTo = jest.fn();
    const ref = {
      id: '1',
      type: 'role',
      name: 'DataSteward',
      fullyQualifiedName: 'DataSteward',
    } as EntityReference;
    const [nameColumn] = getEntityRefColumns(
      (key) => key,
      false,
      false,
      goTo,
      jest.fn(),
      (r) => hashOf(r.fullyQualifiedName ?? '')
    );

    render(nameColumn.render?.(undefined, ref, 0) as ReactElement);
    fireEvent.click(screen.getByRole('button', { name: 'DataSteward' }));

    expect(goTo).toHaveBeenCalledWith(hashOf('DataSteward'));
  });
});
