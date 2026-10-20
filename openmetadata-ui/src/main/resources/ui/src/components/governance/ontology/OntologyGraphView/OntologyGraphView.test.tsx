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
  createOntologyAxiom,
  createOntologyProperty,
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

describe('OntologyGraphView', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPermissions.ontologyConcept.Create = true;
    mockPermissions.ontologyProperty.Create = true;
    mockPermissions.ontologyAxiom.Create = true;
    mockCanEditConcept = true;
    mockUseOntologyStudioModel.mockReturnValue(modelResult);
  });

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
    (createOntologyProperty as jest.Mock).mockImplementation((request) =>
      Promise.resolve({
        ...request,
        fullyQualifiedName: `RetailCommerce.${request.name}`,
        id: `property-${request.name}`,
        iri: `urn:retail:${request.name}`,
        ontology: { id: ontology.id, type: 'ontology' },
      })
    );
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

    const graphProps = mockGraphProps.mock.calls.at(-1)?.[0];

    expect(graphProps).toEqual(
      expect.objectContaining({
        canCreateRelationType: true,
        isEditMode: true,
      })
    );
    expect(
      graphProps.relationTypeGroups.flatMap(
        (group: { options: Array<{ id: string }> }) => group.options
      )
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'isA' }),
        expect.objectContaining({ id: objectProperty.iri }),
      ])
    );

    await act(() => graphProps.onCreateRelation(customer.id, party.id, 'isA'));
    await act(() =>
      graphProps.onCreateRelation(customer.id, orphan.id, objectProperty.iri)
    );
    await act(() =>
      graphProps.onCreateRelation(customer.id, orphan.id, 'new:served by')
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
    expect(createOntologyProperty).toHaveBeenCalledWith(
      expect.objectContaining({
        displayName: 'served by',
        domain: [customer.iri],
        range: [orphan.iri],
      })
    );
    expect(refetch).toHaveBeenCalledTimes(3);
    expect(onWorkingChange).toHaveBeenCalledTimes(4);

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

    expect(onWorkingChange).toHaveBeenCalledTimes(5);

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

  it.each([false, true])(
    'reuses the created relationship property after an axiom failure (model refreshed: %s)',
    async (refreshModel) => {
      const createdProperty = {
        ...objectProperty,
        iri: 'urn:retail:server-minted-servedBy',
      };
      jest.mocked(createOntologyProperty).mockResolvedValue(createdProperty);
      jest
        .mocked(createOntologyAxiom)
        .mockRejectedValueOnce(new Error('axiom write failed'))
        .mockResolvedValue(customerIsParty);
      const { rerender } = render(
        <OntologyGraphView isEditing ontology={ontology} surface="graph" />
      );
      await screen.findByTestId('native-ontology-graph');
      await act(() =>
        mockGraphProps.mock.calls
          .at(-1)?.[0]
          .onCreateRelation(customer.id, orphan.id, 'new:served by')
      );

      expect(showErrorToast).toHaveBeenCalledTimes(1);

      if (refreshModel) {
        mockUseOntologyStudioModel.mockReturnValue({
          ...modelResult,
          model: {
            ...model,
            properties: [...model.properties, createdProperty],
          },
        });
        rerender(
          <OntologyGraphView isEditing ontology={ontology} surface="graph" />
        );
      }

      await act(() =>
        mockGraphProps.mock.calls
          .at(-1)?.[0]
          .onCreateRelation(customer.id, orphan.id, 'new:served by')
      );

      expect(createOntologyProperty).toHaveBeenCalledTimes(1);
      expect(createOntologyAxiom).toHaveBeenCalledTimes(2);
      expect(createOntologyAxiom).toHaveBeenLastCalledWith(
        expect.objectContaining({
          subjectIri: customer.iri,
          expressions: [
            expect.objectContaining({
              filler: expect.objectContaining({ classIri: orphan.iri }),
              propertyIri: createdProperty.iri,
            }),
          ],
        })
      );
    }
  );

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
