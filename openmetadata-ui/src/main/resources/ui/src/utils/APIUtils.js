/*
 *  Copyright 2021 Collate
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

// if more value is added, also update its interface file at -> interface/types.d.ts
export const formatDataResponse = (hits) => {
  const formattedData = hits.map((hit) => {
    const newData = {};
    newData.index = hit._index;
    newData.id = hit._source.id;
    newData.name = hit._source.name;
    newData.displayName = hit._source.displayName;
    newData.description = hit._source.description;
    newData.fullyQualifiedName = hit._source.fullyQualifiedName;
    newData.tableType = hit._source.tableType;
    newData.tags = hit._source.tags;
    newData.dailyStats = hit._source.usageSummary?.dailyStats?.count;
    newData.dailyPercentileRank =
      hit._source.usageSummary?.dailyStats?.percentileRank;
    newData.weeklyStats = hit._source.usageSummary?.weeklyStats?.count;
    newData.weeklyPercentileRank =
      hit._source.usageSummary?.weeklyStats?.percentileRank;
    newData.service = hit._source.service;
    newData.serviceType = hit._source.serviceType;
    newData.tier = hit._source.tier;
    newData.owner = hit._source.owner;
    newData.highlight = hit.highlight;

    newData.database = hit._source.database?.name;
    newData.databaseSchema = hit._source.databaseSchema?.name;

    newData.entityType = hit._source.entityType;
    newData.changeDescriptions = hit._source.changeDescriptions;
    newData.deleted = hit._source.deleted;

    return newData;
  });

  return formattedData;
};

export const formatUsersResponse = (hits) => {
  return hits.map((d) => {
    return {
      name: d._source.name,
      displayName: d._source.displayName,
      email: d._source.email,
      type: d._source.entityType,
      id: d._source.id,
      teams: d._source.teams,
    };
  });
};

export const formatTeamsResponse = (hits) => {
  return hits.map((d) => {
    return {
      name: d._source.name,
      displayName: d._source.displayName,
      type: d._source.entityType,
      id: d._source.id,
      isJoinable: d._source.isJoinable,
    };
  });
};

export const formatSearchGlossaryTermResponse = (hits) => {
  const term = hits.map((d) => {
    return {
      name: d._source.name,
      displayName: d._source.displayName,
      fqdn: d._source.fullyQualifiedName,
      type: d._source.entityType || 'glossaryTerm',
      id: d._id,
    };
  });

  return term;
};

export const omitDeep = (obj, predicate) => {
  return transform(obj, function (result, value, key) {
    if (isObject(value)) {
      value = omitDeep(value, predicate);
    }
    const doOmit = predicate(value, key);
    if (!doOmit) {
      isArray(obj) ? result.push(value) : (result[key] = value);
    }
  });
};

export const getURLWithQueryFields = (url, lstQueryFields, qParams = '') => {
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
