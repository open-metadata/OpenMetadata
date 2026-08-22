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
  EntityStatus,
  OntologyExpression,
  Provenance,
} from '../../generated/api/data/createOntologyAxiom';
import {
  InstantiateOntologyPattern,
  MeasuredKpi,
  PatternType,
  ProductHierarchy,
  RegulatoryControl,
  TermInput,
} from '../../generated/api/data/instantiateOntologyPattern';

export enum PatternTermKey {
  Control = 'control',
  Dimension = 'dimension',
  Evidence = 'evidence',
  Feature = 'feature',
  Kpi = 'kpi',
  Metric = 'metric',
  Portfolio = 'portfolio',
  Product = 'product',
  Requirement = 'requirement',
}

export interface PatternTermForm {
  description: string;
  displayName: string;
  name: string;
}

export interface OntologyPatternFormState {
  changeSetDescription: string;
  changeSetDisplayName: string;
  changeSetName: string;
  control: PatternTermForm;
  dimension: PatternTermForm;
  evidence: PatternTermForm;
  feature: PatternTermForm;
  kpi: PatternTermForm;
  metric: PatternTermForm;
  patternType: PatternType;
  portfolio: PatternTermForm;
  product: PatternTermForm;
  requirement: PatternTermForm;
}

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

export const createEmptyPatternForm = (): OntologyPatternFormState => ({
  changeSetDescription: '',
  changeSetDisplayName: '',
  changeSetName: '',
  control: emptyTerm(),
  dimension: emptyTerm(),
  evidence: emptyTerm(),
  feature: emptyTerm(),
  kpi: emptyTerm(),
  metric: emptyTerm(),
  patternType: PatternType.RegulatoryControl,
  portfolio: emptyTerm(),
  product: emptyTerm(),
  requirement: emptyTerm(),
});

export const EMPTY_PATTERN_FORM = createEmptyPatternForm();

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

export const isPatternTermKey = (key: string): key is PatternTermKey =>
  Object.values(PatternTermKey).some((candidate) => candidate === key);

export const patternTermPaths: Record<
  PatternTermKey,
  Record<keyof PatternTermForm, string>
> = {
  [PatternTermKey.Control]: termPaths(PatternTermKey.Control),
  [PatternTermKey.Dimension]: termPaths(PatternTermKey.Dimension),
  [PatternTermKey.Evidence]: termPaths(PatternTermKey.Evidence),
  [PatternTermKey.Feature]: termPaths(PatternTermKey.Feature),
  [PatternTermKey.Kpi]: termPaths(PatternTermKey.Kpi),
  [PatternTermKey.Metric]: termPaths(PatternTermKey.Metric),
  [PatternTermKey.Portfolio]: termPaths(PatternTermKey.Portfolio),
  [PatternTermKey.Product]: termPaths(PatternTermKey.Product),
  [PatternTermKey.Requirement]: termPaths(PatternTermKey.Requirement),
};

export const buildOntologyPatternRequest = (
  glossaryId: string,
  form: OntologyPatternFormState
): InstantiateOntologyPattern => {
  const base = {
    changeSetDescription: form.changeSetDescription.trim(),
    changeSetDisplayName: optional(form.changeSetDisplayName),
    changeSetName: form.changeSetName.trim(),
    glossaryId,
    patternType: form.patternType,
  };
  let request: InstantiateOntologyPattern;

  switch (form.patternType) {
    case PatternType.MeasuredKpi:
      request = { ...base, measuredKpi: measuredKpi(form) };

      break;
    case PatternType.ProductHierarchy:
      request = { ...base, productHierarchy: productHierarchy(form) };

      break;
    case PatternType.RegulatoryControl:
      request = { ...base, regulatoryControl: regulatoryControl(form) };

      break;
  }

  return request;
};

export const buildOntologyAxiomRequest = (
  glossaryFqn: string,
  form: OntologyAxiomFormState
): CreateOntologyAxiom => {
  const request: CreateOntologyAxiom = {
    axiomType: form.axiomType,
    description: form.description.trim(),
    displayName: form.displayName.trim(),
    entityStatus: EntityStatus.Draft,
    expressions: form.expressions.length ? form.expressions : undefined,
    glossary: glossaryFqn,
    literal: literal(form),
    name: form.name.trim(),
    propertyIri: optional(form.propertyIri),
    provenance: Provenance.Manual,
    subjectIri: form.subjectIri.trim(),
    targetIri: optional(form.targetIri),
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

export const isOntologyPatternReady = (
  form: OntologyPatternFormState,
  termKeys: PatternTermKey[]
) => {
  const hasMetadata = Boolean(
    form.changeSetName.trim() && form.changeSetDescription.trim()
  );
  const hasTerms = termKeys.every((key) => {
    const term = form[key];

    return Boolean(term.name.trim() && term.description.trim());
  });

  return hasMetadata && hasTerms;
};

function termPaths(key: PatternTermKey) {
  return {
    description: `${key}.description`,
    displayName: `${key}.displayName`,
    name: `${key}.name`,
  };
}

function emptyTerm(): PatternTermForm {
  return { description: '', displayName: '', name: '' };
}

function measuredKpi(form: OntologyPatternFormState): MeasuredKpi {
  return {
    dimension: termInput(form.dimension),
    kpi: termInput(form.kpi),
    metric: termInput(form.metric),
  };
}

function productHierarchy(form: OntologyPatternFormState): ProductHierarchy {
  return {
    feature: termInput(form.feature),
    portfolio: termInput(form.portfolio),
    product: termInput(form.product),
  };
}

function regulatoryControl(form: OntologyPatternFormState): RegulatoryControl {
  return {
    control: termInput(form.control),
    evidence: termInput(form.evidence),
    requirement: termInput(form.requirement),
  };
}

function termInput(form: PatternTermForm): TermInput {
  return {
    description: form.description.trim(),
    displayName: optional(form.displayName),
    name: form.name.trim(),
  };
}

function literal(form: OntologyAxiomFormState) {
  const hasLiteral = Boolean(form.literalValue.trim());
  const result = hasLiteral
    ? {
        datatypeIri: optional(form.literalDatatypeIri),
        value: form.literalValue,
      }
    : undefined;

  return result;
}

function optional(value: string) {
  const trimmed = value.trim();
  const result = trimmed || undefined;

  return result;
}
