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
import { SearchOutputType } from '../../components/Explore/AdvanceSearchProvider/AdvanceSearchProvider.interface';
import { EntityType } from '../../enums/entity.enum';
import { buildQueryBuilderConfig } from './config';
import {
  formatQuery,
  isQueryTreeComplete,
  toElasticSearchQuery,
  toJsonLogicQuery,
} from './formatters';
import { getEmptyQueryBuilderTree } from './tree';

// setupTests.js globally stubs `getQbConfigs` to `{}`. The seed-row cases below
// build a real config so `checkTree` has fields to validate against.
jest.mock('../AdvancedSearchClassBase', () =>
  jest.requireActual('../AdvancedSearchClassBase')
);

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
  const realConfig = () =>
    buildQueryBuilderConfig({
      outputType: SearchOutputType.ElasticSearch,
      entityType: EntityType.TABLE,
    } as never);
  const seedJson = () =>
    getEmptyQueryBuilderTree({
      outputType: SearchOutputType.ElasticSearch,
    }) as unknown as { children1: Record<string, unknown> };

  it('should treat the untouched seed row as complete', () => {
    hasUnfinishedRule.mockReturnValue(true);
    const config = realConfig();
    const seeded = QbUtils.checkTree(
      QbUtils.loadTree(seedJson() as never),
      config
    );

    expect(isQueryTreeComplete(seeded, config)).toBe(true);
  });

  // An unfinished row beside a complete one is dropped harmlessly: the rule
  // still filters by the finished condition, so it is not widened to
  // everything and the save must not be blocked.
  it('should stay complete when a finished row survives the drop', () => {
    hasUnfinishedRule.mockReturnValue(true);
    elasticSearchFormat.mockReturnValue({ bool: { must: [{ term: {} }] } });
    const config = realConfig();
    const seed = seedJson();
    const [firstId, firstRule] = Object.entries(seed.children1)[0];
    seed.children1 = { [firstId]: firstRule, added: firstRule };
    const twoRows = QbUtils.checkTree(QbUtils.loadTree(seed as never), config);

    expect(isQueryTreeComplete(twoRows, config)).toBe(true);
  });

  // A row the user actually added is a second row, so it stays blocked while
  // nothing survives the drop.
  it('should stay incomplete once a second row is added', () => {
    elasticSearchFormat.mockReturnValue(undefined);
    hasUnfinishedRule.mockReturnValue(true);
    const config = realConfig();
    const seed = seedJson();
    const [firstId, firstRule] = Object.entries(seed.children1)[0];
    seed.children1 = { [firstId]: firstRule, added: firstRule };
    const twoRows = QbUtils.checkTree(QbUtils.loadTree(seed as never), config);

    expect(isQueryTreeComplete(twoRows, config)).toBe(false);
  });

  it('should be false while a rule is unfinished', () => {
    hasUnfinishedRule.mockReturnValue(true);

    expect(isQueryTreeComplete(tree, config)).toBe(false);
  });

  it('should be true once every rule is finished', () => {
    hasUnfinishedRule.mockReturnValue(false);

    expect(isQueryTreeComplete(tree, config)).toBe(true);
  });
});
