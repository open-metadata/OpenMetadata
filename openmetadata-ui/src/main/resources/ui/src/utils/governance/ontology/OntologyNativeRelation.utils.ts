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

import { Operation } from 'fast-json-patch';
import { RelationTypeOptionGroup } from '../../../components/OntologyExplorer/RelationshipTypePicker.interface';
import {
  AxiomType as CreateAxiomType,
  CreateOntologyAxiom,
  ExpressionKind as CreateExpressionKind,
  Provenance,
  RestrictionKind as CreateRestrictionKind,
} from '../../../generated/api/data/createOntologyAxiom';
import {
  CreateOntologyProperty,
  Kind as CreatePropertyKind,
} from '../../../generated/api/data/createOntologyProperty';
import {
  Category as CreateCategory,
  Characteristic as CreateCharacteristic,
  CreateRelationshipType,
  PaletteKey as CreatePaletteKey,
} from '../../../generated/api/data/createRelationshipType';
import { OntologyConcept } from '../../../generated/entity/data/ontologyConcept';
import {
  Kind,
  OntologyProperty,
} from '../../../generated/entity/data/ontologyProperty';
import {
  Category,
  PaletteKey,
  RelationshipType,
} from '../../../generated/entity/data/relationshipType';
import {
  buildSubClassAxiomRequest,
  getAvailableName,
  getPropertyLabel,
  humanizeName,
  OntologyModelRelation,
  OntologyStudioModel,
  toCamelCase,
  toPascalCase,
} from './OntologyStudioModel.utils';

export const SUBCLASS_OF_PREDICATE =
  'http://www.w3.org/2000/01/rdf-schema#subClassOf';
export const SUPERCLASS_OF_PREDICATE =
  'https://open-metadata.org/ontology/superClassOf';
/** Where admin-defined registry types mint their predicates, beside the seeded core ones. */
export const CUSTOM_PREDICATE_NAMESPACE = 'https://open-metadata.org/ontology/';

const RDFS = 'http://www.w3.org/2000/01/rdf-schema#';
const OWL = 'http://www.w3.org/2002/07/owl#';
const SKOS = 'http://www.w3.org/2004/02/skos/core#';

/** A restriction on an annotation property is not OWL 2 DL, so these registry types are not offered. */
const ANNOTATION_PREDICATES = new Set([
  `${RDFS}label`,
  `${RDFS}comment`,
  `${RDFS}seeAlso`,
  `${RDFS}isDefinedBy`,
  `${OWL}deprecated`,
  `${OWL}versionInfo`,
  `${OWL}priorVersion`,
  `${OWL}backwardCompatibleWith`,
  `${OWL}incompatibleWith`,
  `${SKOS}prefLabel`,
  `${SKOS}altLabel`,
  `${SKOS}hiddenLabel`,
  `${SKOS}note`,
  `${SKOS}changeNote`,
  `${SKOS}definition`,
  `${SKOS}editorialNote`,
  `${SKOS}example`,
  `${SKOS}historyNote`,
  `${SKOS}scopeNote`,
]);

export type NativeRelationKind =
  | 'subClassOf'
  | 'superClassOf'
  | 'objectProperty';

export interface NativeRelationPartner {
  /** The predicate IRI, which is also the picker option id and the native property's IRI. */
  readonly id: string;
  readonly name: string;
  readonly label: string;
}

/** A relation the native picker offers: a registry type, or an object property only this ontology declares. */
export interface NativeRelationType extends NativeRelationPartner {
  readonly kind: NativeRelationKind;
  readonly group: 'core' | 'custom';
  readonly paletteKey: PaletteKey;
  /** A symmetric type names itself. */
  readonly inverse?: NativeRelationPartner;
}

export type NativeRelationStep =
  | { readonly kind: 'property'; readonly request: CreateOntologyProperty }
  | { readonly kind: 'axiom'; readonly request: CreateOntologyAxiom };

export interface RelationshipTypeDraft {
  readonly label: string;
  readonly inverseLabel?: string;
  readonly symmetric: boolean;
  readonly description?: string;
}

export interface RelationshipTypePlan {
  readonly primary: CreateRelationshipType;
  /** Created before the primary, which names it; the back link is patched afterwards. */
  readonly inverse?: CreateRelationshipType;
}

const partnerOf = (type: RelationshipType): NativeRelationPartner => ({
  id: type.rdfPredicate,
  label: type.displayName || humanizeName(type.name),
  name: type.name,
});

const kindOf = (predicate: string): NativeRelationKind => {
  if (predicate === SUBCLASS_OF_PREDICATE) {
    return 'subClassOf';
  }

  return predicate === SUPERCLASS_OF_PREDICATE
    ? 'superClassOf'
    : 'objectProperty';
};

/** A registry type as the native picker offers it, its inverse resolved against the registry. */
export const toNativeRelationType = (
  type: RelationshipType,
  types: readonly RelationshipType[]
): NativeRelationType => {
  const inverse = types.find(
    (candidate) => candidate.name === type.inverse?.name
  );

  return {
    ...partnerOf(type),
    group: type.category === Category.Custom ? 'custom' : 'core',
    inverse: inverse ? partnerOf(inverse) : undefined,
    kind: kindOf(type.rdfPredicate),
    paletteKey: type.paletteKey,
  };
};

const isLiveObjectProperty = (property: OntologyProperty): boolean =>
  property.kind === Kind.Object && !property.deleted;

const partnerOfProperty = (
  property: OntologyProperty
): NativeRelationPartner => ({
  id: property.iri,
  label: getPropertyLabel(property),
  name: property.name,
});

const inverseOfOwnProperty = (
  property: OntologyProperty,
  model: OntologyStudioModel,
  registry: ReadonlyMap<string, NativeRelationType>
): NativeRelationPartner | undefined => {
  const live = model.properties.find(
    (candidate) =>
      candidate.iri === property.inverse && isLiveObjectProperty(candidate)
  );
  if (live) {
    return partnerOfProperty(live);
  }
  const registered = property.inverse && registry.get(property.inverse);

  return registered
    ? { id: registered.id, label: registered.label, name: registered.name }
    : undefined;
};

const ownRelationType = (
  property: OntologyProperty,
  model: OntologyStudioModel,
  registry: ReadonlyMap<string, NativeRelationType>
): NativeRelationType => ({
  ...partnerOfProperty(property),
  group: 'custom',
  inverse: inverseOfOwnProperty(property, model, registry),
  kind: 'objectProperty',
  paletteKey: PaletteKey.Blue,
});

const HIERARCHY_KINDS: readonly NativeRelationKind[] = [
  'subClassOf',
  'superClassOf',
];

/**
 * Every relation a native ontology can author: the registry's types except annotation
 * predicates, hierarchy first, then the ontology's object properties no registry type backs.
 */
export const buildNativeRelationCatalog = (
  model: OntologyStudioModel,
  types: readonly RelationshipType[],
  labels: { readonly subClassOf: string }
): NativeRelationType[] => {
  const registry = types
    .filter((type) => !ANNOTATION_PREDICATES.has(type.rdfPredicate))
    .map((type) => toNativeRelationType(type, types));
  const byPredicate = new Map(registry.map((type) => [type.id, type]));
  const hierarchy: NativeRelationType[] = byPredicate.has(SUBCLASS_OF_PREDICATE)
    ? []
    : [
        {
          group: 'core',
          id: SUBCLASS_OF_PREDICATE,
          kind: 'subClassOf',
          label: labels.subClassOf,
          name: 'subClassOf',
          paletteKey: PaletteKey.Purple,
        },
      ];
  const own = model.properties
    .filter(
      (property) =>
        isLiveObjectProperty(property) && !byPredicate.has(property.iri)
    )
    .map((property) => ownRelationType(property, model, byPredicate));

  return [
    ...hierarchy,
    ...registry.filter((type) => HIERARCHY_KINDS.includes(type.kind)),
    ...registry.filter((type) => !HIERARCHY_KINDS.includes(type.kind)),
    ...own,
  ];
};

export const buildNativeRelationGroups = (
  catalog: readonly NativeRelationType[],
  titles: { readonly core: string; readonly custom: string }
): RelationTypeOptionGroup[] =>
  (['core', 'custom'] as const).map((group) => ({
    id: group,
    options: catalog
      .filter((type) => type.group === group)
      .map((type) => ({
        id: type.id,
        inverseLabel: type.inverse?.label,
        label: type.label,
        paletteKey: type.paletteKey,
      })),
    title: titles[group],
  }));

/** The properties the ontology still lacks for the type, the inverse-less side first so the second can name it. */
const planProperties = (
  model: OntologyStudioModel,
  type: NativeRelationType
): CreateOntologyProperty[] => {
  const declared = (iri: string) =>
    model.properties.some(
      (property) => property.iri === iri && isLiveObjectProperty(property)
    );
  const taken = new Set(model.properties.map((property) => property.name));
  const declare = (
    partner: NativeRelationPartner,
    inverse?: string
  ): CreateOntologyProperty => {
    const name = getAvailableName(
      toCamelCase(partner.name) || 'relatesTo',
      taken
    );
    taken.add(name);

    return {
      displayName: partner.label,
      inverse,
      iri: partner.id,
      kind: CreatePropertyKind.Object,
      name,
      ontology: model.ontology.fullyQualifiedName,
    };
  };
  const partner =
    type.inverse && type.inverse.id !== type.id ? type.inverse : undefined;
  const requests: CreateOntologyProperty[] = [];
  if (partner && !declared(partner.id)) {
    requests.push(declare(partner, declared(type.id) ? type.id : undefined));
  }
  if (!declared(type.id)) {
    requests.push(declare(type, type.inverse?.id));
  }

  return requests;
};

interface NativeRelationInput {
  readonly model: OntologyStudioModel;
  readonly from: OntologyConcept;
  readonly to: OntologyConcept;
  readonly type: NativeRelationType;
}

/**
 * The writes, in order, that relate `from` to `to` through `type`: the missing properties of the
 * pair, then `from SubClassOf type some to`. Nothing is written on the target; `A hasPart some B`
 * does not entail `B partOf some A`.
 */
export const planNativeRelation = ({
  from,
  model,
  to,
  type,
}: NativeRelationInput): NativeRelationStep[] => {
  if (type.kind !== 'objectProperty') {
    const [subject, parent] =
      type.kind === 'subClassOf' ? [from, to] : [to, from];

    return [
      {
        kind: 'axiom',
        request: buildSubClassAxiomRequest({
          from: subject,
          model,
          statement: `${subject.name} is a ${parent.name}`,
          to: parent,
        }),
      },
    ];
  }
  const statement = `${from.name} ${type.label} ${to.name}`;

  return [
    ...planProperties(model, type).map(
      (request): NativeRelationStep => ({ kind: 'property', request })
    ),
    {
      kind: 'axiom',
      request: {
        axiomType: CreateAxiomType.SubclassOf,
        description: statement,
        displayName: statement,
        expressions: [
          {
            filler: { classIri: to.iri, kind: CreateExpressionKind.NamedClass },
            kind: CreateExpressionKind.Restriction,
            propertyIri: type.id,
            restrictionKind: CreateRestrictionKind.Some,
          },
        ],
        name: getAvailableName(
          `${toPascalCase(from.name)}${toPascalCase(type.name)}${toPascalCase(
            to.name
          )}`,
          model.axioms.map((axiom) => axiom.name)
        ),
        ontology: model.ontology.fullyQualifiedName,
        provenance: Provenance.Manual,
        subjectIri: from.iri,
      },
    },
  ];
};

/** Custom registry types for a draft, named apart from every existing type. */
export const planRelationshipType = (
  draft: RelationshipTypeDraft,
  types: readonly RelationshipType[]
): RelationshipTypePlan => {
  const taken = new Set(types.map((type) => type.name));
  const nameFor = (label: string) => {
    const name = getAvailableName(toCamelCase(label) || 'relatesTo', taken);
    taken.add(name);

    return name;
  };
  const label = draft.label.trim();
  const inverseLabel = draft.symmetric ? '' : draft.inverseLabel?.trim() ?? '';
  const name = nameFor(label);
  const inverseName = inverseLabel ? nameFor(inverseLabel) : undefined;
  const request = (
    typeName: string,
    typeLabel: string,
    description: string,
    paletteKey: CreatePaletteKey
  ): CreateRelationshipType => ({
    category: CreateCategory.Custom,
    description,
    displayName: typeLabel,
    name: typeName,
    paletteKey,
    rdfPredicate: `${CUSTOM_PREDICATE_NAMESPACE}${typeName}`,
  });

  return {
    inverse: inverseName
      ? request(
          inverseName,
          inverseLabel,
          inverseLabel,
          CreatePaletteKey.Indigo
        )
      : undefined,
    primary: {
      ...request(
        name,
        label,
        draft.description?.trim() || label,
        CreatePaletteKey.Violet
      ),
      characteristics: draft.symmetric
        ? [CreateCharacteristic.Symmetric]
        : undefined,
      inverse: inverseName,
    },
  };
};

/** The registry links only the side that names its inverse, so the inverse is pointed back by patch. */
export const buildInverseBackLink = (
  inverse: RelationshipType,
  primary: RelationshipType
): Operation[] =>
  inverse.inverse?.id === primary.id
    ? []
    : [
        {
          op: inverse.inverse ? 'replace' : 'add',
          path: '/inverse',
          value: {
            fullyQualifiedName: primary.fullyQualifiedName,
            id: primary.id,
            name: primary.name,
            type: 'relationshipType',
          },
        },
      ];

/** How the target reads an incoming relation: through the property's inverse, when the ontology declares it. */
export const getInverseRelationLabel = (
  relation: OntologyModelRelation,
  model: OntologyStudioModel
): string | undefined => {
  const inverse = model.properties.find(
    (property) =>
      property.iri === relation.property?.inverse &&
      isLiveObjectProperty(property)
  );

  return inverse ? getPropertyLabel(inverse) : undefined;
};
