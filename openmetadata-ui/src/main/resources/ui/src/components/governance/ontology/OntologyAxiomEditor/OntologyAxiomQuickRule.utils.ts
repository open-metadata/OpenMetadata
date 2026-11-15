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
  OntologyExpression,
  RestrictionKind,
} from '../../../../generated/api/data/createOntologyAxiom';
import { OntologyAxiomFormState } from './OntologyAxiomEditor.utils';

export enum QuickRuleKind {
  MustHave = 'MUST_HAVE',
  NeverAlsoBe = 'NEVER_ALSO_BE',
  SameAs = 'SAME_AS',
}

export type QuickQuantifier =
  | RestrictionKind.Exact
  | RestrictionKind.Min
  | RestrictionKind.Max;

export interface QuickRule {
  kind: QuickRuleKind;
  subjectIri: string;
  otherIri: string;
  quantifier: QuickQuantifier;
  count: number;
  propertyIri: string;
}

export type QuickRuleConversion =
  | { rule: QuickRule; reason?: undefined }
  | { rule?: undefined; reason: string };

export const QUICK_QUANTIFIERS: QuickQuantifier[] = [
  RestrictionKind.Exact,
  RestrictionKind.Min,
  RestrictionKind.Max,
];

export const QUICK_QUANTIFIER_LABELS: Record<QuickQuantifier, string> = {
  [RestrictionKind.Exact]: 'label.exactly-lowercase',
  [RestrictionKind.Min]: 'label.at-least-lowercase',
  [RestrictionKind.Max]: 'label.at-most-lowercase',
};

export const QUICK_RULE_LABELS: Record<QuickRuleKind, string> = {
  [QuickRuleKind.MustHave]: 'label.must-have-lowercase',
  [QuickRuleKind.NeverAlsoBe]: 'label.can-never-also-be-lowercase',
  [QuickRuleKind.SameAs]: 'label.is-the-same-as-lowercase',
};

export const QUICK_RULE_HELP: Record<QuickRuleKind, string> = {
  [QuickRuleKind.MustHave]: 'message.ontology-rule-quick-must-have-help',
  [QuickRuleKind.NeverAlsoBe]: 'message.ontology-rule-quick-never-also-be-help',
  [QuickRuleKind.SameAs]: 'message.ontology-rule-quick-same-as-help',
};

export const EMPTY_QUICK_RULE: QuickRule = {
  count: 1,
  kind: QuickRuleKind.MustHave,
  otherIri: '',
  propertyIri: '',
  quantifier: RestrictionKind.Exact,
  subjectIri: '',
};

const QUICK_AXIOM_TYPES: Partial<Record<AxiomType, QuickRuleKind>> = {
  [AxiomType.DisjointWith]: QuickRuleKind.NeverAlsoBe,
  [AxiomType.EquivalentClass]: QuickRuleKind.SameAs,
  [AxiomType.SubclassOf]: QuickRuleKind.MustHave,
};

const isQuickQuantifier = (
  kind: RestrictionKind | undefined
): kind is QuickQuantifier =>
  QUICK_QUANTIFIERS.includes(kind as QuickQuantifier);

const lossy = (reason: string): QuickRuleConversion => ({ reason });

const isEmptyValue = (value: unknown) =>
  Array.isArray(value)
    ? value.length === 0
    : value === undefined || value === null || value === '';

// The server returns every expression field, empty ones included (`operands: []`).
const hasOnlyKeys = (expression: OntologyExpression, allowed: string[]) =>
  Object.entries(expression)
    .filter(([, value]) => !isEmptyValue(value))
    .every(([key]) => allowed.includes(key));

export const quickRuleToForm = (
  rule: QuickRule,
  base: OntologyAxiomFormState
): OntologyAxiomFormState => {
  const next = { ...base, subjectIri: rule.subjectIri };
  if (rule.kind === QuickRuleKind.MustHave) {
    return {
      ...next,
      axiomType: AxiomType.SubclassOf,
      expressions: [
        {
          cardinality: Math.max(0, rule.count),
          kind: ExpressionKind.Restriction,
          propertyIri: rule.propertyIri,
          restrictionKind: rule.quantifier,
        },
      ],
    };
  }

  return {
    ...next,
    axiomType:
      rule.kind === QuickRuleKind.SameAs
        ? AxiomType.EquivalentClass
        : AxiomType.DisjointWith,
    expressions: [{ classIri: rule.otherIri, kind: ExpressionKind.NamedClass }],
  };
};

const MUST_HAVE_KEYS = [
  'kind',
  'restrictionKind',
  'propertyIri',
  'cardinality',
];
const NAMED_CLASS_KEYS = ['kind', 'classIri'];

const mustHaveRule = (
  base: QuickRule,
  expression: OntologyExpression
): QuickRuleConversion => {
  const { restrictionKind } = expression;
  if (
    expression.kind !== ExpressionKind.Restriction ||
    !isQuickQuantifier(restrictionKind) ||
    !hasOnlyKeys(expression, MUST_HAVE_KEYS)
  ) {
    return lossy('message.ontology-rule-quick-lossy-condition');
  }

  return {
    rule: {
      ...base,
      count: expression.cardinality ?? 1,
      propertyIri: expression.propertyIri ?? '',
      quantifier: restrictionKind,
    },
  };
};

const namedClassRule = (
  base: QuickRule,
  expression: OntologyExpression
): QuickRuleConversion =>
  expression.kind === ExpressionKind.NamedClass &&
  hasOnlyKeys(expression, NAMED_CLASS_KEYS)
    ? { rule: { ...base, otherIri: expression.classIri ?? '' } }
    : lossy('message.ontology-rule-quick-lossy-condition');

/**
 * Reads an advanced form as a quick rule only when the quick form can write
 * the same axiom back, so a switch never drops a field.
 */
export const formToQuickRule = (
  form: OntologyAxiomFormState
): QuickRuleConversion => {
  const kind = QUICK_AXIOM_TYPES[form.axiomType];
  if (!kind) {
    return lossy('message.ontology-rule-quick-lossy-kind');
  }
  if (form.expressions.length !== 1) {
    return lossy('message.ontology-rule-quick-lossy-conditions');
  }
  const base: QuickRule = {
    ...EMPTY_QUICK_RULE,
    kind,
    subjectIri: form.subjectIri,
  };

  return kind === QuickRuleKind.MustHave
    ? mustHaveRule(base, form.expressions[0])
    : namedClassRule(base, form.expressions[0]);
};

export const quickRuleSentence = (
  rule: QuickRule,
  label: (iri: string) => string,
  t: (key: string) => string
) =>
  [
    label(rule.subjectIri),
    t(QUICK_RULE_LABELS[rule.kind]),
    ...(rule.kind === QuickRuleKind.MustHave
      ? [
          t(QUICK_QUANTIFIER_LABELS[rule.quantifier]),
          String(rule.count),
          label(rule.propertyIri),
        ]
      : [label(rule.otherIri)]),
  ]
    .filter((part) => part.trim() !== '')
    .join(' ');

export const isQuickRuleReady = (rule: QuickRule) =>
  Boolean(
    rule.subjectIri.trim() &&
      (rule.kind === QuickRuleKind.MustHave
        ? rule.propertyIri.trim()
        : rule.otherIri.trim())
  );

/**
 * Why a must-have count cannot be saved, as a message key: a negative count, or an identifier
 * limited to none, which contradicts every instance carrying one.
 */
export const quickRuleCountProblem = (
  rule: QuickRule,
  isIdentifier: boolean
): string | undefined => {
  if (rule.kind !== QuickRuleKind.MustHave) {
    return undefined;
  }
  if (rule.count < 0) {
    return 'message.ontology-rule-count-negative';
  }

  return isIdentifier &&
    rule.count === 0 &&
    rule.quantifier !== RestrictionKind.Min
    ? 'message.ontology-rule-identifier-count-zero'
    : undefined;
};

export const ruleNameFromSentence = (sentence: string, suffix: string) => {
  const slug = sentence
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
    .replace(/-+$/g, '');

  return slug ? `${slug}-${suffix}` : `rule-${suffix}`;
};

export type AxiomField = 'subject' | 'property' | 'other' | 'count';

export interface AxiomProblem {
  path?: string;
  message: string;
}

export interface RoutedAxiomProblems {
  byField: Partial<Record<AxiomField, string>>;
  general: AxiomProblem[];
}

const fieldForPath = (
  path: string,
  isQuick: boolean
): AxiomField | undefined => {
  if (path.includes('subjectIri')) {
    return 'subject';
  }
  if (path.includes('propertyIri')) {
    return 'property';
  }
  if (path.includes('cardinality')) {
    return isQuick ? 'count' : undefined;
  }
  if (path.includes('classIri') || path.includes('targetIri')) {
    return 'other';
  }

  return undefined;
};

/**
 * Puts each server problem next to the field it names, so the reason shows
 * where the person is typing. Problems that name no field stay general.
 */
export const routeAxiomProblems = (
  problems: AxiomProblem[],
  isQuick: boolean
): RoutedAxiomProblems => {
  const routed: RoutedAxiomProblems = { byField: {}, general: [] };
  problems.forEach((problem) => {
    const field = fieldForPath(problem.path ?? problem.message, isQuick);
    if (field && !routed.byField[field]) {
      routed.byField[field] = problem.message;
    } else {
      routed.general.push(problem);
    }
  });

  return routed;
};
