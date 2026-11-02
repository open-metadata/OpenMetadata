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
  OntologyEdge,
  OntologyGraphData,
  OntologyNode,
} from '../../../components/OntologyExplorer/OntologyExplorer.interface';
import {
  AxiomType as CreateAxiomType,
  CreateOntologyAxiom,
  ExpressionKind as CreateExpressionKind,
  Provenance,
} from '../../../generated/api/data/createOntologyAxiom';
import {
  CreateOntologyProperty,
  Kind as CreatePropertyKind,
} from '../../../generated/api/data/createOntologyProperty';
import { Ontology } from '../../../generated/entity/data/ontology';
import {
  AxiomType,
  ExpressionKind,
  OntologyAxiom,
  RestrictionKind,
} from '../../../generated/entity/data/ontologyAxiom';
import { OntologyConcept } from '../../../generated/entity/data/ontologyConcept';
import {
  Kind,
  OntologyProperty,
} from '../../../generated/entity/data/ontologyProperty';
import { getEntityName } from '../../EntityNameUtils';

/** The working definitions of one native ontology, as the Studio edits them. */
export interface OntologyStudioModel {
  readonly ontology: Ontology;
  readonly concepts: readonly OntologyConcept[];
  readonly properties: readonly OntologyProperty[];
  readonly axioms: readonly OntologyAxiom[];
}

export type OntologyRelationKind =
  | 'subClassOf'
  | 'restriction'
  | 'objectProperty'
  | 'objectAssertion'
  | 'disjointWith'
  | 'equivalentClass';

export interface OntologyRestriction {
  readonly kind: RestrictionKind;
  readonly cardinality?: number;
}

/** A named connection between two concepts of the model, with the definition that asserts it. */
export interface OntologyModelRelation {
  readonly key: string;
  readonly kind: OntologyRelationKind;
  readonly from: OntologyConcept;
  readonly to: OntologyConcept;
  readonly propertyIri?: string;
  readonly property?: OntologyProperty;
  /** Absent when only an object property's domain and range imply the relation. */
  readonly axiom?: OntologyAxiom;
  readonly restriction?: OntologyRestriction;
}

export interface OntologyConceptRelationRow {
  readonly relation: OntologyModelRelation;
  readonly direction: 'outgoing' | 'incoming';
  readonly other: OntologyConcept;
}

export interface OntologyConceptPropertyRow {
  readonly property: OntologyProperty;
  readonly datatype: string;
  /** The ancestor whose domain the property comes from; absent for the concept's own properties. */
  readonly inheritedFrom?: OntologyConcept;
}

const XSD = 'http://www.w3.org/2001/XMLSchema#';

/** The data types the Studio offers when a property is added, in the design's order. */
export const STUDIO_DATATYPES = [
  'string',
  'integer',
  'decimal',
  'boolean',
  'date',
  'dateTime',
  'enum',
] as const;

export type StudioDatatype = (typeof STUDIO_DATATYPES)[number];

export const ISOLATED_CONCEPT_NODE_TYPE = 'glossaryTermIsolated';
export const CONCEPT_NODE_TYPE = 'ontologyConcept';

const RELATION_TYPE_BY_KIND: Record<
  Exclude<
    OntologyRelationKind,
    'restriction' | 'objectProperty' | 'objectAssertion'
  >,
  string
> = {
  subClassOf: 'isA',
  disjointWith: 'disjointWith',
  equivalentClass: 'equivalentTo',
};

export const getIriLocalName = (iri: string): string => {
  const separator = Math.max(iri.lastIndexOf('#'), iri.lastIndexOf('/'));

  return separator >= 0 ? iri.slice(separator + 1) : iri;
};

/** "placedBy" reads as "placed by", the way the canvas labels relation types. */
export const humanizeName = (name: string): string =>
  name
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .trim()
    .toLocaleLowerCase();

export const getPropertyLabel = (property: OntologyProperty): string =>
  property.displayName || humanizeName(property.name);

export const getRelationPropertyLabel = (
  relation: Pick<OntologyModelRelation, 'property' | 'propertyIri'>
): string => {
  if (relation.property) {
    return getPropertyLabel(relation.property);
  }

  return relation.propertyIri
    ? humanizeName(getIriLocalName(relation.propertyIri))
    : '';
};

export const getDatatypeLabel = (property: OntologyProperty): string => {
  if (property.enumValues?.length) {
    return 'enum';
  }
  const [range] = property.range ?? [];

  return range ? getIriLocalName(range) : 'string';
};

export const getDatatypeIri = (datatype: StudioDatatype): string =>
  `${XSD}${datatype === 'enum' ? 'string' : datatype}`;

const restrictionOf = (
  axiom: OntologyAxiom
): Array<{
  propertyIri: string;
  restriction: OntologyRestriction;
  classIri: string;
}> =>
  axiom.expressions.flatMap((expression) => {
    if (expression.kind !== ExpressionKind.Restriction) {
      return [];
    }
    if (!expression.propertyIri || !expression.restrictionKind) {
      return [];
    }
    const filler = expression.filler;
    if (filler?.kind !== ExpressionKind.NamedClass || !filler.classIri) {
      return [];
    }

    return [
      {
        classIri: filler.classIri,
        propertyIri: expression.propertyIri,
        restriction: {
          cardinality: expression.cardinality,
          kind: expression.restrictionKind,
        },
      },
    ];
  });

const namedClassesOf = (axiom: OntologyAxiom): string[] =>
  axiom.expressions.flatMap((expression) =>
    expression.kind === ExpressionKind.NamedClass && expression.classIri
      ? [expression.classIri]
      : []
  );

const NAMED_AXIOM_KINDS: Partial<Record<AxiomType, OntologyRelationKind>> = {
  [AxiomType.SubclassOf]: 'subClassOf',
  [AxiomType.DisjointWith]: 'disjointWith',
  [AxiomType.EquivalentClass]: 'equivalentClass',
};

const restrictionKey = (fromId: string, propertyIri: string, toId: string) =>
  `${fromId}|${propertyIri}|${toId}`;

/**
 * Every concept-to-concept relation the model asserts: named subclass,
 * disjoint and equivalent axioms, object-property restrictions, and object
 * property domain/range pairs that no restriction already states.
 */
export const getModelRelations = (
  model: OntologyStudioModel
): OntologyModelRelation[] => {
  const conceptByIri = new Map(
    model.concepts.map((concept) => [concept.iri, concept])
  );
  const propertyByIri = new Map(
    model.properties.map((property) => [property.iri, property])
  );
  const relations: OntologyModelRelation[] = [];
  const restrictedPairs = new Set<string>();

  model.axioms.forEach((axiom) => {
    const from = conceptByIri.get(axiom.subjectIri);
    if (!from || axiom.deleted) {
      return;
    }
    if (
      axiom.axiomType === AxiomType.ObjectPropertyAssertion &&
      axiom.propertyIri &&
      axiom.targetIri
    ) {
      const to = conceptByIri.get(axiom.targetIri);
      if (to) {
        relations.push({
          axiom,
          from,
          to,
          key: `assertion:${axiom.id}`,
          kind: 'objectAssertion',
          property: propertyByIri.get(axiom.propertyIri),
          propertyIri: axiom.propertyIri,
        });
      }
    }
    const namedKind = NAMED_AXIOM_KINDS[axiom.axiomType];
    if (namedKind) {
      namedClassesOf(axiom).forEach((classIri, index) => {
        const to = conceptByIri.get(classIri);
        if (to && to.id !== from.id) {
          relations.push({
            axiom,
            from,
            key: `axiom:${axiom.id}:${index}`,
            kind: namedKind,
            to,
          });
        }
      });
    }
    if (axiom.axiomType === AxiomType.SubclassOf) {
      restrictionOf(axiom).forEach(
        ({ classIri, propertyIri, restriction }, index) => {
          const to = conceptByIri.get(classIri);
          if (!to) {
            return;
          }
          restrictedPairs.add(restrictionKey(from.id, propertyIri, to.id));
          relations.push({
            axiom,
            from,
            key: `restriction:${axiom.id}:${index}`,
            kind: 'restriction',
            property: propertyByIri.get(propertyIri),
            propertyIri,
            restriction,
            to,
          });
        }
      );
    }
  });

  model.properties
    .filter((property) => property.kind === Kind.Object && !property.deleted)
    .forEach((property) => {
      (property.domain ?? []).forEach((domainIri) => {
        const from = conceptByIri.get(domainIri);
        (property.range ?? []).forEach((rangeIri) => {
          const to = conceptByIri.get(rangeIri);
          if (
            !from ||
            !to ||
            restrictedPairs.has(restrictionKey(from.id, property.iri, to.id))
          ) {
            return;
          }
          relations.push({
            from,
            key: `property:${property.id}:${from.id}:${to.id}`,
            kind: 'objectProperty',
            property,
            propertyIri: property.iri,
            to,
          });
        });
      });
    });

  return relations;
};

export const getModelRelationLabel = (
  relation: OntologyModelRelation
): string =>
  relation.kind === 'restriction' ||
  relation.kind === 'objectProperty' ||
  relation.kind === 'objectAssertion'
    ? getRelationPropertyLabel(relation)
    : RELATION_TYPE_BY_KIND[relation.kind];

/** The model drawn with the Studio canvas: concepts as nodes, relations as typed edges. */
export const buildOntologyStudioGraph = (
  model: OntologyStudioModel,
  relations: OntologyModelRelation[] = getModelRelations(model)
): OntologyGraphData => {
  const connected = new Set(
    relations.flatMap((relation) => [relation.from.id, relation.to.id])
  );
  const group = getEntityName(model.ontology);
  const nodes: OntologyNode[] = model.concepts.map((concept) => ({
    description: concept.description,
    entityRef: {
      fullyQualifiedName: concept.fullyQualifiedName,
      id: concept.id,
      type: CONCEPT_NODE_TYPE,
    },
    fullyQualifiedName: concept.fullyQualifiedName,
    glossaryId: model.ontology.id,
    group,
    id: concept.id,
    label: getEntityName(concept),
    type: connected.has(concept.id)
      ? CONCEPT_NODE_TYPE
      : ISOLATED_CONCEPT_NODE_TYPE,
  }));
  const edges: OntologyEdge[] = relations.map((relation) => {
    const relationType = getModelRelationLabel(relation);

    return {
      edgeKind: 'ontology',
      from: relation.from.id,
      id: relation.key,
      label: relationType,
      relationType,
      to: relation.to.id,
    };
  });

  return { edges, nodes };
};

export const getConceptRelationRows = (
  relations: OntologyModelRelation[],
  conceptId: string
): OntologyConceptRelationRow[] =>
  relations.flatMap((relation): OntologyConceptRelationRow[] => {
    if (relation.from.id === conceptId) {
      return [{ direction: 'outgoing', other: relation.to, relation }];
    }

    return relation.to.id === conceptId
      ? [{ direction: 'incoming', other: relation.from, relation }]
      : [];
  });

/** Named superclasses of a concept, nearest first, without repeats or cycles. */
export const getConceptAncestors = (
  relations: OntologyModelRelation[],
  conceptId: string
): OntologyConcept[] => {
  const parentsOf = new Map<string, OntologyConcept[]>();
  relations
    .filter((relation) => relation.kind === 'subClassOf')
    .forEach((relation) => {
      parentsOf.set(relation.from.id, [
        ...(parentsOf.get(relation.from.id) ?? []),
        relation.to,
      ]);
    });
  const ancestors: OntologyConcept[] = [];
  const visited = new Set([conceptId]);
  let frontier = parentsOf.get(conceptId) ?? [];
  while (frontier.length > 0) {
    const next: OntologyConcept[] = [];
    frontier.forEach((parent) => {
      if (visited.has(parent.id)) {
        return;
      }
      visited.add(parent.id);
      ancestors.push(parent);
      next.push(...(parentsOf.get(parent.id) ?? []));
    });
    frontier = next;
  }

  return ancestors;
};

/** Data properties whose domain is the concept, then those it inherits from its superclasses. */
export const getConceptPropertyRows = (
  model: OntologyStudioModel,
  relations: OntologyModelRelation[],
  concept: OntologyConcept
): OntologyConceptPropertyRow[] => {
  const dataProperties = model.properties.filter(
    (property) => property.kind === Kind.Data && !property.deleted
  );
  const own = dataProperties
    .filter((property) => property.domain?.includes(concept.iri))
    .map((property) => ({ datatype: getDatatypeLabel(property), property }));
  const listed = new Set(own.map((row) => row.property.id));
  const inherited = getConceptAncestors(relations, concept.id).flatMap(
    (ancestor) =>
      dataProperties
        .filter(
          (property) =>
            property.domain?.includes(ancestor.iri) && !listed.has(property.id)
        )
        .map((property) => {
          listed.add(property.id);

          return {
            datatype: getDatatypeLabel(property),
            inheritedFrom: ancestor,
            property,
          };
        })
  );

  return [...own, ...inherited];
};

/** Object properties the Studio can offer as relationship types between two concepts. */
export const getObjectProperties = (
  model: OntologyStudioModel
): OntologyProperty[] =>
  model.properties
    .filter((property) => property.kind === Kind.Object && !property.deleted)
    .sort((left, right) =>
      getPropertyLabel(left).localeCompare(getPropertyLabel(right))
    );

/** "placed by" -> "PlacedBy". */
export const toPascalCase = (value: string): string =>
  value
    .replace(/[^A-Za-z0-9]+/g, ' ')
    .trim()
    .split(' ')
    .filter(Boolean)
    .map((word) => word.charAt(0).toLocaleUpperCase() + word.slice(1))
    .join('');

export const toCamelCase = (value: string): string => {
  const pascal = toPascalCase(value);

  return pascal.charAt(0).toLocaleLowerCase() + pascal.slice(1);
};

/** The base name, or the base with the first free numeric suffix. */
export const getAvailableName = (
  base: string,
  taken: Iterable<string>
): string => {
  const used = new Set(taken);
  let candidate = base;
  let suffix = 2;
  while (used.has(candidate)) {
    candidate = `${base}${suffix}`;
    suffix += 1;
  }

  return candidate;
};

interface RelationAxiomInput {
  readonly model: OntologyStudioModel;
  readonly from: OntologyConcept;
  readonly to: OntologyConcept;
  /** Human-readable statement, e.g. "Customer is a Party", stored as the axiom's label. */
  readonly statement: string;
}

export const buildSubClassAxiomRequest = ({
  model,
  from,
  to,
  statement,
}: RelationAxiomInput): CreateOntologyAxiom => ({
  axiomType: CreateAxiomType.SubclassOf,
  description: statement,
  displayName: statement,
  expressions: [{ classIri: to.iri, kind: CreateExpressionKind.NamedClass }],
  name: getAvailableName(
    `${toPascalCase(from.name)}Is${toPascalCase(to.name)}`,
    model.axioms.map((axiom) => axiom.name)
  ),
  ontology: model.ontology.fullyQualifiedName,
  provenance: Provenance.Manual,
  subjectIri: from.iri,
});

export interface DataPropertyInput {
  readonly name: string;
  readonly datatype: StudioDatatype;
  readonly isIdentifier: boolean;
  readonly enumValues?: string[];
}

export const buildDataPropertyRequest = (
  model: OntologyStudioModel,
  concept: OntologyConcept,
  input: DataPropertyInput
): CreateOntologyProperty => ({
  domain: [concept.iri],
  enumValues:
    input.datatype === 'enum' && input.enumValues?.length
      ? input.enumValues.map((value) => ({
          datatypeIri: getDatatypeIri('string'),
          value,
        }))
      : undefined,
  isIdentifier: input.isIdentifier || undefined,
  kind: CreatePropertyKind.Data,
  name: input.name.trim(),
  ontology: model.ontology.fullyQualifiedName,
  range: [getDatatypeIri(input.datatype)],
});
