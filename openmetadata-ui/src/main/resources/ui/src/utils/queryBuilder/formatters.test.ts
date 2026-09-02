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
import { SearchOutputType } from '../../components/Explore/AdvanceSearchProvider/AdvanceSearchProvider.interface';
import {
  formatQuery,
  isQueryTreeComplete,
  toElasticSearchQuery,
  toJsonLogicQuery,
} from './formatters';

jest.mock('../QueryBuilderElasticsearchFormatUtils', () => ({
  elasticSearchFormat: jest.fn(),
  hasUnfinishedRule: jest.fn(),
}));

jest.mock('@react-awesome-query-builder/ui', () => ({
  ...jest.requireActual('@react-awesome-query-builder/ui'),
  Utils: {
    ...jest.requireActual('@react-awesome-query-builder/ui').Utils,
    jsonLogicFormat: jest.fn(),
  },
}));

const { elasticSearchFormat, hasUnfinishedRule } = jest.requireMock(
  '../QueryBuilderElasticsearchFormatUtils'
);
const { Utils } = jest.requireMock('@react-awesome-query-builder/ui');

const tree = {} as ImmutableTree;
const config = {} as Config;

describe('toElasticSearchQuery', () => {
  it('should wrap the formatted query and serialise it', () => {
    elasticSearchFormat.mockReturnValue({ bool: { must: [] } });

    const result = toElasticSearchQuery(tree, config);

    expect(result.queryFilter).toEqual({ query: { bool: { must: [] } } });
    expect(result.value).toBe('{"query":{"bool":{"must":[]}}}');
  });

  // Callers treat '' as "no filter"; '{}' would be a filter that matches
  // nothing, so an empty tree must not serialise to an object.
  it('should emit an empty string for an empty tree', () => {
    elasticSearchFormat.mockReturnValue(undefined);

    expect(toElasticSearchQuery(tree, config)).toEqual({ value: '' });
  });

  it('should emit an empty string when the formatter returns an empty object', () => {
    elasticSearchFormat.mockReturnValue({});

    expect(toElasticSearchQuery(tree, config)).toEqual({ value: '' });
  });
});

describe('toJsonLogicQuery', () => {
  it('should serialise the logic', () => {
    Utils.jsonLogicFormat.mockReturnValue({ logic: { '==': [1, 1] } });

    expect(toJsonLogicQuery(tree, config).value).toBe('{"==":[1,1]}');
  });

  // RAQB throws while a rule is mid-edit (field chosen, operator not yet).
  // That is a normal transient state, not an error.
  it('should emit an empty string when RAQB throws mid-edit', () => {
    Utils.jsonLogicFormat.mockImplementation(() => {
      throw new Error('incomplete rule');
    });

    expect(toJsonLogicQuery(tree, config).value).toBe('');
  });

  it('should emit an empty string when there is no logic', () => {
    Utils.jsonLogicFormat.mockReturnValue({});

    expect(toJsonLogicQuery(tree, config).value).toBe('""');
  });
});

describe('formatQuery', () => {
  it('should route Elasticsearch output to the ES formatter', () => {
    elasticSearchFormat.mockReturnValue({ bool: {} });

    const result = formatQuery(tree, config, SearchOutputType.ElasticSearch);

    expect(result.queryFilter).toBeDefined();
  });

  it('should route JSONLogic output to the JSONLogic formatter', () => {
    Utils.jsonLogicFormat.mockReturnValue({ logic: { and: [] } });

    const result = formatQuery(tree, config, SearchOutputType.JSONLogic);

    // JSONLogic has no queryFilter — only Elasticsearch produces one.
    expect(result.queryFilter).toBeUndefined();
    expect(result.value).toBe('{"and":[]}');
  });
});

describe('isQueryTreeComplete', () => {
  it('should be false while a rule is unfinished', () => {
    hasUnfinishedRule.mockReturnValue(true);

    expect(isQueryTreeComplete(tree, config)).toBe(false);
  });

  it('should be true once every rule is finished', () => {
    hasUnfinishedRule.mockReturnValue(false);

    expect(isQueryTreeComplete(tree, config)).toBe(true);
  });
});
