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

import { useDomainListing } from '../../../../components/common/atoms/domain/compositions/useDomainListing';
import { ListingData } from '../../../../components/common/atoms/shared/types';
import { Domain } from '../../../../generated/entity/domains/domain';

interface UseSubdomainListingDataProps {
  parentDomainFqn: string;
}

export const useSubdomainListingData = ({
  parentDomainFqn,
}: UseSubdomainListingDataProps): ListingData<Domain> => {
  const baseFilter = {
    query: {
      bool: {
        must: [
          {
            term: {
              'parent.fullyQualifiedName.keyword': parentDomainFqn,
            },
          },
        ],
      },
    },
  };

  return useDomainListing({
    baseFilter: JSON.stringify(baseFilter),
    nameLabelKey: 'label.sub-domain',
    isSubDomain: true,
    searchKey: 'sub-domain',
  });
};
