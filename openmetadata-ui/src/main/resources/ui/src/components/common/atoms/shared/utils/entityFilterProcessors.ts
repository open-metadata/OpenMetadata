/*
 *  Copyright 2023 Collate.
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

import { SearchDropdownOption } from '../../../../SearchDropdown/SearchDropdown.interface';

interface AggregationBucket {
  key: string;
  doc_count: number;
}

interface AggregationResult {
  status: 'fulfilled' | 'rejected';
  value?: {
    data: {
      aggregations: Record<string, { buckets: AggregationBucket[] }>;
    };
  };
  reason?: any;
}

export const processGenericOptions = (
  result: AggregationResult,
  aggregationKey?: string
): SearchDropdownOption[] => {
  if (result.status !== 'fulfilled') {
    return [];
  }

  // Find the aggregation buckets - try common patterns
  let buckets: AggregationBucket[] = [];

  if (aggregationKey && result.value?.data.aggregations[aggregationKey]) {
    buckets = result.value.data.aggregations[aggregationKey].buckets || [];
  } else {
    // Try to find buckets in any aggregation
    const aggregations = result.value?.data.aggregations || {};
    const aggregationValues = Object.values(aggregations);
    if (aggregationValues.length > 0) {
      buckets = (aggregationValues[0] as any)?.buckets || [];
    }
  }

  return buckets.map((bucket) => ({
    key: bucket.key,
    label: bucket.key,
    count: bucket.doc_count,
  }));
};

export const processOwnerOptions = (
  result: AggregationResult
): SearchDropdownOption[] => {
  return processGenericOptions(result, 'sterms#owners.displayName.keyword');
};

export const processTagOptions = (
  result: AggregationResult
): SearchDropdownOption[] => {
  return processGenericOptions(result, 'sterms#tags.tagFQN');
};

export const processDomainTypeOptions = (
  result: AggregationResult
): SearchDropdownOption[] => {
  const options = processGenericOptions(result, 'sterms#domainType');

  // Fallback to static options if no data
  if (options.length === 0) {
    return [
      { key: 'Aggregate', label: 'Aggregate' },
      { key: 'Consumer-aligned', label: 'Consumer-aligned' },
      { key: 'Source-aligned', label: 'Source-aligned' },
    ];
  }

  return options;
};

// Tag filtering utilities
export const filterTagsBySource = (
  allTagOptions: SearchDropdownOption[],
  source: 'Classification' | 'Glossary'
): SearchDropdownOption[] => {
  if (source === 'Classification') {
    return allTagOptions.filter(
      (tag) =>
        tag.key.includes('Classification') ||
        tag.key.includes('.Classification.') ||
        tag.key.startsWith('PII') ||
        tag.key.startsWith('Sensitive') ||
        !tag.key.includes('Glossary') // Fallback for non-glossary tags
    );
  } else {
    return allTagOptions.filter(
      (tag) =>
        tag.key.includes('Glossary') ||
        tag.key.includes('.Glossary.') ||
        (!tag.key.includes('Classification') &&
          !tag.key.includes('PII') &&
          !tag.key.includes('Sensitive'))
    );
  }
};

export const processTagSourceOptions = (
  tagSourceResult: AggregationResult,
  tagsResult: AggregationResult
): {
  classificationTags: SearchDropdownOption[];
  glossaryTerms: SearchDropdownOption[];
} => {
  if (
    tagSourceResult.status !== 'fulfilled' ||
    tagsResult.status !== 'fulfilled'
  ) {
    return { classificationTags: [], glossaryTerms: [] };
  }

  const allTagOptions = processTagOptions(tagsResult);

  return {
    classificationTags: filterTagsBySource(allTagOptions, 'Classification'),
    glossaryTerms: filterTagsBySource(allTagOptions, 'Glossary'),
  };
};
