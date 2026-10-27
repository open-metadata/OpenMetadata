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
import type { TFunction } from 'i18next';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { ReactElement } from 'react';
import { Team, TeamType } from '../../../../../../generated/entity/teams/team';
import { User } from '../../../../../../generated/entity/teams/user';
import {
  getAvailableTabs,
  getChildTeamColumns,
  getTabLabel,
  getUserColumns,
  updateTeamsHierarchy,
  withTeamChildrenPlaceholder,
} from './MembersTeamDetail.utils';

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
  const t = ((key: string) => key) as unknown as TFunction;

  it('labels custom properties without a count', () => {
    const label = getTabLabel('custom-properties', t, {} as Team, 0, 0);

    expect(label).toBe('label.custom-property-plural');
  });

  it('still counts the native tabs', () => {
    expect(getTabLabel('roles', t, { defaultRoles: [{}] } as Team, 0, 0)).toBe(
      'label.role-plural (1)'
    );
  });
});

describe('getChildTeamColumns', () => {
  const t = (key: string) => key;

  const renderAssetCount = (
    record: Team,
    teamAssetCounts: Record<string, number>
  ) => {
    const column = getChildTeamColumns(t, jest.fn(), teamAssetCounts).find(
      (col) => col.key === 'assets'
    ) as {
      render: (value: unknown, record: Team, index: number) => ReactElement;
    };

    // Antd hands render the dataIndex value first, then the row.
    render(column.render(record.fullyQualifiedName, record, 0));

    return screen.getByTestId(`team-asset-count-${record.name}`);
  };

  it('shows a sub-team asset count from the team asset counts', () => {
    expect(
      renderAssetCount(team('org.eng'), { 'org.eng': 7 })
    ).toHaveTextContent('7');
  });

  it('shows zero for a sub-team missing from the team asset counts', () => {
    expect(renderAssetCount(team('org.eng'), {})).toHaveTextContent('0');
  });
});

describe('getUserColumns remove action', () => {
  const t = ((key: string) => key) as unknown as TFunction;
  const alice = { id: 'u1', name: 'alice', displayName: 'Alice' } as User;

  const renderRemoveCell = (onRemoveUser: jest.Mock) => {
    const column = getUserColumns(
      t,
      true,
      jest.fn(),
      'Engineering',
      onRemoveUser
    ).find((col) => col.key === 'actions') as {
      render: (value: unknown, record: User, index: number) => ReactElement;
    };

    render(column.render(undefined, alice, 0));
    fireEvent.click(screen.getByTestId('remove-user-alice'));
  };

  it('removes the user only after confirming in the popover', async () => {
    const onRemoveUser = jest.fn().mockResolvedValue(undefined);
    renderRemoveCell(onRemoveUser);

    expect(onRemoveUser).not.toHaveBeenCalled();
    expect(
      screen.getByTestId('remove-from-team-popover-title')
    ).toHaveTextContent('label.remove-entity');

    await act(async () => {
      fireEvent.click(screen.getByTestId('remove-from-team-popover-confirm'));
    });

    expect(onRemoveUser).toHaveBeenCalledWith(alice);
    expect(
      screen.queryByTestId('remove-from-team-popover')
    ).not.toBeInTheDocument();
  });

  it('keeps the user when the popover is cancelled', () => {
    const onRemoveUser = jest.fn();
    renderRemoveCell(onRemoveUser);

    fireEvent.click(screen.getByTestId('remove-from-team-popover-cancel'));

    expect(onRemoveUser).not.toHaveBeenCalled();
    expect(
      screen.queryByTestId('remove-from-team-popover')
    ).not.toBeInTheDocument();
  });
});
