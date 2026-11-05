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
  CreateOntologyAxiom,
  ExpressionKind,
  OntologyExpression,
  Provenance,
} from '../../../../generated/api/data/createOntologyAxiom';

export interface OntologyAxiomFormState {
  axiomType: AxiomType;
  description: string;
  displayName: string;
  expressions: OntologyExpression[];
  literalDatatypeIri: string;
  literalValue: string;
  name: string;
  propertyIri: string;
  subjectIri: string;
  targetIri: string;
}

function optional(value: string) {
  const trimmed = value.trim();
  const result = trimmed || undefined;

  return result;
}

function literal(form: OntologyAxiomFormState) {
  const result =
    form.axiomType === AxiomType.DataPropertyAssertion
      ? {
          datatypeIri: optional(form.literalDatatypeIri),
          value: form.literalValue,
        }
      : undefined;

  return result;
}

export const EMPTY_AXIOM_FORM: OntologyAxiomFormState = {
  axiomType: AxiomType.SubclassOf,
  description: '',
  displayName: '',
  expressions: [],
  literalDatatypeIri: '',
  literalValue: '',
  name: '',
  propertyIri: '',
  subjectIri: '',
  targetIri: '',
};

export const isClassExpressionAxiom = (axiomType: AxiomType) =>
  [
    AxiomType.ClassAssertion,
    AxiomType.DisjointWith,
    AxiomType.EquivalentClass,
    AxiomType.SubclassOf,
  ].includes(axiomType);

export const AXIOM_LABELS: Record<AxiomType, string> = {
  [AxiomType.ClassAssertion]: 'label.ontology-class-membership',
  [AxiomType.DataPropertyAssertion]: 'label.ontology-data-property-fact',
  [AxiomType.DisjointWith]: 'label.disjoint-with',
  [AxiomType.EquivalentClass]: 'label.equivalent-to',
  [AxiomType.ObjectPropertyAssertion]: 'label.ontology-object-property-fact',
  [AxiomType.SubclassOf]: 'label.subclass-of',
};

function formatRestriction(
  expression: OntologyExpression,
  label: (iri: string) => string,
  t: (key: string) => string,
  formatFiller: (expression: OntologyExpression) => string
): string {
  const operator = {
    SOME: t('label.ontology-some-values'),
    ONLY: t('label.ontology-only-values'),
    VALUE: '=',
    MIN: '≥',
    MAX: '≤',
    EXACT: '=',
  };

  const datatype = expression.literal?.datatypeIri;
  const literalText = expression.literal
    ? JSON.stringify(expression.literal.value)
    : undefined;

  return [
    label(expression.propertyIri ?? ''),
    expression.restrictionKind ? operator[expression.restrictionKind] : '',
    expression.cardinality,
    expression.filler ? formatFiller(expression.filler) : undefined,
    expression.individualIri ? label(expression.individualIri) : undefined,
    datatype ? `${literalText} (${label(datatype)})` : literalText,
  ]
    .filter((part) => part !== undefined && part !== '')
    .join(' ');
}

export function formatOntologyExpression(
  expression: OntologyExpression,
  label: (iri: string) => string,
  t: (key: string) => string
): string {
  switch (expression.kind) {
    case ExpressionKind.NamedClass:
      return label(expression.classIri ?? '');
    case ExpressionKind.Intersection:
    case ExpressionKind.Union:
      return (
        '(' +
        (expression.operands ?? [])
          .map((operand) => formatOntologyExpression(operand, label, t))
          .join(
            ` ${t(
              expression.kind === ExpressionKind.Intersection
                ? 'label.and-lowercase'
                : 'label.or-lowercase'
            )} `
          ) +
        ')'
      );
    case ExpressionKind.OneOf:
      return (
        '{' + (expression.individualIris ?? []).map(label).join(', ') + '}'
      );
    case ExpressionKind.Restriction:
      return formatRestriction(expression, label, t, (filler) =>
        formatOntologyExpression(filler, label, t)
      );
  }
}

export const buildOntologyAxiomRequest = (
  ontologyFqn: string,
  form: OntologyAxiomFormState
): CreateOntologyAxiom => {
  const request: CreateOntologyAxiom = {
    axiomType: form.axiomType,
    description: form.description.trim(),
    displayName: form.displayName.trim(),
    expressions:
      isClassExpressionAxiom(form.axiomType) && form.expressions.length
        ? form.expressions
        : undefined,
    ontology: ontologyFqn,
    literal: literal(form),
    name: form.name.trim(),
    propertyIri: isClassExpressionAxiom(form.axiomType)
      ? undefined
      : optional(form.propertyIri),
    provenance: Provenance.Manual,
    subjectIri: form.subjectIri.trim(),
    targetIri:
      form.axiomType === AxiomType.ObjectPropertyAssertion
        ? optional(form.targetIri)
        : undefined,
  };

  return request;
};

export const isOntologyAxiomReady = (form: OntologyAxiomFormState) =>
  Boolean(
    form.name.trim() &&
      form.displayName.trim() &&
      form.description.trim() &&
      form.subjectIri.trim()
  );
