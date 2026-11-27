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

import { useEffect, useState } from 'react';
import { SearchIndex } from '../../../../enums/search.enum';
import { User } from '../../../../generated/entity/teams/user';
import { searchQuery } from '../../../../rest/searchAPI';
import {
  getOwnerIdsKey,
  getUserAssetsQueryFilter,
  UserAssetsKind,
} from './UserAssets.utils';

/** Total assets the user owns or follows; undefined until loaded or on error. */
export const useUserAssetCount = (
  user: User | undefined,
  kind: UserAssetsKind
): number | undefined => {
  const [count, setCount] = useState<number>();
  const ownerIdsKey = getOwnerIdsKey(user);

  useEffect(() => {
    if (!user?.id) {
      setCount(undefined);

      return;
    }
    let cancelled = false;
    setCount(undefined);
    searchQuery({
      pageNumber: 1,
      pageSize: 0,
      query: '',
      queryFilter: getUserAssetsQueryFilter(kind, user),
      searchIndex: SearchIndex.DATA_ASSET,
    })
      .then((res) => !cancelled && setCount(res.hits?.total?.value ?? 0))
      .catch(() => !cancelled && setCount(undefined));

    return () => {
      cancelled = true;
    };
    // Keyed on ids, not the user object, so a refetched user doesn't refire.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ownerIdsKey, kind]);

  return count;
};
