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
  act,
  fireEvent,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import { Ontology } from '../../../../generated/entity/data/ontology';
import {
  AxiomType,
  ExpressionKind,
  OntologyAxiom,
  Provenance,
} from '../../../../generated/entity/data/ontologyAxiom';
import {
  ConceptMappingType,
  OntologyConcept,
  OntologyConceptType,
} from '../../../../generated/entity/data/ontologyConcept';
import {
  Kind,
  OntologyProperty,
} from '../../../../generated/entity/data/ontologyProperty';
import {
  Category,
  PaletteKey,
  RelationshipType,
} from '../../../../generated/entity/data/relationshipType';
import {
  createOntologyAxiom,
  createOntologyProperty,
  createRelationshipType,
  getRelationshipTypeByName,
  listRelationshipTypes,
  patchOntologyProperty,
  patchRelationshipType,
} from '../../../../rest/ontologyAPI';
import { renderWithQueryClient as render } from '../../../../test/unit/test-utils';
import {
  buildOntologyStudioGraph,
  getModelRelations,
  OntologyStudioModel,
} from '../../../../utils/governance/ontology/OntologyStudioModel.utils';
import { getDerivedPermissionFlags } from '../../../../utils/PermissionDerivation';
import { DEFAULT_ENTITY_PERMISSION } from '../../../../utils/PermissionsUtils';
import { showErrorToast } from '../../../../utils/ToastUtils';
import OntologyGraphView from './OntologyGraphView';

const mockGraphProps = jest.fn();
const mockUseOntologyStudioModel = jest.fn();
const mockPermissions = {
  ontologyConcept: { Create: true },
  ontologyProperty: { Create: true },
  ontologyAxiom: { Create: true },
  relationshipType: { Create: true },
};
let mockCanEditConcept = true;

jest.mock('../../../../context/PermissionProvider/PermissionProvider', () => ({
  usePermissionProvider: () => ({ permissions: mockPermissions }),
}));
jest.mock(
  '../../../../hooks/useEntityPermissions/useEntityPermissions',
  () => ({
    useEntityPermissions: () =>
      getDerivedPermissionFlags({
        ...DEFAULT_ENTITY_PERMISSION,
        EditAll: mockCanEditConcept,
      }),
  })
);

jest.mock(
  '../../../../hooks/governance/ontology/useOntologyStudioModel',
  () => ({
    useOntologyStudioModel: (ontology: Ontology) =>
      mockUseOntologyStudioModel(ontology),
  })
);

jest.mock('../../../../rest/ontologyAPI', () => ({
  getOntologyConceptBindings: jest
    .fn()
    .mockResolvedValue({ revision: 0, assets: [] }),
  createOntologyAxiom: jest.fn(),
  createOntologyProperty: jest.fn(),
  createRelationshipType: jest.fn(),
  getRelationshipTypeByName: jest.fn(),
  listRelationshipTypes: jest.fn(),
  patchOntologyProperty: jest.fn(),
  patchRelationshipType: jest.fn(),
}));

jest.mock('../../../../utils/ToastUtils', () => ({
  showErrorToast: jest.fn(),
}));

jest.mock('../../../OntologyExplorer/OntologyGraphG6', () => {
  const React = jest.requireActual<typeof import('react')>('react');

  return {
    __esModule: true,
    default: React.forwardRef(
      (
        props: {
          nodes: Array<{ id: string; label: string }>;
          onNodeClick: (node: { id: string; label: string }) => void;
        },
        ref
      ) => {
        mockGraphProps(props);
        React.useImperativeHandle(ref, () => ({
          fitView: jest.fn(),
          zoomIn: jest.fn(),
          zoomOut: jest.fn(),
        }));

        return (
          <div data-testid="native-ontology-graph">
            {props.nodes.map((node) => (
              <button
                data-testid={`native-graph-node-${node.id}`}
                key={node.id}
                onClick={() => props.onNodeClick(node)}>
                {node.label}
              </button>
            ))}
          </div>
        );
      }
    ),
  };
});

const ontology: Ontology = {
  displayName: 'Retail Commerce',
  fullyQualifiedName: 'RetailCommerce',
  id: 'ontology-retail',
  iri: 'urn:retail',
  name: 'RetailCommerce',
  namespace: 'urn:retail:',
};

const concept = (
  name: string,
  extra: Partial<OntologyConcept> = {}
): OntologyConcept => ({
  conceptType: OntologyConceptType.OwlClass,
  fullyQualifiedName: `RetailCommerce.${name}`,
  id: `concept-${name.toLocaleLowerCase()}`,
  iri: `urn:retail:${name}`,
  name,
  ontology: { id: ontology.id, type: 'ontology' },
  ...extra,
});

const party = concept('Party');
const customer = concept('Customer', {
  conceptMappings: [
    {
      conceptIri: 'https://schema.org/Person',
      mappingType: ConceptMappingType.ExactMatch,
    },
  ],
  description: 'A person who buys goods.',
});
const orphan = concept('Orphan');

const dataProperty = (
  name: string,
  domain: string,
  extra: Partial<OntologyProperty> = {}
): OntologyProperty => ({
  domain: [domain],
  fullyQualifiedName: `RetailCommerce.${name}`,
  id: `property-${name}`,
  iri: `urn:retail:${name}`,
  kind: Kind.Data,
  name,
  ontology: { id: ontology.id, type: 'ontology' },
  range: ['http://www.w3.org/2001/XMLSchema#string'],
  ...extra,
});

const objectProperty: OntologyProperty = {
  domain: [],
  fullyQualifiedName: 'RetailCommerce.servedBy',
  id: 'property-served-by',
  iri: 'urn:retail:servedBy',
  kind: Kind.Object,
  name: 'servedBy',
  ontology: { id: ontology.id, type: 'ontology' },
  range: [],
};

const customerIsParty: OntologyAxiom = {
  axiomType: AxiomType.SubclassOf,
  description: 'Customer is a Party',
  displayName: 'Customer is a Party',
  expressions: [{ classIri: party.iri, kind: ExpressionKind.NamedClass }],
  fullyQualifiedName: 'RetailCommerce.CustomerIsParty',
  id: 'axiom-customer-party',
  name: 'CustomerIsParty',
  ontology: { id: ontology.id, type: 'ontology' },
  provenance: Provenance.Manual,
  subjectIri: customer.iri,
};

const model: OntologyStudioModel = {
  axioms: [customerIsParty],
  concepts: [party, customer, orphan],
  ontology,
  properties: [
    dataProperty('legalName', party.iri),
    dataProperty('customerCode', customer.iri, { isIdentifier: true }),
  ],
};
const relations = getModelRelations(model);
const graph = buildOntologyStudioGraph(model, relations);

const modelResult = {
  graph,
  isError: false,
  isFetching: false,
  isLoading: false,
  model,
  refetch: jest.fn(),
  relations,
};

const PART_OF = 'https://open-metadata.org/ontology/partOf';
const HAS_PART = 'https://open-metadata.org/ontology/hasPart';
const GOVERNED_BY = 'https://open-metadata.org/ontology/governedBy';
const SUBCLASS_OF = 'http://www.w3.org/2000/01/rdf-schema#subClassOf';

const relationshipType = (
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
const inverseRef = (name: string) => ({
  fullyQualifiedName: name,
  id: `type-${name}`,
  type: 'relationshipType',
});
const registryTypes = [
  relationshipType('partOf', 'Part Of', PART_OF, {
    inverse: inverseRef('hasPart'),
  }),
  relationshipType('hasPart', 'Has Part', HAS_PART, {
    inverse: inverseRef('partOf'),
  }),
  relationshipType('subClassOf', 'Subclass Of', SUBCLASS_OF, {
    category: Category.OwlSkos,
  }),
  relationshipType('governedBy', 'Governed By', GOVERNED_BY, {
    category: Category.Custom,
    systemDefined: false,
  }),
];
const hasPartProperty: OntologyProperty = {
  ...objectProperty,
  fullyQualifiedName: 'RetailCommerce.hasPart',
  id: 'property-hasPart',
  inverse: PART_OF,
  iri: HAS_PART,
  name: 'hasPart',
};
const partOfProperty: OntologyProperty = {
  ...objectProperty,
  fullyQualifiedName: 'RetailCommerce.partOf',
  id: 'property-partOf',
  inverse: HAS_PART,
  iri: PART_OF,
  name: 'partOf',
};

const latestGraphProps = () => mockGraphProps.mock.calls.at(-1)?.[0];
const waitForRegistry = () =>
  waitFor(() =>
    expect(
      latestGraphProps()
        .relationTypeGroups.flatMap(
          (group: { options: Array<{ id: string }> }) => group.options
        )
        .map((option: { id: string }) => option.id)
    ).toContain(PART_OF)
  );

describe('OntologyGraphView', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPermissions.ontologyConcept.Create = true;
    mockPermissions.ontologyProperty.Create = true;
    mockPermissions.ontologyAxiom.Create = true;
    mockPermissions.relationshipType.Create = true;
    mockCanEditConcept = true;
    mockUseOntologyStudioModel.mockReturnValue(modelResult);
    (listRelationshipTypes as jest.Mock).mockResolvedValue({
      data: registryTypes,
      paging: { total: registryTypes.length },
    });
    (createRelationshipType as jest.Mock).mockImplementation((request) =>
      Promise.resolve(
        relationshipType(
          request.name,
          request.displayName,
          request.rdfPredicate,
          {
            category: Category.Custom,
            inverse: request.inverse ? inverseRef(request.inverse) : undefined,
            paletteKey: request.paletteKey,
            systemDefined: false,
          }
        )
      )
    );
    (patchRelationshipType as jest.Mock).mockResolvedValue({});
  });

  it('offers registry types and their inverse labels from later pages', async () => {
    (listRelationshipTypes as jest.Mock)
      .mockResolvedValueOnce({
        data: registryTypes.slice(0, 1),
        paging: { after: 'next', total: registryTypes.length },
      })
      .mockResolvedValueOnce({
        data: registryTypes.slice(1),
        paging: { total: registryTypes.length },
      });
    render(<OntologyGraphView isEditing ontology={ontology} surface="graph" />);
    await screen.findByTestId('native-ontology-graph');
    await waitForRegistry();
    fireEvent.click(screen.getByTestId('native-graph-node-concept-customer'));
    fireEvent.click(screen.getByTestId('ontology-add-relationship'));

    expect(
      await screen.findByTestId(`relation-type-${PART_OF}`)
    ).toHaveTextContent('Has Part');
    expect(
      screen.getByTestId(`relation-type-${GOVERNED_BY}`)
    ).toHaveTextContent('Governed By');
  });

  it('reports a repeated registry cursor without offering a partial catalog', async () => {
    (listRelationshipTypes as jest.Mock).mockResolvedValue({
      data: registryTypes,
      paging: { after: 'same', total: registryTypes.length },
    });
    render(<OntologyGraphView isEditing ontology={ontology} surface="graph" />);
    await screen.findByTestId('native-ontology-graph');
    await waitFor(() =>
      expect(showErrorToast).toHaveBeenCalledWith('server.unexpected-error')
    );
    fireEvent.click(screen.getByTestId('native-graph-node-concept-customer'));
    fireEvent.click(screen.getByTestId('ontology-add-relationship'));

    expect(screen.getByTestId('relationship-type-picker')).toBeVisible();
    expect(
      screen.queryByTestId(`relation-type-${PART_OF}`)
    ).not.toBeInTheDocument();
  });

  it('submits a registry relation through the inspector and resets the form after saving', async () => {
    (createOntologyAxiom as jest.Mock).mockResolvedValue({});
    (createOntologyProperty as jest.Mock).mockResolvedValue({});
    render(<OntologyGraphView isEditing ontology={ontology} surface="graph" />);
    await screen.findByTestId('native-ontology-graph');
    await waitForRegistry();
    fireEvent.click(screen.getByTestId('native-graph-node-concept-customer'));
    fireEvent.click(screen.getByTestId('ontology-add-relationship'));
    fireEvent.click(screen.getByTestId(`relation-type-${PART_OF}`));
    fireEvent.click(screen.getByRole('button', { name: /label\.target/ }));
    fireEvent.click(await screen.findByRole('option', { name: 'Orphan' }));
    fireEvent.click(screen.getByTestId('ontology-relationship-submit'));

    await waitFor(() =>
      expect(createOntologyAxiom).toHaveBeenCalledWith(
        expect.objectContaining({
          subjectIri: customer.iri,
          expressions: [
            expect.objectContaining({
              propertyIri: PART_OF,
              filler: { kind: 'NAMED_CLASS', classIri: orphan.iri },
            }),
          ],
        })
      )
    );

    expect(createOntologyAxiom).toHaveBeenCalledTimes(1);
    expect(
      await screen.findByTestId('ontology-add-relationship')
    ).toBeVisible();

    fireEvent.click(screen.getByTestId('ontology-add-relationship'));

    expect(screen.getByTestId('relationship-type-picker')).toBeVisible();
    expect(
      screen.queryByTestId('ontology-relationship-submit')
    ).not.toBeInTheDocument();
  });

  it.each([
    { targetId: 'removed-concept', relationType: PART_OF },
    { targetId: orphan.id, relationType: 'urn:missing-type' },
  ])(
    'rejects a stale relation selection $targetId $relationType',
    async ({ targetId, relationType }) => {
      render(
        <OntologyGraphView isEditing ontology={ontology} surface="graph" />
      );
      await screen.findByTestId('native-ontology-graph');
      await waitForRegistry();
      await act(() =>
        latestGraphProps().onCreateRelation(customer.id, targetId, relationType)
      );

      expect(showErrorToast).toHaveBeenCalledWith('server.unexpected-error');
      expect(createOntologyProperty).not.toHaveBeenCalled();
      expect(createOntologyAxiom).not.toHaveBeenCalled();
    }
  );

  it.each([
    { status: 409, propertyIris: ['urn:existing:approvedBy'], errors: 0 },
    { status: 503, propertyIris: [], errors: 1 },
  ])(
    'handles registry HTTP $status before creating native properties',
    async ({ status, propertyIris, errors }) => {
      (createRelationshipType as jest.Mock).mockRejectedValue({
        isAxiosError: true,
        response: { status },
      });
      (getRelationshipTypeByName as jest.Mock).mockResolvedValue(
        relationshipType(
          'approvedBy',
          'approved by',
          'urn:existing:approvedBy',
          {
            category: Category.Custom,
          }
        )
      );
      (createOntologyAxiom as jest.Mock).mockResolvedValue({});
      (createOntologyProperty as jest.Mock).mockResolvedValue({});
      render(
        <OntologyGraphView isEditing ontology={ontology} surface="graph" />
      );
      await screen.findByTestId('native-ontology-graph');
      await waitForRegistry();
      let creation: Promise<void> = Promise.resolve();
      act(() => {
        creation = latestGraphProps().onCreateRelation(
          customer.id,
          orphan.id,
          'new:approved by'
        );
      });
      await screen.findByTestId('relationship-type-dialog');
      await act(async () => {
        fireEvent.click(screen.getByTestId('relationship-type-submit'));
        await creation;
      });

      expect(
        (createOntologyProperty as jest.Mock).mock.calls.map(
          ([request]) => request.iri
        )
      ).toEqual(propertyIris);
      expect(createOntologyAxiom).toHaveBeenCalledTimes(propertyIris.length);
      expect(getRelationshipTypeByName).toHaveBeenCalledTimes(
        propertyIris.length
      );
      expect(showErrorToast).toHaveBeenCalledTimes(errors);
      expect(
        screen.queryByTestId('relationship-type-dialog')
      ).not.toBeInTheDocument();
    }
  );

  it('renders the full native model, health, search, and concept inspector', async () => {
    const onStatsChange = jest.fn();
    render(
      <OntologyGraphView
        ontology={ontology}
        surface="graph"
        onStatsChange={onStatsChange}
      />
    );

    await screen.findByTestId('native-ontology-graph');

    expect(screen.getByTestId('ontology-isolated-count')).toHaveTextContent(
      '1'
    );
    expect(onStatsChange).toHaveBeenCalledWith({
      conceptCount: 3,
      isolatedCount: 1,
      ontologyId: ontology.id,
      relationCount: 1,
    });

    fireEvent.change(screen.getByTestId('ontology-graph-search'), {
      target: { value: 'customer' },
    });
    await waitFor(() =>
      expect(
        mockGraphProps.mock.calls.at(-1)?.[0].graphSearchHighlight
          .highlightedNodeIds
      ).toEqual(['concept-customer'])
    );

    fireEvent.click(screen.getByTestId('native-graph-node-concept-customer'));
    const inspector = screen.getByTestId('ontology-concept-inspector');

    expect(
      within(inspector).getByRole('heading', { name: 'Customer' })
    ).toBeVisible();
    expect(
      within(inspector).getByText('A person who buys goods.')
    ).toBeVisible();
    expect(within(inspector).getByText('customer code')).toBeVisible();
    expect(within(inspector).getByText('legal name')).toBeVisible();
    expect(
      within(inspector).getByText('https://schema.org/Person')
    ).toBeVisible();
    expect(
      within(inspector).getByTestId('ontology-concept-relation-concept-party')
    ).toHaveTextContent('Party');

    fireEvent.click(
      within(inspector).getByTestId('ontology-concept-relation-concept-party')
    );

    expect(
      within(screen.getByTestId('ontology-concept-inspector')).getByRole(
        'heading',
        { name: 'Party' }
      )
    ).toBeVisible();
  });

  it('uses the same inspector from the hierarchy tree', () => {
    render(<OntologyGraphView ontology={ontology} surface="tree" />);

    fireEvent.click(screen.getByTestId('ontology-tree-term-concept-customer'));

    expect(
      within(screen.getByTestId('ontology-concept-inspector')).getByRole(
        'heading',
        { name: 'Customer' }
      )
    ).toBeVisible();
    expect(
      screen.queryByTestId('ontology-health-panel')
    ).not.toBeInTheDocument();
  });

  it('authors concepts, data properties, and typed graph relations in Edit', async () => {
    const editableModel = {
      ...model,
      properties: [...model.properties, objectProperty],
    };
    const editableRelations = getModelRelations(editableModel);
    const refetch = jest.fn().mockResolvedValue({ data: editableModel });
    mockUseOntologyStudioModel.mockReturnValue({
      ...modelResult,
      graph: buildOntologyStudioGraph(editableModel, editableRelations),
      model: editableModel,
      refetch,
      relations: editableRelations,
    });
    (createOntologyAxiom as jest.Mock).mockResolvedValue({});
    (createOntologyProperty as jest.Mock).mockResolvedValue({});
    const onWorkingChange = jest.fn();

    const { rerender } = render(
      <OntologyGraphView
        isEditing
        createConceptRequestKey={0}
        ontology={ontology}
        surface="graph"
        onWorkingChange={onWorkingChange}
      />
    );
    await screen.findByTestId('native-ontology-graph');
    await waitForRegistry();

    const graphProps = latestGraphProps();

    expect(graphProps).toEqual(
      expect.objectContaining({
        canCreateRelationType: true,
        isEditMode: true,
      })
    );
    expect(graphProps.relationTypeGroups).toEqual([
      expect.objectContaining({
        id: 'core',
        options: [
          expect.objectContaining({ id: SUBCLASS_OF, label: 'Subclass Of' }),
          expect.objectContaining({
            id: PART_OF,
            inverseLabel: 'Has Part',
            label: 'Part Of',
          }),
          expect.objectContaining({
            id: HAS_PART,
            inverseLabel: 'Part Of',
            label: 'Has Part',
          }),
        ],
      }),
      expect.objectContaining({
        id: 'custom',
        options: [
          expect.objectContaining({ id: GOVERNED_BY, label: 'Governed By' }),
          expect.objectContaining({
            id: objectProperty.iri,
            label: 'served by',
          }),
        ],
      }),
    ]);

    await act(() =>
      graphProps.onCreateRelation(customer.id, party.id, SUBCLASS_OF)
    );
    await act(() =>
      graphProps.onCreateRelation(customer.id, orphan.id, objectProperty.iri)
    );
    await act(() =>
      graphProps.onCreateRelation(customer.id, orphan.id, PART_OF)
    );

    expect(createOntologyAxiom).toHaveBeenCalledTimes(3);
    expect(createOntologyAxiom).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        name: 'CustomerIsParty2',
        subjectIri: customer.iri,
      })
    );
    expect(createOntologyAxiom).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        subjectIri: customer.iri,
        expressions: [
          expect.objectContaining({ propertyIri: objectProperty.iri }),
        ],
      })
    );
    expect(createOntologyProperty).toHaveBeenCalledTimes(2);
    expect(createOntologyProperty).toHaveBeenNthCalledWith(1, {
      displayName: 'Has Part',
      inverse: undefined,
      iri: HAS_PART,
      kind: 'OBJECT',
      name: 'hasPart',
      ontology: 'RetailCommerce',
    });
    expect(createOntologyProperty).toHaveBeenNthCalledWith(2, {
      displayName: 'Part Of',
      inverse: HAS_PART,
      iri: PART_OF,
      kind: 'OBJECT',
      name: 'partOf',
      ontology: 'RetailCommerce',
    });
    expect(createOntologyAxiom).toHaveBeenNthCalledWith(
      3,
      expect.objectContaining({
        name: 'CustomerPartOfOrphan',
        expressions: [expect.objectContaining({ propertyIri: PART_OF })],
      })
    );
    expect(refetch).toHaveBeenCalledTimes(3);
    expect(onWorkingChange).toHaveBeenCalledTimes(5);

    fireEvent.click(screen.getByTestId('native-graph-node-concept-customer'));
    fireEvent.click(screen.getByTestId('ontology-add-property'));
    fireEvent.change(screen.getByTestId('ontology-property-name'), {
      target: { value: 'customerNumber' },
    });
    fireEvent.click(screen.getByTestId('ontology-property-type-integer'));
    fireEvent.click(screen.getByTestId('ontology-property-identifier'));
    await act(async () => {
      fireEvent.click(screen.getByTestId('ontology-property-submit'));
    });

    await waitFor(() =>
      expect(createOntologyProperty).toHaveBeenCalledWith(
        expect.objectContaining({
          domain: [customer.iri],
          isIdentifier: true,
          name: 'customerNumber',
          range: ['http://www.w3.org/2001/XMLSchema#integer'],
        })
      )
    );

    expect(onWorkingChange).toHaveBeenCalledTimes(6);

    fireEvent.click(screen.getByTestId('ontology-concept-edit'));

    expect(screen.getByTestId('ontology-concept-editor')).toBeVisible();

    fireEvent.click(screen.getByTestId('ontology-concept-authoring-close'));
    rerender(
      <OntologyGraphView
        isEditing
        createConceptRequestKey={1}
        ontology={ontology}
        surface="graph"
      />
    );

    expect(await screen.findByTestId('ontology-concept-editor')).toBeVisible();
  });

  it('links a reused pair the ontology left unlinked before writing the restriction', async () => {
    const refetch = jest.fn().mockResolvedValue({});
    mockUseOntologyStudioModel.mockReturnValue({
      ...modelResult,
      model: {
        ...model,
        properties: [
          objectProperty,
          { ...partOfProperty, inverse: undefined },
          { ...hasPartProperty, inverse: undefined },
        ],
      },
      refetch,
    });
    (patchOntologyProperty as jest.Mock).mockResolvedValue(partOfProperty);
    (createOntologyAxiom as jest.Mock).mockResolvedValue({});
    render(<OntologyGraphView isEditing ontology={ontology} surface="graph" />);
    await screen.findByTestId('native-ontology-graph');
    await waitForRegistry();

    await act(() =>
      latestGraphProps().onCreateRelation(customer.id, orphan.id, PART_OF)
    );

    expect(createOntologyProperty).not.toHaveBeenCalled();
    expect(patchOntologyProperty).toHaveBeenCalledWith('property-partOf', [
      { op: 'add', path: '/inverse', value: HAS_PART },
    ]);
    expect(createOntologyAxiom).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'CustomerPartOfOrphan',
        expressions: [expect.objectContaining({ propertyIri: PART_OF })],
      })
    );
    expect(refetch).toHaveBeenCalledTimes(1);
  });

  it('creates a custom registry type with its inverse from the picker, then instantiates it', async () => {
    (createOntologyAxiom as jest.Mock).mockResolvedValue({});
    (createOntologyProperty as jest.Mock).mockResolvedValue({});
    render(<OntologyGraphView isEditing ontology={ontology} surface="graph" />);
    await screen.findByTestId('native-ontology-graph');
    await waitForRegistry();

    let creation: Promise<void> = Promise.resolve();
    act(() => {
      creation = latestGraphProps().onCreateRelation(
        customer.id,
        orphan.id,
        'new:approved by'
      );
    });

    expect(await screen.findByTestId('relationship-type-dialog')).toBeVisible();
    expect(screen.getByTestId('relationship-type-name')).toHaveValue(
      'approved by'
    );

    fireEvent.change(screen.getByTestId('relationship-type-inverse'), {
      target: { value: 'approves' },
    });
    fireEvent.change(screen.getByTestId('relationship-type-description'), {
      target: { value: 'Who signs off.' },
    });
    await act(async () => {
      fireEvent.click(screen.getByTestId('relationship-type-submit'));
      await creation;
    });

    expect(createRelationshipType).toHaveBeenNthCalledWith(1, {
      category: 'CUSTOM',
      description: 'approves',
      displayName: 'approves',
      name: 'approves',
      paletteKey: 'INDIGO',
      rdfPredicate: 'https://open-metadata.org/ontology/approves',
    });
    expect(createRelationshipType).toHaveBeenNthCalledWith(2, {
      category: 'CUSTOM',
      characteristics: undefined,
      description: 'Who signs off.',
      displayName: 'approved by',
      inverse: 'approves',
      name: 'approvedBy',
      paletteKey: 'VIOLET',
      rdfPredicate: 'https://open-metadata.org/ontology/approvedBy',
    });
    expect(patchRelationshipType).toHaveBeenCalledWith('type-approves', [
      {
        op: 'add',
        path: '/inverse',
        value: {
          fullyQualifiedName: 'approvedBy',
          id: 'type-approvedBy',
          name: 'approvedBy',
          type: 'relationshipType',
        },
      },
    ]);
    expect(createOntologyProperty).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        inverse: undefined,
        iri: 'https://open-metadata.org/ontology/approves',
        name: 'approves',
      })
    );
    expect(createOntologyProperty).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        inverse: 'https://open-metadata.org/ontology/approves',
        iri: 'https://open-metadata.org/ontology/approvedBy',
        name: 'approvedBy',
      })
    );
    expect(createOntologyAxiom).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'CustomerApprovedByOrphan',
        expressions: [
          expect.objectContaining({
            propertyIri: 'https://open-metadata.org/ontology/approvedBy',
          }),
        ],
      })
    );

    await waitFor(() => expect(listRelationshipTypes).toHaveBeenCalledTimes(2));

    expect(
      screen.queryByTestId('relationship-type-dialog')
    ).not.toBeInTheDocument();
  });

  it('reuses a registry type whose label matches the requested new type', async () => {
    (createOntologyAxiom as jest.Mock).mockResolvedValue({});
    (createOntologyProperty as jest.Mock).mockResolvedValue({});
    render(<OntologyGraphView isEditing ontology={ontology} surface="graph" />);
    await screen.findByTestId('native-ontology-graph');
    await waitForRegistry();

    await act(() =>
      latestGraphProps().onCreateRelation(
        customer.id,
        orphan.id,
        'new:Governed By'
      )
    );

    expect(
      screen.queryByTestId('relationship-type-dialog')
    ).not.toBeInTheDocument();
    expect(createRelationshipType).not.toHaveBeenCalled();
    expect(createOntologyProperty).toHaveBeenCalledTimes(1);
    expect(createOntologyProperty).toHaveBeenCalledWith({
      displayName: 'Governed By',
      inverse: undefined,
      iri: GOVERNED_BY,
      kind: 'OBJECT',
      name: 'governedBy',
      ontology: 'RetailCommerce',
    });
    expect(createOntologyAxiom).toHaveBeenCalledWith(
      expect.objectContaining({
        expressions: [expect.objectContaining({ propertyIri: GOVERNED_BY })],
      })
    );
  });

  it('offers no registry type creation without the relationshipType permission', async () => {
    mockPermissions.relationshipType.Create = false;
    render(<OntologyGraphView isEditing ontology={ontology} surface="graph" />);
    await screen.findByTestId('native-ontology-graph');
    await waitForRegistry();

    expect(latestGraphProps().canCreateRelationType).toBe(false);

    await act(() =>
      latestGraphProps().onCreateRelation(
        customer.id,
        orphan.id,
        'new:approved by'
      )
    );

    expect(
      screen.queryByTestId('relationship-type-dialog')
    ).not.toBeInTheDocument();
    expect(createRelationshipType).not.toHaveBeenCalled();
    expect(createOntologyAxiom).not.toHaveBeenCalled();
  });

  it('writes nothing when the new type dialog is cancelled', async () => {
    render(<OntologyGraphView isEditing ontology={ontology} surface="graph" />);
    await screen.findByTestId('native-ontology-graph');
    await waitForRegistry();

    let creation: Promise<void> = Promise.resolve();
    act(() => {
      creation = latestGraphProps().onCreateRelation(
        customer.id,
        orphan.id,
        'new:approved by'
      );
    });
    await screen.findByTestId('relationship-type-dialog');
    await act(async () => {
      fireEvent.click(screen.getByTestId('relationship-type-cancel'));
      await creation;
    });

    expect(
      screen.queryByTestId('relationship-type-dialog')
    ).not.toBeInTheDocument();
    expect(createRelationshipType).not.toHaveBeenCalled();
    expect(createOntologyProperty).not.toHaveBeenCalled();
    expect(createOntologyAxiom).not.toHaveBeenCalled();
  });

  it('reuses the properties written before a failed axiom once the model refreshes', async () => {
    (createOntologyProperty as jest.Mock).mockResolvedValue({});
    (createOntologyAxiom as jest.MockedFunction<typeof createOntologyAxiom>)
      .mockRejectedValueOnce(new Error('axiom write failed'))
      .mockResolvedValue(customerIsParty);
    const refetch = jest.fn().mockResolvedValue({});
    mockUseOntologyStudioModel.mockReturnValue({ ...modelResult, refetch });
    const { rerender } = render(
      <OntologyGraphView isEditing ontology={ontology} surface="graph" />
    );
    await screen.findByTestId('native-ontology-graph');
    await waitForRegistry();

    await act(() =>
      latestGraphProps().onCreateRelation(customer.id, orphan.id, PART_OF)
    );

    expect(showErrorToast).toHaveBeenCalledTimes(1);
    expect(createOntologyProperty).toHaveBeenCalledTimes(2);
    expect(refetch).toHaveBeenCalledTimes(1);

    mockUseOntologyStudioModel.mockReturnValue({
      ...modelResult,
      model: {
        ...model,
        properties: [...model.properties, hasPartProperty, partOfProperty],
      },
      refetch,
    });
    rerender(
      <OntologyGraphView isEditing ontology={ontology} surface="graph" />
    );
    await act(() =>
      latestGraphProps().onCreateRelation(customer.id, orphan.id, PART_OF)
    );

    expect(createOntologyProperty).toHaveBeenCalledTimes(2);
    expect(createOntologyAxiom).toHaveBeenCalledTimes(2);
    expect(refetch).toHaveBeenCalledTimes(2);
  });

  it('starts a blank concept after editing an existing concept and hides the editor in View', async () => {
    const { rerender } = render(
      <OntologyGraphView isEditing ontology={ontology} surface="graph" />
    );
    fireEvent.click(
      await screen.findByTestId('native-graph-node-concept-customer')
    );
    fireEvent.click(screen.getByTestId('ontology-concept-edit'));

    expect(screen.getByRole('textbox', { name: 'label.name' })).toHaveValue(
      'Customer'
    );

    rerender(
      <OntologyGraphView
        isEditing
        createConceptRequestKey={1}
        ontology={ontology}
        surface="graph"
      />
    );

    expect(screen.getByRole('textbox', { name: 'label.name' })).toHaveValue('');

    rerender(
      <OntologyGraphView
        createConceptRequestKey={1}
        ontology={ontology}
        surface="graph"
      />
    );

    expect(
      screen.queryByTestId('ontology-concept-editor')
    ).not.toBeInTheDocument();
  });

  it('shows incoming relationships in subject-predicate order', async () => {
    render(<OntologyGraphView ontology={ontology} surface="graph" />);
    fireEvent.click(
      await screen.findByTestId('native-graph-node-concept-party')
    );

    expect(
      screen.getByTestId('ontology-concept-relationships')
    ).toHaveTextContent('Customeris a');
  });

  it('hides writes when the corresponding definition permission is denied', async () => {
    mockPermissions.ontologyProperty.Create = false;
    mockPermissions.ontologyAxiom.Create = false;
    mockCanEditConcept = false;
    render(<OntologyGraphView isEditing ontology={ontology} surface="graph" />);
    fireEvent.click(
      await screen.findByTestId('native-graph-node-concept-customer')
    );

    expect(
      screen.queryByTestId('ontology-add-property')
    ).not.toBeInTheDocument();
    expect(
      screen.queryByTestId('ontology-add-relationship')
    ).not.toBeInTheDocument();
    expect(
      screen.queryByTestId('ontology-concept-edit')
    ).not.toBeInTheDocument();
    expect(screen.getByTestId('ontology-concept-inspector')).toHaveTextContent(
      'Customer'
    );
  });

  it('keeps the inspector open and reports a failed authoring write', async () => {
    (createOntologyProperty as jest.Mock).mockRejectedValue(
      new Error('write failed')
    );
    render(<OntologyGraphView isEditing ontology={ontology} surface="graph" />);

    fireEvent.click(
      await screen.findByTestId('native-graph-node-concept-customer')
    );
    fireEvent.click(screen.getByTestId('ontology-add-property'));
    fireEvent.change(screen.getByTestId('ontology-property-name'), {
      target: { value: 'customerNumber' },
    });
    fireEvent.click(screen.getByTestId('ontology-property-submit'));

    await waitFor(() => expect(showErrorToast).toHaveBeenCalled());

    expect(screen.getByTestId('ontology-property-name')).toBeVisible();
  });

  it('does not replay an old add-concept request after the graph remounts', async () => {
    render(
      <OntologyGraphView
        isEditing
        createConceptRequestKey={4}
        ontology={ontology}
        surface="graph"
      />
    );

    await screen.findByTestId('native-ontology-graph');

    expect(
      screen.queryByTestId('ontology-concept-editor')
    ).not.toBeInTheDocument();
  });

  it('shows a retryable error instead of a partial model', () => {
    const refetch = jest.fn();
    mockUseOntologyStudioModel.mockReturnValue({
      ...modelResult,
      graph: null,
      isError: true,
      model: undefined,
      refetch,
      relations: [],
    });
    render(<OntologyGraphView ontology={ontology} surface="graph" />);

    fireEvent.click(screen.getByRole('button', { name: 'label.retry' }));

    expect(refetch).toHaveBeenCalled();
    expect(
      screen.queryByTestId('native-ontology-graph')
    ).not.toBeInTheDocument();
  });
});
