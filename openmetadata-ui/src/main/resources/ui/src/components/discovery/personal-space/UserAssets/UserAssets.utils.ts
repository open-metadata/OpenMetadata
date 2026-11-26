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
import { SearchSourceAlias } from '../../../../interface/search.interface';
import { getTermQuery } from '../../../../utils/SearchPureUtils';

export type UserAssetsKind = 'owned' | 'following';

/**
 * A user owns an asset directly or through any of their teams. Sorted and
 * joined so callers can key effects on it without refiring on new refs.
 */
export const getOwnerIdsKey = (user?: Pick<User, 'id' | 'teams'>): string =>
  [user?.id, ...(user?.teams ?? []).map((team) => team.id)]
    .filter(Boolean)
    .sort()
    .join(',');

export const getUserAssetsQueryFilter = (
  kind: UserAssetsKind,
  user: Pick<User, 'id' | 'teams'>
): Record<string, unknown> =>
  (kind === 'owned'
    ? getTermQuery(
        { 'owners.id': getOwnerIdsKey(user).split(',').filter(Boolean) },
        'should',
        1
      )
    : getTermQuery({ followers: user.id }, 'should', 1)) as Record<
    string,
    unknown
  >;

export const suffixedTestId = (testId: string | undefined, suffix: string) =>
  testId ? `${testId}-${suffix}` : undefined;

/**
 * The first asset stands selected until the user picks another; `null` means
 * the user closed the summary panel, so nothing is selected.
 */
export const getSelectedAsset = (
  assets: SearchSourceAlias[],
  selectedId: string | null | undefined
): SearchSourceAlias | undefined =>
  selectedId === null
    ? undefined
    : assets.find((asset) => asset.id === selectedId) ?? assets[0];
