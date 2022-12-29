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

import { isArray, isObject, transform } from 'lodash';
import { FormattedTableData } from 'Models';
import { SearchIndex } from '../enums/search.enum';
import { GlossaryTerm } from '../generated/entity/data/glossaryTerm';
import { Team } from '../generated/entity/teams/team';
import { User } from '../generated/entity/teams/user';
import { SearchResponse } from '../interface/search.interface';

export type SearchEntityHits = SearchResponse<
  | SearchIndex.PIPELINE
  | SearchIndex.DASHBOARD
  | SearchIndex.TABLE
  | SearchIndex.MLMODEL
  | SearchIndex.TOPIC
>['hits']['hits'];

// if more value is added, also update its interface file at -> interface/types.d.ts
export const formatDataResponse = (
  hits: SearchEntityHits
): FormattedTableData[] => {
  const formattedData = hits.map((hit) => {
    const newData = {} as FormattedTableData;
    const source = hit._source;
    newData.index = hit._index;
    newData.id = hit._source.id;
    newData.name = hit._source.name;
    newData.displayName = hit._source.displayName ?? '';
    newData.description = hit._source.description ?? '';
    newData.fullyQualifiedName = hit._source.fullyQualifiedName ?? '';
    newData.tags = hit._source.tags ?? [];
    newData.service = hit._source.service?.name;
    newData.serviceType = hit._source.serviceType;
    newData.tier = hit._source.tier;
    newData.owner = hit._source.owner;
    newData.highlight = hit.highlight;
    newData.entityType = hit._source.entityType;
    newData.deleted = hit._source.deleted;

    if ('tableType' in source) {
      newData.tableType = source.tableType ?? '';
    }

    if ('usageSummary' in source) {
      newData.dailyStats = source.usageSummary?.dailyStats?.count;
      newData.dailyPercentileRank =
        source.usageSummary?.dailyStats?.percentileRank;
      newData.weeklyStats = source.usageSummary?.weeklyStats?.count;
      newData.weeklyPercentileRank =
        source.usageSummary?.weeklyStats?.percentileRank;
    }

    if ('database' in source) {
      newData.database = source.database?.name;
    }

    if ('databaseSchema' in source) {
      newData.databaseSchema = source.databaseSchema?.name;
    }

    newData.changeDescription = source.changeDescription;

    return newData;
  });

  return formattedData;
};

export const formatUsersResponse = (
  hits: SearchResponse<SearchIndex.USER>['hits']['hits']
): User[] => {
  return hits.map((d) => {
    return {
      name: d._source.name,
      displayName: d._source.displayName,
      email: d._source.email,
      type: d._source.entityType,
      id: d._source.id,
      teams: d._source.teams,
      roles: d._source.roles,
      href: d._source.href,
    };
  });
};

export const formatTeamsResponse = (
  hits: SearchResponse<SearchIndex.TEAM>['hits']['hits']
): Team[] => {
  return hits.map((d) => {
    return {
      name: d._source.name,
      displayName: d._source.displayName,
      type: d._source.entityType,
      id: d._source.id,
      isJoinable: d._source.isJoinable,
      teamType: d._source.teamType,
      href: d._source.href,
    };
  });
};

export const formatSearchGlossaryTermResponse = (
  hits: SearchResponse<SearchIndex.GLOSSARY>['hits']['hits']
): GlossaryTerm[] => {
  return hits.map((d) => ({
    name: d._source.name,
    description: d._source.description,
    id: d._source.id,
    glossary: d._source.glossary,
    displayName: d._source.displayName,
    fqdn: d._source.fullyQualifiedName,
    fullyQualifiedName: d._source.fullyQualifiedName,
    type: d._source.entityType || 'glossaryTerm',
  }));
};

export const getURLWithQueryFields = (
  url: string,
  lstQueryFields?: string | string[],
  qParams?: string
) => {
  let strQuery = lstQueryFields
    ? typeof lstQueryFields === 'string'
      ? lstQueryFields
      : lstQueryFields.length
      ? lstQueryFields.join()
      : ''
    : '';
  strQuery = strQuery.replace(/ /g, '');

  let queryParam = strQuery ? `?fields=${strQuery}` : '';

  if (qParams) {
    queryParam += queryParam ? `&${qParams}` : `?${qParams}`;
  }

  return url + queryParam;
};

export const omitDeep = <T>(
  obj: T,
  predicate: (value: string, key: string | number | symbol) => boolean
): T => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return transform(obj as any, function (result, value, key) {
    if (isObject(value)) {
      value = omitDeep(value, predicate) as unknown as string;
    }
    const doOmit = predicate(value, key);
    if (!doOmit) {
      if (isArray(obj) && isArray(result)) {
        result.push(value);
      } else {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (result as any)[key] = value;
      }
    }
  });
};
