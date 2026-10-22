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
import { User } from '../../../../generated/entity/teams/user';
import { EMPTY_STATE_COPY, TYPE_OPTIONS } from './UserAssets.constants';
import {
  getOwnerIdsKey,
  getUserAssetsQueryFilter,
  suffixedTestId,
} from './UserAssets.utils';

const user = {
  id: 'u2',
  teams: [
    { id: 't9', type: 'team' },
    { id: 't1', type: 'team' },
  ],
} as User;

type TermClause = {
  term?: Record<string, unknown>;
  nested?: { query: { term: Record<string, unknown> } };
};

// owners.* is a nested field, so its terms come wrapped in a nested query.
const termValues = (filter: Record<string, unknown>, field: string) =>
  (filter as { query: { bool: { should: TermClause[] } } }).query.bool.should
    .map((clause) => (clause.term ?? clause.nested?.query.term)?.[field])
    .filter(Boolean);

describe('getOwnerIdsKey', () => {
  it('joins the user and team ids sorted', () => {
    expect(getOwnerIdsKey(user)).toBe('t1,t9,u2');
  });

  it('is empty without a user', () => {
    expect(getOwnerIdsKey(undefined)).toBe('');
    expect(getOwnerIdsKey({ id: '' } as User)).toBe('');
  });
});

describe('getUserAssetsQueryFilter', () => {
  it('matches owners by the user or any of their teams for owned', () => {
    const filter = getUserAssetsQueryFilter('owned', user);

    expect(termValues(filter, 'owners.id')).toEqual(['t1', 't9', 'u2']);
    expect(JSON.stringify(filter)).not.toContain('followers');
  });

  it('matches only the user as follower for following', () => {
    const filter = getUserAssetsQueryFilter('following', user);

    expect(termValues(filter, 'followers')).toEqual(['u2']);
    expect(JSON.stringify(filter)).not.toContain('t1');
  });
});

describe('suffixedTestId', () => {
  it('suffixes a test id and passes undefined through', () => {
    expect(suffixedTestId('card', 'value')).toBe('card-value');
    expect(suffixedTestId(undefined, 'value')).toBeUndefined();
  });
});

describe('UserAssets constants', () => {
  it('exposes label/value type options only', () => {
    expect(TYPE_OPTIONS.length).toBeGreaterThan(0);

    TYPE_OPTIONS.forEach((option) =>
      expect(Object.keys(option).sort()).toEqual(['label', 'value'])
    );
  });

  it('has a title and description key per kind and audience', () => {
    (['owned', 'following'] as const).forEach((kind) =>
      (['self', 'other'] as const).forEach((who) =>
        expect(EMPTY_STATE_COPY[kind][who]).toHaveLength(2)
      )
    );
  });
});
