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

import { Aggregations, Bucket } from 'interface/search.interface';
import { isEmpty, isEqual, isUndefined, uniqWith } from 'lodash';
import {
  QueryFieldInterface,
  QueryFilterInterface,
} from 'pages/explore/ExplorePage.interface';
import { QueryFilterFieldsEnum } from '../../enums/Explore.enum';

export const getQueryFiltersArray = (
  field: QueryFilterFieldsEnum,
  queryFiltersObj: QueryFilterInterface
) => {
  switch (field) {
    case QueryFilterFieldsEnum.SHOULD: {
      return queryFiltersObj?.query?.bool?.should ?? [];
    }
    case QueryFilterFieldsEnum.MUST: {
      return queryFiltersObj?.query?.bool?.must ?? [];
    }
  }
};

export const getCombinedFields = (
  field: QueryFilterFieldsEnum,
  filtersArray: Array<QueryFilterInterface | undefined>
): QueryFieldInterface[] => {
  const combinedFiltersArray: QueryFieldInterface[] = [];

  filtersArray.forEach((filtersObj) => {
    if (!isUndefined(filtersObj)) {
      combinedFiltersArray.push(...getQueryFiltersArray(field, filtersObj));
    }
  });

  return uniqWith(combinedFiltersArray, isEqual);
};

export const getCombinedQueryFilterObject = (
  elasticsearchQueryFilter?: QueryFilterInterface,
  advancesSearchQueryFilter?: QueryFilterInterface,
  advancesSearchFilter?: QueryFilterInterface
) => {
  const mustField = getCombinedFields(QueryFilterFieldsEnum.MUST, [
    elasticsearchQueryFilter,
    advancesSearchQueryFilter,
    advancesSearchFilter,
  ]);
  const shouldField = getCombinedFields(QueryFilterFieldsEnum.SHOULD, [
    elasticsearchQueryFilter,
    advancesSearchQueryFilter,
    advancesSearchFilter,
  ]);

  return {
    query: {
      bool: {
        ...(isEmpty(mustField) ? {} : { must: mustField }),
        ...(isEmpty(shouldField) ? {} : { should: shouldField }),
      },
    },
  };
};

export const getUpdatedAggregateFieldValue = (
  withFilterAggregations: Aggregations,
  withoutFilterAggregations: Aggregations,
  filterKey: string
): { buckets: Bucket[] } | undefined => {
  const withoutFilterAggField = withoutFilterAggregations[filterKey];
  const withFilterAggField = withFilterAggregations[filterKey];

  if (!isEmpty(withoutFilterAggField) && !isEmpty(withFilterAggField)) {
    return {
      ...withoutFilterAggField,
      // Fetching buckets with updated entities count for applied filters
      buckets: getBucketsWithUpdatedCounts(
        withoutFilterAggField.buckets,
        withFilterAggField.buckets
      ),
    };
  } else {
    return undefined;
  }
};

// Function to get buckets with updated counts for facet filters
export const getBucketsWithUpdatedCounts = (
  currentBucket: Bucket[],
  withFilterBucket: Bucket[]
): Bucket[] =>
  currentBucket
    .map((currentBucketItem) => {
      const item = withFilterBucket.find(
        (withFilterBucketItem) =>
          withFilterBucketItem.key === currentBucketItem.key
      );
      // Take updated count for filter if present else show 0 count
      const docCount = item ? item.doc_count : 0;

      return {
        ...currentBucketItem,
        doc_count: docCount,
      };
    })
    .sort((a, b) => b.doc_count - a.doc_count); // Sorting buckets according to the entity counts
