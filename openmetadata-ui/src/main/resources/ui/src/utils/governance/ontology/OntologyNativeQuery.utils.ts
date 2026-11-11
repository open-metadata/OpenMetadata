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

export const QUERY_LIMITS = [10, 50, 100, 500];

export const DEFAULT_QUERY_LIMIT = 100;

export interface NativeConceptCondition {
  readonly relation: OntologyModelRelation;
  readonly target: OntologyConcept;
}

export type NativePropertyConditionKind = 'domain' | 'range';

export interface NativePropertyCondition {
  readonly kind: NativePropertyConditionKind;
  readonly target: OntologyConcept;
}

const OPEN_OPTIONAL = '  OPTIONAL {';

const PREFIXES = `PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
PREFIX owl: <http://www.w3.org/2002/07/owl#>
PREFIX skos: <http://www.w3.org/2004/02/skos/core#>
PREFIX xsd: <http://www.w3.org/2001/XMLSchema#>`;

// The first condition keeps the plain ?target name the single-condition builder always used.
const targetVariable = (index: number) =>
  index === 0 ? '?target' : `?target${index + 1}`;

const buildTargetValues = (targets: OntologyConcept[]) =>
  targets.map(
    (target, index) =>
      `  VALUES ${targetVariable(index)} { ${iri(target.iri)} }`
  );

const buildRestrictionPattern = (
  relation: OntologyModelRelation,
  target: string,
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
      ? target
      : `"${cardinality}"^^xsd:nonNegativeInteger ; owl:onClass ${target}`;

  return `?concept rdfs:subClassOf [ a owl:Restriction ; owl:onProperty ${property} ; ${predicate} ${value} ] .`;
};

const buildConceptPattern = (
  relation: OntologyModelRelation,
  target: string
): string => {
  const property = relation.propertyIri ? iri(relation.propertyIri) : undefined;
  switch (relation.kind) {
    case 'subClassOf':
      return `?concept rdfs:subClassOf ${target} .`;
    case 'disjointWith':
      return `?concept owl:disjointWith ${target} .`;
    case 'equivalentClass':
      return `?concept owl:equivalentClass ${target} .`;
    case 'objectAssertion':
      return `?concept ${property} ${target} .`;
    case 'objectProperty':
      return `${property} rdfs:domain ?concept ; rdfs:range ${target} .`;
    case 'restriction':
      return buildRestrictionPattern(relation, target, property);
  }
};

/**
 * Concepts matching every condition (ANDed), one row per concept with its label and a named parent.
 * The Java contract test runs these exact strings against canonical RDF
 * (openmetadata-service/src/test/resources/ontology/native-visual-queries.json).
 */
export const buildNativeVisualSparqlQuery = (
  conditions: NativeConceptCondition[],
  limit = DEFAULT_QUERY_LIMIT
): string => {
  const patterns = conditions.map(
    ({ relation }, index) =>
      `  ${buildConceptPattern(relation, targetVariable(index))}`
  );

  return [
    PREFIXES,
    '',
    'SELECT (SAMPLE(?conceptLabel) AS ?label) ?concept (SAMPLE(COALESCE(?superLabel, ?superClass)) AS ?parent) WHERE {',
    ...buildTargetValues(conditions.map(({ target }) => target)),
    '  VALUES ?conceptType { owl:Class skos:Concept }',
    '  ?concept rdf:type ?conceptType .',
    ...patterns,
    '  OPTIONAL { ?concept rdfs:label ?conceptLabel . }',
    OPEN_OPTIONAL,
    '    ?concept rdfs:subClassOf ?superClass .',
    '    FILTER(isIRI(?superClass) && ?superClass != owl:Thing)',
    '    OPTIONAL { ?superClass rdfs:label ?superLabel . }',
    '  }',
    '}',
    'GROUP BY ?concept',
    'ORDER BY ?label ?concept',
    `LIMIT ${limit}`,
  ].join('\n');
};

/** Object and data properties matching every domain/range condition, with readable domain and range. */
export const buildNativePropertyQuery = (
  conditions: NativePropertyCondition[],
  limit = DEFAULT_QUERY_LIMIT
): string => {
  const patterns = conditions.map(
    ({ kind }, index) => `  ?property rdfs:${kind} ${targetVariable(index)} .`
  );

  return [
    PREFIXES,
    '',
    'SELECT (SAMPLE(COALESCE(?propertyLabel, ?property)) AS ?propertyName) (SAMPLE(COALESCE(?domainLabel, ?domainClass)) AS ?domain) (SAMPLE(COALESCE(?rangeLabel, ?rangeClass)) AS ?range) WHERE {',
    ...buildTargetValues(conditions.map(({ target }) => target)),
    '  VALUES ?propertyType { owl:ObjectProperty owl:DatatypeProperty }',
    '  ?property rdf:type ?propertyType .',
    ...patterns,
    '  OPTIONAL { ?property rdfs:label ?propertyLabel . }',
    OPEN_OPTIONAL,
    '    ?property rdfs:domain ?domainClass .',
    '    OPTIONAL { ?domainClass rdfs:label ?domainLabel . }',
    '  }',
    OPEN_OPTIONAL,
    '    ?property rdfs:range ?rangeClass .',
    '    OPTIONAL { ?rangeClass rdfs:label ?rangeLabel . }',
    '  }',
    '}',
    'GROUP BY ?property',
    'ORDER BY ?propertyName',
    `LIMIT ${limit}`,
  ].join('\n');
};
