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
import type { Bucket } from 'Models';
import { EntityType } from '../enums/entity.enum';
import { SearchIndex } from '../enums/search.enum';
import type { ElasticsearchQuery } from './QueryBuilderPureUtils';

export const getEntityTypeFromSearchIndex = (searchIndex: string) => {
  const commonAssets: Record<string, EntityType> = {
    [SearchIndex.TABLE]: EntityType.TABLE,
    [SearchIndex.PIPELINE]: EntityType.PIPELINE,
    [SearchIndex.DASHBOARD]: EntityType.DASHBOARD,
    [SearchIndex.MLMODEL]: EntityType.MLMODEL,
    [SearchIndex.TOPIC]: EntityType.TOPIC,
    [SearchIndex.CONTAINER]: EntityType.CONTAINER,
    [SearchIndex.STORED_PROCEDURE]: EntityType.STORED_PROCEDURE,
    [SearchIndex.DASHBOARD_DATA_MODEL]: EntityType.DASHBOARD_DATA_MODEL,
    [SearchIndex.SEARCH_INDEX]: EntityType.SEARCH_INDEX,
    [SearchIndex.DATABASE_SCHEMA]: EntityType.DATABASE_SCHEMA,
    [SearchIndex.DATABASE_SERVICE]: EntityType.DATABASE_SERVICE,
    [SearchIndex.MESSAGING_SERVICE]: EntityType.MESSAGING_SERVICE,
    [SearchIndex.DASHBOARD_SERVICE]: EntityType.DASHBOARD_SERVICE,
    [SearchIndex.PIPELINE_SERVICE]: EntityType.PIPELINE_SERVICE,
    [SearchIndex.ML_MODEL_SERVICE]: EntityType.MLMODEL_SERVICE,
    [SearchIndex.STORAGE_SERVICE]: EntityType.STORAGE_SERVICE,
    [SearchIndex.SEARCH_SERVICE]: EntityType.SEARCH_SERVICE,
    [SearchIndex.GLOSSARY_TERM]: EntityType.GLOSSARY_TERM,
    [SearchIndex.TAG]: EntityType.TAG,
    [SearchIndex.DATABASE]: EntityType.DATABASE,
    [SearchIndex.DOMAIN]: EntityType.DOMAIN,
    [SearchIndex.DATA_PRODUCT]: EntityType.DATA_PRODUCT,
    [SearchIndex.API_COLLECTION]: EntityType.API_COLLECTION,
    [SearchIndex.API_ENDPOINT]: EntityType.API_ENDPOINT,
    [SearchIndex.METRIC]: EntityType.METRIC,
    [SearchIndex.API_SERVICE]: EntityType.API_SERVICE,
  };

  return commonAssets[searchIndex] || null;
};

export const parseBucketsData = (
  buckets: Array<Bucket>,
  sourceFields?: string,
  sourceFieldOptionType?: {
    label: string;
    value: string;
  }
) => {
  if (sourceFieldOptionType) {
    return buckets.map((bucket) => {
      const topHitsData = (bucket as Record<string, unknown>)[
        'top_hits#top'
      ] as
        | {
            hits?: {
              hits?: Array<{
                _source?: Record<string, unknown>;
              }>;
            };
          }
        | undefined;
      const data = topHitsData?.hits?.hits?.[0]?._source;

      return {
        title: data?.[sourceFieldOptionType.label] as string,
        value: data?.[sourceFieldOptionType.value] as string,
      };
    });
  }

  return buckets.map((bucket) => {
    const topHitsSource = (
      (bucket as Record<string, unknown>)['top_hits#top'] as
        | {
            hits?: {
              hits?: Array<{
                _source?: Record<string, unknown>;
              }>;
            };
          }
        | undefined
    )?.hits?.hits?.[0]?._source;

    const actualValue =
      sourceFields && topHitsSource
        ? sourceFields
            .split('.')
            .reduce(
              (obj: unknown, key: string): unknown =>
                obj && typeof obj === 'object' && obj !== null && key in obj
                  ? (obj as Record<string, unknown>)[key]
                  : undefined,
              topHitsSource
            ) ?? bucket.key
        : bucket.key;

    return {
      value: actualValue,
      title: bucket.label ?? actualValue,
    };
  });
};

const NESTED_FIELDS = ['owners'];

const getNestedPath = (field: string): string | undefined => {
  return NESTED_FIELDS.find((nested) => field.startsWith(`${nested}.`));
};

const wrapTermQuery = (
  field: string,
  value: string | number | boolean,
  nestedPath?: string
): ElasticsearchQuery => {
  const termQuery: ElasticsearchQuery = { term: { [field]: value } };
  if (nestedPath) {
    return { nested: { path: nestedPath, query: termQuery } };
  }

  return termQuery;
};

export const getTermQuery = (
  terms: Record<string, string | string[] | number | boolean>,
  queryType: 'must' | 'must_not' | 'should' | 'should_not' = 'must',
  minimumShouldMatch?: number,
  options?: {
    wildcardTerms?: Record<string, string>;
    wildcardShouldQueries?: Record<string, string>;
    mustNotTerms?: Record<string, string | string[] | number | boolean>;
    matchTerms?: Record<string, string | number | boolean>;
    wildcardMustNotQueries?: Record<string, string | string[]>;
  }
) => {
  const termQueries = Object.entries(terms).flatMap(([field, value]) => {
    const nestedPath = getNestedPath(field);
    if (Array.isArray(value)) {
      return value.map((v) => wrapTermQuery(field, v, nestedPath));
    }

    return wrapTermQuery(field, value, nestedPath);
  });

  const wildcardQueries = options?.wildcardTerms
    ? Object.entries(options.wildcardTerms).map(([field, value]) => ({
        wildcard: { [field]: value },
      }))
    : [];

  const mustNotQueries = options?.mustNotTerms
    ? Object.entries(options.mustNotTerms).flatMap(([field, value]) => {
        const nestedPath = getNestedPath(field);
        if (Array.isArray(value)) {
          return value.map((v) => wrapTermQuery(field, v, nestedPath));
        }

        return wrapTermQuery(field, value, nestedPath);
      })
    : [];

  const matchQueries = options?.matchTerms
    ? Object.entries(options.matchTerms).map(([field, value]) => ({
        match: { [field]: value },
      }))
    : [];

  const allQueries: ElasticsearchQuery[] = [
    ...termQueries,
    ...wildcardQueries,
    ...matchQueries,
  ];

  if (
    options?.wildcardShouldQueries &&
    Object.keys(options.wildcardShouldQueries).length > 0
  ) {
    const shouldWildcardQueries = Object.entries(
      options.wildcardShouldQueries
    ).map(([field, value]) => ({
      wildcard: { [field]: value },
    }));

    allQueries.push({
      bool: {
        should: shouldWildcardQueries,
        minimum_should_match: 1,
      },
    });
  }

  type ESBoolQuery = Record<string, ElasticsearchQuery[] | number> & {
    must_not?: ElasticsearchQuery[];
    minimum_should_match?: number;
  };

  const boolQuery: ESBoolQuery = {
    [queryType]: allQueries,
  };

  const wildcardMustNotQueries = options?.wildcardMustNotQueries
    ? Object.entries(options.wildcardMustNotQueries).flatMap(
        ([field, value]) => {
          if (Array.isArray(value)) {
            return value.map((v) => ({ wildcard: { [field]: v } }));
          }

          return { wildcard: { [field]: value } };
        }
      )
    : [];

  const allMustNotQueries = [...mustNotQueries, ...wildcardMustNotQueries];

  if (allMustNotQueries.length > 0) {
    boolQuery.must_not = allMustNotQueries;
  }

  if (queryType === 'should' && minimumShouldMatch !== undefined) {
    boolQuery.minimum_should_match = minimumShouldMatch;
  }

  return {
    query: {
      bool: boolQuery,
    },
  };
};
