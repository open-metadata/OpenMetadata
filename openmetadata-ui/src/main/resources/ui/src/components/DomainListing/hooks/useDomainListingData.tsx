/*
 *  Copyright 2024 Collate.
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

import { useMemo } from 'react';
import { useDomainListing } from '../../../components/common/atoms/domain/compositions/useDomainListing';
import { ListingData } from '../../../components/common/atoms/shared/types';
import { Domain } from '../../../generated/entity/domains/domain';
import { useDomainStore } from '../../../hooks/useDomainStore';
import { useMarketplaceStore } from '../../../hooks/useMarketplaceStore';
import { QueryFieldInterface } from '../../../pages/ExplorePage/ExplorePage.interface';

export const useDomainListingData = (): ListingData<Domain> => {
  const { domainBasePath } = useMarketplaceStore();
  const { userDomains, isDomainRestricted } = useDomainStore();

  const baseFilter = useMemo(() => {
    const must: QueryFieldInterface[] = [];

    if (isDomainRestricted) {
      const should = userDomains.flatMap((domain) => [
        { term: { fullyQualifiedName: domain.fullyQualifiedName } },
        { prefix: { fullyQualifiedName: `${domain.fullyQualifiedName}.` } },
      ]) as QueryFieldInterface[];

      must.push({
        bool: {
          should,
          minimum_should_match: 1,
        },
      });
    }

    return {
      query: {
        bool: {
          must,
          must_not: [
            {
              exists: {
                field: 'parent',
              },
            },
          ],
        },
      },
    };
  }, [userDomains, isDomainRestricted]);

  return useDomainListing({
    baseFilter: JSON.stringify(baseFilter),
    nameLabelKey: 'label.domain',
    basePath: domainBasePath,
  });
};
