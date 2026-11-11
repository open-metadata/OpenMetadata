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
import {
  RelationTypeOption,
  RelationTypeOptionGroup,
} from '../../../components/OntologyExplorer/RelationshipTypePicker.interface';
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
  DataPropertyInput,
  getAvailableName,
  getModelRelations,
  getPropertyLabel,
  humanizeName,
  OntologyModelRelation,
  OntologyStudioModel,
  toCamelCase,
  toPascalCase,
} from './OntologyStudioModel.utils';

export const MAX_RELATIONSHIP_TYPE_PAGES = 10;
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
  readonly description?: string;
  /** Concept ids the declared property's domain allows; empty or absent allows any. */
  readonly domain?: readonly string[];
  readonly range?: readonly string[];
  /** "Domain → Range" in concept names, for a type that only fits some concepts. */
  readonly scopeLabel?: string;
}

export type NativeRelationStep =
  | { readonly kind: 'property'; readonly request: CreateOntologyProperty }
  | {
      readonly kind: 'link';
      readonly id: string;
      /** The patched property's FQN, by which the UI reads its edit rights. */
      readonly fqn: string;
      readonly patch: Operation[];
    }
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
  /** An inverse an earlier attempt registered but never linked, which the primary names in place of a new one. */
  readonly reusedInverse?: RelationshipType;
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

/** The registry stores an inverse as `{ id, fullyQualifiedName }`; the server never fills its `name`. */
const isReferenced = (
  candidate: RelationshipType,
  reference: NonNullable<RelationshipType['inverse']>
): boolean =>
  reference.id
    ? candidate.id === reference.id
    : candidate.fullyQualifiedName === reference.fullyQualifiedName;

/** A registry type as the native picker offers it, its inverse resolved against the registry. */
export const toNativeRelationType = (
  type: RelationshipType,
  types: readonly RelationshipType[]
): NativeRelationType => {
  const reference = type.inverse;
  const inverse =
    reference && types.find((candidate) => isReferenced(candidate, reference));

  return {
    ...partnerOf(type),
    description: type.description,
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
  description: property.description,
  group: 'custom',
  inverse: inverseOfOwnProperty(property, model, registry),
  kind: 'objectProperty',
  paletteKey: PaletteKey.Blue,
});

const HIERARCHY_KINDS: readonly NativeRelationKind[] = [
  'subClassOf',
  'superClassOf',
];

type DeclaredProperty = (iri: string) => OntologyProperty | undefined;

/** The live object property that holds each predicate, indexed once so a whole catalog plans in linear time. */
const declaredProperties = (model: OntologyStudioModel): DeclaredProperty => {
  const byIri = new Map(
    model.properties
      .filter(isLiveObjectProperty)
      .map((property) => [property.iri, property])
  );

  return (iri) => byIri.get(iri);
};

/** Each concept with every concept below it, through the hierarchy the model draws. */
const descendantsOf = (model: OntologyStudioModel) => {
  const children = new Map<string, string[]>();
  getModelRelations(model)
    .filter((relation) => relation.kind === 'subClassOf')
    .forEach(({ from, to }) =>
      children.set(to.id, [...(children.get(to.id) ?? []), from.id])
    );

  return (ids: readonly string[]) => {
    const reached = new Set(ids);
    let frontier = [...ids];
    while (frontier.length > 0) {
      frontier = frontier
        .flatMap((id) => children.get(id) ?? [])
        .filter((id) => !reached.has(id));
      frontier.forEach((id) => reached.add(id));
    }

    return [...reached];
  };
};

/** Adds the domain and range the ontology declares for an object property, as concept ids. */
const scopeOf = (model: OntologyStudioModel) => {
  const concepts = new Map(
    model.concepts.map((concept) => [concept.iri, concept])
  );
  const declared = declaredProperties(model);
  const withDescendants = descendantsOf(model);
  /**
   * The concepts an end may be: the declared classes and everything below them. A class the
   * model does not hold (owl:Thing, an external vocabulary) cannot be checked, so it allows any.
   */
  const allowedIds = (iris: readonly string[] = []) => {
    const known = iris.flatMap((iri) => {
      const concept = concepts.get(iri);

      return concept ? [concept.id] : [];
    });

    return iris.length > 0 && known.length === iris.length
      ? withDescendants(known)
      : undefined;
  };
  const namesOf = (iris: readonly string[] = []) =>
    iris
      .map((iri) => {
        const concept = concepts.get(iri);

        return concept ? concept.displayName || concept.name : iri;
      })
      .join(', ') || '…';

  return (type: NativeRelationType): NativeRelationType => {
    const property = declared(type.id);
    const domain = allowedIds(property?.domain);
    const range = allowedIds(property?.range);
    if (!property || (!domain && !range)) {
      return type;
    }

    return {
      ...type,
      domain,
      range,
      scopeLabel: `${namesOf(property.domain)} → ${namesOf(property.range)}`,
    };
  };
};

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

  const withScope = scopeOf(model);

  return [
    ...hierarchy,
    ...registry.filter((type) => HIERARCHY_KINDS.includes(type.kind)),
    ...registry
      .filter((type) => !HIERARCHY_KINDS.includes(type.kind))
      .map(withScope),
    ...own.map(withScope),
  ];
};

export const buildNativeRelationGroups = (
  catalog: readonly NativeRelationType[],
  titles: { readonly hierarchy: string; readonly relationships: string }
): RelationTypeOptionGroup[] =>
  (['hierarchy', 'relationships'] as const).map((group) => ({
    id: group,
    options: catalog
      .filter(
        (type) =>
          HIERARCHY_KINDS.includes(type.kind) === (group === 'hierarchy')
      )
      .map((type) => ({
        description: type.description,
        domain: type.domain,
        id: type.id,
        inverseLabel: type.inverse?.label,
        label: type.label,
        paletteKey: type.paletteKey,
        range: type.range,
        scopeLabel: type.scopeLabel,
      })),
    title: titles[group],
  }));

const allows = (allowed: readonly string[] | undefined, id?: string) =>
  !allowed?.length || !id || allowed.includes(id);

const fitsPair = (
  option: RelationTypeOption,
  sourceId?: string,
  targetId?: string
) => allows(option.domain, sourceId) && allows(option.range, targetId);

/**
 * Moves the options whose declared domain or range leaves out the source or target into a
 * trailing group the picker shows disabled, so the user sees why a link is not offered.
 */
export const splitUnfitRelationOptions = (
  groups: readonly RelationTypeOptionGroup[],
  ends: { readonly sourceId?: string; readonly targetId?: string },
  otherTitle: string
): RelationTypeOptionGroup[] => {
  const unfit = groups.flatMap((group) =>
    group.options.filter(
      (option) => !fitsPair(option, ends.sourceId, ends.targetId)
    )
  );
  if (unfit.length === 0) {
    return [...groups];
  }

  return [
    ...groups.map((group) => ({
      ...group,
      options: group.options.filter((option) => !unfit.includes(option)),
    })),
    {
      id: 'other',
      options: unfit.map((option) => ({ ...option, isDisabled: true })),
      title: otherTitle,
    },
  ];
};

/** A synonym that reads like a relation phrase ("part of Order") is better modelled as a relationship. */
const RELATION_LIKE_SYNONYM =
  /^(part of|is a|has|broader|narrower|disjoint)\b/i;

export const getRelationPhrase = (synonym: string): string | undefined =>
  RELATION_LIKE_SYNONYM.exec(synonym.trim())?.[1].toLowerCase();

export interface ObjectPropertyInput {
  readonly kind: 'object';
  readonly name: string;
  readonly rangeIri: string;
}

export const buildObjectPropertyRequest = (
  model: OntologyStudioModel,
  concept: OntologyConcept,
  input: ObjectPropertyInput
): CreateOntologyProperty => ({
  domain: [concept.iri],
  kind: CreatePropertyKind.Object,
  name: input.name.trim(),
  ontology: model.ontology.fullyQualifiedName,
  range: [input.rangeIri],
});

/** The entry a typed label names, so the picker reuses a type instead of registering it twice. */
export const findNativeRelationTypeByLabel = (
  catalog: readonly NativeRelationType[],
  label: string
): NativeRelationType | undefined => {
  const wanted = label.trim().toLowerCase();

  return catalog.find((type) => type.label.toLowerCase() === wanted);
};

/** The catalog entry a relation phrase names: the exact label, else the first label it starts. */
export const findNativeRelationTypeByPhrase = (
  catalog: readonly NativeRelationType[],
  phrase: string
): NativeRelationType | undefined =>
  findNativeRelationTypeByLabel(catalog, phrase) ??
  catalog.find((type) => type.label.toLowerCase().startsWith(phrase));

/** The other half of a reciprocal pair; a self-inverse type has none. */
const otherSideOf = (type: NativeRelationType) =>
  type.inverse && type.inverse.id !== type.id ? type.inverse : undefined;

/** Points a live property the ontology already holds at the inverse its type declares. */
const linkStep = (
  primary: OntologyProperty,
  inverse: string
): NativeRelationStep => ({
  fqn: primary.fullyQualifiedName,
  id: primary.id,
  kind: 'link',
  patch: [
    {
      op: primary.inverse ? 'replace' : 'add',
      path: '/inverse',
      value: inverse,
    },
  ],
});

/** The properties the ontology still lacks for the type, the inverse-less side first so the second can name it. */
const planProperties = (
  model: OntologyStudioModel,
  type: NativeRelationType,
  declared: DeclaredProperty
): NativeRelationStep[] => {
  const partner = otherSideOf(type);
  const partnerPending = partner && !declared(partner.id);
  const primary = declared(type.id);
  const wanted = type.inverse?.id;
  if (primary && !partnerPending) {
    return wanted && primary.inverse !== wanted
      ? [linkStep(primary, wanted)]
      : [];
  }
  const taken = new Set(model.properties.map((property) => property.name));
  const declare = (
    side: NativeRelationPartner,
    inverse?: string
  ): NativeRelationStep => {
    const name = getAvailableName(toCamelCase(side.name) || 'relatesTo', taken);
    taken.add(name);

    return {
      kind: 'property',
      request: {
        displayName: side.label,
        inverse,
        iri: side.id,
        kind: CreatePropertyKind.Object,
        name,
        ontology: model.ontology.fullyQualifiedName,
      },
    };
  };

  return [
    ...(partnerPending
      ? [declare(partner, primary ? type.id : undefined)]
      : []),
    ...(primary ? [] : [declare(type, wanted)]),
  ];
};

/** The property writes each type's relation makes before its axiom; a hierarchy relation makes none. */
export const planNativeProperties = (
  model: OntologyStudioModel,
  catalog: readonly NativeRelationType[]
): Array<{ type: NativeRelationType; steps: NativeRelationStep[] }> => {
  const declared = declaredProperties(model);

  return catalog.map((type) => ({
    steps:
      type.kind === 'objectProperty'
        ? planProperties(model, type, declared)
        : [],
    type,
  }));
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
    ...planProperties(model, type, declaredProperties(model)),
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

/**
 * Custom registry types for a draft, named apart from every existing type. An inverse an earlier
 * attempt registered but never linked is reused when the draft's inverse would take its name.
 */
export const planRelationshipType = (
  draft: RelationshipTypeDraft,
  types: readonly RelationshipType[],
  unlinkedInverse?: RelationshipType
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
  // Freed only after the primary is named, so the primary never takes it.
  if (unlinkedInverse) {
    taken.delete(unlinkedInverse.name);
  }
  const inverseName = inverseLabel ? nameFor(inverseLabel) : undefined;
  const reusedInverse =
    inverseName === unlinkedInverse?.name ? unlinkedInverse : undefined;
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
    inverse:
      inverseName && !reusedInverse
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
    reusedInverse,
  };
};

/** The registry links only the side that names its inverse, so the inverse just created is pointed back by patch. */
export const buildInverseBackLink = (
  primary: RelationshipType
): Operation[] => [
  {
    op: 'add',
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

export type ConceptPropertyInput = DataPropertyInput | ObjectPropertyInput;
