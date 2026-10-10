/*
 *  Copyright 2025 Collate.
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

import { isEmpty } from 'lodash';
import { SearchIndex } from '../../../enums/search.enum';
import { searchQuery } from '../../../rest/searchAPI';
import { getTermQuery } from '../../../utils/SearchPureUtils';

const getContainerFqn = (
  source: object,
  containerEntities: string[]
): string | undefined => {
  if (
    !('entityType' in source) ||
    typeof source.entityType !== 'string' ||
    !containerEntities.includes(source.entityType)
  ) {
    return undefined;
  }
  if (
    'fullyQualifiedName' in source &&
    typeof source.fullyQualifiedName === 'string'
  ) {
    return source.fullyQualifiedName || undefined;
  }

  return undefined;
};

// Resolves which of the saved FQNs refer to a container (ancestor) entity type for the current
// source. The match rule is identical to authoring time (entityType in containerEntities), so the
// saved-alert view can re-apply the display-only ".*" subtree hint that is not persisted.
export const resolveWildcardFqns = async (
  fqns: string[],
  searchIndex: SearchIndex | SearchIndex[],
  containerEntities: string[] = []
): Promise<string[]> => {
  let wildcardFqns: string[] = [];
  if (!isEmpty(fqns) && !isEmpty(containerEntities)) {
    try {
      const response = await searchQuery({
        query: '*',
        pageNumber: 1,
        pageSize: fqns.length,
        searchIndex,
        queryFilter: getTermQuery({ fullyQualifiedName: fqns }, 'should', 1),
      });

      wildcardFqns = response.hits.hits.flatMap(({ _source }) => {
        const fqn = getContainerFqn(_source, containerEntities);

        return fqn ? [fqn] : [];
      });
    } catch {
      wildcardFqns = [];
    }
  }

  return wildcardFqns;
};
