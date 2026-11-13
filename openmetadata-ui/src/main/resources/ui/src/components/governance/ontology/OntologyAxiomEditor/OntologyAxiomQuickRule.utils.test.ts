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

import {
  AxiomType,
  ExpressionKind,
  RestrictionKind,
} from '../../../../generated/api/data/createOntologyAxiom';
import { EMPTY_AXIOM_FORM } from './OntologyAxiomEditor.utils';
import {
  EMPTY_QUICK_RULE,
  formToQuickRule,
  QuickRule,
  QuickRuleKind,
  quickRuleToForm,
  routeAxiomProblems,
  ruleNameFromSentence,
} from './OntologyAxiomQuickRule.utils';

const mustHave: QuickRule = {
  ...EMPTY_QUICK_RULE,
  count: 2,
  propertyIri: 'urn:p',
  quantifier: RestrictionKind.Min,
  subjectIri: 'urn:S',
};

describe('quick rule conversion', () => {
  it.each([
    [mustHave, AxiomType.SubclassOf],
    [
      {
        ...EMPTY_QUICK_RULE,
        kind: QuickRuleKind.NeverAlsoBe,
        otherIri: 'urn:O',
        subjectIri: 'urn:S',
      },
      AxiomType.DisjointWith,
    ],
    [
      {
        ...EMPTY_QUICK_RULE,
        kind: QuickRuleKind.SameAs,
        otherIri: 'urn:O',
        subjectIri: 'urn:S',
      },
      AxiomType.EquivalentClass,
    ],
  ])('round-trips %j through the advanced form as %s', (rule, axiomType) => {
    const form = quickRuleToForm(rule, EMPTY_AXIOM_FORM);

    expect(form.axiomType).toBe(axiomType);
    expect(formToQuickRule(form)).toEqual({
      rule: {
        ...EMPTY_QUICK_RULE,
        ...rule,
        count: rule.kind === QuickRuleKind.MustHave ? rule.count : 1,
      },
    });
  });

  it('writes the cardinality restriction with no filler', () => {
    expect(quickRuleToForm(mustHave, EMPTY_AXIOM_FORM).expressions).toEqual([
      {
        cardinality: 2,
        kind: ExpressionKind.Restriction,
        propertyIri: 'urn:p',
        restrictionKind: RestrictionKind.Min,
      },
    ]);
  });

  it.each([
    [{ axiomType: AxiomType.ClassAssertion }, 'kind'],
    [{ axiomType: AxiomType.SubclassOf, expressions: [] }, 'conditions'],
    [
      {
        axiomType: AxiomType.SubclassOf,
        expressions: [{ classIri: 'urn:P', kind: ExpressionKind.NamedClass }],
      },
      'condition',
    ],
    [
      {
        axiomType: AxiomType.SubclassOf,
        expressions: [
          {
            filler: { classIri: 'urn:P', kind: ExpressionKind.NamedClass },
            kind: ExpressionKind.Restriction,
            propertyIri: 'urn:p',
            restrictionKind: RestrictionKind.Some,
          },
        ],
      },
      'condition',
    ],
    [
      {
        axiomType: AxiomType.SubclassOf,
        expressions: [
          {
            cardinality: 1,
            filler: { classIri: 'urn:P', kind: ExpressionKind.NamedClass },
            kind: ExpressionKind.Restriction,
            propertyIri: 'urn:p',
            restrictionKind: RestrictionKind.Exact,
          },
        ],
      },
      'condition',
    ],
    [
      {
        axiomType: AxiomType.DisjointWith,
        expressions: [
          { classIri: 'urn:P', kind: ExpressionKind.NamedClass },
          { classIri: 'urn:Q', kind: ExpressionKind.NamedClass },
        ],
      },
      'conditions',
    ],
  ])('refuses %j because converting would lose data (%s)', (patch, reason) => {
    const conversion = formToQuickRule({ ...EMPTY_AXIOM_FORM, ...patch });

    expect(conversion).toEqual({
      reason: `message.ontology-rule-quick-lossy-${reason}`,
    });
  });
});

describe('a rule as the server returns it', () => {
  it('reads empty operand and individual lists as absent', () => {
    const conversion = formToQuickRule({
      ...EMPTY_AXIOM_FORM,
      axiomType: AxiomType.SubclassOf,
      expressions: [
        {
          cardinality: 2,
          individualIris: [],
          kind: ExpressionKind.Restriction,
          operands: [],
          propertyIri: 'urn:p',
          restrictionKind: RestrictionKind.Min,
        },
      ],
      subjectIri: 'urn:S',
    });

    expect(conversion).toEqual({ rule: mustHave });
  });
});

describe('default rule name', () => {
  it('slugs the sentence and appends the unique suffix', () => {
    expect(
      ruleNameFromSentence('Patient must have exactly 1 dateOfBirth', 'abc123')
    ).toBe('patient-must-have-exactly-1-dateofbirth-abc123');
  });

  it('falls back to a plain name for an empty sentence', () => {
    expect(ruleNameFromSentence('', 'abc123')).toBe('rule-abc123');
  });
});

describe('routing server problems to fields', () => {
  it('puts each problem next to the field its path names and keeps the rest general', () => {
    const routed = routeAxiomProblems(
      [
        { message: 'bad subject', path: '/subjectIri' },
        { message: 'bad property', path: '/expressions/0/propertyIri' },
        { message: 'bad count', path: '/expressions/0/cardinality' },
        { message: 'shape', path: '/axiomType' },
        { message: 'second subject problem', path: '/subjectIri' },
      ],
      true
    );

    expect(routed.byField).toEqual({
      count: 'bad count',
      property: 'bad property',
      subject: 'bad subject',
    });
    expect(routed.general.map((problem) => problem.message)).toEqual([
      'shape',
      'second subject problem',
    ]);
  });

  it('reads a bare 400 message by the field it names', () => {
    expect(
      routeAxiomProblems(
        [{ message: 'subjectIri must be an absolute IRI' }],
        true
      ).byField.subject
    ).toBe('subjectIri must be an absolute IRI');
  });
});
