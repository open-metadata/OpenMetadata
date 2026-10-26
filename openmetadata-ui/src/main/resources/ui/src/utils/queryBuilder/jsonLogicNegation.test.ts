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
import type {
  Config,
  ImmutableTree,
  JsonLogicTree,
} from '@react-awesome-query-builder/antd';
import { Utils as QbUtils } from '@react-awesome-query-builder/antd';
import { SearchIndex } from '../../enums/search.enum';
import jsonLogicSearchClassBase from '../JSONLogicSearchClassBase';
import {
  fromEngineJsonLogic,
  hasExplicitNegation,
  toEngineJsonLogic,
} from './jsonLogicNegation';

const tags = { var: 'tags' };
const tagFqn = { var: 'tagFQN' };
const tagIs = (fqn: string) => ({ some: [tags, { '==': [tagFqn, fqn] }] });
const tagIsNot = (fqn: string) => ({ some: [tags, { '!=': [tagFqn, fqn] }] });
const tagNotIn = (fqns: string[]) => ({
  some: [tags, { '!': { in: [tagFqn, fqns] } }],
});
const tagNotSet = { some: [tags, { '==': [tagFqn, null] }] };
const tagSet = { some: [tags, { '!=': [tagFqn, null] }] };

describe('toEngineJsonLogic', () => {
  it.each([
    ['Is Not', tagIsNot('PII.Sensitive'), { '!': tagIs('PII.Sensitive') }],
    [
      'Not In',
      tagNotIn(['PII.Sensitive']),
      { '!': { some: [tags, { in: [tagFqn, ['PII.Sensitive']] }] } },
    ],
    ['Is Not Set', tagNotSet, { '!': tagSet }],
  ])('negates the whole list for "%s"', (_, rule, expected) => {
    expect(toEngineJsonLogic({ and: [rule] })).toEqual({ and: [expected] });
  });

  it.each([
    ['Is', tagIs('PII.Sensitive')],
    ['Is Set', tagSet],
    ['a scalar field', { '!=': [{ var: 'description' }, 'x'] }],
    ['a multi-rule element match', { some: [tags, { and: [tagIs('A')] }] }],
    [
      'a negation the load side cannot turn back into a row',
      {
        some: [
          { var: 'relatedTerms' },
          { '!': { some: [{ var: 'x' }, { '==': [{ var: 'y' }, 'A'] }] } },
        ],
      },
    ],
  ])('leaves "%s" alone', (_, rule) => {
    expect(toEngineJsonLogic({ or: [rule] })).toEqual({ or: [rule] });
  });

  it('is idempotent, so a rule saved before is not negated twice', () => {
    const once = toEngineJsonLogic({
      and: [tagIsNot('A'), tagNotIn(['B']), tagNotSet],
    });

    expect(toEngineJsonLogic(once)).toEqual(once);
  });

  it('is left unchanged by the data contract rewrite applied on top of it', () => {
    const saved = toEngineJsonLogic({
      and: [tagIsNot('A'), tagNotIn(['B']), tagNotSet],
    }) as Record<string, unknown>;

    expect(
      jsonLogicSearchClassBase.getNegativeQueryForNotContainsReverserOperation(
        saved
      )
    ).toEqual(saved);
  });
});

describe('fromEngineJsonLogic', () => {
  it('turns a negated single-rule group from the API into an "Is Not" row', () => {
    expect(
      fromEngineJsonLogic({ '!': { and: [tagIs('PII.Sensitive')] } })
    ).toEqual(tagIsNot('PII.Sensitive'));
  });

  it('reverses every shape the save side produces', () => {
    const rules = { and: [tagIsNot('A'), tagNotIn(['B']), tagNotSet] };

    expect(fromEngineJsonLogic(toEngineJsonLogic(rules))).toEqual(rules);
  });

  it('keeps a negation it cannot express as a row', () => {
    const multi = { '!': { and: [tagIs('A'), tagIs('B')] } };

    expect(fromEngineJsonLogic(multi)).toEqual(multi);
  });

  it('does not read "no tag is unset" as "Is Set"', () => {
    const noneUnset = { '!': { some: [tags, { '==': [tagFqn, null] }] } };

    expect(fromEngineJsonLogic(noneUnset)).toEqual(noneUnset);
  });
});

// Written through the API under an explicit NOT, which the editor cannot produce: their per-element meaning was meant.
const apiNegations: Array<[string, Record<string, unknown>]> = [
  ['every tag is A', { '!': tagIsNot('A') }],
  ['every tag is in [A]', { '!': tagNotIn(['A']) }],
  ['no tag is unset', { '!': tagNotSet }],
  ['a NOT around a per-element row', { '!': { and: [tagIsNot('A')] } }],
];

describe('rules under an explicit NOT', () => {
  it.each(apiNegations)('saves "%s" as written', (_, rule) => {
    expect(toEngineJsonLogic(rule)).toEqual(rule);
  });

  it.each(apiNegations)('loads "%s" as written', (_, rule) => {
    expect(fromEngineJsonLogic(rule)).toEqual(rule);
  });
});

describe('JSON Logic negation through the builder', () => {
  const config = jsonLogicSearchClassBase.getQbConfigs([
    SearchIndex.GLOSSARY_TERM,
  ]) as Config;

  // The widget's own load and save path: fromEngine before RAQB loads, toEngine after it formats.
  const load = (rule: unknown) =>
    QbUtils.loadFromJsonLogic(
      fromEngineJsonLogic(rule) as JsonLogicTree,
      config
    ) as ImmutableTree;
  const save = (tree: ImmutableTree) =>
    toEngineJsonLogic(QbUtils.jsonLogicFormat(tree, config).logic);

  const operatorsOf = (rule: unknown) => {
    const operators: string[] = [];
    const walk = (node: {
      type?: string;
      properties?: { operator?: string };
      children1?: unknown[];
    }) => {
      if (node.type === 'rule') {
        operators.push(String(node.properties?.operator));
      }
      (node.children1 ?? []).forEach((child) => walk(child as typeof node));
    };
    walk(QbUtils.getTree(load(rule)) as Parameters<typeof walk>[0]);

    return operators;
  };

  it('shows the API rule from the report as "Is Not"', () => {
    expect(operatorsOf({ '!': { and: [tagIs('A')] } })).toEqual([
      'select_not_equals',
    ]);
  });

  it.each([
    ['Is Not', tagIsNot('A'), { '!': tagIs('A') }],
    [
      'Not In',
      tagNotIn(['A', 'B']),
      { '!': { some: [tags, { in: [tagFqn, ['A', 'B']] }] } },
    ],
    ['Is Not Set', tagNotSet, { '!': tagSet }],
  ])('saves "%s" as a negation of the whole list', (_, rule, stored) => {
    const saved = save(load({ and: [rule] }));

    expect(saved).toEqual({ and: [stored] });
    expect(save(load(saved))).toEqual(saved);
  });

  it.each(apiNegations)(
    'saves "%s" back with the meaning it was stored with',
    (_, rule) => {
      const [inner] = Object.values(rule);
      const asGroup = (inner as Record<string, unknown>).and
        ? rule
        : { '!': { and: [inner] } };

      expect(save(load(rule))).toEqual(asGroup);
    }
  );
});

describe('hasExplicitNegation', () => {
  it('is true for a NOT the editor cannot show as a row', () => {
    expect(
      hasExplicitNegation(
        fromEngineJsonLogic({ '!': { and: [tagIs('A'), tagIs('B')] } })
      )
    ).toBe(true);
  });

  it('is false once a negated single rule loads as an "Is Not" row', () => {
    expect(
      hasExplicitNegation(fromEngineJsonLogic({ '!': { and: [tagIs('A')] } }))
    ).toBe(false);
  });

  it('is false for a rule with no NOT', () => {
    expect(hasExplicitNegation({ and: [tagIs('A')] })).toBe(false);
  });
});
