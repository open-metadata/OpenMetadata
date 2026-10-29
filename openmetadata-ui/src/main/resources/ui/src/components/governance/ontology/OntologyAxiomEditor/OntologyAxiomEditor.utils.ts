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
  const hasLiteral = Boolean(form.literalValue.trim());
  const result = hasLiteral
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

export const buildOntologyAxiomRequest = (
  ontologyFqn: string,
  form: OntologyAxiomFormState
): CreateOntologyAxiom => {
  const request: CreateOntologyAxiom = {
    axiomType: form.axiomType,
    description: form.description.trim(),
    displayName: form.displayName.trim(),
    expressions: form.expressions.length ? form.expressions : undefined,
    ontology: ontologyFqn,
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
