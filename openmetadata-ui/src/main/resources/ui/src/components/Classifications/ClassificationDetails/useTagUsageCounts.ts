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

import { useQuery } from '@tanstack/react-query';
import { isEmpty } from 'lodash';
import { useMemo } from 'react';
import { SearchIndex } from '../../../enums/search.enum';
import { Tag } from '../../../generated/entity/classification/tag';
import { postExactAggregateFieldOptions } from '../../../rest/miscAPI';
import {
    buildTagFqnIncludeRegex,
    getTagUsageAggregationField,
    parseTagUsageBuckets
} from '../../../utils/TagsPureUtils';

export const TAG_USAGE_COUNTS_QUERY_KEY = 'tag-usage-counts';

const TAG_USAGE_COUNTS_STALE_TIME = 60 * 1000;

export interface TagUsageCounts {
  // Undefined when unknown, so the column can tell it from a real zero
  usageCounts?: Record<string, number>;
  isUsageCountsLoading: boolean;
}

/** Asset counts for a page of tags — keyed on its FQNs, so paging aborts the in-flight aggregation. */
export const useTagUsageCounts = (
  classificationName: string | undefined,
  tags: Tag[],
  enabled = true
): TagUsageCounts => {
  const tagFQNs = useMemo(
    () =>
      tags
        .map(({ fullyQualifiedName }) => fullyQualifiedName)
        .filter(Boolean) as string[],
    [tags]
  );

  const fieldName = getTagUsageAggregationField(classificationName ?? '');

  const { data: usageCounts, isFetching } = useQuery({
    queryKey: [TAG_USAGE_COUNTS_QUERY_KEY, fieldName, tagFQNs],
    queryFn: ({ signal }) =>
      postExactAggregateFieldOptions(
        {
          index: SearchIndex.ALL,
          fieldName,
          fieldValue: buildTagFqnIncludeRegex(tagFQNs),
          size: tagFQNs.length,
          deleted: false,
        },
        signal
      ).then(({ data }) => parseTagUsageBuckets(data.aggregations, fieldName)),
    enabled: enabled && !isEmpty(tagFQNs),
    staleTime: TAG_USAGE_COUNTS_STALE_TIME,
    // Supplementary counts — a search outage falls back to "unknown", no retry
    retry: false,
  });

  return { usageCounts, isUsageCountsLoading: isFetching };
};
