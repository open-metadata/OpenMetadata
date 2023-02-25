/*
 *  Copyright 2022 Collate.
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

import { isEmpty, isUndefined } from 'lodash';
import { QueryFilterInterface } from 'pages/explore/ExplorePage.interface';
import { QueryFilterFieldsEnum } from '../../enums/Explore.enum';

export const getQueryFiltersArray = (
  queryFilters: QueryFilterInterface[] | undefined
) => (isUndefined(queryFilters) ? [] : queryFilters);

export const getCombinedFields = (
  field: QueryFilterFieldsEnum,
  elasticsearchQueryFilter?: QueryFilterInterface,
  advancesSearchQueryFilter?: QueryFilterInterface
): QueryFilterInterface[] => {
  switch (field) {
    case QueryFilterFieldsEnum.SHOULD: {
      return [
        ...getQueryFiltersArray(elasticsearchQueryFilter?.query?.bool?.should),
        ...getQueryFiltersArray(advancesSearchQueryFilter?.query?.bool?.should),
      ];
    }
    case QueryFilterFieldsEnum.MUST: {
      return [
        ...getQueryFiltersArray(elasticsearchQueryFilter?.query?.bool?.must),
        ...getQueryFiltersArray(advancesSearchQueryFilter?.query?.bool?.must),
      ];
    }
  }
};

export const getCombinedQueryFilterObject = (
  elasticsearchQueryFilter?: QueryFilterInterface,
  advancesSearchQueryFilter?: QueryFilterInterface
) => {
  const mustField = getCombinedFields(
    QueryFilterFieldsEnum.MUST,
    elasticsearchQueryFilter,
    advancesSearchQueryFilter
  );
  const shouldField = getCombinedFields(
    QueryFilterFieldsEnum.SHOULD,
    elasticsearchQueryFilter,
    advancesSearchQueryFilter
  );

  return {
    query: {
      bool: {
        ...(isEmpty(mustField) ? {} : { must: mustField }),
        ...(isEmpty(shouldField) ? {} : { should: shouldField }),
      },
    },
  };
};
