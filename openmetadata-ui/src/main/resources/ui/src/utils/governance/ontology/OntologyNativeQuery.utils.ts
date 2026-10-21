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
import { RestrictionKind } from '../../../generated/entity/data/ontologyAxiom';
import { OntologyConcept } from '../../../generated/entity/data/ontologyConcept';
import {
  getModelRelationLabel,
  OntologyModelRelation,
} from './OntologyStudioModel.utils';

const iri = (value: string) => {
  if (/[<>"{}|^`\\\s]/u.test(value)) {
    throw new Error('Invalid semantic IRI');
  }

  return `<${value}>`;
};

export const getNativeQueryRelations = (relations: OntologyModelRelation[]) => {
  const seen = new Set<string>();

  return relations.flatMap((relation) => {
    const id = [
      relation.kind,
      relation.propertyIri,
      relation.restriction?.kind,
      relation.restriction?.cardinality,
    ].join(':');
    if (seen.has(id)) {
      return [];
    }
    seen.add(id);

    return [{ id, label: getModelRelationLabel(relation), relation }];
  });
};

const buildRestrictionPattern = (
  relation: OntologyModelRelation,
  property?: string
) => {
  const restriction = relation.restriction;
  if (!restriction || !property) {
    throw new Error('Missing restriction');
  }
  const predicate = {
    [RestrictionKind.Some]: 'owl:someValuesFrom',
    [RestrictionKind.Only]: 'owl:allValuesFrom',
    [RestrictionKind.Value]: 'owl:hasValue',
    [RestrictionKind.Min]: 'owl:minQualifiedCardinality',
    [RestrictionKind.Max]: 'owl:maxQualifiedCardinality',
    [RestrictionKind.Exact]: 'owl:qualifiedCardinality',
  }[restriction.kind];
  const cardinality = restriction.cardinality;
  const value =
    cardinality === undefined
      ? '?target'
      : `"${cardinality}"^^xsd:nonNegativeInteger ; owl:onClass ?target`;

  return `?concept rdfs:subClassOf [ a owl:Restriction ; owl:onProperty ${property} ; ${predicate} ${value} ] .`;
};

export const buildNativeVisualSparqlQuery = (
  relation: OntologyModelRelation,
  target: OntologyConcept
): string => {
  let pattern: string;
  const property = relation.propertyIri ? iri(relation.propertyIri) : undefined;
  switch (relation.kind) {
    case 'subClassOf':
      pattern = '?concept rdfs:subClassOf ?target .';

      break;
    case 'disjointWith':
      pattern = '?concept owl:disjointWith ?target .';

      break;
    case 'equivalentClass':
      pattern = '?concept owl:equivalentClass ?target .';

      break;
    case 'objectAssertion':
      pattern = `?concept ${property} ?target .`;

      break;
    case 'objectProperty':
      pattern = `${property} rdfs:domain ?concept ; rdfs:range ?target .`;

      break;
    case 'restriction':
      pattern = buildRestrictionPattern(relation, property);

      break;
  }

  return `PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
PREFIX owl: <http://www.w3.org/2002/07/owl#>
PREFIX skos: <http://www.w3.org/2004/02/skos/core#>
PREFIX xsd: <http://www.w3.org/2001/XMLSchema#>

SELECT DISTINCT ?concept ?label WHERE {
  VALUES ?target { ${iri(target.iri)} }
  VALUES ?conceptType { owl:Class skos:Concept }
  ?concept rdf:type ?conceptType .
  ${pattern}
  OPTIONAL { ?concept rdfs:label ?label . }
}
LIMIT 100`;
};
