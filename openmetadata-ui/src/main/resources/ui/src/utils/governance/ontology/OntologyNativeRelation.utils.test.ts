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

import { Ontology } from '../../../generated/entity/data/ontology';
import {
  OntologyConcept,
  OntologyConceptType,
} from '../../../generated/entity/data/ontologyConcept';
import {
  Kind,
  OntologyProperty,
} from '../../../generated/entity/data/ontologyProperty';
import {
  Category,
  Characteristic,
  PaletteKey,
  RelationshipType,
} from '../../../generated/entity/data/relationshipType';
import {
  buildInverseBackLink,
  buildNativeRelationCatalog,
  buildNativeRelationGroups,
  CUSTOM_PREDICATE_NAMESPACE,
  getInverseRelationLabel,
  NativeRelationType,
  planNativeRelation,
  planRelationshipType,
  SUBCLASS_OF_PREDICATE,
  SUPERCLASS_OF_PREDICATE,
  toNativeRelationType,
} from './OntologyNativeRelation.utils';
import {
  getModelRelations,
  OntologyStudioModel,
} from './OntologyStudioModel.utils';

const NS = 'urn:retail:';
const PART_OF = `${CUSTOM_PREDICATE_NAMESPACE}partOf`;
const HAS_PART = `${CUSTOM_PREDICATE_NAMESPACE}hasPart`;
const RELATED_TO = `${CUSTOM_PREDICATE_NAMESPACE}relatedTo`;
const GOVERNED_BY = `${CUSTOM_PREDICATE_NAMESPACE}governedBy`;
const SEE_ALSO = 'http://www.w3.org/2000/01/rdf-schema#seeAlso';

const ontology = {
  id: 'ontology-retail',
  name: 'RetailCommerce',
  fullyQualifiedName: 'RetailCommerce',
  iri: 'urn:retail',
  namespace: NS,
} as Ontology;

const concept = (name: string): OntologyConcept => ({
  conceptType: OntologyConceptType.OwlClass,
  fullyQualifiedName: `RetailCommerce.${name}`,
  id: `concept-${name}`,
  iri: `${NS}${name}`,
  name,
  ontology: { id: ontology.id, type: 'ontology' },
});

const account = concept('Account');
const customer = concept('Customer');

const objectProperty = (
  name: string,
  iri: string,
  extra: Partial<OntologyProperty> = {}
): OntologyProperty => ({
  fullyQualifiedName: `RetailCommerce.${name}`,
  id: `property-${name}`,
  iri,
  kind: Kind.Object,
  name,
  ontology: { id: ontology.id, type: 'ontology' },
  ...extra,
});

const servedBy = objectProperty('servedBy', `${NS}servedBy`, {
  displayName: 'served by',
  domain: [account.iri],
  inverse: `${NS}serves`,
  range: [customer.iri],
});
const serves = objectProperty('serves', `${NS}serves`, {
  inverse: `${NS}servedBy`,
});
const partOfProperty = objectProperty('partOf', PART_OF, {
  displayName: 'Part Of',
  inverse: HAS_PART,
});
const hasPartProperty = objectProperty('hasPart', HAS_PART, {
  displayName: 'Has Part',
  inverse: PART_OF,
});

const model: OntologyStudioModel = {
  axioms: [],
  concepts: [account, customer],
  ontology,
  properties: [servedBy, serves],
};

const inverseRef = (name: string) => ({
  fullyQualifiedName: name,
  id: `type-${name}`,
  type: 'relationshipType',
});

const registryType = (
  name: string,
  displayName: string,
  rdfPredicate: string,
  extra: Partial<RelationshipType> = {}
): RelationshipType => ({
  category: Category.Core,
  characteristics: [],
  crossGlossaryAllowed: true,
  description: displayName,
  displayName,
  fullyQualifiedName: name,
  id: `type-${name}`,
  name,
  paletteKey: PaletteKey.Teal,
  rdfPredicate,
  systemDefined: true,
  ...extra,
});

const relatedTo = registryType('relatedTo', 'Related To', RELATED_TO, {
  characteristics: [Characteristic.Symmetric],
  inverse: inverseRef('relatedTo'),
});
const partOf = registryType('partOf', 'Part Of', PART_OF, {
  inverse: inverseRef('hasPart'),
});
const hasPart = registryType('hasPart', 'Has Part', HAS_PART, {
  inverse: inverseRef('partOf'),
  paletteKey: PaletteKey.Blue,
});
const seeAlso = registryType('seeAlso', 'See Also', SEE_ALSO, {
  category: Category.OwlSkos,
  characteristics: [Characteristic.Symmetric],
  inverse: inverseRef('seeAlso'),
});
const subClassOf = registryType(
  'subClassOf',
  'Subclass Of',
  SUBCLASS_OF_PREDICATE,
  { category: Category.OwlSkos, inverse: inverseRef('superClassOf') }
);
const superClassOf = registryType(
  'superClassOf',
  'Superclass Of',
  SUPERCLASS_OF_PREDICATE,
  {
    category: Category.OwlSkos,
    inverse: inverseRef('subClassOf'),
    paletteKey: PaletteKey.Purple,
  }
);
const governedBy = registryType('governedBy', 'Governed By', GOVERNED_BY, {
  category: Category.Custom,
  paletteKey: PaletteKey.Violet,
  systemDefined: false,
});
const types = [
  relatedTo,
  partOf,
  hasPart,
  seeAlso,
  subClassOf,
  superClassOf,
  governedBy,
];

const labels = { subClassOf: 'Is A' };
const native = (type: RelationshipType): NativeRelationType =>
  toNativeRelationType(type, types);

describe('OntologyNativeRelation.utils', () => {
  it('groups the registry hierarchy first, skips annotation predicates and adds own properties', () => {
    const catalog = buildNativeRelationCatalog(model, types, labels);

    expect(
      buildNativeRelationGroups(catalog, { core: 'Core', custom: 'Custom' })
    ).toEqual([
      {
        id: 'core',
        options: [
          {
            id: SUBCLASS_OF_PREDICATE,
            inverseLabel: 'Superclass Of',
            label: 'Subclass Of',
            paletteKey: PaletteKey.Teal,
          },
          {
            id: SUPERCLASS_OF_PREDICATE,
            inverseLabel: 'Subclass Of',
            label: 'Superclass Of',
            paletteKey: PaletteKey.Purple,
          },
          {
            id: RELATED_TO,
            inverseLabel: 'Related To',
            label: 'Related To',
            paletteKey: PaletteKey.Teal,
          },
          {
            id: PART_OF,
            inverseLabel: 'Has Part',
            label: 'Part Of',
            paletteKey: PaletteKey.Teal,
          },
          {
            id: HAS_PART,
            inverseLabel: 'Part Of',
            label: 'Has Part',
            paletteKey: PaletteKey.Blue,
          },
        ],
        title: 'Core',
      },
      {
        id: 'custom',
        options: [
          {
            id: GOVERNED_BY,
            inverseLabel: undefined,
            label: 'Governed By',
            paletteKey: PaletteKey.Violet,
          },
          {
            id: servedBy.iri,
            inverseLabel: 'serves',
            label: 'served by',
            paletteKey: PaletteKey.Blue,
          },
          {
            id: serves.iri,
            inverseLabel: 'served by',
            label: 'serves',
            paletteKey: PaletteKey.Blue,
          },
        ],
        title: 'Custom',
      },
    ]);
  });

  it('lists a property backed by a registry predicate once and synthesizes Subclass Of without a registry', () => {
    const declared = { ...model, properties: [partOfProperty, servedBy] };

    expect(
      buildNativeRelationCatalog(declared, types, labels).map(({ id }) => id)
    ).toEqual([
      SUBCLASS_OF_PREDICATE,
      SUPERCLASS_OF_PREDICATE,
      RELATED_TO,
      PART_OF,
      HAS_PART,
      GOVERNED_BY,
      servedBy.iri,
    ]);
    expect(buildNativeRelationCatalog(declared, [], labels)).toEqual([
      {
        group: 'core',
        id: SUBCLASS_OF_PREDICATE,
        kind: 'subClassOf',
        label: 'Is A',
        name: 'subClassOf',
        paletteKey: PaletteKey.Purple,
      },
      {
        group: 'custom',
        id: PART_OF,
        inverse: undefined,
        kind: 'objectProperty',
        label: 'Part Of',
        name: 'partOf',
        paletteKey: PaletteKey.Blue,
      },
      {
        group: 'custom',
        id: servedBy.iri,
        inverse: undefined,
        kind: 'objectProperty',
        label: 'served by',
        name: 'servedBy',
        paletteKey: PaletteKey.Blue,
      },
    ]);
  });

  it('plans the missing pair, the inverse-less side first, then the restriction', () => {
    expect(
      planNativeRelation({
        from: account,
        model,
        to: customer,
        type: native(partOf),
      })
    ).toEqual([
      {
        kind: 'property',
        request: {
          displayName: 'Has Part',
          inverse: undefined,
          iri: HAS_PART,
          kind: 'OBJECT',
          name: 'hasPart',
          ontology: 'RetailCommerce',
        },
      },
      {
        kind: 'property',
        request: {
          displayName: 'Part Of',
          inverse: HAS_PART,
          iri: PART_OF,
          kind: 'OBJECT',
          name: 'partOf',
          ontology: 'RetailCommerce',
        },
      },
      {
        kind: 'axiom',
        request: {
          axiomType: 'SUBCLASS_OF',
          description: 'Account Part Of Customer',
          displayName: 'Account Part Of Customer',
          expressions: [
            {
              filler: { classIri: customer.iri, kind: 'NAMED_CLASS' },
              kind: 'RESTRICTION',
              propertyIri: PART_OF,
              restrictionKind: 'SOME',
            },
          ],
          name: 'AccountPartOfCustomer',
          ontology: 'RetailCommerce',
          provenance: 'Manual',
          subjectIri: account.iri,
        },
      },
    ]);
  });

  it('reuses declared properties by IRI and completes a half pair through its inverse', () => {
    const complete = planNativeRelation({
      from: account,
      model: { ...model, properties: [partOfProperty, hasPartProperty] },
      to: customer,
      type: native(partOf),
    });
    const half = planNativeRelation({
      from: account,
      model: { ...model, properties: [partOfProperty] },
      to: customer,
      type: native(partOf),
    });

    expect(complete.map((step) => step.kind)).toEqual(['axiom']);
    expect(half).toEqual([
      {
        kind: 'property',
        request: {
          displayName: 'Has Part',
          inverse: PART_OF,
          iri: HAS_PART,
          kind: 'OBJECT',
          name: 'hasPart',
          ontology: 'RetailCommerce',
        },
      },
      complete[0],
    ]);
  });

  it('links a reused pair the ontology left unlinked and re-points a stale inverse', () => {
    const plan = (partOfInverse?: string) =>
      planNativeRelation({
        from: account,
        model: {
          ...model,
          properties: [
            { ...partOfProperty, inverse: partOfInverse },
            { ...hasPartProperty, inverse: undefined },
          ],
        },
        to: customer,
        type: native(partOf),
      }).map((step) =>
        step.kind === 'link' ? { id: step.id, patch: step.patch } : step.kind
      );

    expect(plan(undefined)).toEqual([
      {
        id: partOfProperty.id,
        patch: [{ op: 'add', path: '/inverse', value: HAS_PART }],
      },
      'axiom',
    ]);
    expect(plan(serves.iri)).toEqual([
      {
        id: partOfProperty.id,
        patch: [{ op: 'replace', path: '/inverse', value: HAS_PART }],
      },
      'axiom',
    ]);
    expect(plan(HAS_PART)).toEqual(['axiom']);
  });

  it('plans one property and a source restriction for a registry type without an inverse', () => {
    expect(
      planNativeRelation({
        from: account,
        model,
        to: customer,
        type: toNativeRelationType({ ...partOf, inverse: undefined }, types),
      })
    ).toEqual([
      {
        kind: 'property',
        request: {
          displayName: 'Part Of',
          inverse: undefined,
          iri: PART_OF,
          kind: 'OBJECT',
          name: 'partOf',
          ontology: 'RetailCommerce',
        },
      },
      {
        kind: 'axiom',
        request: expect.objectContaining({
          subjectIri: account.iri,
          expressions: [
            expect.objectContaining({
              propertyIri: PART_OF,
              filler: { classIri: customer.iri, kind: 'NAMED_CLASS' },
            }),
          ],
        }),
      },
    ]);
  });

  it('plans one self-inverse property for a symmetric type', () => {
    expect(
      planNativeRelation({
        from: account,
        model,
        to: customer,
        type: native(relatedTo),
      })
    ).toEqual([
      {
        kind: 'property',
        request: {
          displayName: 'Related To',
          inverse: RELATED_TO,
          iri: RELATED_TO,
          kind: 'OBJECT',
          name: 'relatedTo',
          ontology: 'RetailCommerce',
        },
      },
      expect.objectContaining({
        kind: 'axiom',
        request: expect.objectContaining({ name: 'AccountRelatedToCustomer' }),
      }),
    ]);
  });

  it('maps Subclass Of to the is-a axiom and Superclass Of to its reverse', () => {
    const isA = {
      axiomType: 'SUBCLASS_OF',
      description: 'Account is a Customer',
      displayName: 'Account is a Customer',
      expressions: [{ classIri: customer.iri, kind: 'NAMED_CLASS' }],
      name: 'AccountIsCustomer',
      ontology: 'RetailCommerce',
      provenance: 'Manual',
      subjectIri: account.iri,
    };

    expect(
      planNativeRelation({
        from: account,
        model,
        to: customer,
        type: native(subClassOf),
      })
    ).toEqual([{ kind: 'axiom', request: isA }]);
    expect(
      planNativeRelation({
        from: customer,
        model,
        to: account,
        type: native(superClassOf),
      })
    ).toEqual([{ kind: 'axiom', request: isA }]);
  });

  it('names custom registry types apart from existing ones and links the primary to its inverse', () => {
    expect(
      planRelationshipType(
        {
          description: ' Which policy applies. ',
          inverseLabel: ' governs ',
          label: 'governed by',
          symmetric: false,
        },
        types
      )
    ).toEqual({
      inverse: {
        category: 'CUSTOM',
        description: 'governs',
        displayName: 'governs',
        name: 'governs',
        paletteKey: 'INDIGO',
        rdfPredicate: `${CUSTOM_PREDICATE_NAMESPACE}governs`,
      },
      primary: {
        category: 'CUSTOM',
        characteristics: undefined,
        description: 'Which policy applies.',
        displayName: 'governed by',
        inverse: 'governs',
        name: 'governedBy2',
        paletteKey: 'VIOLET',
        rdfPredicate: `${CUSTOM_PREDICATE_NAMESPACE}governedBy2`,
      },
    });
  });

  it('plans a symmetric type alone, ignoring an inverse label', () => {
    expect(
      planRelationshipType(
        { inverseLabel: 'ignored', label: 'adjacent to', symmetric: true },
        types
      )
    ).toEqual({
      inverse: undefined,
      primary: {
        category: 'CUSTOM',
        characteristics: ['SYMMETRIC'],
        description: 'adjacent to',
        displayName: 'adjacent to',
        inverse: undefined,
        name: 'adjacentTo',
        paletteKey: 'VIOLET',
        rdfPredicate: `${CUSTOM_PREDICATE_NAMESPACE}adjacentTo`,
      },
    });
  });

  it('points the inverse back at the primary unless it already does', () => {
    const governs = registryType(
      'governs',
      'governs',
      `${CUSTOM_PREDICATE_NAMESPACE}governs`,
      { category: Category.Custom }
    );

    expect(buildInverseBackLink(governs, governedBy)).toEqual([
      {
        op: 'add',
        path: '/inverse',
        value: {
          fullyQualifiedName: 'governedBy',
          id: 'type-governedBy',
          name: 'governedBy',
          type: 'relationshipType',
        },
      },
    ]);
    expect(
      buildInverseBackLink(
        { ...governs, inverse: inverseRef('partOf') },
        governedBy
      )[0]
    ).toEqual(expect.objectContaining({ op: 'replace', path: '/inverse' }));
    expect(
      buildInverseBackLink(
        { ...governs, inverse: inverseRef('governedBy') },
        governedBy
      )
    ).toEqual([]);
  });

  it('reads an incoming relation through the inverse the ontology declares', () => {
    const [relation] = getModelRelations(model);

    expect(relation.property).toBe(servedBy);
    expect(getInverseRelationLabel(relation, model)).toBe('serves');
    expect(
      getInverseRelationLabel(relation, { ...model, properties: [servedBy] })
    ).toBeUndefined();
  });
});
