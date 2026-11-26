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
import { OldJsonTree, Utils as QbUtils } from '@react-awesome-query-builder/ui';
import { SearchOutputType } from '../../components/Explore/AdvanceSearchProvider/AdvanceSearchProvider.interface';
import { EntityReferenceFields } from '../../enums/AdvancedSearch.enum';
import { SearchIndex } from '../../enums/search.enum';
import { getEntityLifecycleStages } from '../../rest/metadataTypeAPI';
import { JSONLogicSearchClassBase } from '../JSONLogicSearchClassBase';
import { generateUUID } from '../StringUtils';
import { formatQuery } from './formatters';
import { rewriteTierVarToTags, routeTagsGroupToTier } from './jsonLogicTierVar';
import { loadQueryBuilderTree } from './tree';

jest.mock('../../rest/metadataTypeAPI', () => ({
  getEntityLifecycleStages: jest.fn(),
}));

const tags = { var: 'tags' };
const tier = { var: 'tier' };
const tagFqn = { var: 'tagFQN' };

describe('rewriteTierVarToTags', () => {
  it('rewrites the Tier group variable to tags', () => {
    const logic = { some: [tier, { contains: [tagFqn, ['Tier.Tier1']] }] };

    expect(rewriteTierVarToTags(logic)).toEqual({
      some: [tags, { contains: [tagFqn, ['Tier.Tier1']] }],
    });
  });

  it('rewrites the variable inside the exported negation of a not-contains rule', () => {
    const logic = {
      '!': { some: [tier, { contains: [tagFqn, ['Tier.Tier1']] }] },
    };

    expect(rewriteTierVarToTags(logic)).toEqual({
      '!': { some: [tags, { contains: [tagFqn, ['Tier.Tier1']] }] },
    });
  });

  it('rewrites the variable across and/or branches', () => {
    const logic = {
      and: [
        { some: [tier, { contains: [tagFqn, ['Tier.Tier1']] }] },
        { '==': [{ var: 'name' }, 'foo'] },
      ],
    };

    expect(rewriteTierVarToTags(logic)).toEqual({
      and: [
        { some: [tags, { contains: [tagFqn, ['Tier.Tier1']] }] },
        { '==': [{ var: 'name' }, 'foo'] },
      ],
    });
  });

  it('leaves the tagFQN subfield, owners and column tags untouched', () => {
    const logic = {
      some: [
        { var: 'owners' },
        {
          '==': [{ var: 'fullyQualifiedName' }, 'admin'],
        },
      ],
    };

    expect(rewriteTierVarToTags(logic)).toEqual(logic);

    expect(
      rewriteTierVarToTags({
        some: [{ var: 'columns.tags' }, { '==': [tagFqn, 'X'] }],
      })
    ).toEqual({ some: [{ var: 'columns.tags' }, { '==': [tagFqn, 'X'] }] });
  });
});

describe('routeTagsGroupToTier', () => {
  it('routes a tags-grouped contains rule back to the tier variable', () => {
    const logic = { some: [tags, { contains: [tagFqn, ['Tier.Tier1']] }] };

    expect(routeTagsGroupToTier(logic)).toEqual({
      some: [tier, { contains: [tagFqn, ['Tier.Tier1']] }],
    });
  });

  it('routes a tags-grouped not-contains rule (the RAQB load shape) back to tier', () => {
    const logic = {
      some: [tags, { '!': { contains: [tagFqn, ['Tier.Tier1']] } }],
    };

    expect(routeTagsGroupToTier(logic)).toEqual({
      some: [tier, { '!': { contains: [tagFqn, ['Tier.Tier1']] } }],
    });
  });

  it('leaves a Tags select_equals rule on tags so it loads into the Tags field', () => {
    const logic = { some: [tags, { '==': [tagFqn, 'SomeTag'] }] };

    expect(routeTagsGroupToTier(logic)).toEqual(logic);
  });

  it('leaves a Tags select_not_any_in rule (negated in, not contains) on tags', () => {
    const logic = { some: [tags, { '!': { in: [tagFqn, ['A', 'B']] } }] };

    expect(routeTagsGroupToTier(logic)).toEqual(logic);
  });

  it('leaves a Tags "Is Set/Is Not Set" rule on tags', () => {
    const isSet = { some: [tags, { '!=': [tagFqn, null] }] };
    const isNotSet = { some: [tags, { '==': [tagFqn, null] }] };

    expect(routeTagsGroupToTier(isSet)).toEqual(isSet);
    expect(routeTagsGroupToTier(isNotSet)).toEqual(isNotSet);
  });

  it('routes inside and/or branches and leaves sibling Tags rules alone', () => {
    const logic = {
      and: [
        { some: [tags, { contains: [tagFqn, ['Tier.Tier1']] }] },
        { some: [tags, { '==': [tagFqn, 'SomeTag'] }] },
      ],
    };

    expect(routeTagsGroupToTier(logic)).toEqual({
      and: [
        { some: [tier, { contains: [tagFqn, ['Tier.Tier1']] }] },
        { some: [tags, { '==': [tagFqn, 'SomeTag'] }] },
      ],
    });
  });

  it('does not touch other some groups (owners, domains)', () => {
    const logic = {
      some: [
        { var: 'owners' },
        { '==': [{ var: 'fullyQualifiedName' }, 'admin'] },
      ],
    };

    expect(routeTagsGroupToTier(logic)).toEqual(logic);
  });
});

// `groupField` is the rule_group field key; the rule inside targets `<key>.tagFQN`.
const buildGroupedRuleTree = (
  groupField: string,
  operator: string,
  tierFQN: string
): OldJsonTree => {
  const group = generateUUID();
  const rule = generateUUID();

  return {
    id: generateUUID(),
    type: 'group',
    properties: { conjunction: 'AND', not: false },
    children1: {
      [group]: {
        type: 'rule_group',
        id: group,
        properties: {
          conjunction: 'AND',
          not: false,
          mode: 'some',
          field: groupField,
          fieldSrc: 'field',
        },
        children1: {
          [rule]: {
            type: 'rule',
            id: rule,
            properties: {
              field: `${groupField}.tagFQN`,
              operator,
              value: [[tierFQN]],
              valueSrc: ['value'],
              valueType: ['multiselect'],
              fieldSrc: 'field',
            },
          },
        },
      },
    },
  };
};

const fieldsAndOpsOf = (loaded: Parameters<typeof QbUtils.getTree>[0]) => {
  const tree = QbUtils.getTree(loaded) as {
    children1?: Array<{
      properties: { field?: string; not?: boolean };
      children1?: Array<{
        properties: {
          field?: string;
          operator?: string;
          not?: boolean;
        };
      }>;
    }>;
  };
  const groupNode = tree.children1?.[0];
  const group = groupNode?.properties?.field;
  const ruleProps = groupNode?.children1?.[0]?.properties;

  return {
    group,
    // `not` lives on the rule_group for a negated some (not-contains), not the rule.
    groupNot: groupNode?.properties?.not,
    operator: ruleProps?.operator,
    not: ruleProps?.not,
    field: ruleProps?.field,
  };
};

describe('Tier rule through the workflow builder pipeline', () => {
  let config: ReturnType<JSONLogicSearchClassBase['getQbConfigs']>;

  beforeEach(() => {
    (getEntityLifecycleStages as jest.Mock).mockResolvedValue({
      stages: [],
      entityTypes: [],
    });
    config = new JSONLogicSearchClassBase().getQbConfigs([SearchIndex.TABLE]);
  });

  const saveTier = (operator: string, tierFQN = 'Tier.Tier1') => {
    const tree = QbUtils.checkTree(
      QbUtils.loadTree(
        buildGroupedRuleTree(EntityReferenceFields.TIER, operator, tierFQN)
      ),
      config
    );

    return formatQuery(tree as never, config, SearchOutputType.JSONLogic).value;
  };

  it('saves a Tier "contains Tier1" rule against the tags list, with no tier variable', () => {
    const saved = saveTier('array_contains');

    expect(saved).toBe(
      JSON.stringify({
        and: [
          {
            some: [tags, { contains: [tagFqn, ['Tier.Tier1']] }],
          },
        ],
      })
    );
    expect(saved).not.toContain('"var":"tier"');
  });

  it('saves a Tier "does not contain Tier1" rule against the tags list', () => {
    const saved = saveTier('array_not_contains');

    expect(saved).toBe(
      JSON.stringify({
        and: [
          {
            '!': { some: [tags, { contains: [tagFqn, ['Tier.Tier1']] }] },
          },
        ],
      })
    );
    expect(saved).not.toContain('"var":"tier"');
  });

  it('round-trips a saved Tier contains rule back into the Tier field', () => {
    const saved = saveTier('array_contains');
    const loaded = loadQueryBuilderTree({
      config,
      value: saved,
      outputType: SearchOutputType.JSONLogic,
    });

    expect(fieldsAndOpsOf(loaded)).toMatchObject({
      group: EntityReferenceFields.TIER,
      operator: 'array_contains',
      field: `${EntityReferenceFields.TIER}.tagFQN`,
    });
    expect(fieldsAndOpsOf(loaded).not).toBeFalsy();
    expect(fieldsAndOpsOf(loaded).groupNot).toBeFalsy();

    // Loading then re-saving is stable, so a stored rule never drifts.
    expect(
      formatQuery(loaded as never, config, SearchOutputType.JSONLogic).value
    ).toBe(saved);
  });

  it('round-trips a saved Tier not-contains rule back into the Tier field', () => {
    const saved = saveTier('array_not_contains');
    const loaded = loadQueryBuilderTree({
      config,
      value: saved,
      outputType: SearchOutputType.JSONLogic,
    });

    // RAQB loads the negated condition as a `not`-flagged rule_group around a
    // positive `array_contains` rule; it must land in the Tier field and re-save
    // to the exact stored wire form.
    expect(fieldsAndOpsOf(loaded)).toMatchObject({
      group: EntityReferenceFields.TIER,
      groupNot: true,
      operator: 'array_contains',
      field: `${EntityReferenceFields.TIER}.tagFQN`,
    });
    expect(
      formatQuery(loaded as never, config, SearchOutputType.JSONLogic).value
    ).toBe(saved);
  });

  // A saved Tags rule is also `{"var":"tags"}`; routing it by the variable alone
  // (as a `fieldName` remap would) would load it into the Tier field and drop the
  // Tags `select_equals` operator, since the Tier multiselect does not offer it.
  // The operator-based routing keeps Tags rules on the Tags field.
  it('loads a saved Tags select_equals rule into the Tags field, not Tier', () => {
    const saved = JSON.stringify({
      and: [{ some: [tags, { '==': [tagFqn, 'SomeTag'] }] }],
    });
    const loaded = loadQueryBuilderTree({
      config,
      value: saved,
      outputType: SearchOutputType.JSONLogic,
    });

    expect(fieldsAndOpsOf(loaded)).toMatchObject({
      group: EntityReferenceFields.TAG,
      operator: 'select_equals',
      field: `${EntityReferenceFields.TAG}.tagFQN`,
    });
    expect(fieldsAndOpsOf(loaded).not).toBeFalsy();
    expect(fieldsAndOpsOf(loaded).groupNot).toBeFalsy();
    expect(
      formatQuery(loaded as never, config, SearchOutputType.JSONLogic).value
    ).toBe(saved);
  });
});
