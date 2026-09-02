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
import type { Config, ImmutableTree } from '@react-awesome-query-builder/ui';
import { Utils as QbUtils } from '@react-awesome-query-builder/ui';
import { isEmpty } from 'lodash';
import { SearchOutputType } from '../../components/Explore/AdvanceSearchProvider/AdvanceSearchProvider.interface';
import type { QueryFilterInterface } from '../../interface/queryFilter.interface';
import {
  elasticSearchFormat,
  hasUnfinishedRule,
} from '../QueryBuilderElasticsearchFormatUtils';

/**
 * What a formatted tree produces, for both output types.
 *
 * `value` is what the caller persists — a serialised ES filter or JSONLogic —
 * and is deliberately `''` (not `'{}'`) for an empty tree, because callers
 * treat the empty string as "no filter".
 */
export interface FormattedQuery {
  value: string;
  /** Present for Elasticsearch output only. */
  queryFilter?: QueryFilterInterface;
}

/**
 * `QueryBuilderElasticsearchFormatUtils` is still untyped JS, so the casts are
 * confined here rather than repeated at every call site.
 */
export const toElasticSearchQuery = (
  tree: ImmutableTree,
  config: Config
): FormattedQuery => {
  const query = (elasticSearchFormat(tree, config) ?? '') as unknown;

  if (isEmpty(query)) {
    return { value: '' };
  }

  const queryFilter = { query } as unknown as QueryFilterInterface;

  return { value: JSON.stringify(queryFilter), queryFilter };
};

/**
 * RAQB throws while a rule is mid-edit (a field chosen but no operator yet),
 * which is a normal transient state rather than an error — emit an empty value
 * so the caller simply sees "no filter yet".
 */
export const toJsonLogicQuery = (
  tree: ImmutableTree,
  config: Config
): FormattedQuery => {
  try {
    const jsonLogic = QbUtils.jsonLogicFormat(tree, config);

    return { value: JSON.stringify(jsonLogic.logic ?? '') };
  } catch {
    return { value: '' };
  }
};

export const formatQuery = (
  tree: ImmutableTree,
  config: Config,
  outputType: SearchOutputType
): FormattedQuery =>
  outputType === SearchOutputType.ElasticSearch
    ? toElasticSearchQuery(tree, config)
    : toJsonLogicQuery(tree, config);

/**
 * False while any rule is incomplete. Callers gate saving on this so a
 * half-written condition cannot be silently dropped from the emitted filter,
 * which would widen it without the user noticing.
 */
export const isQueryTreeComplete = (
  tree: ImmutableTree,
  config: Config
): boolean => !(hasUnfinishedRule(tree, config) as unknown as boolean);
