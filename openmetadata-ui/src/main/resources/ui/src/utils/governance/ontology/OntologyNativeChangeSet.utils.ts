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
import { v5 as uuid } from 'uuid';
import {
  AxiomType,
  CreateOntologyChangeSet,
  EntityReference,
  ExpressionKind,
  Kind,
  OntologyChangeOperation,
  OntologyConceptType,
  OperationState,
  OperationType,
  Provenance,
} from '../../../generated/api/data/createOntologyChangeSet';
import { Ontology } from '../../../generated/entity/data/ontology';
import { StudioDatatype } from './OntologyStudioModel.utils';

export type OwnPropertyDraft = { name: string; isIdentifier: boolean } & (
  | { kind: 'data'; datatype: Exclude<StudioDatatype, 'enum'> }
  | { kind: 'enum'; values: string[] }
  | { kind: 'object'; rangeIri: string }
);
export interface NewClassDraft {
  label: string;
  localName: string;
  synonyms: string[];
  description: string;
  definitionSource: string;
  parentIris: string[];
  equivalentIris: string[];
  disjointIris: string[];
  abstract: boolean;
  owners: EntityReference[];
  ownProperties: OwnPropertyDraft[];
}
export const buildNewClassChangeSet = (
  ontology: Ontology,
  draft: NewClassDraft,
  attemptName: string,
  workingRevision: number
): CreateOntologyChangeSet => {
  const iri = ontology.namespace + draft.localName.trim();
  const owner = {
    id: ontology.id,
    type: 'ontology',
    fullyQualifiedName: ontology.fullyQualifiedName,
  };
  const id = (key: string) => uuid(attemptName + ':' + key, uuid.URL);
  const localName = draft.localName.trim();
  const operations: OntologyChangeOperation[] = [
    {
      id: id('concept-operation'),
      operationType: OperationType.UpsertConcept,
      state: OperationState.Active,
      concept: {
        id: id('concept'),
        name: localName,
        fullyQualifiedName: ontology.fullyQualifiedName + '.' + localName,
        iri,
        ontology: owner,
        conceptType: OntologyConceptType.OwlClass,
        displayName: draft.label.trim(),
        synonyms: [...new Set(draft.synonyms)],
        description: draft.description.trim() || undefined,
        definitionSource: draft.definitionSource.trim() || undefined,
        abstract: draft.abstract,
        owners: draft.owners,
      },
    },
  ];
  draft.ownProperties.forEach((property, index) => {
    const name = property.name.trim();
    operations.push({
      id: id('property-operation-' + index),
      operationType: OperationType.UpsertProperty,
      state: OperationState.Active,
      property: {
        id: id('property-' + index),
        name,
        fullyQualifiedName: ontology.fullyQualifiedName + '.' + name,
        iri: ontology.namespace + name,
        ontology: owner,
        displayName: name,
        kind: property.kind === 'object' ? Kind.Object : Kind.Data,
        domain: [iri],
        range:
          property.kind === 'object'
            ? [property.rangeIri]
            : [
                'http://www.w3.org/2001/XMLSchema#' +
                  (property.kind === 'enum' ? 'string' : property.datatype),
              ],
        isIdentifier: property.isIdentifier,
        ...(property.kind === 'enum'
          ? {
              enumValues: property.values.map((value) => ({
                value,
                datatypeIri: 'http://www.w3.org/2001/XMLSchema#string',
              })),
            }
          : {}),
      },
    });
  });
  const axioms: [AxiomType, string[]][] = [
    [AxiomType.SubclassOf, draft.parentIris],
    [AxiomType.EquivalentClass, draft.equivalentIris],
    [AxiomType.DisjointWith, draft.disjointIris],
  ];
  axioms.forEach(([axiomType, targets]) =>
    [...new Set(targets)].forEach((targetIri) => {
      const key = axiomType + ':' + targetIri;
      const name = id(key);
      operations.push({
        id: id('operation-' + key),
        operationType: OperationType.UpsertAxiom,
        state: OperationState.Active,
        axiom: {
          id: name,
          name,
          fullyQualifiedName: ontology.fullyQualifiedName + '.' + name,
          displayName: draft.label.trim(),
          description: '',
          ontology: owner,
          axiomType,
          subjectIri: iri,
          targetIri,
          expressions: [
            { kind: ExpressionKind.NamedClass, classIri: iri },
            { kind: ExpressionKind.NamedClass, classIri: targetIri },
          ],
          provenance: Provenance.Manual,
        },
      });
    })
  );

  return {
    name: attemptName,
    displayName: draft.label.trim(),
    description: draft.description.trim(),
    ontology: ontology.fullyQualifiedName,
    baseWorkingRevision: workingRevision,
    owners: draft.owners,
    operations,
    undoCursor: operations.length,
  };
};
