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

import { Cube01 } from '@openmetadata/ui-core-components/icons';
import {
  act,
  fireEvent,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import { applyPatch } from 'fast-json-patch';
import { useState } from 'react';
import { MemoryRouter, useSearchParams } from 'react-router-dom';
import OntologyDraftProvider from '../../../../context/OntologyDraft/OntologyDraftProvider';
import {
  Code,
  Severity,
} from '../../../../generated/api/data/ontologyProfileReport';
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
import { useIsAiMode } from '../../../../hooks/useAppMode';
import {
  acquireOntologyEditLock,
  applyOntologyChangeSet,
  createOntologyAxiom,
  createOntologyChangeSet,
  createOntologyProperty,
  createRelationshipType,
  getNativeOntologyDataGraphPage,
  getOntologyChangeSet,
  getOntologyConcept,
  getOntologyState,
  getOntologyWorkingValidation,
  getRelationshipTypeByName,
  listRelationshipTypes,
  patchOntologyAxiom,
  patchOntologyConcept,
  patchOntologyProperty,
  patchRelationshipType,
  releaseOntologyEditLock,
  softDeleteOntologyDefinition,
} from '../../../../rest/ontologyAPI';
import {
  useEnUsTranslations,
  useKeyEchoTranslations,
} from '../../../../test/unit/enUsTranslation';
import { renderWithQueryClient as render } from '../../../../test/unit/test-utils';
import { pageFixture } from '../../../../utils/governance/ontology/OntologyNativeDataGraph.mock';
import {
  buildOntologyStudioGraph,
  getModelRelations,
  OntologyStudioModel,
} from '../../../../utils/governance/ontology/OntologyStudioModel.utils';
import { getDerivedPermissionFlags } from '../../../../utils/PermissionDerivation';
import { DEFAULT_ENTITY_PERMISSION } from '../../../../utils/PermissionsUtils';
import { showErrorToast } from '../../../../utils/ToastUtils';
import { OntologyGraphSearchSlotContext } from './OntologyGraphSearchSlot.context';
import OntologyGraphView from './OntologyGraphView';

// The type list is virtualized; jsdom has no layout, so without a size it
// renders only the first rows. Restored after each test.
const sizeSpies: jest.SpyInstance[] = [];
const renderEveryOption = () => {
  if (sizeSpies.length === 0) {
    sizeSpies.push(
      jest
        .spyOn(HTMLElement.prototype, 'clientHeight', 'get')
        .mockReturnValue(2000),
      jest
        .spyOn(HTMLElement.prototype, 'clientWidth', 'get')
        .mockReturnValue(1000)
    );
  }
};

afterEach(() => {
  sizeSpies.splice(0).forEach((spy) => spy.mockRestore());
  useKeyEchoTranslations();
});

const openRelationTypes = async () => {
  renderEveryOption();
  fireEvent.click(
    within(await screen.findByTestId('ontology-relationship-type')).getByRole(
      'button'
    )
  );
};

/** The relationship type is a select in the inline form; this opens it and picks one. */
const chooseRelationType = async (id: string) => {
  fireEvent.click(
    within(await screen.findByTestId('ontology-relationship-type')).getByRole(
      'button'
    )
  );
  fireEvent.click(screen.getByTestId(`relation-type-${id}`));
};

const mockGraphProps = jest.fn();
const mockGraphControls = {
  clearEdgeSelection: jest.fn(),
  focusNode: jest.fn(),
  getNodePositions: jest.fn(),
  fitView: jest.fn(),
  zoomIn: jest.fn(),
  zoomOut: jest.fn(),
};

const mockUseOntologyStudioModel = jest.fn();
const mockPermissions = {
  ontologyConcept: { Create: true },
  ontologyProperty: { Create: true },
  ontologyAxiom: { Create: true },
  ontologyChangeSet: { Create: true },
  relationshipType: { Create: true, EditAll: true },
};
let mockCanEditConcept = true;
let mockCanDeleteConcept = false;
let mockUneditableProperties: string[] = [];

jest.mock('../../../../context/PermissionProvider/PermissionProvider', () => ({
  usePermissionProvider: () => ({ permissions: mockPermissions }),
}));
jest.mock(
  '../../../../hooks/useEntityPermissions/useEntityPermissions',
  () => ({
    useEntityPermissions: () =>
      getDerivedPermissionFlags({
        ...DEFAULT_ENTITY_PERMISSION,
        Delete: mockCanDeleteConcept,
        EditAll: mockCanEditConcept,
      }),
  })
);
jest.mock(
  '../../../../hooks/useEntityPermissions/useBulkEntityPermissions',
  () => ({
    useBulkEntityPermissions: (_resource: string, fqns: string[]) => ({
      flagsByFqn: Object.fromEntries(
        fqns.map((fqn) => [
          fqn,
          getDerivedPermissionFlags({
            ...DEFAULT_ENTITY_PERMISSION,
            EditAll: !mockUneditableProperties.includes(fqn),
          }),
        ])
      ),
      isLoading: false,
      permissionsByFqn: {},
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
  acquireOntologyEditLock: jest.fn(),
  applyOntologyChangeSet: jest.fn(),
  createOntologyChangeSet: jest.fn(),
  getOntologyChangeSet: jest.fn(),
  getOntologyConcept: jest.fn(),
  getOntologyEditLock: jest.fn(),
  getOntologyState: jest.fn(),
  getOntologyWorkingValidation: jest.fn(),
  listOntologyChangeSets: jest.fn(),
  releaseOntologyEditLock: jest.fn(),
  renewOntologyEditLock: jest.fn(),
  restoreOntologyDefinition: jest.fn(),
  softDeleteOntologyDefinition: jest.fn().mockResolvedValue(undefined),
  getOntologyConceptBindings: jest
    .fn()
    .mockResolvedValue({ kind: 'complete', revision: 0, assets: [] }),
  getNativeOntologyDataGraphPage: jest.fn(),
  createOntologyAxiom: jest.fn(),
  createOntologyProperty: jest.fn(),
  createRelationshipType: jest.fn(),
  getRelationshipTypeByName: jest.fn(),
  listRelationshipTypes: jest.fn(),
  patchOntologyAxiom: jest.fn(),
  patchOntologyConcept: jest.fn(),
  patchOntologyProperty: jest.fn(),
  patchRelationshipType: jest.fn(),
}));

jest.mock('../../../../hooks/useAppMode', () => ({
  ...jest.requireActual('../../../../hooks/useAppMode'),
  useIsAiMode: jest.fn().mockReturnValue(false),
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
        React.useImperativeHandle(ref, () => mockGraphControls);

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
const APPROVES = 'https://open-metadata.org/ontology/approves';
const APPROVED_BY = 'https://open-metadata.org/ontology/approvedBy';
const GOVERNS = 'https://open-metadata.org/ontology/governs';
const GOVERNS_2 = 'https://open-metadata.org/ontology/governs2';
const SIGNED_OFF_BY = 'https://open-metadata.org/ontology/signedOffBy';

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
const offeredRelationIds = (): string[] =>
  latestGraphProps()
    .relationTypeGroups.flatMap(
      (group: { options: Array<{ id: string }> }) => group.options
    )
    .map((option: { id: string }) => option.id);
const waitForRegistry = (offered = PART_OF) =>
  waitFor(() => expect(offeredRelationIds()).toContain(offered));

/** Keeps registry writes, so the list a retry loads holds what an earlier attempt wrote. */
const keepRegistryWrites = () => {
  const stored = new Map(registryTypes.map((type) => [type.id, type]));
  const register = (
    createRelationshipType as jest.Mock
  ).getMockImplementation();
  (listRelationshipTypes as jest.Mock).mockImplementation(() =>
    Promise.resolve({
      data: [...stored.values()],
      paging: { total: stored.size },
    })
  );
  (createRelationshipType as jest.Mock).mockImplementation(async (request) => {
    const created: RelationshipType = await register?.(request);
    stored.set(created.id, created);

    return created;
  });
  (patchRelationshipType as jest.Mock).mockImplementation(async (id, patch) => {
    const type = stored.get(id);
    if (!type) {
      throw new Error(`Unknown relationship type ${id}`);
    }
    const { newDocument } = applyPatch(type, patch, false, false);
    stored.set(id, newDocument);

    return newDocument;
  });

  return stored;
};
const registeredPairs = (stored: Map<string, RelationshipType>) =>
  [...stored.values()]
    .slice(registryTypes.length)
    .map((type) => [type.name, type.inverse?.fullyQualifiedName]);
const backLinkTo = (name: string) => [
  {
    op: 'add',
    path: '/inverse',
    value: {
      fullyQualifiedName: name,
      id: `type-${name}`,
      name,
      type: 'relationshipType',
    },
  },
];
const registerType = async (label: string, inverseLabel: string) => {
  let creation: Promise<void> = Promise.resolve();
  act(() => {
    creation = latestGraphProps().onCreateRelation(
      customer.id,
      orphan.id,
      `new:${label}`
    );
  });
  await screen.findByTestId('relationship-type-dialog');
  fireEvent.change(screen.getByTestId('relationship-type-inverse'), {
    target: { value: inverseLabel },
  });
  await act(async () => {
    fireEvent.click(screen.getByTestId('relationship-type-submit'));
    await creation;
  });
};
const registerApprovedBy = () => registerType('approved by', 'approves');

describe('OntologyGraphView', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPermissions.ontologyConcept.Create = true;
    mockPermissions.ontologyChangeSet.Create = true;
    mockPermissions.ontologyProperty.Create = true;
    mockPermissions.ontologyAxiom.Create = true;
    mockPermissions.relationshipType.Create = true;
    mockPermissions.relationshipType.EditAll = true;
    mockCanEditConcept = true;
    mockCanDeleteConcept = false;
    mockUneditableProperties = [];
    mockUseOntologyStudioModel.mockReturnValue(modelResult);
    (getOntologyConcept as jest.Mock).mockImplementation((id: string) =>
      Promise.resolve(
        modelResult.model.concepts.find((concept) => concept.id === id)
      )
    );
    (getOntologyWorkingValidation as jest.Mock).mockResolvedValue({
      valid: true,
      violations: [],
    });
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
    render(
      <OntologyGraphView
        isEditing
        ontology={ontology}
        surface="graph"
        onRequestGraphSurface={jest.fn()}
      />
    );
    await screen.findByTestId('native-ontology-graph');
    await waitForRegistry();
    fireEvent.click(screen.getByTestId('native-graph-node-concept-customer'));
    fireEvent.click(screen.getByTestId('ontology-add-relationship'));
    await openRelationTypes();

    expect(screen.getByTestId(`relation-type-${PART_OF}`)).toHaveTextContent(
      'Has Part'
    );
    expect(
      screen.getByTestId(`relation-type-${GOVERNED_BY}`)
    ).toHaveTextContent('Governed By');
  });

  it('reports a repeated registry cursor without offering a partial catalog', async () => {
    (listRelationshipTypes as jest.Mock).mockResolvedValue({
      data: registryTypes,
      paging: { after: 'same', total: registryTypes.length },
    });
    render(
      <OntologyGraphView
        isEditing
        ontology={ontology}
        surface="graph"
        onRequestGraphSurface={jest.fn()}
      />
    );
    await screen.findByTestId('native-ontology-graph');
    await waitFor(() =>
      expect(showErrorToast).toHaveBeenCalledWith('server.unexpected-error')
    );
    fireEvent.click(screen.getByTestId('native-graph-node-concept-customer'));
    fireEvent.click(screen.getByTestId('ontology-add-relationship'));
    await openRelationTypes();

    expect(
      screen.queryByTestId(`relation-type-${PART_OF}`)
    ).not.toBeInTheDocument();
  });

  it('keeps a relationship type picked before the working copy finished loading', async () => {
    render(
      <OntologyGraphView
        isEditing
        ontology={ontology}
        surface="graph"
        onRequestGraphSurface={jest.fn()}
      />
    );
    await screen.findByTestId('native-ontology-graph');
    await waitForRegistry();
    fireEvent.click(screen.getByTestId('native-graph-node-concept-customer'));
    fireEvent.click(screen.getByTestId('ontology-add-relationship'));

    // Synchronously, so the pick lands before the working copy arrives.
    expect(
      screen.queryByTestId('ontology-concept-editor')
    ).not.toBeInTheDocument();

    fireEvent.click(
      within(screen.getByTestId('ontology-relationship-type')).getByRole(
        'button'
      )
    );
    fireEvent.click(screen.getByTestId(`relation-type-${PART_OF}`));

    await screen.findByTestId('ontology-concept-editor');

    // The trigger shows the chosen value; the field also holds a hidden list of every option.
    expect(
      within(screen.getByTestId('ontology-relationship-type')).getByRole(
        'button'
      )
    ).toHaveTextContent('Part Of');
  });

  it('submits a registry relation through the inspector and resets the form after saving', async () => {
    (createOntologyAxiom as jest.Mock).mockResolvedValue({});
    (createOntologyProperty as jest.Mock).mockResolvedValue({});
    render(
      <OntologyGraphView
        isEditing
        ontology={ontology}
        surface="graph"
        onRequestGraphSurface={jest.fn()}
      />
    );
    await screen.findByTestId('native-ontology-graph');
    await waitForRegistry();
    fireEvent.click(screen.getByTestId('native-graph-node-concept-customer'));
    // Edit mode is ready once the working copy loaded and the editor form is up.
    await screen.findByTestId('ontology-concept-editor');
    fireEvent.click(screen.getByTestId('ontology-add-relationship'));
    await chooseRelationType(PART_OF);
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

    // A fresh form: no target is carried over, so Add stays off.
    expect(screen.getByTestId('ontology-relationship-type')).toBeVisible();
    expect(screen.getByTestId('ontology-relationship-submit')).toBeDisabled();
  });

  it.each([
    { targetId: 'removed-concept', relationType: PART_OF },
    { targetId: orphan.id, relationType: 'urn:missing-type' },
  ])(
    'rejects a stale relation selection $targetId $relationType',
    async ({ targetId, relationType }) => {
      render(
        <OntologyGraphView
          isEditing
          ontology={ontology}
          surface="graph"
          onRequestGraphSurface={jest.fn()}
        />
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

  it.each([409, 503])(
    'reports registry HTTP %s instead of writing native properties',
    async (status) => {
      (createRelationshipType as jest.Mock).mockRejectedValue({
        isAxiosError: true,
        response: { status },
      });
      render(
        <OntologyGraphView
          isEditing
          ontology={ontology}
          surface="graph"
          onRequestGraphSurface={jest.fn()}
        />
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

      expect(showErrorToast).toHaveBeenCalledTimes(1);
      expect(showErrorToast).toHaveBeenCalledWith(
        expect.objectContaining({ response: { status } })
      );
      expect(getRelationshipTypeByName).not.toHaveBeenCalled();
      expect(patchRelationshipType).not.toHaveBeenCalled();
      expect(createOntologyProperty).not.toHaveBeenCalled();
      expect(createOntologyAxiom).not.toHaveBeenCalled();
      expect(
        screen.queryByTestId('relationship-type-dialog')
      ).not.toBeInTheDocument();
    }
  );

  it('opens an isolated concept from Connect when the selection lives in the URL', async () => {
    // Mirrors the Studio page: selection and the edit request both write the URL, and
    // react-router's functional setSearchParams does not queue, so a second write in the
    // same tick would replace the first.
    const writeParam =
      (
        setParams: ReturnType<typeof useSearchParams>[1],
        key: string,
        value?: string
      ) =>
      () =>
        setParams((current) => {
          const next = new URLSearchParams(current);
          if (value) {
            next.set(key, value);
          } else {
            next.delete(key);
          }

          return next;
        });
    const UrlStudio = () => {
      const [params, setParams] = useSearchParams();

      return (
        <OntologyGraphView
          isEditing
          ontology={ontology}
          selectedConceptId={params.get('concept') ?? undefined}
          surface="graph"
          onRequestEdit={writeParam(setParams, 'mode', 'edit')}
          onRequestGraphSurface={jest.fn()}
          onSelectedConceptChange={(id) =>
            writeParam(setParams, 'concept', id)()
          }
        />
      );
    };
    render(
      <MemoryRouter>
        <UrlStudio />
      </MemoryRouter>
    );
    await screen.findByTestId('native-ontology-graph');
    fireEvent.click(screen.getByTestId('ontology-health-review'));
    fireEvent.click(await screen.findByTestId(`ontology-connect-${orphan.id}`));

    expect(
      await screen.findByTestId('ontology-concept-inspector')
    ).toHaveTextContent('Orphan');
  });

  it('renders the full native model, health, search, and concept inspector', async () => {
    const onStatsChange = jest.fn();
    render(
      <OntologyGraphView
        ontology={ontology}
        surface="graph"
        onRequestGraphSurface={jest.fn()}
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
    const detail = screen.getByTestId('ontology-relation-detail');

    expect(
      screen.queryByTestId('ontology-concept-inspector')
    ).not.toBeInTheDocument();
    expect(
      within(detail).getByTestId('ontology-relation-detail-back')
    ).toHaveTextContent('Customer');
    expect(
      within(detail).getByTestId('ontology-relation-detail-target')
    ).toHaveTextContent('Party');

    fireEvent.click(
      within(detail).getByTestId('ontology-relation-detail-advanced-toggle')
    );
    const advanced = within(detail).getByTestId(
      'ontology-relation-detail-advanced'
    );

    expect(
      within(advanced)
        .getAllByRole('term')
        .map((term) => term.textContent)
    ).toEqual(expect.arrayContaining(['label.subject', 'label.target']));
    expect(
      within(advanced).getByTestId('ontology-relation-detail-advanced-subject')
    ).toHaveTextContent(/customer/i);
    expect(
      within(advanced).getByTestId('ontology-relation-detail-advanced-target')
    ).toHaveTextContent(/party/i);

    fireEvent.click(
      within(detail).getByTestId('ontology-relation-detail-target')
    );

    expect(
      within(screen.getByTestId('ontology-concept-inspector')).getByRole(
        'heading',
        { name: 'Party' }
      )
    ).toBeVisible();
  });

  it('draws a New concept ghost where the canvas was double-clicked while the panel is open', async () => {
    render(
      <OntologyGraphView
        isEditing
        ontology={ontology}
        surface="graph"
        onRequestGraphSurface={jest.fn()}
      />
    );
    await screen.findByTestId('native-ontology-graph');

    expect(latestGraphProps().ghostNode).toBeUndefined();

    act(() => latestGraphProps().onCanvasDoubleClick({ x: 40, y: 60 }));

    expect(await screen.findByTestId('ontology-new-class-panel')).toBeVisible();
    expect(latestGraphProps().ghostNode).toEqual({
      label: 'label.new-concept',
      x: 40,
      y: 60,
    });

    fireEvent.click(screen.getByTestId('ontology-new-class-close'));

    await waitFor(() =>
      expect(
        screen.queryByTestId('ontology-new-class-panel')
      ).not.toBeInTheDocument()
    );

    expect(latestGraphProps().ghostNode).toBeUndefined();
  });

  it('selects a concept requested from outside the graph, such as a Concepts row', async () => {
    const onSelectedConceptChange = jest.fn();
    render(
      <OntologyGraphView
        isEditing
        editConceptRequest={customer.id}
        ontology={ontology}
        surface="graph"
        onRequestGraphSurface={jest.fn()}
        onSelectedConceptChange={onSelectedConceptChange}
      />
    );

    await waitFor(() =>
      expect(onSelectedConceptChange).toHaveBeenCalledWith(customer.id)
    );
  });

  it('does not bring a New concept form back after leaving Edit and returning', async () => {
    const props = {
      ontology,
      surface: 'graph' as const,
      onRequestGraphSurface: jest.fn(),
    };
    const { rerender } = render(<OntologyGraphView isEditing {...props} />);
    await screen.findByTestId('native-ontology-graph');
    act(() => latestGraphProps().onCanvasDoubleClick({ x: 40, y: 60 }));

    expect(await screen.findByTestId('ontology-new-class-panel')).toBeVisible();

    rerender(<OntologyGraphView isEditing={false} {...props} />);
    rerender(<OntologyGraphView isEditing {...props} />);

    expect(
      screen.queryByTestId('ontology-new-class-panel')
    ).not.toBeInTheDocument();
  });

  it('turns a relation-like synonym into a relationship and leaves the concept unsaved', async () => {
    const withSynonym = { ...customer, synonyms: ['Buyer', 'part of Party'] };
    const synonymModel = {
      ...model,
      concepts: model.concepts.map((item) =>
        item.id === customer.id ? withSynonym : item
      ),
    };
    mockUseOntologyStudioModel.mockReturnValue({
      ...modelResult,
      model: synonymModel,
    });
    (getOntologyConcept as jest.Mock).mockImplementation((id: string) =>
      Promise.resolve(synonymModel.concepts.find((item) => item.id === id))
    );
    render(
      <OntologyGraphView
        isEditing
        ontology={ontology}
        surface="graph"
        onRequestGraphSurface={jest.fn()}
      />
    );
    await screen.findByTestId('native-ontology-graph');
    await waitForRegistry();
    fireEvent.click(screen.getByTestId('native-graph-node-concept-customer'));
    const inspector = screen.getByTestId('ontology-concept-inspector');

    expect(await within(inspector).findByTestId('concept-save')).toBeDisabled();

    fireEvent.click(
      await within(inspector).findByTestId(
        'ontology-synonym-add-as-relationship'
      )
    );

    expect(
      within(
        await within(inspector).findByTestId('ontology-relationship-type')
      ).getByRole('button')
    ).toHaveTextContent('Part Of');

    await waitFor(() =>
      expect(within(inspector).getByTestId('concept-save')).toBeEnabled()
    );

    expect(
      within(inspector).getByTestId('concept-save-status')
    ).toHaveTextContent('label.unsaved-changes');
    expect(
      within(inspector).getByTestId('ontology-concept-synonyms')
    ).not.toHaveTextContent('part of Party');
  });

  it('opens a relationship from the concept panel and saves its description', async () => {
    (patchOntologyAxiom as jest.Mock).mockResolvedValue(customerIsParty);
    render(
      <OntologyGraphView
        isEditing
        ontology={ontology}
        surface="graph"
        onRequestGraphSurface={jest.fn()}
      />
    );
    await screen.findByTestId('native-ontology-graph');
    fireEvent.click(screen.getByTestId('native-graph-node-concept-customer'));
    fireEvent.click(
      await screen.findByTestId('ontology-concept-relation-concept-party')
    );
    // The graph keeps reporting no clicked edge on re-render; that must not close the panel.
    act(() => latestGraphProps().onEdgeClick(undefined));
    const detail = screen.getByTestId('ontology-relation-detail');

    await waitFor(() =>
      expect(
        within(detail).getByTestId('ontology-relation-detail-status')
      ).toHaveTextContent('label.no-issues')
    );

    expect(
      within(detail).queryByTestId('ontology-relation-detail-conflict')
    ).not.toBeInTheDocument();

    const description = await within(detail).findByRole('textbox');
    fireEvent.change(description, {
      target: { value: 'Every buyer is a party' },
    });
    fireEvent.click(
      within(detail).getByTestId('ontology-relation-detail-description-save')
    );

    await waitFor(() =>
      expect(patchOntologyAxiom).toHaveBeenCalledWith(customerIsParty.id, [
        { op: 'add', path: '/description', value: 'Every buyer is a party' },
      ])
    );
  });

  it('asks before the close button drops an unsaved relationship description', async () => {
    render(
      <MemoryRouter>
        <OntologyDraftProvider>
          <OntologyGraphView
            isEditing
            ontology={ontology}
            surface="graph"
            onRequestGraphSurface={jest.fn()}
          />
        </OntologyDraftProvider>
      </MemoryRouter>
    );
    await screen.findByTestId('native-ontology-graph');
    fireEvent.click(screen.getByTestId('native-graph-node-concept-customer'));
    fireEvent.click(
      await screen.findByTestId('ontology-concept-relation-concept-party')
    );
    const detail = screen.getByTestId('ontology-relation-detail');
    fireEvent.change(await within(detail).findByRole('textbox'), {
      target: { value: 'Every buyer is a party' },
    });

    fireEvent.click(
      within(detail).getByTestId('ontology-relation-detail-close')
    );
    fireEvent.click(
      within(await screen.findByRole('dialog')).getByRole('button', {
        name: 'label.cancel',
      })
    );

    expect(screen.getByTestId('ontology-relation-detail')).toBeInTheDocument();
    expect(within(detail).getByRole('textbox')).toHaveValue(
      'Every buyer is a party'
    );

    fireEvent.click(
      within(detail).getByTestId('ontology-relation-detail-close')
    );
    fireEvent.click(
      within(await screen.findByRole('dialog')).getByRole('button', {
        name: 'label.discard',
      })
    );

    await waitFor(() =>
      expect(
        screen.queryByTestId('ontology-relation-detail')
      ).not.toBeInTheDocument()
    );
  });

  it('marks the clashing concept on the graph, lists the clash and, in Edit, resolves it from the concept drawer', async () => {
    const customerNeverParty: OntologyAxiom = {
      ...customerIsParty,
      axiomType: AxiomType.DisjointWith,
      displayName: 'Customer can never be a Party',
      id: 'axiom-customer-never-party',
      name: 'CustomerNeverParty',
      updatedAt: Date.UTC(2026, 9, 20),
      updatedBy: 'karthick',
    };
    const clashModel = {
      ...model,
      axioms: [customerIsParty, customerNeverParty],
    };
    const clashRelations = getModelRelations(clashModel);
    mockUseOntologyStudioModel.mockReturnValue({
      ...modelResult,
      graph: buildOntologyStudioGraph(clashModel, clashRelations),
      model: clashModel,
      relations: clashRelations,
    });
    (getOntologyWorkingValidation as jest.Mock).mockResolvedValue({
      valid: false,
      violations: [
        {
          code: Code.DisjointClash,
          conceptIds: ['concept-customer', 'concept-party'],
          message: 'Customer is disjoint with its ancestor Party',
          path: '/expressions',
          severity: Severity.Error,
        },
      ],
    });
    render(
      <OntologyGraphView
        isEditing
        ontology={ontology}
        surface="graph"
        onRequestGraphSurface={jest.fn()}
      />
    );

    const row = await screen.findByTestId('ontology-conflict-row');

    expect(row).toHaveTextContent(
      'Customer is disjoint with its ancestor Party'
    );
    expect(within(row).getByText('Customer').tagName).toBe('STRONG');
    expect(within(row).getByText('Party').tagName).toBe('STRONG');
    expect(
      within(row).getByTestId('ontology-conflict-provenance')
    ).toHaveTextContent('message.ontology-saved-by-on');
    expect(screen.getByTestId('ontology-conflicts-count')).toHaveTextContent(
      '1'
    );

    await waitFor(() => {
      const props = mockGraphProps.mock.calls.at(-1)?.[0];

      expect(
        props.nodes
          .filter((node: { hasConflict?: boolean }) => node.hasConflict)
          .map((node: { id: string }) => node.id)
      ).toEqual(['concept-customer']);
      expect([...props.conflictEdgeKeys]).toHaveLength(1);
    });

    fireEvent.click(within(row).getByTestId('ontology-conflict-resolve'));

    const inspector = screen.getByTestId('ontology-concept-inspector');

    expect(
      within(inspector).getByRole('heading', { name: 'Customer' })
    ).toBeVisible();
    expect(
      within(inspector).getByTestId('ontology-concept-conflicts-toggle')
    ).toHaveAttribute('aria-expanded', 'true');
    expect(
      within(inspector).getAllByTestId('ontology-concept-conflict-part')
    ).toHaveLength(2);
    expect(
      within(inspector).getAllByTestId('ontology-concept-relation-conflict-dot')
    ).toHaveLength(2);

    const [, rulePart] = within(inspector).getAllByTestId(
      'ontology-concept-conflict-part'
    );

    expect(rulePart).toHaveTextContent('message.ontology-conflict-never-be');

    fireEvent.click(
      within(rulePart).getByTestId('ontology-concept-conflict-remove')
    );

    await waitFor(() =>
      expect(softDeleteOntologyDefinition).toHaveBeenCalledWith(
        'axiom',
        customerNeverParty.id
      )
    );
  });

  it('opens a clashing concept with its conflict box collapsed and shows the clash on the graph', async () => {
    (getOntologyWorkingValidation as jest.Mock).mockResolvedValue({
      valid: false,
      violations: [
        {
          code: Code.DisjointClash,
          conceptIds: ['concept-customer', 'concept-party'],
          message: 'Customer is disjoint with its ancestor Party',
          path: '/expressions',
          severity: Severity.Error,
        },
      ],
    });
    render(
      <OntologyGraphView
        ontology={ontology}
        surface="graph"
        onRequestGraphSurface={jest.fn()}
      />
    );
    await screen.findByTestId('ontology-conflict-row');
    fireEvent.click(screen.getByTestId('native-graph-node-concept-customer'));

    const toggle = await screen.findByTestId(
      'ontology-concept-conflicts-toggle'
    );

    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(toggle).toHaveTextContent('label.review');
    expect(
      screen.queryByTestId('ontology-concept-conflict-part')
    ).not.toBeInTheDocument();

    fireEvent.click(toggle);

    expect(toggle).toHaveTextContent('label.hide');
    expect(
      screen.getByText('message.ontology-conflict-remove-one')
    ).toBeVisible();

    fireEvent.click(
      screen.getByTestId('ontology-concept-conflict-show-on-graph')
    );

    expect(
      screen.queryByTestId('ontology-concept-inspector')
    ).not.toBeInTheDocument();
    expect(mockGraphControls.focusNode).toHaveBeenCalledWith(
      'concept-customer'
    );
  });

  it('shows a clash on the graph from the Tree, focusing the concept once the graph is drawn', async () => {
    (getOntologyWorkingValidation as jest.Mock).mockResolvedValue({
      valid: false,
      violations: [
        {
          code: Code.DisjointClash,
          conceptIds: ['concept-customer', 'concept-party'],
          message: 'Customer is disjoint with its ancestor Party',
          path: '/expressions',
          severity: Severity.Error,
        },
      ],
    });
    const TreeThenGraph = () => {
      const [surface, setSurface] = useState<'graph' | 'tree'>('tree');

      return (
        <OntologyGraphView
          ontology={ontology}
          surface={surface}
          onRequestGraphSurface={() => setSurface('graph')}
        />
      );
    };
    render(<TreeThenGraph />);
    fireEvent.click(
      await screen.findByTestId('ontology-tree-term-concept-customer')
    );
    fireEvent.click(
      await screen.findByTestId('ontology-concept-conflicts-toggle')
    );
    fireEvent.click(
      screen.getByTestId('ontology-concept-conflict-show-on-graph')
    );

    expect(
      await screen.findByTestId('native-ontology-graph')
    ).toBeInTheDocument();
    expect(mockGraphProps).toHaveBeenLastCalledWith(
      expect.objectContaining({ focusNodeId: 'concept-customer' })
    );
  });

  it('clears the badge and the row after the fix when Validate all runs again', async () => {
    (getOntologyWorkingValidation as jest.Mock)
      .mockResolvedValueOnce({
        valid: false,
        violations: [
          {
            code: Code.DisjointClash,
            conceptIds: ['concept-customer', 'concept-party'],
            message: 'Customer is disjoint with its ancestor Party',
            path: '/expressions',
            severity: Severity.Error,
          },
        ],
      })
      .mockResolvedValue({ valid: true, violations: [] });
    render(
      <OntologyGraphView
        ontology={ontology}
        surface="graph"
        onRequestGraphSurface={jest.fn()}
      />
    );
    await screen.findByTestId('ontology-conflict-row');

    fireEvent.click(screen.getByTestId('ontology-validate-all'));

    await waitFor(() =>
      expect(
        screen.queryByTestId('ontology-conflict-row')
      ).not.toBeInTheDocument()
    );

    expect(
      mockGraphProps.mock.calls
        .at(-1)?.[0]
        .nodes.some((node: { hasConflict?: boolean }) => node.hasConflict)
    ).toBe(false);
    expect(getOntologyWorkingValidation).toHaveBeenCalledTimes(2);
  });

  it('attaches an existing property to the concept with one patch instead of declaring it again', async () => {
    const note: OntologyProperty = {
      domain: [party.iri],
      fullyQualifiedName: 'RetailCommerce.note',
      id: 'property-note',
      iri: 'urn:retail:note',
      kind: Kind.Annotation,
      name: 'note',
      ontology: { id: ontology.id, type: 'ontology' },
      version: 0.3,
    };
    mockUseOntologyStudioModel.mockReturnValue({
      ...modelResult,
      model: {
        ...modelResult.model,
        properties: [...modelResult.model.properties, note],
      },
    });
    (patchOntologyProperty as jest.Mock).mockResolvedValue(note);
    render(
      <OntologyGraphView
        isEditing
        ontology={ontology}
        surface="graph"
        onRequestGraphSurface={jest.fn()}
      />
    );
    fireEvent.click(
      await screen.findByTestId('native-graph-node-concept-customer')
    );
    fireEvent.click(screen.getByTestId('ontology-add-property'));
    fireEvent.click(screen.getByTestId('ontology-property-source-existing'));
    const picker = screen.getByRole('combobox', { name: /label.property/ });
    fireEvent.focus(picker);
    fireEvent.keyDown(picker, { key: 'ArrowDown' });
    fireEvent.click(await screen.findByRole('option', { name: /note/ }));
    await act(async () => {
      fireEvent.click(screen.getByTestId('ontology-property-submit'));
    });

    await waitFor(() =>
      expect(patchOntologyProperty).toHaveBeenCalledWith('property-note', [
        { op: 'test', path: '/version', value: 0.3 },
        { op: 'add', path: '/domain/1', value: customer.iri },
      ])
    );

    expect(createOntologyProperty).not.toHaveBeenCalled();
  });

  it('uses the same inspector from the hierarchy tree', () => {
    render(
      <OntologyGraphView
        ontology={ontology}
        surface="tree"
        onRequestGraphSurface={jest.fn()}
      />
    );

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
        onRequestGraphSurface={jest.fn()}
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
        keepCanvasOnAdd: true,
      })
    );
    expect(graphProps.relationTypeGroups).toEqual([
      expect.objectContaining({
        id: 'hierarchy',
        options: [
          expect.objectContaining({ id: SUBCLASS_OF, label: 'Subclass Of' }),
        ],
      }),
      expect.objectContaining({
        id: 'relationships',
        options: [
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
          expect.objectContaining({ id: GOVERNED_BY, label: 'Governed By' }),
          expect.objectContaining({
            id: objectProperty.iri,
            label: 'served by',
          }),
        ],
      }),
    ]);

    await act(() =>
      graphProps.onCreateRelation(orphan.id, party.id, SUBCLASS_OF)
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
        name: 'OrphanIsParty',
        subjectIri: orphan.iri,
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
    expect(onWorkingChange).toHaveBeenCalledTimes(3);

    fireEvent.click(screen.getByTestId('native-graph-node-concept-customer'));
    fireEvent.click(screen.getByTestId('ontology-add-property'));
    fireEvent.change(screen.getByTestId('ontology-property-name'), {
      target: { value: 'customerNumber' },
    });
    fireEvent.click(screen.getByRole('button', { name: /label.range/ }));
    fireEvent.click(
      await screen.findByTestId('ontology-property-type-integer')
    );
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

    expect(onWorkingChange).toHaveBeenCalledTimes(4);

    expect(await screen.findByTestId('concept-save')).toBeVisible();
    expect(
      screen.queryByTestId('ontology-concept-edit')
    ).not.toBeInTheDocument();

    rerender(
      <OntologyGraphView
        isEditing
        createConceptRequestKey={1}
        ontology={ontology}
        surface="graph"
        onRequestGraphSurface={jest.fn()}
      />
    );

    expect(await screen.findByTestId('ontology-new-class-panel')).toBeVisible();
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
    render(
      <OntologyGraphView
        isEditing
        ontology={ontology}
        surface="graph"
        onRequestGraphSurface={jest.fn()}
      />
    );
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

  it('names the relationship delete action in sentence case', async () => {
    useEnUsTranslations();
    render(
      <OntologyGraphView
        isEditing
        ontology={ontology}
        surface="graph"
        onRequestGraphSurface={jest.fn()}
      />
    );
    await screen.findByTestId('native-ontology-graph');
    fireEvent.click(screen.getByTestId('native-graph-node-concept-customer'));
    fireEvent.click(
      await screen.findByTestId('ontology-concept-relation-concept-party')
    );

    expect(
      within(screen.getByTestId('ontology-relation-detail')).getByTestId(
        'ontology-relation-delete'
      )
    ).toHaveTextContent('Delete relationship');
  });

  it('asks for a new relationship type in a sentence-case dialog that the close button dismisses', async () => {
    useEnUsTranslations();
    render(
      <OntologyGraphView
        isEditing
        ontology={ontology}
        surface="graph"
        onRequestGraphSurface={jest.fn()}
      />
    );
    await screen.findByTestId('native-ontology-graph');
    await waitForRegistry();
    act(() => {
      void latestGraphProps().onCreateRelation(
        customer.id,
        orphan.id,
        'new:approved by'
      );
    });

    const dialog = await screen.findByRole('dialog');

    expect(
      within(dialog).getByRole('heading', { name: 'Add relationship type' })
    ).toBeVisible();

    fireEvent.click(within(dialog).getByRole('button', { name: /close/i }));

    await waitFor(() =>
      expect(
        screen.queryByTestId('relationship-type-dialog')
      ).not.toBeInTheDocument()
    );
  });

  it('creates a custom registry type with its inverse from the picker, then instantiates it', async () => {
    (createOntologyAxiom as jest.Mock).mockResolvedValue({});
    (createOntologyProperty as jest.Mock).mockResolvedValue({});
    render(
      <OntologyGraphView
        isEditing
        ontology={ontology}
        surface="graph"
        onRequestGraphSurface={jest.fn()}
      />
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

    await waitFor(() => expect(listRelationshipTypes).toHaveBeenCalledTimes(3));

    expect(
      screen.queryByTestId('relationship-type-dialog')
    ).not.toBeInTheDocument();
  });

  it('reuses a type registered since the list was cached, with its inverse', async () => {
    const approves = relationshipType('approves', 'approves', APPROVES, {
      category: Category.Custom,
      inverse: inverseRef('approvedBy'),
      systemDefined: false,
    });
    const approvedBy = relationshipType(
      'approvedBy',
      'approved by',
      APPROVED_BY,
      {
        category: Category.Custom,
        inverse: inverseRef('approves'),
        systemDefined: false,
      }
    );
    const fresh = [...registryTypes, approves, approvedBy];
    (listRelationshipTypes as jest.Mock)
      .mockResolvedValueOnce({
        data: registryTypes,
        paging: { total: registryTypes.length },
      })
      .mockResolvedValue({ data: fresh, paging: { total: fresh.length } });
    (createRelationshipType as jest.Mock).mockRejectedValue({
      isAxiosError: true,
      response: { status: 409 },
    });
    (getRelationshipTypeByName as jest.Mock).mockResolvedValue(approvedBy);
    (createOntologyAxiom as jest.Mock).mockResolvedValue({});
    (createOntologyProperty as jest.Mock).mockResolvedValue({});
    render(
      <OntologyGraphView
        isEditing
        ontology={ontology}
        surface="graph"
        onRequestGraphSurface={jest.fn()}
      />
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

    expect(createRelationshipType).not.toHaveBeenCalled();
    expect(getRelationshipTypeByName).not.toHaveBeenCalled();
    expect(patchRelationshipType).not.toHaveBeenCalled();
    expect(createOntologyProperty).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        inverse: undefined,
        iri: APPROVES,
        name: 'approves',
      })
    );
    expect(createOntologyProperty).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        inverse: APPROVES,
        iri: APPROVED_BY,
        name: 'approvedBy',
      })
    );
    expect(createOntologyAxiom).toHaveBeenCalledWith(
      expect.objectContaining({
        expressions: [expect.objectContaining({ propertyIri: APPROVED_BY })],
      })
    );
    expect(showErrorToast).not.toHaveBeenCalled();
  });

  it('leaves a registered inverse name and its partner alone when the cached list missed them', async () => {
    const governs = relationshipType('governs', 'governs', GOVERNS, {
      category: Category.Custom,
      inverse: inverseRef('governedBy'),
      systemDefined: false,
    });
    const fresh = [
      ...registryTypes.map((type) =>
        type.name === 'governedBy'
          ? { ...type, inverse: inverseRef('governs') }
          : type
      ),
      governs,
    ];
    (listRelationshipTypes as jest.Mock)
      .mockResolvedValueOnce({
        data: registryTypes,
        paging: { total: registryTypes.length },
      })
      .mockResolvedValue({ data: fresh, paging: { total: fresh.length } });
    const register = (
      createRelationshipType as jest.Mock
    ).getMockImplementation();
    (createRelationshipType as jest.Mock).mockImplementation((request) =>
      request.name === 'governs'
        ? Promise.reject({ isAxiosError: true, response: { status: 409 } })
        : register?.(request)
    );
    (getRelationshipTypeByName as jest.Mock).mockResolvedValue(governs);
    (createOntologyAxiom as jest.Mock).mockResolvedValue({});
    (createOntologyProperty as jest.Mock).mockResolvedValue({});
    render(
      <OntologyGraphView
        isEditing
        ontology={ontology}
        surface="graph"
        onRequestGraphSurface={jest.fn()}
      />
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
    fireEvent.change(screen.getByTestId('relationship-type-inverse'), {
      target: { value: 'governs' },
    });
    await act(async () => {
      fireEvent.click(screen.getByTestId('relationship-type-submit'));
      await creation;
    });

    expect(getRelationshipTypeByName).not.toHaveBeenCalled();
    expect(createRelationshipType).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ displayName: 'governs', name: 'governs2' })
    );
    expect(createRelationshipType).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ inverse: 'governs2', name: 'approvedBy' })
    );
    expect(patchRelationshipType).toHaveBeenCalledTimes(1);
    expect(patchRelationshipType).toHaveBeenCalledWith('type-governs2', [
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
      2,
      expect.objectContaining({
        inverse: GOVERNS_2,
        iri: APPROVED_BY,
        name: 'approvedBy',
      })
    );
    expect(showErrorToast).not.toHaveBeenCalled();
  });

  it('reuses the inverse a failed primary write left behind when the author retries', async () => {
    const stored = keepRegistryWrites();
    const failure = { isAxiosError: true, response: { status: 500 } };
    const register = (
      createRelationshipType as jest.Mock
    ).getMockImplementation();
    (createRelationshipType as jest.Mock)
      .mockImplementationOnce((request) => register?.(request))
      .mockRejectedValueOnce(failure);
    (createOntologyAxiom as jest.Mock).mockResolvedValue({});
    (createOntologyProperty as jest.Mock).mockResolvedValue({});
    render(
      <OntologyGraphView
        isEditing
        ontology={ontology}
        surface="graph"
        onRequestGraphSurface={jest.fn()}
      />
    );
    await screen.findByTestId('native-ontology-graph');
    await waitForRegistry();

    await registerApprovedBy();

    expect(showErrorToast).toHaveBeenCalledWith(failure);

    await registerApprovedBy();

    expect(
      (createRelationshipType as jest.Mock).mock.calls.map(([request]) => [
        request.name,
        request.inverse,
      ])
    ).toEqual([
      ['approves', undefined],
      ['approvedBy', 'approves'],
      ['approvedBy', 'approves'],
    ]);
    expect((patchRelationshipType as jest.Mock).mock.calls).toEqual([
      ['type-approves', backLinkTo('approvedBy')],
    ]);
    expect(registeredPairs(stored)).toEqual([
      ['approves', 'approvedBy'],
      ['approvedBy', 'approves'],
    ]);
    expect(createOntologyProperty).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ inverse: APPROVES, iri: APPROVED_BY })
    );
  });

  it('links the inverse back when the author retries after the back link failed', async () => {
    const stored = keepRegistryWrites();
    const failure = { isAxiosError: true, response: { status: 500 } };
    (patchRelationshipType as jest.Mock).mockRejectedValueOnce(failure);
    (createOntologyAxiom as jest.Mock).mockResolvedValue({});
    (createOntologyProperty as jest.Mock).mockResolvedValue({});
    render(
      <OntologyGraphView
        isEditing
        ontology={ontology}
        surface="graph"
        onRequestGraphSurface={jest.fn()}
      />
    );
    await screen.findByTestId('native-ontology-graph');
    await waitForRegistry();

    await registerApprovedBy();

    expect(showErrorToast).toHaveBeenCalledWith(failure);

    await registerApprovedBy();

    expect((patchRelationshipType as jest.Mock).mock.calls).toEqual([
      ['type-approves', backLinkTo('approvedBy')],
      ['type-approves', backLinkTo('approvedBy')],
    ]);
    expect(
      (createRelationshipType as jest.Mock).mock.calls.map(([request]) => [
        request.name,
        request.inverse,
      ])
    ).toEqual([
      ['approves', undefined],
      ['approvedBy', 'approves'],
    ]);
    expect(registeredPairs(stored)).toEqual([
      ['approves', 'approvedBy'],
      ['approvedBy', 'approves'],
    ]);
    expect(createOntologyAxiom).toHaveBeenCalledTimes(1);
    expect(createOntologyAxiom).toHaveBeenCalledWith(
      expect.objectContaining({
        expressions: [expect.objectContaining({ propertyIri: APPROVED_BY })],
      })
    );
    expect(showErrorToast).toHaveBeenCalledTimes(1);
  });

  it('finishes the earlier pair and gives a relabelled retry its own inverse', async () => {
    const stored = keepRegistryWrites();
    const failure = { isAxiosError: true, response: { status: 500 } };
    (patchRelationshipType as jest.Mock).mockRejectedValueOnce(failure);
    (createOntologyAxiom as jest.Mock).mockResolvedValue({});
    (createOntologyProperty as jest.Mock).mockResolvedValue({});
    render(
      <OntologyGraphView
        isEditing
        ontology={ontology}
        surface="graph"
        onRequestGraphSurface={jest.fn()}
      />
    );
    await screen.findByTestId('native-ontology-graph');
    await waitForRegistry();

    await registerApprovedBy();

    expect(showErrorToast).toHaveBeenCalledWith(failure);

    await registerType('signed off by', 'approves');

    expect(registeredPairs(stored)).toEqual([
      ['approves', 'approvedBy'],
      ['approvedBy', 'approves'],
      ['approves2', 'signedOffBy'],
      ['signedOffBy', 'approves2'],
    ]);
    expect(createOntologyAxiom).toHaveBeenCalledTimes(1);
    expect(createOntologyAxiom).toHaveBeenCalledWith(
      expect.objectContaining({
        expressions: [expect.objectContaining({ propertyIri: SIGNED_OFF_BY })],
      })
    );
    expect(showErrorToast).toHaveBeenCalledTimes(1);
  });

  it('keeps the inverse when the repair fails, so a later retry links it back', async () => {
    const stored = keepRegistryWrites();
    const failure = { isAxiosError: true, response: { status: 500 } };
    const repairFailure = { isAxiosError: true, response: { status: 503 } };
    (patchRelationshipType as jest.Mock)
      .mockRejectedValueOnce(failure)
      .mockRejectedValueOnce(repairFailure);
    (createOntologyAxiom as jest.Mock).mockResolvedValue({});
    (createOntologyProperty as jest.Mock).mockResolvedValue({});
    render(
      <OntologyGraphView
        isEditing
        ontology={ontology}
        surface="graph"
        onRequestGraphSurface={jest.fn()}
      />
    );
    await screen.findByTestId('native-ontology-graph');
    await waitForRegistry();

    await registerApprovedBy();
    await registerApprovedBy();

    expect((showErrorToast as jest.Mock).mock.calls).toEqual([
      [failure],
      [repairFailure],
    ]);
    expect(createOntologyAxiom).not.toHaveBeenCalled();

    await registerApprovedBy();

    expect((patchRelationshipType as jest.Mock).mock.calls).toEqual([
      ['type-approves', backLinkTo('approvedBy')],
      ['type-approves', backLinkTo('approvedBy')],
      ['type-approves', backLinkTo('approvedBy')],
    ]);
    expect(registeredPairs(stored)).toEqual([
      ['approves', 'approvedBy'],
      ['approvedBy', 'approves'],
    ]);
    expect(createRelationshipType).toHaveBeenCalledTimes(2);
    expect(createOntologyAxiom).toHaveBeenCalledTimes(1);
    expect(showErrorToast).toHaveBeenCalledTimes(2);
  });

  it('links the earlier pair back when the retry is drawn as the inverse', async () => {
    const stored = keepRegistryWrites();
    const failure = { isAxiosError: true, response: { status: 500 } };
    (patchRelationshipType as jest.Mock).mockRejectedValueOnce(failure);
    (createOntologyAxiom as jest.Mock).mockResolvedValue({});
    (createOntologyProperty as jest.Mock).mockResolvedValue({});
    render(
      <OntologyGraphView
        isEditing
        ontology={ontology}
        surface="graph"
        onRequestGraphSurface={jest.fn()}
      />
    );
    await screen.findByTestId('native-ontology-graph');
    await waitForRegistry();

    await registerApprovedBy();
    await registerType('approves', 'approved by');

    expect((patchRelationshipType as jest.Mock).mock.calls).toEqual([
      ['type-approves', backLinkTo('approvedBy')],
      ['type-approves', backLinkTo('approvedBy')],
    ]);
    expect(registeredPairs(stored)).toEqual([
      ['approves', 'approvedBy'],
      ['approvedBy', 'approves'],
    ]);
    expect(createRelationshipType).toHaveBeenCalledTimes(2);
    expect(
      (createOntologyProperty as jest.Mock).mock.calls.map(([request]) => [
        request.iri,
        request.inverse,
      ])
    ).toEqual([
      [APPROVED_BY, undefined],
      [APPROVES, APPROVED_BY],
    ]);
    expect(createOntologyAxiom).toHaveBeenCalledTimes(1);
    expect(createOntologyAxiom).toHaveBeenCalledWith(
      expect.objectContaining({
        expressions: [expect.objectContaining({ propertyIri: APPROVES })],
      })
    );
    expect(showErrorToast).toHaveBeenCalledTimes(1);
  });

  it('leaves a one-way pair it did not register as it is', async () => {
    const approves = relationshipType('approves', 'approves', APPROVES, {
      category: Category.Custom,
      systemDefined: false,
    });
    const approvedBy = relationshipType(
      'approvedBy',
      'approved by',
      APPROVED_BY,
      {
        category: Category.Custom,
        inverse: inverseRef('approves'),
        systemDefined: false,
      }
    );
    const fresh = [...registryTypes, approves, approvedBy];
    (listRelationshipTypes as jest.Mock)
      .mockResolvedValueOnce({
        data: registryTypes,
        paging: { total: registryTypes.length },
      })
      .mockResolvedValue({ data: fresh, paging: { total: fresh.length } });
    (createOntologyAxiom as jest.Mock).mockResolvedValue({});
    (createOntologyProperty as jest.Mock).mockResolvedValue({});
    render(
      <OntologyGraphView
        isEditing
        ontology={ontology}
        surface="graph"
        onRequestGraphSurface={jest.fn()}
      />
    );
    await screen.findByTestId('native-ontology-graph');
    await waitForRegistry();

    await registerApprovedBy();

    expect(createOntologyAxiom).toHaveBeenCalledWith(
      expect.objectContaining({
        expressions: [expect.objectContaining({ propertyIri: APPROVED_BY })],
      })
    );
    expect(createRelationshipType).not.toHaveBeenCalled();
    expect(patchRelationshipType).not.toHaveBeenCalled();
  });

  it('leaves an unlinked inverse it did not register as it is', async () => {
    const approves = relationshipType('approves', 'approves', APPROVES, {
      category: Category.Custom,
      systemDefined: false,
    });
    const fresh = [...registryTypes, approves];
    (listRelationshipTypes as jest.Mock).mockResolvedValue({
      data: fresh,
      paging: { total: fresh.length },
    });
    (createOntologyAxiom as jest.Mock).mockResolvedValue({});
    (createOntologyProperty as jest.Mock).mockResolvedValue({});
    render(
      <OntologyGraphView
        isEditing
        ontology={ontology}
        surface="graph"
        onRequestGraphSurface={jest.fn()}
      />
    );
    await screen.findByTestId('native-ontology-graph');
    await waitForRegistry();

    await registerApprovedBy();

    expect(
      (createRelationshipType as jest.Mock).mock.calls.map(([request]) => [
        request.name,
        request.inverse,
      ])
    ).toEqual([
      ['approves2', undefined],
      ['approvedBy', 'approves2'],
    ]);
    expect((patchRelationshipType as jest.Mock).mock.calls).toEqual([
      ['type-approves2', backLinkTo('approvedBy')],
    ]);
  });

  it('reuses a registry type whose label matches the requested new type', async () => {
    (createOntologyAxiom as jest.Mock).mockResolvedValue({});
    (createOntologyProperty as jest.Mock).mockResolvedValue({});
    render(
      <OntologyGraphView
        isEditing
        ontology={ontology}
        surface="graph"
        onRequestGraphSurface={jest.fn()}
      />
    );
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
    render(
      <OntologyGraphView
        isEditing
        ontology={ontology}
        surface="graph"
        onRequestGraphSurface={jest.fn()}
      />
    );
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

  it('registers a single type without an inverse when the user cannot edit relationship types', async () => {
    mockPermissions.relationshipType.EditAll = false;
    (createOntologyAxiom as jest.Mock).mockResolvedValue({});
    (createOntologyProperty as jest.Mock).mockResolvedValue({});
    render(
      <OntologyGraphView
        isEditing
        ontology={ontology}
        surface="graph"
        onRequestGraphSurface={jest.fn()}
      />
    );
    await screen.findByTestId('native-ontology-graph');
    await waitForRegistry();

    expect(latestGraphProps().canCreateRelationType).toBe(true);

    let creation: Promise<void> = Promise.resolve();
    act(() => {
      creation = latestGraphProps().onCreateRelation(
        customer.id,
        orphan.id,
        'new:approved by'
      );
    });

    expect(await screen.findByTestId('relationship-type-dialog')).toBeVisible();
    expect(screen.getByTestId('relationship-type-inverse')).toBeDisabled();
    expect(screen.getByText('message.no-permission-for-action')).toBeVisible();

    fireEvent.change(screen.getByTestId('relationship-type-description'), {
      target: { value: 'Who signs off.' },
    });
    await act(async () => {
      fireEvent.click(screen.getByTestId('relationship-type-submit'));
      await creation;
    });

    expect(createRelationshipType).toHaveBeenCalledTimes(1);
    expect(createRelationshipType).toHaveBeenCalledWith({
      category: 'CUSTOM',
      characteristics: undefined,
      description: 'Who signs off.',
      displayName: 'approved by',
      inverse: undefined,
      name: 'approvedBy',
      paletteKey: 'VIOLET',
      rdfPredicate: 'https://open-metadata.org/ontology/approvedBy',
    });
    expect(patchRelationshipType).not.toHaveBeenCalled();
    expect(createOntologyProperty).toHaveBeenCalledTimes(1);
    expect(createOntologyProperty).toHaveBeenCalledWith(
      expect.objectContaining({
        inverse: undefined,
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
    expect(
      screen.queryByTestId('relationship-type-dialog')
    ).not.toBeInTheDocument();
  });

  it('keeps the symmetric option for a user who cannot edit relationship types', async () => {
    mockPermissions.relationshipType.EditAll = false;
    (createOntologyAxiom as jest.Mock).mockResolvedValue({});
    (createOntologyProperty as jest.Mock).mockResolvedValue({});
    render(
      <OntologyGraphView
        isEditing
        ontology={ontology}
        surface="graph"
        onRequestGraphSurface={jest.fn()}
      />
    );
    await screen.findByTestId('native-ontology-graph');
    await waitForRegistry();

    let creation: Promise<void> = Promise.resolve();
    act(() => {
      creation = latestGraphProps().onCreateRelation(
        customer.id,
        orphan.id,
        'new:sibling of'
      );
    });
    await screen.findByTestId('relationship-type-dialog');
    fireEvent.click(screen.getByRole('checkbox', { name: 'label.symmetric' }));

    expect(
      screen.getByText('message.symmetric-relationship-type')
    ).toBeVisible();
    expect(
      screen.queryByTestId('relationship-type-inverse')
    ).not.toBeInTheDocument();

    await act(async () => {
      fireEvent.click(screen.getByTestId('relationship-type-submit'));
      await creation;
    });

    expect(createRelationshipType).toHaveBeenCalledTimes(1);
    expect(createRelationshipType).toHaveBeenCalledWith({
      category: 'CUSTOM',
      characteristics: ['SYMMETRIC'],
      description: 'sibling of',
      displayName: 'sibling of',
      inverse: undefined,
      name: 'siblingOf',
      paletteKey: 'VIOLET',
      rdfPredicate: 'https://open-metadata.org/ontology/siblingOf',
    });
    expect(patchRelationshipType).not.toHaveBeenCalled();
    expect(createOntologyAxiom).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'CustomerSiblingOfOrphan',
        expressions: [
          expect.objectContaining({
            propertyIri: 'https://open-metadata.org/ontology/siblingOf',
          }),
        ],
      })
    );
  });

  it('writes nothing when the new type dialog is cancelled', async () => {
    render(
      <OntologyGraphView
        isEditing
        ontology={ontology}
        surface="graph"
        onRequestGraphSurface={jest.fn()}
      />
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
      <OntologyGraphView
        isEditing
        ontology={ontology}
        surface="graph"
        onRequestGraphSurface={jest.fn()}
      />
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
      <OntologyGraphView
        isEditing
        ontology={ontology}
        surface="graph"
        onRequestGraphSurface={jest.fn()}
      />
    );
    await act(() =>
      latestGraphProps().onCreateRelation(customer.id, orphan.id, PART_OF)
    );

    expect(createOntologyProperty).toHaveBeenCalledTimes(2);
    expect(createOntologyAxiom).toHaveBeenCalledTimes(2);
    expect(refetch).toHaveBeenCalledTimes(2);
  });

  it('edits the draft wording of a concept the graph draws from the release', async () => {
    (getOntologyConcept as jest.Mock).mockResolvedValue({
      ...customer,
      displayName: 'Customer, draft wording',
    });
    render(
      <OntologyGraphView
        isEditing
        ontology={ontology}
        surface="graph"
        onRequestGraphSurface={jest.fn()}
      />
    );
    fireEvent.click(
      await screen.findByTestId('native-graph-node-concept-customer')
    );

    await waitFor(() =>
      expect(
        screen.getByRole('textbox', { name: 'label.ontology-display-name' })
      ).toHaveValue('Customer, draft wording')
    );
  });

  it('drops in-place edits when the user leaves Edit, so returning starts clean', async () => {
    const { rerender } = render(
      <OntologyGraphView
        isEditing
        ontology={ontology}
        surface="graph"
        onRequestGraphSurface={jest.fn()}
      />
    );
    fireEvent.click(
      await screen.findByTestId('native-graph-node-concept-customer')
    );
    const description = await screen.findByRole('textbox', {
      name: 'label.description',
    });
    fireEvent.change(description, { target: { value: 'Unsaved wording' } });

    expect(await screen.findByTestId('concept-save-status')).toHaveTextContent(
      'label.unsaved-changes'
    );

    rerender(
      <OntologyGraphView
        ontology={ontology}
        surface="graph"
        onRequestGraphSurface={jest.fn()}
      />
    );

    expect(screen.queryByTestId('concept-save-status')).not.toBeInTheDocument();

    rerender(
      <OntologyGraphView
        isEditing
        ontology={ontology}
        surface="graph"
        onRequestGraphSurface={jest.fn()}
      />
    );

    expect(
      await screen.findByRole('textbox', { name: 'label.description' })
    ).not.toHaveValue('Unsaved wording');
    expect(screen.getByTestId('concept-save-status')).toHaveTextContent(
      'label.all-changes-saved'
    );
  });

  it('closes the concept drawer once its edits are saved', async () => {
    (patchOntologyConcept as jest.Mock).mockResolvedValue({
      ...customer,
      description: 'Saved wording',
    });
    render(
      <OntologyGraphView
        isEditing
        ontology={ontology}
        surface="graph"
        onRequestGraphSurface={jest.fn()}
      />
    );
    fireEvent.click(
      await screen.findByTestId('native-graph-node-concept-customer')
    );
    fireEvent.change(
      await screen.findByRole('textbox', { name: 'label.description' }),
      { target: { value: 'Saved wording' } }
    );
    fireEvent.click(screen.getByRole('button', { name: 'label.save' }));

    await waitFor(() =>
      expect(
        screen.queryByTestId('ontology-concept-inspector')
      ).not.toBeInTheDocument()
    );

    expect(patchOntologyConcept).toHaveBeenCalledTimes(1);
  });

  it('says the working copy failed to load instead of leaving Edit read-only without a reason', async () => {
    (getOntologyConcept as jest.Mock).mockRejectedValue(new Error('boom'));
    render(
      <OntologyGraphView
        isEditing
        ontology={ontology}
        surface="graph"
        onRequestGraphSurface={jest.fn()}
      />
    );
    await screen.findByTestId('native-ontology-graph');
    await waitForRegistry();
    fireEvent.click(screen.getByTestId('native-graph-node-concept-customer'));

    expect(
      await screen.findByTestId('ontology-concept-editor-error')
    ).toHaveTextContent('server.unexpected-error');
    expect(
      screen.queryByRole('textbox', { name: 'label.description' })
    ).not.toBeInTheDocument();
  });

  it('keeps unsaved field edits when a relation is added from the same panel', async () => {
    (createOntologyAxiom as jest.Mock).mockResolvedValue({});
    (getOntologyConcept as jest.Mock).mockResolvedValue(customer);
    render(
      <OntologyGraphView
        isEditing
        ontology={ontology}
        surface="graph"
        onRequestGraphSurface={jest.fn()}
      />
    );
    await screen.findByTestId('native-ontology-graph');
    await waitForRegistry();
    fireEvent.click(screen.getByTestId('native-graph-node-concept-customer'));
    fireEvent.change(
      await screen.findByRole('textbox', { name: 'label.description' }),
      { target: { value: 'Unsaved wording' } }
    );
    let refetched!: (value: unknown) => void;
    (getOntologyConcept as jest.Mock).mockReturnValue(
      new Promise((resolve) => {
        refetched = resolve;
      })
    );

    await act(() =>
      latestGraphProps().onCreateRelation(customer.id, orphan.id, SUBCLASS_OF)
    );

    expect(createOntologyAxiom).toHaveBeenCalled();
    expect(
      screen.getByRole('textbox', { name: 'label.description' })
    ).toHaveValue('Unsaved wording');

    await act(async () => refetched(customer));

    expect(
      screen.getByRole('textbox', { name: 'label.description' })
    ).toHaveValue('Unsaved wording');
    expect(screen.getByTestId('concept-save-status')).toHaveTextContent(
      'label.unsaved-changes'
    );
  });

  it('starts a blank concept after editing an existing concept and hides the editor in View', async () => {
    const { rerender } = render(
      <OntologyGraphView
        isEditing
        ontology={ontology}
        surface="graph"
        onRequestGraphSurface={jest.fn()}
      />
    );
    fireEvent.click(
      await screen.findByTestId('native-graph-node-concept-customer')
    );
    await screen.findByTestId('concept-save');
    fireEvent.click(screen.getByTestId('ontology-concept-advanced-toggle'));

    expect(
      await screen.findByTestId('ontology-concept-name')
    ).toHaveTextContent('Customer');

    rerender(
      <OntologyGraphView
        isEditing
        createConceptRequestKey={1}
        ontology={ontology}
        surface="graph"
        onRequestGraphSurface={jest.fn()}
      />
    );

    expect(screen.getByTestId('new-class-label')).toHaveValue('');

    rerender(
      <OntologyGraphView
        createConceptRequestKey={1}
        ontology={ontology}
        surface="graph"
        onRequestGraphSurface={jest.fn()}
      />
    );

    expect(
      screen.queryByTestId('ontology-concept-editor')
    ).not.toBeInTheDocument();
  });

  it('shows an incoming relationship badge first, read backwards', async () => {
    render(
      <OntologyGraphView
        ontology={ontology}
        surface="graph"
        onRequestGraphSurface={jest.fn()}
      />
    );
    fireEvent.click(
      await screen.findByTestId('native-graph-node-concept-party')
    );

    expect(
      screen.getByTestId('ontology-concept-relationships')
    ).toHaveTextContent('is aCustomer');
    expect(screen.getByTestId('ontology-concept-relation-row')).toHaveAttribute(
      'data-direction',
      'backward'
    );
  });

  it('hides writes when the corresponding definition permission is denied', async () => {
    mockPermissions.ontologyProperty.Create = false;
    mockPermissions.ontologyAxiom.Create = false;
    mockCanEditConcept = false;
    render(
      <OntologyGraphView
        isEditing
        ontology={ontology}
        surface="graph"
        onRequestGraphSurface={jest.fn()}
      />
    );
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

  describe('keyboard route and large ontologies', () => {
    const renderGraph = (
      props: Partial<React.ComponentProps<typeof OntologyGraphView>> = {}
    ) =>
      render(
        <OntologyGraphView
          ontology={ontology}
          surface="graph"
          onRequestGraphSurface={jest.fn()}
          {...props}
        />
      );
    const findBox = () => screen.getByTestId('ontology-graph-search');

    it('lists matches under Find and opens the first one with Enter', async () => {
      renderGraph();
      await screen.findByTestId('native-ontology-graph');

      fireEvent.change(findBox(), { target: { value: 'cust' } });

      const results = screen.getByTestId('ontology-graph-search-results');

      expect(
        within(results)
          .getAllByRole('option')
          .map((option) => option.textContent)
      ).toEqual(['Customer']);

      fireEvent.keyDown(findBox(), { key: 'Enter' });

      expect(
        await screen.findByTestId('ontology-concept-inspector')
      ).toHaveTextContent('Customer');
      expect(
        screen.queryByTestId('ontology-graph-search-results')
      ).not.toBeInTheDocument();
    });

    it('says when nothing matches and leaves Enter without effect', async () => {
      renderGraph();
      await screen.findByTestId('native-ontology-graph');

      fireEvent.change(findBox(), { target: { value: 'zzz' } });
      fireEvent.keyDown(findBox(), { key: 'Enter' });

      expect(
        screen.getByTestId('ontology-graph-search-results')
      ).toHaveTextContent('message.ontology-find-no-match');
      expect(
        screen.queryByTestId('ontology-concept-inspector')
      ).not.toBeInTheDocument();
    });

    it('moves through the results with the arrow keys before Enter', async () => {
      renderGraph();
      await screen.findByTestId('native-ontology-graph');

      fireEvent.change(findBox(), { target: { value: 'r' } });
      fireEvent.keyDown(findBox(), { key: 'ArrowDown' });
      fireEvent.keyDown(findBox(), { key: 'Enter' });

      expect(
        await screen.findByTestId('ontology-concept-inspector')
      ).toHaveTextContent('Orphan');
    });

    it('closes the panel on Escape and puts focus back on the Find box', async () => {
      renderGraph();
      await screen.findByTestId('native-ontology-graph');
      findBox().focus();
      fireEvent.change(findBox(), { target: { value: 'cust' } });
      fireEvent.keyDown(findBox(), { key: 'Enter' });
      const inspector = await screen.findByTestId('ontology-concept-inspector');
      within(inspector).getAllByRole('button')[0].focus();

      fireEvent.keyDown(document.activeElement as HTMLElement, {
        key: 'Escape',
      });

      await waitFor(() =>
        expect(
          screen.queryByTestId('ontology-concept-inspector')
        ).not.toBeInTheDocument()
      );

      expect(findBox()).toHaveFocus();
    });

    it('clears the search on Escape while its result list is open', async () => {
      renderGraph();
      await screen.findByTestId('native-ontology-graph');
      findBox().focus();
      fireEvent.change(findBox(), { target: { value: 'cust' } });

      fireEvent.keyDown(findBox(), { key: 'Escape' });

      expect(findBox()).toHaveValue('');
      expect(
        screen.queryByTestId('ontology-graph-search-results')
      ).not.toBeInTheDocument();
    });

    it('opens a concept from the node list with the keyboard and returns focus to it on Escape', async () => {
      renderGraph();
      await screen.findByTestId('native-ontology-graph');
      const list = within(
        screen.getByTestId('ontology-graph-node-list')
      ).getByRole('listbox');

      expect(list).toHaveAttribute('tabindex', '0');

      act(() => list.focus());

      expect(
        within(list)
          .getAllByRole('option')
          .map((option) => option.textContent)
      ).toEqual(['Customer', 'Orphan', 'Party']);

      fireEvent.keyDown(list, { key: 'ArrowDown' });
      fireEvent.keyDown(list, { key: 'Enter' });

      expect(
        await screen.findByTestId('ontology-concept-inspector')
      ).toHaveTextContent('Orphan');

      fireEvent.keyDown(list, { key: 'Escape' });

      await waitFor(() =>
        expect(
          screen.queryByTestId('ontology-concept-inspector')
        ).not.toBeInTheDocument()
      );

      expect(list).toHaveFocus();
    });

    describe('above the node limit', () => {
      const filler = Array.from({ length: 600 }, (_, index) => ({
        id: `filler-${index}`,
        label: `Filler ${index}`,
        type: 'ontologyConcept',
      }));
      const bigGraph = {
        nodes: [...graph.nodes, ...filler],
        edges: [
          ...graph.edges,
          ...filler.slice(1).map((node, index) => ({
            from: node.id,
            to: filler[index].id,
            label: 'is a',
            relationType: 'subClassOf',
          })),
        ],
      };

      beforeEach(() => {
        mockUseOntologyStudioModel.mockReturnValue({
          ...modelResult,
          graph: bigGraph,
        });
      });

      it('draws no canvas and offers a concept picker until a concept is chosen', async () => {
        renderGraph();

        const state = await screen.findByTestId('ontology-graph-too-large');

        expect(state).toHaveTextContent('message.ontology-graph-too-large');
        expect(within(state).getByTestId('empty-placeholder')).toBeVisible();

        const cubePath = render(<Cube01 />)
          .container.querySelector('path')
          ?.getAttribute('d');

        expect(
          within(state).getByTestId('empty-placeholder').querySelector('path')
        ).toHaveAttribute('d', cubePath);
        expect(screen.queryByTestId('native-ontology-graph')).toBeNull();
        expect(
          screen.queryByTestId('ontology-graph-focused-notice')
        ).toBeNull();

        fireEvent.click(screen.getByTestId('ontology-graph-concept-picker'));
        fireEvent.change(
          await screen.findByTestId('ontology-graph-concept-picker-search'),
          { target: { value: 'Filler 300' } }
        );
        fireEvent.click(
          screen.getByTestId('ontology-graph-concept-option-filler-300')
        );

        await screen.findByTestId('native-ontology-graph');

        expect(
          latestGraphProps().nodes.map(({ label }: { label: string }) => label)
        ).toEqual(expect.arrayContaining(['Filler 300', 'Filler 299']));
        expect(
          screen.queryByTestId('ontology-graph-too-large')
        ).not.toBeInTheDocument();
      });

      const pickFiller = async (label: string, id: string) => {
        fireEvent.click(
          await screen.findByTestId('ontology-graph-concept-picker')
        );
        fireEvent.change(
          await screen.findByTestId('ontology-graph-concept-picker-search'),
          { target: { value: label } }
        );
        fireEvent.click(
          screen.getByTestId(`ontology-graph-concept-option-${id}`)
        );
        await screen.findByTestId('native-ontology-graph');
      };
      const drawnLabels = () =>
        latestGraphProps().nodes.map(({ label }: { label: string }) => label);

      it('keeps the picked neighbourhood drawn after the selection is cleared', async () => {
        const onSelectedConceptChange = jest.fn();
        const { rerender } = renderGraph({
          selectedConceptId: undefined,
          onSelectedConceptChange,
        });
        fireEvent.click(
          await screen.findByTestId('ontology-graph-concept-picker')
        );
        fireEvent.change(
          await screen.findByTestId('ontology-graph-concept-picker-search'),
          { target: { value: 'Filler 300' } }
        );
        fireEvent.click(
          screen.getByTestId('ontology-graph-concept-option-filler-300')
        );

        // Picking only loads the graph; the drawer waits for a node click.
        expect(onSelectedConceptChange).not.toHaveBeenCalled();

        const view = (selectedConceptId?: string) => (
          <OntologyGraphView
            ontology={ontology}
            selectedConceptId={selectedConceptId}
            surface="graph"
            onRequestGraphSurface={jest.fn()}
            onSelectedConceptChange={onSelectedConceptChange}
          />
        );
        rerender(view('filler-300'));
        await screen.findByTestId('native-ontology-graph');
        // The drawer closing clears the selection.
        rerender(view(undefined));

        expect(screen.getByTestId('native-ontology-graph')).toBeInTheDocument();
        expect(drawnLabels()).toContain('Filler 300');
        expect(
          screen.queryByTestId('ontology-graph-too-large')
        ).not.toBeInTheDocument();
        expect(
          screen.getByTestId('ontology-graph-concept-picker')
        ).toHaveTextContent('Filler 300');
      });

      it('does not recentre when a drawn concept is clicked, and clears back to the picker', async () => {
        renderGraph();
        await pickFiller('Filler 300', 'filler-300');
        const before = drawnLabels();

        fireEvent.click(screen.getByTestId('native-graph-node-filler-301'));

        expect(drawnLabels()).toEqual(before);

        fireEvent.click(screen.getByTestId('ontology-graph-clear-focus'));

        expect(
          await screen.findByTestId('ontology-graph-too-large')
        ).toBeInTheDocument();
      });

      it('pages the picker list and narrows it by search', async () => {
        useEnUsTranslations();
        renderGraph();
        fireEvent.click(
          await screen.findByTestId('ontology-graph-concept-picker')
        );

        const options = () =>
          within(
            screen.getByRole('listbox', { name: 'Concepts' })
          ).getAllByRole('option');

        const more = () =>
          screen.getByTestId('ontology-graph-concept-picker-more');

        expect(options()).toHaveLength(20);

        const total = more().textContent?.match(/^Show More 20\/(\d+)$/)?.[1];

        expect(Number(total)).toBeGreaterThan(40);

        fireEvent.click(more());

        expect(options()).toHaveLength(40);
        expect(more()).toHaveTextContent(`Show More 40/${total}`);

        fireEvent.change(
          screen.getByTestId('ontology-graph-concept-picker-search'),
          { target: { value: 'Filler 59' } }
        );

        expect(options().map((option) => option.textContent)).toEqual([
          'Filler 59',
          'Filler 590',
          'Filler 591',
          'Filler 592',
          'Filler 593',
          'Filler 594',
          'Filler 595',
          'Filler 596',
          'Filler 597',
          'Filler 598',
          'Filler 599',
        ]);
      });

      it('draws the neighbourhood of a concept found with Find', async () => {
        renderGraph();
        await screen.findByTestId('ontology-graph-too-large');

        fireEvent.change(findBox(), { target: { value: 'Filler 300' } });
        fireEvent.keyDown(findBox(), { key: 'Enter' });

        await screen.findByTestId('native-ontology-graph');
        const drawn = latestGraphProps().nodes.map(
          ({ label }: { label: string }) => label
        );

        expect(drawn).toEqual(
          expect.arrayContaining([
            'Filler 300',
            'Filler 299',
            'Filler 301',
            'Filler 298',
            'Filler 302',
          ])
        );
        expect(drawn).not.toContain('Filler 10');
        expect(drawn.length).toBeLessThan(10);
        expect(
          screen.getByTestId('ontology-graph-focused-notice')
        ).toHaveTextContent('message.ontology-graph-focused');
      });

      it('lists only the drawn concepts in the keyboard node list', async () => {
        renderGraph({
          selectedConceptId: 'filler-5',
          onSelectedConceptChange: jest.fn(),
        });

        await screen.findByTestId('native-ontology-graph');
        const list = within(
          screen.getByTestId('ontology-graph-node-list')
        ).getByRole('listbox');

        expect(list).toHaveAttribute('aria-label', 'label.concept-plural (5)');
      });
    });
  });

  it('offers a user who cannot create properties only the relations an axiom completes', async () => {
    mockPermissions.ontologyProperty.Create = false;
    (createOntologyAxiom as jest.Mock).mockResolvedValue({});
    mockUseOntologyStudioModel.mockReturnValue({
      ...modelResult,
      model: {
        ...model,
        properties: [...model.properties, hasPartProperty, partOfProperty],
      },
    });
    render(
      <OntologyGraphView
        isEditing
        ontology={ontology}
        surface="graph"
        onRequestGraphSurface={jest.fn()}
      />
    );
    await screen.findByTestId('native-ontology-graph');
    await waitForRegistry();
    fireEvent.click(screen.getByTestId('native-graph-node-concept-customer'));
    fireEvent.click(screen.getByTestId('ontology-add-relationship'));
    await openRelationTypes();

    expect(
      screen.getByTestId(`relation-type-${SUBCLASS_OF}`)
    ).toBeInTheDocument();
    expect(screen.getByTestId(`relation-type-${PART_OF}`)).toBeInTheDocument();
    expect(
      screen.queryByTestId(`relation-type-${GOVERNED_BY}`)
    ).not.toBeInTheDocument();

    await act(() =>
      latestGraphProps().onCreateRelation(customer.id, orphan.id, GOVERNED_BY)
    );

    expect(showErrorToast).toHaveBeenCalledWith(
      'message.no-permission-for-action'
    );
    expect(createOntologyProperty).not.toHaveBeenCalled();
    expect(createOntologyAxiom).not.toHaveBeenCalled();

    await act(() =>
      latestGraphProps().onCreateRelation(customer.id, orphan.id, PART_OF)
    );

    expect(createOntologyAxiom).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'CustomerPartOfOrphan',
        expressions: [expect.objectContaining({ propertyIri: PART_OF })],
      })
    );
  });

  it('offers a reused pair from the side whose inverse the user can edit', async () => {
    mockUneditableProperties = ['RetailCommerce.partOf'];
    (patchOntologyProperty as jest.Mock).mockResolvedValue(hasPartProperty);
    (createOntologyAxiom as jest.Mock).mockResolvedValue({});
    mockUseOntologyStudioModel.mockReturnValue({
      ...modelResult,
      model: {
        ...model,
        properties: [
          { ...partOfProperty, inverse: undefined },
          { ...hasPartProperty, inverse: undefined },
        ],
      },
    });
    render(
      <OntologyGraphView
        isEditing
        ontology={ontology}
        surface="graph"
        onRequestGraphSurface={jest.fn()}
      />
    );
    await screen.findByTestId('native-ontology-graph');
    await waitForRegistry(HAS_PART);
    fireEvent.click(screen.getByTestId('native-graph-node-concept-customer'));
    fireEvent.click(screen.getByTestId('ontology-add-relationship'));
    await openRelationTypes();

    expect(screen.getByTestId(`relation-type-${HAS_PART}`)).toBeInTheDocument();
    expect(
      screen.queryByTestId(`relation-type-${PART_OF}`)
    ).not.toBeInTheDocument();

    await act(() =>
      latestGraphProps().onCreateRelation(customer.id, orphan.id, PART_OF)
    );

    expect(showErrorToast).toHaveBeenCalledWith(
      'message.no-permission-for-action'
    );
    expect(patchOntologyProperty).not.toHaveBeenCalled();
    expect(createOntologyAxiom).not.toHaveBeenCalled();

    await act(() =>
      latestGraphProps().onCreateRelation(customer.id, orphan.id, HAS_PART)
    );

    expect(patchOntologyProperty).toHaveBeenCalledWith('property-hasPart', [
      { op: 'add', path: '/inverse', value: PART_OF },
    ]);
    expect(createOntologyAxiom).toHaveBeenCalledWith(
      expect.objectContaining({
        expressions: [expect.objectContaining({ propertyIri: HAS_PART })],
      })
    );
  });

  it('keeps the inspector open and reports a failed authoring write', async () => {
    (createOntologyProperty as jest.Mock).mockRejectedValue(
      new Error('write failed')
    );
    render(
      <OntologyGraphView
        isEditing
        ontology={ontology}
        surface="graph"
        onRequestGraphSurface={jest.fn()}
      />
    );

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

  it('does not replay an add-concept request the page marked handled after the graph remounts', async () => {
    const Page = ({ remountKey }: { remountKey: string }) => {
      const [handled, setHandled] = useState(false);

      return (
        <OntologyGraphView
          isEditing
          createConceptRequestKey={handled ? 0 : 4}
          key={remountKey}
          ontology={ontology}
          surface="graph"
          onCreateConceptRequestHandled={() => setHandled(true)}
          onRequestGraphSurface={jest.fn()}
        />
      );
    };
    const view = render(<Page remountKey="first" />);

    expect(await screen.findByTestId('ontology-new-class-panel')).toBeVisible();

    view.rerender(<Page remountKey="second" />);
    await screen.findByTestId('native-ontology-graph');

    expect(
      screen.queryByTestId('ontology-new-class-panel')
    ).not.toBeInTheDocument();
  });

  it('opens the New class panel for a pending add-concept request when the graph mounts after it was made', async () => {
    render(
      <OntologyGraphView
        isEditing
        createConceptRequestKey={4}
        ontology={ontology}
        surface="graph"
        onRequestGraphSurface={jest.fn()}
      />
    );

    expect(await screen.findByTestId('ontology-new-class-panel')).toBeVisible();
  });

  it('keeps a pending class attempt mounted when another canvas node is selected', async () => {
    let rejectPreparation: (reason: Error) => void = (_reason: Error) =>
      undefined;
    (getOntologyState as jest.Mock).mockReturnValue(
      new Promise((_, reject) => {
        rejectPreparation = reject;
      })
    );
    const view = (key: number) => (
      <MemoryRouter>
        <OntologyDraftProvider>
          <OntologyGraphView
            isEditing
            createConceptRequestKey={key}
            ontology={ontology}
            surface="graph"
            onRequestGraphSurface={jest.fn()}
          />
        </OntologyDraftProvider>
      </MemoryRouter>
    );
    const { rerender } = render(view(0));
    rerender(view(1));
    fireEvent.change(await screen.findByTestId('new-class-label'), {
      target: { value: 'Funds Transfer' },
    });
    fireEvent.click(screen.getByTestId('new-class-create'));
    await waitFor(() =>
      expect(screen.getByTestId('ontology-new-class-close')).toBeDisabled()
    );
    fireEvent.click(screen.getByTestId(`native-graph-node-${customer.id}`));

    expect(
      screen.getByRole('button', { name: 'label.discard' })
    ).toBeDisabled();
    expect(screen.getByTestId('ontology-new-class-panel')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'label.cancel' }));
    await act(async () => rejectPreparation(new Error('Preparation failed')));
    await waitFor(() =>
      expect(screen.getByTestId('ontology-new-class-close')).toBeEnabled()
    );
  });

  it('closes the New class panel and releases the page after an applied class the canvas cannot place', async () => {
    const created = concept('FundsTransfer');
    const refreshed = { ...model, concepts: [...model.concepts, created] };
    const refetch = jest.fn().mockResolvedValue({ data: refreshed });
    mockUseOntologyStudioModel.mockReturnValue({ ...modelResult, refetch });
    mockGraphControls.getNodePositions.mockReturnValue({});
    (getOntologyState as jest.Mock).mockResolvedValue({ workingRevision: 3 });
    (acquireOntologyEditLock as jest.Mock).mockResolvedValue({
      sessionId: 'lease',
      version: 1,
    });
    (releaseOntologyEditLock as jest.Mock).mockResolvedValue(undefined);
    let draft: Record<string, unknown> = {};
    (createOntologyChangeSet as jest.Mock).mockImplementation(
      async (plan: Record<string, unknown>) => {
        draft = {
          ...plan,
          id: 'draft',
          ontology: { fullyQualifiedName: plan.ontology },
          undoCursor: (plan.operations as unknown[]).length,
        };

        return { ...draft, state: 'DRAFT' };
      }
    );
    (getOntologyChangeSet as jest.Mock).mockImplementation(async () => ({
      ...draft,
      state: 'DRAFT',
    }));
    (applyOntologyChangeSet as jest.Mock).mockImplementation(async () => ({
      ...draft,
      state: 'APPLIED',
    }));
    const onAuthoringLockChange = jest.fn();
    const props = {
      isEditing: true,
      ontology,
      onAuthoringLockChange,
      onRequestGraphSurface: jest.fn(),
      surface: 'graph' as const,
    };
    const { rerender } = render(<OntologyGraphView {...props} />);
    await screen.findByTestId('native-ontology-graph');
    rerender(<OntologyGraphView {...props} createConceptRequestKey={1} />);
    fireEvent.change(await screen.findByTestId('new-class-label'), {
      target: { value: 'Funds Transfer' },
    });
    await act(async () => {
      fireEvent.click(screen.getByTestId('new-class-create'));
    });

    await waitFor(() =>
      expect(
        screen.queryByTestId('ontology-new-class-panel')
      ).not.toBeInTheDocument()
    );

    expect(onAuthoringLockChange).toHaveBeenLastCalledWith(false);
    expect(latestGraphProps().focusNodeId).toBe(created.id);
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
    render(
      <OntologyGraphView
        ontology={ontology}
        surface="graph"
        onRequestGraphSurface={jest.fn()}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'label.retry' }));

    expect(refetch).toHaveBeenCalled();
    expect(
      screen.queryByTestId('native-ontology-graph')
    ).not.toBeInTheDocument();
  });

  it('controls the model viewport and switches to Data without losing the concept', async () => {
    (getNativeOntologyDataGraphPage as jest.Mock).mockResolvedValue(
      pageFixture({
        clusters: [
          {
            id: 'concept-customer',
            name: 'Customer',
            count: 6,
            after: 'cursor',
            assets: [1, 2, 3, 4].map((n) => ({
              id: `t${n}`,
              name: `table_${n}`,
            })),
          },
        ],
      })
    );
    render(
      <MemoryRouter>
        <OntologyGraphView
          ontology={ontology}
          surface="graph"
          onRequestGraphSurface={jest.fn()}
        />
      </MemoryRouter>
    );
    await screen.findByTestId('native-ontology-graph');
    fireEvent.click(screen.getByTestId('fit-view'));
    fireEvent.click(screen.getByTestId('zoom-in'));
    fireEvent.click(screen.getByTestId('zoom-out'));
    fireEvent.click(screen.getByTestId('refresh'));

    expect(mockGraphControls.fitView).toHaveBeenCalled();
    expect(mockGraphControls.zoomIn).toHaveBeenCalled();
    expect(mockGraphControls.zoomOut).toHaveBeenCalled();
    expect(modelResult.refetch).toHaveBeenCalled();

    fireEvent.click(screen.getByTestId('native-graph-node-concept-customer'));
    fireEvent.click(screen.getByTestId('ontology-graph-mode-data'));

    expect(screen.getByTestId('ontology-native-data-graph')).toBeVisible();
    expect(screen.getByTestId('ontology-concept-inspector')).toHaveTextContent(
      'Customer'
    );
    expect(
      await screen.findByTestId('ontology-data-cluster-concept-customer')
    ).toBeVisible();

    fireEvent.click(screen.getByTestId('ontology-graph-mode-model'));

    expect(screen.getByTestId('ontology-graph-mode-model')).toHaveAttribute(
      'aria-pressed',
      'true'
    );
    expect(screen.getByTestId('native-ontology-graph')).toBeVisible();
    expect(screen.getByTestId('ontology-native-data-graph')).not.toBeVisible();

    fireEvent.click(screen.getByTestId('ontology-graph-mode-data'));

    expect(screen.getByTestId('ontology-native-data-graph')).toBeVisible();
    expect(
      screen.getByTestId('ontology-data-cluster-concept-customer')
    ).toBeVisible();
    expect(getNativeOntologyDataGraphPage).toHaveBeenCalledTimes(1);
  });

  it('keeps Link data in Data after the drawer closes, and reopens the concept in Edit to link', async () => {
    (getNativeOntologyDataGraphPage as jest.Mock).mockResolvedValue(
      pageFixture({ clusters: [] })
    );
    const onRequestEdit = jest.fn();
    const StudioSelection = () => {
      const [conceptId, setConceptId] = useState<string>();

      return (
        <OntologyGraphView
          ontology={ontology}
          selectedConceptId={conceptId}
          surface="graph"
          onRequestEdit={onRequestEdit}
          onRequestGraphSurface={jest.fn()}
          onSelectedConceptChange={setConceptId}
        />
      );
    };
    render(
      <MemoryRouter>
        <StudioSelection />
      </MemoryRouter>
    );
    await screen.findByTestId('native-ontology-graph');
    fireEvent.click(screen.getByTestId('native-graph-node-concept-customer'));
    fireEvent.click(screen.getByTestId('ontology-graph-mode-data'));
    await screen.findByTestId('ontology-data-link-asset');

    fireEvent.click(screen.getByTestId('ontology-concept-close'));

    await waitFor(() =>
      expect(
        screen.queryByTestId('ontology-concept-inspector')
      ).not.toBeInTheDocument()
    );

    fireEvent.click(screen.getByTestId('ontology-data-link-asset'));

    expect(onRequestEdit).toHaveBeenCalledWith('concept-customer');
    expect(
      await screen.findByTestId('ontology-concept-inspector')
    ).toBeVisible();
  });

  it('floats the conflicts and health cards over the canvas so the graph keeps its width', async () => {
    (getOntologyWorkingValidation as jest.Mock).mockResolvedValue({
      valid: false,
      violations: [
        {
          code: Code.DisjointClash,
          conceptIds: ['concept-customer', 'concept-party'],
          message: 'Customer is disjoint with its ancestor Party',
          path: '/expressions',
          severity: Severity.Error,
        },
      ],
    });
    render(
      <MemoryRouter>
        <OntologyGraphView
          ontology={ontology}
          surface="graph"
          onRequestGraphSurface={jest.fn()}
        />
      </MemoryRouter>
    );
    await screen.findByTestId('native-ontology-graph');

    expect(
      screen.queryByTestId('ontology-graph-sidebar')
    ).not.toBeInTheDocument();
    expect(await screen.findByTestId('ontology-conflicts-panel')).toHaveClass(
      'tw:absolute'
    );
    expect(screen.getByTestId('ontology-health-panel')).toHaveClass(
      'tw:absolute'
    );
  });

  it('shows no conflicts card while validation is still running', async () => {
    (getOntologyWorkingValidation as jest.Mock).mockReturnValue(
      new Promise(() => undefined)
    );
    render(
      <MemoryRouter>
        <OntologyGraphView
          ontology={ontology}
          surface="graph"
          onRequestGraphSurface={jest.fn()}
        />
      </MemoryRouter>
    );
    await screen.findByTestId('native-ontology-graph');

    expect(
      screen.queryByTestId('ontology-conflicts-panel')
    ).not.toBeInTheDocument();
  });

  it('shows no conflicts card once validation finds nothing to resolve', async () => {
    render(
      <MemoryRouter>
        <OntologyGraphView
          ontology={ontology}
          surface="graph"
          onRequestGraphSurface={jest.fn()}
        />
      </MemoryRouter>
    );
    await screen.findByTestId('native-ontology-graph');
    await waitFor(() =>
      expect(getOntologyWorkingValidation).toHaveBeenCalled()
    );

    expect(
      screen.queryByTestId('ontology-conflicts-panel')
    ).not.toBeInTheDocument();
    expect(screen.getByTestId('ontology-health-panel')).toBeInTheDocument();
  });

  it('asks to delete a concept in a page modal rather than inside its panel', async () => {
    mockCanDeleteConcept = true;
    render(
      <MemoryRouter>
        <OntologyGraphView
          isEditing
          ontology={ontology}
          surface="graph"
          onRequestGraphSurface={jest.fn()}
        />
      </MemoryRouter>
    );
    await screen.findByTestId('native-ontology-graph');
    await waitForRegistry();
    fireEvent.click(screen.getByTestId('native-graph-node-concept-customer'));
    const inspector = await screen.findByTestId('ontology-concept-inspector');
    fireEvent.click(within(inspector).getByTestId('ontology-concept-more'));
    fireEvent.click(await screen.findByTestId('ontology-concept-delete'));

    expect(inspector).not.toContainElement(
      await screen.findByTestId('ontology-concept-delete-dialog')
    );
  });

  it('titles a failed validation as an error instead of zero conflicts', async () => {
    (getOntologyWorkingValidation as jest.Mock).mockRejectedValue(
      new Error('boom')
    );
    render(
      <MemoryRouter>
        <OntologyGraphView
          ontology={ontology}
          surface="graph"
          onRequestGraphSurface={jest.fn()}
        />
      </MemoryRouter>
    );

    const title = await screen.findByTestId('ontology-conflicts-title');
    await waitFor(() =>
      expect(title).toHaveTextContent('message.ontology-conflicts-check-failed')
    );

    expect(title).not.toHaveTextContent('label.n-conflicts-to-resolve');
  });

  it('marks each conflicting concept row on the Tree surface instead of a conflicts block', async () => {
    (getOntologyWorkingValidation as jest.Mock).mockResolvedValue({
      valid: false,
      violations: [
        {
          code: Code.DisjointClash,
          conceptIds: ['concept-customer', 'concept-party'],
          message: 'Customer is disjoint with its ancestor Party',
          path: '/expressions',
          severity: Severity.Error,
        },
      ],
    });
    render(
      <MemoryRouter>
        <OntologyGraphView
          ontology={ontology}
          surface="tree"
          onRequestGraphSurface={jest.fn()}
        />
      </MemoryRouter>
    );

    const customerRow = await screen.findByTestId(
      'ontology-tree-term-concept-customer'
    );
    await waitFor(() =>
      expect(
        within(customerRow).getByTestId('ontology-tree-conflict')
      ).toHaveTextContent('Customer is disjoint with its ancestor Party')
    );

    expect(
      within(customerRow).getByTestId('ontology-tree-conflict-dot')
    ).toHaveClass('tw:bg-fg-error-primary');
    expect(
      screen.queryByTestId('ontology-tree-conflicts')
    ).not.toBeInTheDocument();
    expect(
      screen.queryByTestId('ontology-conflicts-panel')
    ).not.toBeInTheDocument();
    expect(screen.getByTestId('ontology-health-panel')).toBeInTheDocument();
  });

  it('shows a retry strip in the tree card when the conflict check fails', async () => {
    (getOntologyWorkingValidation as jest.Mock).mockRejectedValue(
      new Error('boom')
    );
    render(
      <MemoryRouter>
        <OntologyGraphView
          ontology={ontology}
          surface="tree"
          onRequestGraphSurface={jest.fn()}
        />
      </MemoryRouter>
    );

    expect(
      await screen.findByTestId('ontology-tree-conflicts')
    ).toHaveTextContent('message.ontology-conflicts-check-failed');
    expect(
      screen.queryByTestId('ontology-tree-conflict')
    ).not.toBeInTheDocument();
  });

  it('shows no conflict rows in the tree card for a clean draft', async () => {
    render(
      <MemoryRouter>
        <OntologyGraphView
          ontology={ontology}
          surface="tree"
          onRequestGraphSurface={jest.fn()}
        />
      </MemoryRouter>
    );
    await waitFor(() =>
      expect(getOntologyWorkingValidation).toHaveBeenCalled()
    );

    expect(
      screen.queryByTestId('ontology-tree-conflicts')
    ).not.toBeInTheDocument();
    expect(
      screen.queryByTestId('ontology-tree-conflict-dot')
    ).not.toBeInTheDocument();
  });

  it('goes from loading to loaded and opens Data without a hook-order error', async () => {
    const consoleError = jest.spyOn(console, 'error').mockImplementation();
    (getNativeOntologyDataGraphPage as jest.Mock).mockResolvedValue(
      pageFixture({
        clusters: [
          {
            id: 'concept-customer',
            name: 'Customer',
            count: 1,
            assets: [{ id: 't1', name: 'customers' }],
          },
        ],
      })
    );
    mockUseOntologyStudioModel.mockReturnValue({
      ...modelResult,
      graph: undefined,
      isLoading: true,
      model: undefined,
    });
    const view = (
      <MemoryRouter>
        <OntologyGraphView
          ontology={ontology}
          surface="graph"
          onRequestGraphSurface={jest.fn()}
        />
      </MemoryRouter>
    );
    const { rerender } = render(view);

    expect(
      screen.queryByTestId('native-ontology-graph')
    ).not.toBeInTheDocument();

    mockUseOntologyStudioModel.mockReturnValue(modelResult);
    rerender(view);
    await screen.findByTestId('native-ontology-graph');
    fireEvent.click(screen.getByTestId('native-graph-node-concept-customer'));
    fireEvent.click(screen.getByTestId('ontology-graph-mode-data'));

    expect(
      await screen.findByTestId('ontology-data-cluster-concept-customer')
    ).toBeVisible();
    expect(
      consoleError.mock.calls.filter(([message]) =>
        String(message).includes('Rendered more hooks')
      )
    ).toEqual([]);

    consoleError.mockRestore();
  });

  it('reloads the picked concept once after a relation is drawn in Model, when Data shows again', async () => {
    const editableModel = {
      ...model,
      properties: [...model.properties, objectProperty],
    };
    mockUseOntologyStudioModel.mockReturnValue({
      ...modelResult,
      model: editableModel,
      refetch: jest.fn().mockResolvedValue({ data: editableModel }),
      relations: getModelRelations(editableModel),
    });
    (createOntologyAxiom as jest.Mock).mockResolvedValue({});
    const clusters = [
      {
        id: customer.id,
        name: 'Customer',
        count: 1,
        assets: [{ id: 't1', name: 'customers' }],
      },
      {
        id: orphan.id,
        name: 'Orphan',
        count: 1,
        assets: [{ id: 't2', name: 'orphans' }],
      },
    ];
    (getNativeOntologyDataGraphPage as jest.Mock)
      .mockResolvedValueOnce(pageFixture({ clusters }))
      .mockResolvedValueOnce(
        pageFixture({
          clusters,
          conceptEdges: [
            { from: customer.id, to: orphan.id, label: 'served by' },
          ],
        })
      );
    render(
      <MemoryRouter>
        <OntologyGraphView
          isEditing
          ontology={ontology}
          surface="graph"
          onRequestGraphSurface={jest.fn()}
          onWorkingChange={jest.fn()}
        />
      </MemoryRouter>
    );
    await screen.findByTestId('native-ontology-graph');
    await waitForRegistry();
    fireEvent.click(screen.getByTestId('native-graph-node-concept-customer'));
    fireEvent.click(screen.getByTestId('ontology-graph-mode-data'));
    await screen.findByTestId(`ontology-data-cluster-${customer.id}`);

    expect(
      screen.queryByTestId(`ontology-data-cluster-${orphan.id}`)
    ).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId('ontology-graph-mode-model'));
    await act(() =>
      latestGraphProps().onCreateRelation(
        customer.id,
        orphan.id,
        objectProperty.iri
      )
    );

    expect(createOntologyAxiom).toHaveBeenCalledTimes(1);
    expect(getNativeOntologyDataGraphPage).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByTestId('ontology-graph-mode-data'));

    await waitFor(() =>
      expect(getNativeOntologyDataGraphPage).toHaveBeenCalledTimes(2)
    );

    expect(
      await screen.findByTestId(`ontology-data-cluster-${customer.id}`)
    ).toBeVisible();
  });

  it('reloads Data once for a relation that writes three steps while Data shows', async () => {
    const answers: (() => void)[] = [];
    const answerLater = <T,>(value: T) =>
      new Promise<T>((resolve) => answers.push(() => resolve(value)));
    (createOntologyProperty as jest.Mock).mockImplementation(() =>
      answerLater({})
    );
    (createOntologyAxiom as jest.Mock).mockImplementation(() =>
      answerLater(customerIsParty)
    );
    const clusters = [
      {
        id: customer.id,
        name: 'Customer',
        count: 1,
        assets: [{ id: 't1', name: 'customers' }],
      },
    ];
    (getNativeOntologyDataGraphPage as jest.Mock).mockResolvedValue(
      pageFixture({ clusters })
    );
    render(
      <MemoryRouter>
        <OntologyGraphView
          isEditing
          ontology={ontology}
          surface="graph"
          onRequestGraphSurface={jest.fn()}
          onWorkingChange={jest.fn()}
        />
      </MemoryRouter>
    );
    await screen.findByTestId('native-ontology-graph');
    await waitForRegistry();
    fireEvent.click(screen.getByTestId('native-graph-node-concept-customer'));
    fireEvent.click(screen.getByTestId('ontology-graph-mode-data'));
    await screen.findByTestId(`ontology-data-cluster-${customer.id}`);

    let created!: Promise<boolean>;
    act(() => {
      created = latestGraphProps().onCreateRelation(
        customer.id,
        orphan.id,
        PART_OF
      );
    });
    for (const step of [1, 2, 3]) {
      await waitFor(() => expect(answers).toHaveLength(step));
      await act(async () => answers[step - 1]());
    }
    await act(() => created);
    await waitFor(() =>
      expect(screen.queryByTestId('loader')).not.toBeInTheDocument()
    );

    expect(createOntologyProperty).toHaveBeenCalledTimes(2);
    expect(createOntologyAxiom).toHaveBeenCalledTimes(1);
    expect(getNativeOntologyDataGraphPage).toHaveBeenCalledTimes(2);
  });

  it('shows a concept renamed in the editor while Data shows', async () => {
    (patchOntologyConcept as jest.Mock).mockResolvedValue({
      ...customer,
      displayName: 'Client',
    });
    const cluster = (name: string) =>
      pageFixture({
        clusters: [
          {
            id: customer.id,
            name,
            count: 1,
            assets: [{ id: 't1', name: 'customers' }],
          },
        ],
      });
    (getNativeOntologyDataGraphPage as jest.Mock)
      .mockResolvedValueOnce(cluster('Customer'))
      .mockResolvedValueOnce(cluster('Client'));
    render(
      <MemoryRouter>
        <OntologyGraphView
          isEditing
          ontology={ontology}
          surface="graph"
          onRequestGraphSurface={jest.fn()}
          onWorkingChange={jest.fn()}
        />
      </MemoryRouter>
    );
    fireEvent.click(
      await screen.findByTestId('native-graph-node-concept-customer')
    );
    fireEvent.click(screen.getByTestId('ontology-graph-mode-data'));
    await screen.findByTestId(`ontology-data-cluster-${customer.id}`);
    await screen.findByTestId('concept-save');
    fireEvent.change(
      await screen.findByRole('textbox', {
        name: 'label.ontology-display-name',
      }),
      { target: { value: 'Client' } }
    );
    fireEvent.click(screen.getByRole('button', { name: 'label.save' }));

    expect(
      await within(
        screen.getByTestId(`ontology-data-cluster-${customer.id}`)
      ).findByText('Client')
    ).toBeVisible();
    expect(patchOntologyConcept).toHaveBeenCalledTimes(1);
    expect(getNativeOntologyDataGraphPage).toHaveBeenCalledTimes(2);
    expect(
      (getNativeOntologyDataGraphPage as jest.Mock).mock.calls[1][1].page
    ).toEqual({ kind: 'clusters', limit: 12, offset: 0 });
  });

  it('reloads Data after a data property is added while Data shows', async () => {
    (createOntologyProperty as jest.Mock).mockResolvedValue({});
    (getNativeOntologyDataGraphPage as jest.Mock).mockResolvedValue(
      pageFixture({
        clusters: [
          {
            id: customer.id,
            name: 'Customer',
            count: 1,
            assets: [{ id: 't1', name: 'customers' }],
          },
        ],
      })
    );
    render(
      <MemoryRouter>
        <OntologyGraphView
          isEditing
          ontology={ontology}
          surface="graph"
          onRequestGraphSurface={jest.fn()}
        />
      </MemoryRouter>
    );
    fireEvent.click(
      await screen.findByTestId('native-graph-node-concept-customer')
    );
    fireEvent.click(screen.getByTestId('ontology-graph-mode-data'));
    await screen.findByTestId(`ontology-data-cluster-${customer.id}`);
    fireEvent.click(screen.getByTestId('ontology-add-property'));
    fireEvent.change(screen.getByTestId('ontology-property-name'), {
      target: { value: 'customerNumber' },
    });
    fireEvent.click(screen.getByRole('button', { name: /label.range/ }));
    fireEvent.click(
      await screen.findByTestId('ontology-property-type-integer')
    );
    await act(async () => {
      fireEvent.click(screen.getByTestId('ontology-property-submit'));
    });

    await waitFor(() =>
      expect(getNativeOntologyDataGraphPage).toHaveBeenCalledTimes(2)
    );

    expect(createOntologyProperty).toHaveBeenCalledTimes(1);
  });

  describe('in AI mode', () => {
    let slot: HTMLDivElement;

    beforeEach(() => {
      (useIsAiMode as jest.Mock).mockReturnValue(true);
      slot = document.createElement('div');
      document.body.appendChild(slot);
    });

    afterEach(() => {
      (useIsAiMode as jest.Mock).mockReturnValue(false);
      slot.remove();
    });

    const renderAiGraph = () =>
      render(
        <MemoryRouter>
          <OntologyGraphSearchSlotContext.Provider value={slot}>
            <OntologyGraphView
              ontology={ontology}
              surface="graph"
              onRequestGraphSurface={jest.fn()}
            />
          </OntologyGraphSearchSlotContext.Provider>
        </MemoryRouter>
      );

    it('opens the search results upward from the bottom toolbar, so the canvas never cuts them off', async () => {
      renderAiGraph();
      await screen.findByTestId('native-ontology-graph');

      fireEvent.change(within(slot).getByTestId('ontology-graph-search'), {
        target: { value: 'customer' },
      });

      expect(
        within(slot).getByTestId('ontology-graph-search-results')
      ).toHaveClass('tw:bottom-full');
    });

    it('moves the term search into the sub-bar slot and keeps the canvas controls', async () => {
      renderAiGraph();

      await screen.findByTestId('native-ontology-graph');

      fireEvent.change(within(slot).getByTestId('ontology-graph-search'), {
        target: { value: 'customer' },
      });
      await waitFor(() =>
        expect(
          mockGraphProps.mock.calls.at(-1)?.[0].graphSearchHighlight
            .highlightedNodeIds
        ).toEqual(['concept-customer'])
      );

      const controls = screen.getByTestId('ontology-graph-controls');
      ['fit-view', 'zoom-in', 'zoom-out', 'refresh'].forEach((id) =>
        expect(within(controls).getByTestId(id)).toBeInTheDocument()
      );

      fireEvent.click(within(controls).getByTestId('refresh'));

      expect(modelResult.refetch).toHaveBeenCalled();
      expect(screen.getByTestId('ontology-health-panel')).toBeInTheDocument();
    });

    it('switches to Data mode, asks which concept to show, and keeps the chosen concept when going back and forth', async () => {
      (getNativeOntologyDataGraphPage as jest.Mock).mockResolvedValue(
        pageFixture({
          clusters: [
            {
              id: customer.id,
              name: 'Customer',
              count: 1,
              assets: [{ id: 't1', name: 'customers' }],
            },
            {
              id: orphan.id,
              name: 'Orphan',
              count: 1,
              assets: [{ id: 't2', name: 'orphans' }],
            },
          ],
        })
      );
      renderAiGraph();

      await screen.findByTestId('native-ontology-graph');
      fireEvent.click(screen.getByTestId('ontology-graph-mode-data'));

      expect(
        await screen.findByText('message.ontology-data-pick-title')
      ).toBeVisible();
      expect(screen.queryByTestId('ontology-health-panel')).toBeNull();

      fireEvent.click(
        screen.getByTestId('ontology-data-concept-picker-trigger')
      );
      fireEvent.click(
        await screen.findByTestId(`ontology-data-concept-option-${orphan.id}`)
      );

      expect(
        await screen.findByTestId(`ontology-data-cluster-${orphan.id}`)
      ).toBeVisible();
      expect(
        screen.queryByTestId(`ontology-data-cluster-${customer.id}`)
      ).not.toBeInTheDocument();
      expect(
        screen.getByTestId('ontology-concept-inspector')
      ).toHaveTextContent('Orphan');

      fireEvent.click(screen.getByTestId('ontology-graph-mode-model'));
      fireEvent.click(screen.getByTestId('native-graph-node-concept-customer'));
      fireEvent.click(screen.getByTestId('ontology-graph-mode-data'));

      expect(
        await screen.findByTestId(`ontology-data-cluster-${customer.id}`)
      ).toBeVisible();
      expect(
        screen.getByTestId(`ontology-data-root-${customer.id}`)
      ).toHaveAttribute('aria-pressed', 'true');
      expect(getNativeOntologyDataGraphPage).toHaveBeenCalledTimes(1);
    });

    it('reports a failed data graph read and retries it in the AI data graph', async () => {
      (getNativeOntologyDataGraphPage as jest.Mock)
        .mockRejectedValueOnce(new Error('read failed'))
        .mockResolvedValueOnce(
          pageFixture({
            clusters: [
              {
                id: customer.id,
                name: 'Customer',
                count: 1,
                assets: [{ id: 't1', name: 'customers' }],
              },
            ],
          })
        );
      renderAiGraph();

      await screen.findByTestId('native-ontology-graph');
      fireEvent.click(screen.getByTestId('native-graph-node-concept-customer'));
      fireEvent.click(screen.getByTestId('ontology-graph-mode-data'));
      const dataGraph = await screen.findByTestId('ontology-native-data-graph');
      const alert = await within(dataGraph).findByTestId(
        'ontology-native-data-error'
      );

      expect(alert).toHaveTextContent(
        'message.ontology-data-graph-unavailable'
      );

      fireEvent.click(
        within(alert).getByRole('button', { name: 'label.retry' })
      );

      expect(
        await within(dataGraph).findByTestId(
          `ontology-data-cluster-${customer.id}`
        )
      ).toBeVisible();
      expect(
        within(dataGraph).queryByTestId('ontology-native-data-error')
      ).not.toBeInTheDocument();
      expect(getNativeOntologyDataGraphPage).toHaveBeenCalledTimes(2);
    });
  });
});
