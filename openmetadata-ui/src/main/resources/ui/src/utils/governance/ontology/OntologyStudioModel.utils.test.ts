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
  AxiomType,
  ExpressionKind,
  OntologyAxiom,
  Provenance,
  RestrictionKind,
} from '../../../generated/entity/data/ontologyAxiom';
import {
  OntologyConcept,
  OntologyConceptType,
} from '../../../generated/entity/data/ontologyConcept';
import {
  Kind,
  OntologyProperty,
} from '../../../generated/entity/data/ontologyProperty';
import {
  buildDataPropertyRequest,
  buildObjectPropertyRequest,
  buildOntologyStudioGraph,
  buildRestrictionAxiomRequest,
  buildSubClassAxiomRequest,
  getAvailableName,
  getConceptAncestors,
  getConceptPropertyRows,
  getConceptRelationRows,
  getDatatypeLabel,
  getModelRelations,
  getObjectProperties,
  humanizeName,
  OntologyStudioModel,
} from './OntologyStudioModel.utils';

const NS = 'https://example.org/retail/';
const XSD = 'http://www.w3.org/2001/XMLSchema#';

const ontology = {
  id: 'ontology-retail',
  name: 'RetailCommerce',
  displayName: 'Retail Commerce',
  fullyQualifiedName: 'RetailCommerce',
  iri: NS,
  namespace: NS,
} as Ontology;

const concept = (name: string): OntologyConcept => ({
  id: `concept-${name}`,
  name,
  fullyQualifiedName: `RetailCommerce.${name}`,
  iri: `${NS}${name}`,
  ontology: { id: ontology.id, type: 'ontology' },
  conceptType: OntologyConceptType.OwlClass,
  version: 0.1,
});

const party = concept('Party');
const customer = concept('Customer');
const premiumCustomer = concept('PremiumCustomer');
const order = concept('Order');
const orderLine = concept('OrderLine');
const product = concept('Product');
const physicalProduct = concept('PhysicalProduct');
const digitalProduct = concept('DigitalProduct');
const shipment = concept('Shipment');

const property = (
  name: string,
  kind: Kind,
  domain: string[],
  range: string[],
  extra: Partial<OntologyProperty> = {}
): OntologyProperty => ({
  id: `property-${name}`,
  name,
  fullyQualifiedName: `RetailCommerce.${name}`,
  iri: `${NS}${name}`,
  ontology: { id: ontology.id, type: 'ontology' },
  kind,
  domain,
  range,
  ...extra,
});

const partyName = property(
  'legalName',
  Kind.Data,
  [party.iri],
  [`${XSD}string`]
);
const customerId = property(
  'customerId',
  Kind.Data,
  [customer.iri],
  [`${XSD}string`],
  { isIdentifier: true }
);
const orderTotal = property(
  'orderTotal',
  Kind.Data,
  [order.iri],
  [`${XSD}decimal`]
);
const placedBy = property('placedBy', Kind.Object, [order.iri], [customer.iri]);
const hasLine = property('hasLine', Kind.Object, [order.iri], [orderLine.iri]);
const fulfils = property('fulfills', Kind.Object, [shipment.iri], [order.iri], {
  displayName: 'Fulfils',
});

const axiom = (
  name: string,
  axiomType: AxiomType,
  subjectIri: string,
  expressions: OntologyAxiom['expressions']
): OntologyAxiom => ({
  id: `axiom-${name}`,
  name,
  displayName: name,
  description: name,
  fullyQualifiedName: `RetailCommerce.${name}`,
  ontology: { id: ontology.id, type: 'ontology' },
  axiomType,
  subjectIri,
  expressions,
  provenance: Provenance.Manual,
});

const named = (iri: string) => ({
  kind: ExpressionKind.NamedClass,
  classIri: iri,
});

const model: OntologyStudioModel = {
  ontology,
  concepts: [
    party,
    customer,
    premiumCustomer,
    order,
    orderLine,
    product,
    physicalProduct,
    digitalProduct,
    shipment,
  ],
  properties: [partyName, customerId, orderTotal, placedBy, hasLine, fulfils],
  axioms: [
    axiom('CustomerIsParty', AxiomType.SubclassOf, customer.iri, [
      named(party.iri),
    ]),
    axiom(
      'PremiumCustomerIsCustomer',
      AxiomType.SubclassOf,
      premiumCustomer.iri,
      [named(customer.iri)]
    ),
    axiom('PhysicalIsProduct', AxiomType.SubclassOf, physicalProduct.iri, [
      named(product.iri),
    ]),
    axiom(
      'PhysicalDisjointDigital',
      AxiomType.DisjointWith,
      physicalProduct.iri,
      [named(digitalProduct.iri)]
    ),
    axiom('OrderHasOneCustomer', AxiomType.SubclassOf, order.iri, [
      {
        kind: ExpressionKind.Restriction,
        propertyIri: placedBy.iri,
        restrictionKind: RestrictionKind.Exact,
        cardinality: 1,
        filler: named(customer.iri),
      },
    ]),
  ],
};

describe('OntologyStudioModel utils', () => {
  it('derives each concept relation once, letting a restriction stand for its property', () => {
    const relations = getModelRelations(model);

    expect(
      relations.map(
        (relation) =>
          `${relation.from.name} ${relation.kind} ${relation.to.name}`
      )
    ).toEqual([
      'Customer subClassOf Party',
      'PremiumCustomer subClassOf Customer',
      'PhysicalProduct subClassOf Product',
      'PhysicalProduct disjointWith DigitalProduct',
      'Order restriction Customer',
      'Order objectProperty OrderLine',
      'Shipment objectProperty Order',
    ]);
    expect(relations[4]).toMatchObject({
      key: 'restriction:axiom-OrderHasOneCustomer:0',
      property: placedBy,
      restriction: { cardinality: 1, kind: RestrictionKind.Exact },
    });
  });

  it('ignores definitions pointing outside the model and deleted ones', () => {
    const relations = getModelRelations({
      ...model,
      axioms: [
        axiom('ExternalParent', AxiomType.SubclassOf, customer.iri, [
          named('https://schema.org/Person'),
        ]),
        {
          ...axiom('Gone', AxiomType.SubclassOf, order.iri, [named(party.iri)]),
          deleted: true,
        },
      ],
      properties: [{ ...hasLine, deleted: true }],
    });

    expect(relations).toEqual([]);
  });

  it('draws concepts as Studio nodes and relations as labelled edges', () => {
    const graph = buildOntologyStudioGraph(model);

    expect(graph.nodes.find((node) => node.id === party.id)).toEqual({
      description: undefined,
      entityRef: {
        fullyQualifiedName: 'RetailCommerce.Party',
        id: party.id,
        type: 'ontologyConcept',
      },
      fullyQualifiedName: 'RetailCommerce.Party',
      glossaryId: 'ontology-retail',
      group: 'Retail Commerce',
      id: party.id,
      label: 'Party',
      type: 'ontologyConcept',
    });
    expect(
      graph.nodes.filter((node) => node.type === 'glossaryTermIsolated')
    ).toEqual([]);
    expect(
      graph.edges.map((edge) => `${edge.from}>${edge.relationType}>${edge.to}`)
    ).toEqual([
      'concept-Customer>isA>concept-Party',
      'concept-PremiumCustomer>isA>concept-Customer',
      'concept-PhysicalProduct>isA>concept-Product',
      'concept-PhysicalProduct>disjointWith>concept-DigitalProduct',
      'concept-Order>placed by>concept-Customer',
      'concept-Order>has line>concept-OrderLine',
      'concept-Shipment>Fulfils>concept-Order',
    ]);
  });

  it('marks a concept without relations as isolated', () => {
    const lonely = concept('Category');
    const graph = buildOntologyStudioGraph({
      ...model,
      concepts: [...model.concepts, lonely],
    });

    expect(graph.nodes.find((node) => node.id === lonely.id)?.type).toBe(
      'glossaryTermIsolated'
    );
  });

  it('lists a concept relations in both directions', () => {
    const rows = getConceptRelationRows(getModelRelations(model), customer.id);

    expect(
      rows.map(
        (row) => `${row.direction}:${row.relation.kind}:${row.other.name}`
      )
    ).toEqual([
      'outgoing:subClassOf:Party',
      'incoming:subClassOf:PremiumCustomer',
      'incoming:restriction:Order',
    ]);
  });

  it('walks superclasses nearest first and survives cycles', () => {
    const cyclic = getModelRelations({
      ...model,
      axioms: [
        ...model.axioms,
        axiom('PartyIsPremium', AxiomType.SubclassOf, party.iri, [
          named(premiumCustomer.iri),
        ]),
      ],
    });

    expect(
      getConceptAncestors(getModelRelations(model), premiumCustomer.id).map(
        (ancestor) => ancestor.name
      )
    ).toEqual(['Customer', 'Party']);
    expect(
      getConceptAncestors(cyclic, premiumCustomer.id).map(
        (ancestor) => ancestor.name
      )
    ).toEqual(['Customer', 'Party']);
  });

  it('lists own data properties, then those inherited from superclasses', () => {
    const rows = getConceptPropertyRows(
      model,
      getModelRelations(model),
      premiumCustomer
    );

    expect(
      rows.map((row) => [
        row.property.name,
        row.datatype,
        row.inheritedFrom?.name,
        row.property.isIdentifier,
      ])
    ).toEqual([
      ['customerId', 'string', 'Customer', true],
      ['legalName', 'string', 'Party', undefined],
    ]);
  });

  it('labels data types by their XSD local name, and enumerations as enum', () => {
    expect(getDatatypeLabel(orderTotal)).toBe('decimal');
    expect(
      getDatatypeLabel({
        ...orderTotal,
        enumValues: [{ value: 'GOLD' }],
      })
    ).toBe('enum');
    expect(getDatatypeLabel({ ...orderTotal, range: [] })).toBe('string');
  });

  it('offers live object properties sorted by label', () => {
    expect(getObjectProperties(model).map((item) => item.name)).toEqual([
      'fulfills',
      'hasLine',
      'placedBy',
    ]);
  });

  it('humanizes property names the way the canvas labels relations', () => {
    expect(humanizeName('placedBy')).toBe('placed by');
    expect(humanizeName('has_line')).toBe('has line');
  });

  it('picks the first free name for a new definition', () => {
    expect(getAvailableName('CustomerIsParty', ['CustomerIsParty'])).toBe(
      'CustomerIsParty2'
    );
    expect(
      getAvailableName('CustomerIsParty', [
        'CustomerIsParty',
        'CustomerIsParty2',
      ])
    ).toBe('CustomerIsParty3');
  });

  it('builds a subclass axiom with a fresh name', () => {
    expect(
      buildSubClassAxiomRequest({
        model,
        from: premiumCustomer,
        to: party,
        statement: 'PremiumCustomer is a Party',
      })
    ).toEqual({
      axiomType: 'SUBCLASS_OF',
      description: 'PremiumCustomer is a Party',
      displayName: 'PremiumCustomer is a Party',
      expressions: [{ classIri: party.iri, kind: 'NAMED_CLASS' }],
      name: 'PremiumCustomerIsParty',
      ontology: 'RetailCommerce',
      provenance: 'Manual',
      subjectIri: premiumCustomer.iri,
    });
  });

  it('builds an existential restriction through an object property', () => {
    expect(
      buildRestrictionAxiomRequest({
        model,
        from: shipment,
        to: order,
        property: fulfils,
        statement: 'Shipment fulfils Order',
      })
    ).toEqual({
      axiomType: 'SUBCLASS_OF',
      description: 'Shipment fulfils Order',
      displayName: 'Shipment fulfils Order',
      expressions: [
        {
          filler: { classIri: order.iri, kind: 'NAMED_CLASS' },
          kind: 'RESTRICTION',
          propertyIri: fulfils.iri,
          restrictionKind: 'SOME',
        },
      ],
      name: 'ShipmentFulfillsOrder',
      ontology: 'RetailCommerce',
      provenance: 'Manual',
      subjectIri: shipment.iri,
    });
  });

  it('builds a new object property between two concepts', () => {
    expect(
      buildObjectPropertyRequest(model, 'placed by', order, customer)
    ).toEqual({
      displayName: 'placed by',
      domain: [order.iri],
      kind: 'OBJECT',
      name: 'placedBy2',
      ontology: 'RetailCommerce',
      range: [customer.iri],
    });
  });

  it('builds a data property for the concept', () => {
    expect(
      buildDataPropertyRequest(model, order, {
        name: ' status ',
        datatype: 'enum',
        isIdentifier: false,
        enumValues: ['OPEN', 'SHIPPED'],
      })
    ).toEqual({
      domain: [order.iri],
      enumValues: [
        { datatypeIri: `${XSD}string`, value: 'OPEN' },
        { datatypeIri: `${XSD}string`, value: 'SHIPPED' },
      ],
      isIdentifier: undefined,
      kind: 'DATA',
      name: 'status',
      ontology: 'RetailCommerce',
      range: [`${XSD}string`],
    });
  });
});
