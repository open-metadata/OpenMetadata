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
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import OntologyDraftProvider from '../../../../context/OntologyDraft/OntologyDraftProvider';
import {
  Code,
  OntologyProfileReport,
  Severity,
} from '../../../../generated/api/data/ontologyProfileReport';
import { UpdateOntologyConceptBinding } from '../../../../generated/api/data/updateOntologyConceptBinding';
import { Ontology } from '../../../../generated/entity/data/ontology';
import {
  AxiomType,
  ExpressionKind,
  OntologyAxiom,
  Provenance,
} from '../../../../generated/entity/data/ontologyAxiom';
import { OntologyConceptType } from '../../../../generated/entity/data/ontologyConcept';
import {
  Kind,
  OntologyProperty,
} from '../../../../generated/entity/data/ontologyProperty';
import { PaletteKey } from '../../../../generated/entity/data/relationshipType';
import {
  AssetType,
  OntologyConceptBindingsResponse,
  State,
} from '../../../../generated/type/ontologyConceptBindingsResponse';
import { OntologyDefinitionStatus } from '../../../../generated/type/ontologyDefinitionStatus';
import { useIsAiMode } from '../../../../hooks/useAppMode';
import { BindingSnapshot } from '../../../../interface/governance/ontology/ontologyConceptBindings.types';
import APIClient from '../../../../rest/axiosClient';
import {
  createOntologyAxiom,
  deleteOntologyConceptBinding,
  generateOntologyConceptQuery,
  getOntologyConceptBindings,
  putOntologyConceptBinding,
  softDeleteOntologyDefinition,
  validateOntologyAxiom,
} from '../../../../rest/ontologyAPI';
import { getEntityPermissionById } from '../../../../rest/permissionAPI';
import { renderWithQueryClient } from '../../../../test/unit/test-utils';
import {
  getModelRelations,
  OntologyModelRelation,
  OntologyStudioModel,
} from '../../../../utils/governance/ontology/OntologyStudioModel.utils';
import { showUndoToast } from '../../../../utils/governance/ontology/OntologyUndoToast';
import {
  RelationWarningCheck,
  RelationWarningContext,
} from '../../../OntologyExplorer/RelationWarning.context';
import { useOntologyConceptEditor } from '../OntologyConceptEditor/OntologyConceptEditor';
import OntologyConceptInspector from './OntologyConceptInspector';
import OntologyConceptRules from './OntologyConceptRules';

/** The relationship type is a select in the inline form; this opens it and picks one. */
const chooseRelationType = async (id: string) => {
  fireEvent.click(
    within(await screen.findByTestId('ontology-relationship-type')).getByRole(
      'button'
    )
  );
  fireEvent.click(screen.getByTestId(`relation-type-${id}`));
};

jest.mock('../../../../rest/ontologyAPI');
jest.mock('../../../../rest/permissionAPI');
jest.mock('../../../../utils/governance/ontology/OntologyUndoToast', () => ({
  showUndoToast: jest.fn(),
}));
jest.mock('../../../../utils/ToastUtils', () => ({
  showErrorToast: jest.fn(),
  showSuccessToast: jest.fn(),
}));
jest.mock('../../../../rest/axiosClient', () => ({
  get: jest.fn(),
  put: jest.fn(),
  post: jest.fn(),
  patch: jest.fn(),
  delete: jest.fn(),
}));
jest.mock('../../../../hooks/useAppMode', () => ({
  ...jest.requireActual('../../../../hooks/useAppMode'),
  useIsAiMode: jest.fn().mockReturnValue(false),
}));

const ontology = {
  id: 'ontology',
  name: 'Sales',
  fullyQualifiedName: 'Sales',
  iri: 'urn:sales',
  namespace: 'urn:sales:',
};
const concept = {
  id: 'customer',
  name: 'Customer',
  fullyQualifiedName: 'Sales.Customer',
  iri: 'urn:sales:Customer',
  ontology: { id: ontology.id, type: 'ontology' },
  conceptType: OntologyConceptType.OwlClass,
};
const property: OntologyProperty = {
  id: 'customer-name',
  name: 'CustomerName',
  fullyQualifiedName: 'Sales.CustomerName',
  iri: 'urn:sales:name',
  ontology: { id: ontology.id, type: 'ontology' },
  kind: Kind.Data,
  domain: [concept.iri],
  range: ['http://www.w3.org/2001/XMLSchema#string'],
};
const unavailableProperty = {
  ...property,
  id: 'unavailable-property',
  name: 'FormerId',
  domain: ['urn:sales:Order'],
};
const model: OntologyStudioModel = {
  ontology,
  concepts: [concept],
  properties: [property],
  axioms: [],
};
const response: BindingSnapshot = {
  kind: 'complete',
  revision: 4,
  assets: [
    {
      assetId: 'table',
      assetType: AssetType.Table,
      asset: {
        id: 'table',
        type: 'table',
        name: 'customers',
        fullyQualifiedName: 'service.db.schema.customers',
      },
      columns: [
        {
          propertyId: unavailableProperty.id,
          columnPath: ['former_id'],
          state: State.Unresolved,
        },
        {
          propertyId: property.id,
          columnPath: ['name'],
          state: State.Resolved,
        },
      ],
    },
  ],
};

const mockGetBindings = getOntologyConceptBindings as jest.MockedFunction<
  typeof getOntologyConceptBindings
>;
const mockPutBinding = putOntologyConceptBinding as jest.MockedFunction<
  typeof putOntologyConceptBinding
>;
const mockGetPermission = getEntityPermissionById as jest.MockedFunction<
  typeof getEntityPermissionById
>;
const mockApiClient = APIClient as jest.Mocked<typeof APIClient>;

const renderInspector = (
  properties: readonly OntologyProperty[],
  canEditBindings = true
) =>
  renderWithQueryClient(
    <MemoryRouter>
      <OntologyConceptInspector
        isEditing
        canEditBindings={canEditBindings}
        concept={concept}
        model={{ ...model, properties }}
        relations={[]}
        onClose={jest.fn()}
        onSelectConcept={jest.fn()}
      />
    </MemoryRouter>
  );

describe('OntologyConceptInspector column assignment cleanup', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetBindings.mockResolvedValue(response);
    mockGetPermission.mockResolvedValue({ resource: 'table', permissions: [] });
    mockPutBinding.mockImplementation(async () => {
      mockGetBindings.mockResolvedValue({
        kind: 'complete',
        revision: 5,
        assets: [
          { ...response.assets[0], columns: [response.assets[0].columns[1]] },
        ],
      });
    });
  });

  it('keeps an off-page table linked and its columns unchanged when adding another asset', async () => {
    const api = jest.requireActual<
      typeof import('../../../../rest/ontologyAPI')
    >('../../../../rest/ontologyAPI');
    mockGetBindings.mockImplementation(api.getOntologyConceptBindings);
    mockPutBinding.mockImplementation(api.putOntologyConceptBinding);
    const table = structuredClone(response.assets[0]);
    const columns = structuredClone(table.columns);
    const stored: OntologyConceptBindingsResponse = {
      revision: 4,
      assets: [
        {
          assetId: 'a-topic',
          assetType: AssetType.Topic,
          asset: { id: 'a-topic', type: 'topic', name: 'existing-topic' },
          columns: [],
        },
        table,
      ],
    };
    const firstPage = () => ({
      revision: stored.revision,
      assets: stored.assets.slice(0, 1),
      after: 'hidden-scan',
    });
    mockApiClient.get.mockImplementation(async (url, config) => {
      if (url.startsWith('/search/query?')) {
        return {
          data: {
            hits: {
              total: { value: 2 },
              hits: [
                { _source: { ...table.asset, entityType: 'table' } },
                {
                  _source: {
                    id: 'new-topic',
                    name: 'new-topic',
                    entityType: 'topic',
                  },
                },
              ],
            },
          },
        };
      }

      expect(url).toBe(`/ontologyConcepts/${concept.id}/bindings`);

      const params = config?.params as { after?: string } | undefined;
      if (params?.after === 'hidden-scan') {
        return {
          data: { revision: stored.revision, assets: [], after: 'last' },
        };
      }

      return {
        data:
          params?.after === 'last'
            ? { revision: stored.revision, assets: stored.assets.slice(1) }
            : firstPage(),
      };
    });
    mockApiClient.put.mockImplementation(async (_url, data) => {
      const request = data as UpdateOntologyConceptBinding;

      expect(request.expectedRevision).toBe(stored.revision);

      const existing = stored.assets.find(
        (asset) => asset.assetId === request.asset.assetId
      );
      if (existing) {
        existing.columns = (request.asset.columns ?? []).map((column) => ({
          ...column,
          state: State.Resolved,
        }));
      } else {
        stored.assets.push({
          assetId: request.asset.assetId,
          assetType: AssetType.Topic,
          asset: {
            id: request.asset.assetId,
            type: 'topic',
            name: 'new-topic',
          },
          columns: [],
        });
      }
      stored.revision += 1;

      return { data: firstPage() };
    });
    renderInspector([property]);
    await screen.findByText('existing-topic');
    fireEvent.click(await screen.findByTestId('ontology-native-link-assets'));
    const picker = await screen.findByTestId('ontology-data-asset-picker');
    await within(picker).findByRole('checkbox', { name: 'customers' });

    fireEvent.click(
      within(picker).getByRole('checkbox', {
        name: 'label.select-all-lowercase',
      })
    );
    fireEvent.click(within(picker).getByTestId('ontology-data-asset-save'));
    await waitFor(() =>
      expect(
        screen.queryByTestId('ontology-data-asset-picker')
      ).not.toBeInTheDocument()
    );

    expect(
      stored.assets.find((asset) => asset.assetId === table.assetId)?.columns
    ).toEqual(columns);
    expect(stored.assets.map((asset) => asset.assetId)).toContain('new-topic');
    expect(
      await screen.findByText(/former_id.*label.unavailable/)
    ).toBeVisible();

    fireEvent.click(screen.getByTestId('ontology-native-link-assets'));

    expect(
      await within(screen.getByTestId('ontology-data-asset-picker')).findByRole(
        'checkbox',
        { name: 'customers' }
      )
    ).toBeDisabled();
  });

  it.each<{ description: string; properties: OntologyProperty[] }>([
    { description: 'absent', properties: [property] },
    {
      description: 'outside the concept domain',
      properties: [property, unavailableProperty],
    },
  ])(
    'removes an unresolved assignment whose property is $description while preserving the other assignment and linked asset',
    async ({ properties }) => {
      renderInspector(properties);
      const assets = await screen.findByTestId('ontology-native-assets');

      expect(
        await within(assets).findByRole('link', { name: 'customers' })
      ).toBeVisible();
      expect(
        within(assets).getByText(/label.ontology-column-count/)
      ).toBeVisible();
      expect(
        await screen.findByText(/former_id.*label.unavailable/)
      ).toBeVisible();
      expect(
        screen.queryByTestId(`ontology-bind-property-${unavailableProperty.id}`)
      ).not.toBeInTheDocument();

      fireEvent.click(
        screen.getByTestId(`ontology-binding-remove-${unavailableProperty.id}`)
      );

      await waitFor(() =>
        expect(screen.queryByText(/former_id/)).not.toBeInTheDocument()
      );

      expect(putOntologyConceptBinding).toHaveBeenCalledTimes(1);
      expect(putOntologyConceptBinding).toHaveBeenCalledWith(concept.id, {
        expectedRevision: 4,
        asset: {
          assetId: 'table',
          assetType: AssetType.Table,
          columns: [{ propertyId: property.id, columnPath: ['name'] }],
        },
      });
      expect(
        screen.getByTestId(`ontology-property-bindings-${property.id}`)
      ).toHaveTextContent('customers · name');
      expect(
        within(assets).getByRole('link', { name: 'customers' })
      ).toBeVisible();
      expect(deleteOntologyConceptBinding).not.toHaveBeenCalled();
    }
  );

  it('shows unresolved assignments in a read-only inspector without removal or add controls', async () => {
    renderInspector([property], false);

    expect(
      await screen.findByText(/former_id.*label.unavailable/)
    ).toBeVisible();
    expect(
      screen.queryByTestId(`ontology-binding-remove-${unavailableProperty.id}`)
    ).not.toBeInTheDocument();
    expect(
      screen.queryByTestId(`ontology-bind-property-${unavailableProperty.id}`)
    ).not.toBeInTheDocument();
    expect(
      screen.queryByTestId(`ontology-binding-remove-${property.id}`)
    ).not.toBeInTheDocument();
    expect(
      screen.queryByTestId('ontology-native-asset-remove-table')
    ).not.toBeInTheDocument();
    expect(putOntologyConceptBinding).not.toHaveBeenCalled();
  });

  it('renders an applicable property with a missing column once and still permits binding a replacement', async () => {
    mockGetBindings.mockResolvedValue({
      ...response,
      assets: [
        {
          ...response.assets[0],
          columns: [
            {
              propertyId: property.id,
              columnPath: ['missing_name'],
              state: State.Unresolved,
            },
          ],
        },
      ],
    });
    renderInspector([property]);

    expect(
      await screen.findByText(/missing_name.*label.unavailable/)
    ).toBeVisible();
    expect(
      screen.getAllByTestId(`ontology-binding-remove-${property.id}`)
    ).toHaveLength(1);
    expect(
      screen.getByTestId(`ontology-bind-property-${property.id}`)
    ).toBeEnabled();
  });

  it('offers Bind to column on a data property but not on an annotation', async () => {
    const annotation: OntologyProperty = {
      ...property,
      id: 'review-note',
      iri: 'urn:sales:reviewNote',
      kind: Kind.Annotation,
      name: 'reviewNote',
      range: [],
    };
    renderInspector([property, annotation]);
    await screen.findByTestId('ontology-native-assets');

    expect(
      await screen.findByTestId(`ontology-bind-property-${property.id}`)
    ).toBeEnabled();
    expect(
      screen.getByTestId(`ontology-property-bindings-${annotation.id}`)
    ).toBeInTheDocument();
    expect(
      screen.queryByTestId(`ontology-bind-property-${annotation.id}`)
    ).not.toBeInTheDocument();
  });
});

describe('OntologyConceptInspector relationships', () => {
  const account = {
    ...concept,
    id: 'account',
    name: 'Account',
    fullyQualifiedName: 'Sales.Account',
    iri: 'urn:sales:Account',
  };
  const partOf: OntologyProperty = {
    id: 'part-of',
    name: 'partOf',
    displayName: 'Part Of',
    fullyQualifiedName: 'Sales.partOf',
    iri: 'https://open-metadata.org/ontology/partOf',
    ontology: { id: ontology.id, type: 'ontology' },
    kind: Kind.Object,
    domain: [account.iri],
    range: [concept.iri],
    inverse: 'https://open-metadata.org/ontology/hasPart',
  };
  const hasPart: OntologyProperty = {
    id: 'has-part',
    name: 'hasPart',
    displayName: 'Has Part',
    fullyQualifiedName: 'Sales.hasPart',
    iri: 'https://open-metadata.org/ontology/hasPart',
    ontology: { id: ontology.id, type: 'ontology' },
    kind: Kind.Object,
    inverse: partOf.iri,
  };
  const renderRelations = (properties: OntologyProperty[]) => {
    const relationModel = {
      ...model,
      concepts: [concept, account],
      properties,
    };

    return renderWithQueryClient(
      <MemoryRouter>
        <OntologyConceptInspector
          concept={concept}
          model={relationModel}
          relations={getModelRelations(relationModel)}
          onClose={jest.fn()}
          onSelectConcept={jest.fn()}
        />
      </MemoryRouter>
    );
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockGetBindings.mockResolvedValue({
      kind: 'complete',
      revision: 0,
      assets: [],
    });
    mockGetPermission.mockResolvedValue({ resource: 'table', permissions: [] });
  });

  it('reads an incoming relation through the inverse the ontology declares', () => {
    renderRelations([partOf, hasPart]);

    expect(
      screen.getByTestId('ontology-concept-relationships')
    ).toHaveTextContent(/has part\s*Account/);
  });

  it('marks an incoming relation as read backwards when no inverse is declared', () => {
    renderRelations([partOf]);

    expect(
      screen.getByTestId('ontology-concept-relationships')
    ).toHaveTextContent(/part of\s*Account/);
    expect(screen.getByTestId('ontology-concept-relation-row')).toHaveAttribute(
      'data-direction',
      'backward'
    );
  });
});

describe('OntologyConceptInspector header and empty sections', () => {
  const parent = {
    ...concept,
    id: 'party',
    name: 'Party',
    displayName: 'Party',
    fullyQualifiedName: 'Sales.Party',
    iri: 'urn:sales:Party',
  };
  const renderHeader = (
    relations: OntologyModelRelation[],
    onSelectConcept = jest.fn()
  ) =>
    renderWithQueryClient(
      <MemoryRouter>
        <OntologyConceptInspector
          concept={concept}
          model={{ ...model, concepts: [concept, parent] }}
          relations={relations}
          onClose={jest.fn()}
          onSelectConcept={onSelectConcept}
        />
      </MemoryRouter>
    );

  beforeEach(() => {
    jest.clearAllMocks();
    mockGetBindings.mockResolvedValue({
      kind: 'complete',
      revision: 0,
      assets: [],
    });
    mockGetPermission.mockResolvedValue({ resource: 'table', permissions: [] });
  });

  it('places a concept with no parent at the top level and says each empty section is empty', () => {
    renderHeader([]);

    expect(screen.getByTestId('ontology-concept-parent')).toHaveTextContent(
      'label.top-level-concept'
    );
    expect(
      screen.getByTestId('ontology-concept-relationships')
    ).toHaveTextContent('message.ontology-no-relationships-yet');
    expect(screen.getByTestId('ontology-concept-mappings')).toHaveTextContent(
      'message.ontology-no-mappings-yet'
    );
  });

  it('names the parent in the breadcrumb and opens it from there', () => {
    const onSelectConcept = jest.fn();
    renderHeader(
      [{ key: 'is-a', kind: 'subClassOf', from: concept, to: parent }],
      onSelectConcept
    );
    fireEvent.click(screen.getByTestId('ontology-concept-parent'));

    expect(onSelectConcept).toHaveBeenCalledWith(parent);
  });

  it('copies the IRI', async () => {
    const writeText = jest.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });
    Object.defineProperty(window, 'isSecureContext', {
      configurable: true,
      value: true,
    });
    renderHeader([]);
    fireEvent.click(screen.getByTestId('ontology-concept-copy-iri'));

    await waitFor(() => expect(writeText).toHaveBeenCalledWith(concept.iri));
  });
});

describe('OntologyConceptInspector view rail', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetBindings.mockResolvedValue({
      kind: 'complete',
      revision: 1,
      assets: Array.from({ length: 7 }, (_, i) => ({
        assetId: 'asset-' + i,
        assetType: AssetType.Table,
        columns: [],
        asset: {
          id: 'asset-' + i,
          type: 'table',
          name: 'Asset ' + i,
          fullyQualifiedName: 'service.db.schema.asset' + i,
        },
      })),
    });
    mockGetPermission.mockResolvedValue({ resource: 'table', permissions: [] });
  });

  it.each([
    [OntologyDefinitionStatus.Draft, 'label.draft'],
    [OntologyDefinitionStatus.InReview, 'label.in-review'],
    [OntologyDefinitionStatus.Approved, 'label.approved'],
  ])(
    'shows %s, owner and three assets, and expands the rest in place',
    async (lifecycleStatus, label) => {
      renderWithQueryClient(
        <MemoryRouter>
          <OntologyConceptInspector
            concept={{ ...concept, lifecycleStatus }}
            model={model}
            relations={[]}
            onClose={jest.fn()}
            onSelectConcept={jest.fn()}
          />
        </MemoryRouter>
      );

      fireEvent.click(screen.getByTestId('ontology-concept-advanced-toggle'));

      expect(
        screen.getByTestId('ontology-concept-lifecycle')
      ).toHaveTextContent(label);
      expect(screen.getByTestId('ontology-concept-owner')).toHaveTextContent(
        'Sales'
      );

      const assets = screen.getByTestId('ontology-native-assets');
      await within(assets).findByRole('link', { name: 'Asset 0' });

      expect(within(assets).getAllByRole('link')).toHaveLength(3);
      expect(within(assets).queryByText('Asset 3')).not.toBeInTheDocument();
      expect(
        within(assets).queryByRole('link', { name: 'label.sample-data' })
      ).not.toBeInTheDocument();

      fireEvent.click(within(assets).getByTestId('ontology-assets-more'));

      expect(within(assets).getByText('Asset 3')).toBeInTheDocument();

      fireEvent.click(within(assets).getByTestId('ontology-assets-more'));

      expect(within(assets).queryByText('Asset 3')).not.toBeInTheDocument();
      expect(
        screen.queryByTestId('ontology-native-link-assets')
      ).not.toBeInTheDocument();
    }
  );

  it('retains asset paging in Edit', async () => {
    mockGetBindings.mockResolvedValue({
      kind: 'complete',
      revision: 1,
      assets: Array.from({ length: 12 }, (_, i) => ({
        assetId: 'asset-' + i,
        assetType: AssetType.Table,
        columns: [],
        asset: {
          id: 'asset-' + i,
          type: 'table',
          name: 'Asset ' + i,
          fullyQualifiedName: 'service.db.schema.asset' + i,
        },
      })),
    });
    renderInspector([], false);
    const assets = screen.getByTestId('ontology-native-assets');
    await within(assets).findByRole('link', { name: 'Asset 0' });

    expect(within(assets).getAllByRole('link')).toHaveLength(10);

    fireEvent.click(within(assets).getByRole('button', { name: 'label.next' }));

    expect(within(assets).getAllByRole('link')).toHaveLength(2);
    expect(
      within(assets).getByRole('link', { name: 'Asset 11' })
    ).toBeVisible();

    fireEvent.click(
      within(assets).getByRole('button', { name: 'label.previous' })
    );

    expect(within(assets).getByRole('link', { name: 'Asset 0' })).toBeVisible();
    expect(
      within(assets).queryByTestId('ontology-assets-more')
    ).not.toBeInTheDocument();
  });
});

it('adds a relationship from the rail, changes its type and retries a refused save', async () => {
  mockGetBindings.mockResolvedValue({
    kind: 'complete',
    revision: 0,
    assets: [],
  });
  const target = {
    ...concept,
    id: 'party',
    iri: 'urn:sales:Party',
    name: 'Party',
  };
  const save = jest
    .fn()
    .mockResolvedValueOnce(false)
    .mockResolvedValueOnce(true);
  renderWithQueryClient(
    <MemoryRouter>
      <OntologyConceptInspector
        canAddRelation
        concept={concept}
        model={{ ...model, concepts: [concept, target] }}
        relationTypeGroups={[
          {
            id: 'hierarchy',
            title: 'Hierarchy',
            options: [
              { id: 'isA', label: 'Is a', paletteKey: PaletteKey.Blue },
            ],
          },
        ]}
        relations={[]}
        onAddRelation={save}
        onClose={jest.fn()}
        onSelectConcept={jest.fn()}
      />
    </MemoryRouter>
  );
  fireEvent.click(screen.getByTestId('ontology-add-relationship'));
  await chooseRelationType('isA');

  expect(
    within(screen.getByTestId('ontology-relationship-type')).getByRole('button')
  ).toHaveTextContent('Is a');
  expect(screen.getByTestId('ontology-relationship-form')).toHaveTextContent(
    'message.pick-concept-to-complete-sentence'
  );

  fireEvent.click(screen.getByRole('button', { name: /label.target-concept/ }));
  fireEvent.click(await screen.findByRole('option', { name: 'Party' }));
  await act(async () => {
    fireEvent.click(screen.getByTestId('ontology-relationship-submit'));
  });
  await waitFor(() => expect(save).toHaveBeenCalledTimes(1));

  expect(screen.getByTestId('ontology-relationship-submit')).toBeVisible();

  await waitFor(() =>
    expect(screen.getByTestId('ontology-relationship-submit')).toBeEnabled()
  );
  await act(async () => {
    fireEvent.click(screen.getByTestId('ontology-relationship-submit'));
  });
  await waitFor(() =>
    expect(screen.getByTestId('ontology-add-relationship')).toBeVisible()
  );

  expect(save).toHaveBeenLastCalledWith(target.id, 'isA');
});

it('ends the rail with the Live data section and its generated SQL', async () => {
  jest.mocked(getOntologyConceptBindings).mockResolvedValue(response);
  jest.mocked(generateOntologyConceptQuery).mockResolvedValue({
    hops: [],
    sql: 'SELECT customer_name\nFROM sales.customers\nLIMIT 50',
  });
  renderInspector([property]);

  const liveData = await screen.findByTestId('ontology-concept-live-data');

  expect(
    await within(liveData).findByTestId('ontology-live-data-sql')
  ).toHaveTextContent('SELECT customer_name FROM sales.customers LIMIT 50');
  expect(
    within(liveData).getByTestId('ontology-live-data-not-stored')
  ).toBeVisible();
  expect(generateOntologyConceptQuery).toHaveBeenCalledWith(
    'customer',
    [],
    expect.any(AbortSignal)
  );
});

describe('OntologyConceptInspector in AI mode', () => {
  const party = {
    ...concept,
    id: 'party',
    name: 'Party',
    iri: 'urn:sales:Party',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (useIsAiMode as jest.Mock).mockReturnValue(true);
    mockGetBindings.mockResolvedValue(response);
    mockGetPermission.mockResolvedValue({ resource: 'table', permissions: [] });
  });

  afterEach(() => (useIsAiMode as jest.Mock).mockReturnValue(false));

  const renderAiInspector = (extraProperties: OntologyProperty[] = []) => {
    const handlers = {
      onAddProperty: jest.fn().mockResolvedValue(true),
      onAddRelation: jest.fn().mockResolvedValue(true),
      onClose: jest.fn(),
      onEdit: jest.fn(),
      onEditMappings: jest.fn(),
      onSelectConcept: jest.fn(),
    };
    renderWithQueryClient(
      <MemoryRouter>
        <OntologyConceptInspector
          canAddProperty
          canAddRelation
          canEditBindings
          concept={concept}
          model={{
            ...model,
            concepts: [concept, party],
            properties: [property, ...extraProperties],
          }}
          relationTypeGroups={[
            {
              id: 'hierarchy',
              title: 'Hierarchy',
              options: [
                { id: 'isA', label: 'is a', paletteKey: PaletteKey.Blue },
              ],
            },
          ]}
          relations={[
            { key: 'isA', kind: 'subClassOf', from: concept, to: party },
          ]}
          {...handlers}
        />
      </MemoryRouter>
    );

    return handlers;
  };

  it('keeps the description in the scrollable body with the sections', async () => {
    renderAiInspector();
    const description = await screen.findByTestId(
      'ontology-concept-description'
    );
    const header = screen.getByTestId(
      'ontology-concept-completeness'
    ).parentElement;

    expect(header).not.toContainElement(description);
    expect(description.closest('.tw\\:overflow-y-auto')).toContainElement(
      screen.getByTestId(`ontology-concept-relation-${party.id}`)
    );
  });

  it('counts the five design sections towards completeness', async () => {
    renderAiInspector();
    await within(
      await screen.findByTestId('ontology-native-assets')
    ).findByRole('link', { name: 'customers' });
    const progress = within(
      screen.getByTestId('ontology-concept-completeness')
    ).getByRole('progressbar');

    // A relationship, a property and an asset; no description, no mapping.
    expect(progress).toHaveAttribute('aria-valuenow', '3');
    expect(progress).toHaveAttribute('aria-valuemax', '5');
  });

  it('shows the type by name and offers Add for a missing description', async () => {
    const handlers = renderAiInspector();

    expect(
      await screen.findByTestId('ontology-concept-type')
    ).toHaveTextContent('label.class-owl');
    expect(
      screen.getByTestId('ontology-concept-description')
    ).toHaveTextContent('message.no-description-yet');

    fireEvent.click(screen.getByTestId('ontology-concept-add-description'));

    expect(handlers.onEdit).toHaveBeenCalledTimes(1);
  });

  it('lists the name, IRI and status read-only under Advanced', async () => {
    renderAiInspector();
    fireEvent.click(
      await screen.findByTestId('ontology-concept-advanced-toggle')
    );
    const advanced = screen.getByTestId('ontology-concept-advanced');

    expect(
      within(advanced).getByTestId('ontology-concept-name')
    ).toHaveTextContent('Customer');
    expect(
      within(advanced).getByTestId('ontology-concept-full-iri')
    ).toHaveTextContent('urn:sales:Customer');
    expect(
      within(advanced).getByTestId('ontology-concept-lifecycle')
    ).toHaveTextContent('label.unavailable');
    expect(advanced).toHaveTextContent('message.ontology-generated-read-only');
    expect(within(advanced).queryByRole('textbox')).not.toBeInTheDocument();
  });

  it('keeps the header, section controls and bindings working', async () => {
    const handlers = renderAiInspector();
    const assets = await screen.findByTestId('ontology-native-assets');

    expect(
      await within(assets).findByRole('link', { name: 'customers' })
    ).toBeVisible();
    expect(
      screen.getByTestId('ontology-concept-completeness')
    ).toHaveTextContent('message.completed-section-count');
    expect(
      screen.getByTestId(`ontology-concept-relation-${party.id}`)
    ).toHaveTextContent('Party');
    expect(
      screen.getByTestId(`ontology-bind-property-${property.id}`)
    ).toBeEnabled();
    expect(
      await screen.findByText(/former_id.*label.unavailable/)
    ).toBeVisible();

    fireEvent.click(screen.getByTestId('ontology-concept-edit'));
    fireEvent.click(screen.getByTestId('ontology-add-mapping'));
    fireEvent.click(
      within(screen.getByTestId('ontology-concept-inspector')).getByRole(
        'button',
        { name: 'label.close' }
      )
    );

    expect(handlers.onEdit).toHaveBeenCalled();
    expect(handlers.onEditMappings).toHaveBeenCalled();
    expect(handlers.onClose).toHaveBeenCalled();

    fireEvent.click(screen.getByTestId('ontology-native-link-assets'));

    expect(screen.getByTestId('ontology-data-asset-picker')).toBeVisible();
    expect(
      screen.queryByTestId('ontology-native-link-assets')
    ).not.toBeInTheDocument();
  });

  it('adds a property and a relationship from the inline forms', async () => {
    const handlers = renderAiInspector();
    await screen.findByTestId('ontology-native-assets');

    fireEvent.click(screen.getByTestId('ontology-add-property'));

    expect(
      screen.queryByTestId('ontology-add-property')
    ).not.toBeInTheDocument();

    const form = screen.getByTestId('ontology-property-form');

    expect(within(form).getByTestId('ontology-property-name')).toBeVisible();
    expect(within(form).getByTestId('ontology-property-submit')).toBeVisible();
    expect(form).toHaveTextContent('message.ontology-property-preview-empty');

    fireEvent.change(screen.getByTestId('ontology-property-name'), {
      target: { value: 'loyaltyTier' },
    });

    expect(form).toHaveTextContent('message.ontology-property-preview-data');

    fireEvent.click(screen.getByRole('button', { name: /label.range/ }));
    fireEvent.click(await screen.findByTestId('ontology-property-type-enum'));
    fireEvent.change(screen.getByTestId('ontology-property-enum-values'), {
      target: { value: 'gold, silver' },
    });
    fireEvent.click(screen.getByTestId('ontology-property-identifier'));
    fireEvent.click(screen.getByTestId('ontology-property-submit'));

    await waitFor(() =>
      expect(handlers.onAddProperty).toHaveBeenCalledWith({
        datatype: 'enum',
        enumValues: ['gold', 'silver'],
        isIdentifier: true,
        kind: 'data',
        name: 'loyaltyTier',
      })
    );
    await waitFor(() =>
      expect(screen.getByTestId('ontology-add-property')).toBeVisible()
    );

    fireEvent.click(screen.getByTestId('ontology-add-relationship'));
    await chooseRelationType('isA');

    expect(screen.getByTestId('ontology-relationship-submit')).toBeDisabled();
    expect(screen.getByTestId('ontology-relationship-form')).toBeVisible();
  });

  it('adds an annotation property with no data type to pick', async () => {
    const handlers = renderAiInspector();
    await screen.findByTestId('ontology-native-assets');

    fireEvent.click(screen.getByTestId('ontology-add-property'));

    fireEvent.click(
      within(screen.getByTestId('ontology-property-kind')).getByRole('button')
    );
    fireEvent.click(
      await screen.findByTestId('ontology-property-kind-annotation')
    );

    expect(
      screen.queryByRole('button', { name: /label.range/ })
    ).not.toBeInTheDocument();
    expect(screen.getByTestId('ontology-property-form')).toHaveTextContent(
      'message.ontology-annotation-no-range'
    );

    fireEvent.change(screen.getByTestId('ontology-property-name'), {
      target: { value: 'reviewNote' },
    });
    fireEvent.click(screen.getByTestId('ontology-property-submit'));

    await waitFor(() =>
      expect(handlers.onAddProperty).toHaveBeenCalledWith(
        expect.objectContaining({ kind: 'annotation', name: 'reviewNote' })
      )
    );
  });

  it('reuses a property another concept declared, and does not offer one this concept already has', async () => {
    const shared: OntologyProperty = {
      ...property,
      domain: ['urn:sales:Order'],
      id: 'shared-note',
      iri: 'urn:sales:note',
      kind: Kind.Annotation,
      name: 'note',
    };
    const handlers = renderAiInspector([shared]);
    await screen.findByTestId('ontology-native-assets');

    fireEvent.click(screen.getByTestId('ontology-add-property'));
    fireEvent.click(screen.getByTestId('ontology-property-source-existing'));

    expect(screen.getByTestId('ontology-property-submit')).toBeDisabled();

    const picker = screen.getByRole('combobox', { name: /label.property/ });
    fireEvent.focus(picker);
    fireEvent.keyDown(picker, { key: 'ArrowDown' });

    expect(await screen.findAllByRole('option')).toHaveLength(1);

    fireEvent.click(screen.getByRole('option', { name: /note/ }));
    fireEvent.click(screen.getByTestId('ontology-property-submit'));

    await waitFor(() =>
      expect(handlers.onAddProperty).toHaveBeenCalledWith(
        expect.objectContaining({ reusePropertyIri: 'urn:sales:note' })
      )
    );
  });

  it('reads an incoming relation through its inverse in the AI panel', async () => {
    const partOf: OntologyProperty = {
      id: 'part-of',
      name: 'partOf',
      displayName: 'Part Of',
      fullyQualifiedName: 'Sales.partOf',
      iri: 'urn:sales:partOf',
      ontology: { id: ontology.id, type: 'ontology' },
      kind: Kind.Object,
      domain: [party.iri],
      range: [concept.iri],
      inverse: 'urn:sales:hasPart',
    };
    const hasPart: OntologyProperty = {
      id: 'has-part',
      name: 'hasPart',
      displayName: 'Has Part',
      fullyQualifiedName: 'Sales.hasPart',
      iri: 'urn:sales:hasPart',
      ontology: { id: ontology.id, type: 'ontology' },
      kind: Kind.Object,
      inverse: partOf.iri,
    };
    const relationModel = {
      ...model,
      concepts: [concept, party],
      properties: [partOf, hasPart],
    };

    renderWithQueryClient(
      <MemoryRouter>
        <OntologyConceptInspector
          concept={concept}
          model={relationModel}
          relations={getModelRelations(relationModel)}
          onClose={jest.fn()}
          onSelectConcept={jest.fn()}
        />
      </MemoryRouter>
    );
    await screen.findByTestId('ontology-native-assets');

    expect(screen.getByTestId('ontology-concept-completeness')).toBeVisible();
    expect(
      screen.getByTestId('ontology-concept-relationships')
    ).toHaveTextContent(/has part\s*Party/);
  });

  it('shows three assets with a Data handoff in the AI view rail', async () => {
    mockGetBindings.mockResolvedValue({
      kind: 'complete',
      revision: 1,
      assets: Array.from({ length: 7 }, (_, i) => ({
        assetId: 'asset-' + i,
        assetType: AssetType.Table,
        columns: [],
        asset: {
          id: 'asset-' + i,
          type: 'table',
          name: 'Asset ' + i,
          fullyQualifiedName: 'service.db.schema.asset' + i,
        },
      })),
    });
    renderAiInspector();
    const assets = screen.getByTestId('ontology-native-assets');
    await within(assets).findByRole('link', { name: 'Asset 0' });

    expect(within(assets).getAllByRole('link')).toHaveLength(3);
    expect(within(assets).queryByText('Asset 3')).not.toBeInTheDocument();
    expect(
      within(assets).queryByRole('button', { name: 'label.next' })
    ).not.toBeInTheDocument();

    fireEvent.click(within(assets).getByTestId('ontology-assets-more'));

    expect(within(assets).getByText('Asset 3')).toBeInTheDocument();
  });

  it('retries a failed bindings read and removes an asset from the AI section', async () => {
    mockGetBindings.mockRejectedValueOnce(new Error('read failed'));
    renderAiInspector();
    const assets = await screen.findByTestId('ontology-native-assets');

    expect(
      await within(assets).findByText(
        'message.ontology-binding-read-unavailable'
      )
    ).toBeVisible();

    fireEvent.click(
      within(assets).getByRole('button', { name: 'label.retry' })
    );

    expect(
      await within(assets).findByRole('link', { name: 'customers' })
    ).toBeVisible();

    fireEvent.click(
      within(assets).getByTestId('ontology-native-asset-remove-table')
    );

    expect(deleteOntologyConceptBinding).not.toHaveBeenCalled();

    fireEvent.click(
      await screen.findByRole('button', { name: 'label.unlink' })
    );
    await waitFor(() =>
      expect(showUndoToast).toHaveBeenCalledWith(
        'message.ontology-asset-unlinked',
        expect.any(Function)
      )
    );

    expect(deleteOntologyConceptBinding).toHaveBeenCalledWith(concept.id, {
      assetType: AssetType.Table,
      assetId: 'table',
      expectedRevision: 4,
    });
  });
});

describe('OntologyConceptInspector relationship authoring', () => {
  const party = {
    ...concept,
    id: 'party',
    iri: 'urn:sales:Party',
    name: 'Party',
  };
  const customerIsParty: OntologyAxiom = {
    axiomType: AxiomType.SubclassOf,
    description: 'Customer is a Party',
    displayName: 'Customer is a Party',
    expressions: [{ classIri: party.iri, kind: ExpressionKind.NamedClass }],
    fullyQualifiedName: 'Sales.CustomerIsParty',
    id: 'axiom-customer-party',
    name: 'CustomerIsParty',
    ontology: { id: ontology.id, type: 'ontology' },
    provenance: Provenance.Manual,
    subjectIri: concept.iri,
  };
  const authoringModel: OntologyStudioModel = {
    ...model,
    axioms: [customerIsParty],
    concepts: [concept, party],
  };
  const relationTypeGroups = [
    {
      id: 'hierarchy',
      title: 'Hierarchy',
      options: [{ id: 'isA', label: 'Is a', paletteKey: PaletteKey.Blue }],
    },
  ];

  const renderAuthoring = (
    props: Partial<React.ComponentProps<typeof OntologyConceptInspector>> = {},
    warn?: RelationWarningCheck
  ) =>
    renderWithQueryClient(
      <RelationWarningContext.Provider value={warn}>
        <MemoryRouter>
          <OntologyConceptInspector
            canAddRelation
            canEditRelations
            concept={concept}
            model={authoringModel}
            relationTypeGroups={relationTypeGroups}
            relations={getModelRelations(authoringModel)}
            onAddRelation={jest.fn().mockResolvedValue(true)}
            onClose={jest.fn()}
            onDeleteRelation={jest.fn().mockResolvedValue(true)}
            onEditRelation={jest.fn().mockResolvedValue(true)}
            onSelectConcept={jest.fn()}
            {...props}
          />
        </MemoryRouter>
      </RelationWarningContext.Provider>
    );

  beforeEach(() => {
    jest.clearAllMocks();
    mockGetBindings.mockResolvedValue({
      kind: 'complete',
      revision: 0,
      assets: [],
    });
    mockGetPermission.mockResolvedValue({ resource: 'table', permissions: [] });
  });

  it('starts the inline form on broader when the ontology offers it, matched by its SKOS IRI', () => {
    const broader = 'http://www.w3.org/2004/02/skos/core#broader';
    renderAuthoring({
      relationTypeGroups: [
        {
          id: 'hierarchy',
          title: 'Hierarchy',
          options: [{ id: 'isA', label: 'Is a', paletteKey: PaletteKey.Blue }],
        },
        {
          id: 'relationships',
          title: 'Relationships',
          options: [
            { id: broader, label: 'Broader', paletteKey: PaletteKey.Green },
          ],
        },
      ],
    });
    fireEvent.click(screen.getByTestId('ontology-add-relationship'));

    expect(
      within(screen.getByTestId('ontology-relationship-type')).getByRole(
        'button'
      )
    ).toHaveTextContent('Broader');
  });

  it('leaves the type empty when the ontology has no broader type', () => {
    renderAuthoring();
    fireEvent.click(screen.getByTestId('ontology-add-relationship'));

    expect(
      within(screen.getByTestId('ontology-relationship-type')).getByRole(
        'button'
      )
    ).toHaveTextContent('label.choose-relationship');
    expect(screen.getByTestId('ontology-relationship-submit')).toBeDisabled();
  });

  it('deletes the relationship on its row', () => {
    const onDeleteRelation = jest.fn().mockResolvedValue(true);
    renderAuthoring({ onDeleteRelation });

    const row = screen.getByTestId('ontology-concept-relationships');

    expect(row).toHaveTextContent('Party');

    fireEvent.click(within(row).getByTestId('ontology-relation-delete'));

    expect(onDeleteRelation).toHaveBeenCalledTimes(1);
    expect(onDeleteRelation).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: 'subClassOf',
        from: expect.objectContaining({ id: concept.id }),
        to: expect.objectContaining({ id: party.id }),
      })
    );
  });

  it('changes the type of the relationship in the inline form on its row', async () => {
    const onEditRelation = jest.fn().mockResolvedValue(true);
    renderAuthoring({ onEditRelation });

    fireEvent.click(screen.getByTestId('ontology-relation-edit'));

    expect(screen.getByTestId('ontology-relationship-edit-form')).toBeVisible();
    expect(
      screen.getByTestId('ontology-relationship-edit-save')
    ).toBeDisabled();

    await chooseRelationType('isA');
    await act(async () => {
      fireEvent.click(screen.getByTestId('ontology-relationship-edit-save'));
    });

    await waitFor(() => expect(onEditRelation).toHaveBeenCalledTimes(1));
    await waitFor(() =>
      expect(
        screen.queryByTestId('ontology-relationship-edit-form')
      ).not.toBeInTheDocument()
    );

    expect(onEditRelation).toHaveBeenCalledWith(
      expect.objectContaining({ key: expect.any(String) }),
      'isA'
    );
  });

  it('shows the reason inline and keeps Save off when the new type is refused', async () => {
    const onEditRelation = jest.fn().mockResolvedValue(true);
    renderAuthoring({
      checkRelationType: () => 'Customer is already a subclass of Party.',
      onEditRelation,
    });

    fireEvent.click(screen.getByTestId('ontology-relation-edit'));
    await chooseRelationType('isA');

    expect(screen.getByTestId('ontology-relationship-issue')).toHaveTextContent(
      'Customer is already a subclass of Party.'
    );
    expect(
      screen.getByTestId('ontology-relationship-edit-save')
    ).toBeDisabled();
    expect(onEditRelation).not.toHaveBeenCalled();
  });

  it('drops an open edit form when relation edit rights go away', async () => {
    const onEditRelation = jest.fn().mockResolvedValue(true);
    const { rerender } = renderAuthoring({ onEditRelation });
    fireEvent.click(screen.getByTestId('ontology-relation-edit'));

    expect(screen.getByTestId('ontology-relationship-edit-form')).toBeVisible();

    const rerenderWith = (canEditRelations: boolean) =>
      rerender(
        <RelationWarningContext.Provider value={undefined}>
          <MemoryRouter>
            <OntologyConceptInspector
              canAddRelation
              canEditRelations={canEditRelations}
              concept={concept}
              model={authoringModel}
              relationTypeGroups={relationTypeGroups}
              relations={getModelRelations(authoringModel)}
              onAddRelation={jest.fn().mockResolvedValue(true)}
              onClose={jest.fn()}
              onDeleteRelation={jest.fn().mockResolvedValue(true)}
              onEditRelation={onEditRelation}
              onSelectConcept={jest.fn()}
            />
          </MemoryRouter>
        </RelationWarningContext.Provider>
      );
    rerenderWith(false);

    expect(
      screen.queryByTestId('ontology-relationship-edit-form')
    ).not.toBeInTheDocument();

    rerenderWith(true);

    expect(
      screen.queryByTestId('ontology-relationship-edit-form')
    ).not.toBeInTheDocument();
    expect(onEditRelation).not.toHaveBeenCalled();
  });

  it('closes the inline edit form on Cancel without saving', async () => {
    const onEditRelation = jest.fn().mockResolvedValue(true);
    renderAuthoring({ onEditRelation });

    fireEvent.click(screen.getByTestId('ontology-relation-edit'));
    await chooseRelationType('isA');
    fireEvent.click(
      within(screen.getByTestId('ontology-relationship-edit-form')).getByRole(
        'button',
        { name: 'label.cancel' }
      )
    );

    expect(
      screen.queryByTestId('ontology-relationship-edit-form')
    ).not.toBeInTheDocument();
    expect(screen.getByTestId('ontology-relation-edit')).toBeVisible();
    expect(onEditRelation).not.toHaveBeenCalled();
  });

  it('offers no row actions without relation edit rights', () => {
    renderAuthoring({ canEditRelations: false });

    expect(
      screen.queryByTestId('ontology-relation-delete')
    ).not.toBeInTheDocument();
    expect(
      screen.queryByTestId('ontology-relation-edit')
    ).not.toBeInTheDocument();
  });

  it('shows the server clash beside the chosen parent and still allows Add', async () => {
    renderAuthoring(
      { relations: [] },
      async () => 'Customer would also be a Supplier, which are disjoint.'
    );

    fireEvent.click(screen.getByTestId('ontology-add-relationship'));
    await chooseRelationType('isA');
    fireEvent.click(screen.getByRole('button', { name: /label.target/ }));
    fireEvent.click(await screen.findByRole('option', { name: 'Party' }));

    expect(
      await screen.findByTestId('ontology-relationship-clash')
    ).toHaveTextContent(
      'Customer would also be a Supplier, which are disjoint.'
    );
    expect(screen.getByTestId('ontology-relationship-submit')).toBeEnabled();
  });

  it('explains why a new relationship cannot be added and disables Add', async () => {
    renderAuthoring({
      checkAddRelation: () => 'Party is already above Customer.',
      relations: [],
    });

    fireEvent.click(screen.getByTestId('ontology-add-relationship'));
    await chooseRelationType('isA');
    fireEvent.click(screen.getByRole('button', { name: /label.target/ }));
    fireEvent.click(await screen.findByRole('option', { name: 'Party' }));

    expect(screen.getByTestId('ontology-relationship-issue')).toHaveTextContent(
      'Party is already above Customer.'
    );
    expect(screen.getByTestId('ontology-relationship-submit')).toBeDisabled();
  });

  it('opens the relationship from its row when the panel can, else the other concept', () => {
    const onOpenRelation = jest.fn();
    const onSelectConcept = jest.fn();
    const { unmount } = renderAuthoring({ onOpenRelation, onSelectConcept });

    fireEvent.click(
      screen.getByTestId(`ontology-concept-relation-${party.id}`)
    );

    expect(onOpenRelation).toHaveBeenCalledWith(
      expect.objectContaining({ key: expect.any(String), kind: 'subClassOf' })
    );
    expect(onSelectConcept).not.toHaveBeenCalled();

    unmount();
    renderAuthoring({ onSelectConcept });
    fireEvent.click(
      screen.getByTestId(`ontology-concept-relation-${party.id}`)
    );

    expect(onSelectConcept).toHaveBeenCalledWith(
      expect.objectContaining({ id: party.id })
    );
  });

  it('opens the relationship from anywhere on its card, but not from its edit and delete controls', () => {
    const onOpenRelation = jest.fn();
    const onDeleteRelation = jest.fn().mockResolvedValue(true);
    renderAuthoring({ onDeleteRelation, onOpenRelation });
    const card = screen.getByTestId('ontology-concept-relation-row');

    fireEvent.click(card);

    expect(onOpenRelation).toHaveBeenCalledTimes(1);

    fireEvent.click(
      screen.getByTestId(`ontology-concept-relation-${party.id}`)
    );

    expect(onOpenRelation).toHaveBeenCalledTimes(2);

    fireEvent.click(within(card).getByTestId('ontology-relation-delete'));

    expect(onDeleteRelation).toHaveBeenCalledTimes(1);
    expect(onOpenRelation).toHaveBeenCalledTimes(2);

    fireEvent.click(within(card).getByTestId('ontology-relation-edit'));

    expect(onOpenRelation).toHaveBeenCalledTimes(2);
  });

  it('lists ten relationships at a time and loads the next ten on demand', () => {
    const parents = Array.from({ length: 23 }, (_, index) => ({
      ...concept,
      id: `parent-${index}`,
      iri: `urn:sales:Parent${index}`,
      name: `Parent ${index}`,
    }));
    const manyRelationsModel: OntologyStudioModel = {
      ...model,
      axioms: parents.map((parent) => ({
        ...customerIsParty,
        expressions: [
          { classIri: parent.iri, kind: ExpressionKind.NamedClass },
        ],
        id: `axiom-${parent.id}`,
        name: `CustomerIs${parent.id}`,
      })),
      concepts: [concept, ...parents],
    };
    renderAuthoring({
      model: manyRelationsModel,
      relations: getModelRelations(manyRelationsModel),
    });
    const rows = () => screen.getAllByTestId('ontology-concept-relation-row');
    const loadMore = 'ontology-concept-relations-load-more';

    expect(rows()).toHaveLength(10);

    fireEvent.click(screen.getByTestId(loadMore));

    expect(rows()).toHaveLength(20);

    fireEvent.click(screen.getByTestId(loadMore));

    expect(rows()).toHaveLength(23);
    expect(screen.queryByTestId(loadMore)).not.toBeInTheDocument();
  });

  it('truncates a long related concept name instead of running under its controls', () => {
    renderAuthoring();
    const target = screen.getByTestId(`ontology-concept-relation-${party.id}`);

    expect(target.querySelector('[data-text]')).toHaveClass(
      'tw:truncate',
      'tw:min-w-0'
    );
    expect(target).toHaveTextContent('Party');
  });

  it('lists the rules about the concept apart from its relationships', () => {
    const rule: OntologyAxiom = {
      ...customerIsParty,
      axiomType: AxiomType.SubclassOf,
      displayName: 'Customer must have exactly 1 name',
      expressions: [],
      id: 'axiom-rule',
      name: 'CustomerMustHaveName',
    };
    const rulesModel = {
      ...authoringModel,
      axioms: [customerIsParty, rule],
    };
    renderAuthoring({
      model: rulesModel,
      relations: getModelRelations(rulesModel),
    });
    const rules = screen.getByTestId('ontology-concept-rules');

    expect(
      within(rules).getByTestId('ontology-concept-rule-axiom-rule')
    ).toHaveTextContent('Customer must have exactly 1 name');
    expect(rules).not.toHaveTextContent('Customer is a Party');
    // Adding a rule edits the concept, so View offers none.
    expect(
      within(rules).queryByTestId('ontology-add-rule')
    ).not.toBeInTheDocument();
  });

  it('greys the concept a rule is about, and deletes a rule while editing after confirming', async () => {
    const rule: OntologyAxiom = {
      ...customerIsParty,
      axiomType: AxiomType.SubclassOf,
      displayName: 'Customer must have exactly 1 name',
      expressions: [],
      id: 'axiom-rule',
      name: 'CustomerMustHaveName',
    };
    const rulesModel = { ...authoringModel, axioms: [rule] };
    const onCreated = jest.fn();
    render(
      <OntologyConceptRules
        canAdd
        isEditing
        concept={concept}
        model={rulesModel}
        relations={[]}
        onCreated={onCreated}
      />
    );
    const row = screen.getByTestId('ontology-concept-rule-axiom-rule');

    expect(within(row).getByText('Customer')).toHaveClass('tw:text-tertiary');

    fireEvent.click(
      screen.getByTestId('ontology-concept-rule-delete-axiom-rule')
    );

    // Nothing is deleted until the person confirms.
    expect(await screen.findByTestId('delete-modal')).toBeInTheDocument();
    expect(softDeleteOntologyDefinition).not.toHaveBeenCalled();

    fireEvent.click(screen.getByTestId('confirm-button'));

    await waitFor(() =>
      expect(softDeleteOntologyDefinition).toHaveBeenCalledWith(
        'axiom',
        'axiom-rule'
      )
    );

    expect(onCreated).toHaveBeenCalled();

    await waitFor(() =>
      expect(screen.queryByTestId('delete-modal')).not.toBeInTheDocument()
    );
  });

  it('flags a synonym that reads like a relationship, read-only in View', () => {
    renderAuthoring({
      concept: { ...concept, synonyms: ['Client', 'part of Order'] },
      findRelationType: () => 'isA',
    });

    expect(
      screen.getByTestId('ontology-synonym-relation-warning')
    ).toHaveTextContent('message.synonym-looks-like-relationship');
    expect(
      screen.queryByTestId('ontology-synonym-add-as-relationship')
    ).not.toBeInTheDocument();
  });

  describe('in Edit', () => {
    const EditableInspector = (
      props: React.ComponentProps<typeof OntologyConceptInspector>
    ) => {
      const editor = useOntologyConceptEditor({
        canEdit: true,
        concept: props.concept,
        ontology: ontology as Ontology,
        onSaved: jest.fn(),
      });

      return <OntologyConceptInspector {...props} isEditing editor={editor} />;
    };

    const renderEditable = (
      props: Partial<React.ComponentProps<typeof OntologyConceptInspector>>
    ) =>
      renderWithQueryClient(
        <MemoryRouter>
          <EditableInspector
            canAddProperty
            canAddRelation
            canAddRule
            concept={concept}
            model={authoringModel}
            relationTypeGroups={relationTypeGroups}
            relations={getModelRelations(authoringModel)}
            onAddProperty={jest.fn().mockResolvedValue(true)}
            onAddRelation={jest.fn().mockResolvedValue(true)}
            onClose={jest.fn()}
            onRuleCreated={jest.fn()}
            onSelectConcept={jest.fn()}
            {...props}
          />
        </MemoryRouter>
      );

    it('adds a mapping through its own card and leaves it out again on Cancel', async () => {
      renderEditable({});

      fireEvent.click(await screen.findByTestId('ontology-add-mapping'));
      const card = screen.getByTestId('ontology-concept-mapping');

      expect(card).toHaveTextContent('label.ontology-new-mapping');
      expect(
        within(card).getByTestId('ontology-mapping-submit')
      ).toBeDisabled();
      expect(
        screen.queryByTestId('ontology-add-mapping')
      ).not.toBeInTheDocument();

      fireEvent.click(
        within(card).getByRole('button', { name: 'label.cancel' })
      );

      expect(
        screen.queryByTestId('ontology-concept-mapping')
      ).not.toBeInTheDocument();
      expect(screen.getByTestId('concept-save')).toBeDisabled();

      fireEvent.click(screen.getByTestId('ontology-add-mapping'));
      fireEvent.change(
        within(screen.getByTestId('ontology-concept-mapping')).getByRole(
          'combobox',
          { name: /^label\.concept-iri/ }
        ),
        { target: { value: 'https://example.org/Client' } }
      );
      await act(async () => {
        fireEvent.click(screen.getByTestId('ontology-mapping-submit'));
      });

      await waitFor(() =>
        expect(
          screen.queryByTestId('ontology-concept-mapping')
        ).not.toBeInTheDocument()
      );

      expect(
        screen.getByTestId('ontology-concept-mapping-row')
      ).toHaveTextContent('https://example.org/Client');
      expect(screen.getByTestId('concept-save')).toBeEnabled();
    });

    it('does not accept a mapping whose concept IRI is not absolute', async () => {
      renderEditable({});

      fireEvent.click(await screen.findByTestId('ontology-add-mapping'));
      const card = screen.getByTestId('ontology-concept-mapping');
      fireEvent.change(
        within(card).getByRole('combobox', { name: /^label\.concept-iri/ }),
        { target: { value: 'relative/concept' } }
      );
      await act(async () => {
        fireEvent.click(within(card).getByTestId('ontology-mapping-submit'));
      });

      expect(
        await within(card).findByText('message.invalid-concept-iri')
      ).toBeVisible();
      expect(
        screen.queryByTestId('ontology-concept-mapping-row')
      ).not.toBeInTheDocument();
    });

    it('previews a rule only once it is complete', async () => {
      renderEditable({});

      fireEvent.click(await screen.findByTestId('ontology-add-rule'));

      expect(screen.getByTestId('ontology-axiom-preview')).toHaveTextContent(
        'message.ontology-rule-preview-empty'
      );
      expect(screen.getByTestId('ontology-rule-form')).toHaveTextContent(
        'message.ontology-rule-must-have-short-help'
      );
    });

    it('turns a relation-like synonym into a relationship form with its type chosen', async () => {
      const findRelationType = jest.fn().mockReturnValue('isA');
      renderEditable({
        concept: { ...concept, synonyms: ['Client', 'part of Order'] },
        findRelationType,
      });

      fireEvent.click(
        await screen.findByTestId('ontology-synonym-add-as-relationship')
      );

      expect(findRelationType).toHaveBeenCalledWith('part of');
      expect(
        within(
          await screen.findByTestId('ontology-relationship-type')
        ).getByRole('button')
      ).toHaveTextContent('Is a');
      expect(
        screen.queryByTestId('ontology-synonym-relation-warning')
      ).not.toBeInTheDocument();
      expect(screen.getByTestId('ontology-concept-synonyms')).toHaveTextContent(
        'Client'
      );
      expect(
        screen.getByTestId('ontology-concept-synonyms')
      ).not.toHaveTextContent('part of Order');
    });

    it('adds an object property from this concept to a target concept', async () => {
      const onAddProperty = jest.fn().mockResolvedValue(true);
      renderEditable({ onAddProperty });

      fireEvent.click(await screen.findByTestId('ontology-add-property'));
      fireEvent.click(
        within(screen.getByTestId('ontology-property-kind')).getByRole('button')
      );
      fireEvent.click(
        await screen.findByTestId('ontology-property-kind-object')
      );
      fireEvent.change(screen.getByTestId('ontology-property-name'), {
        target: { value: 'servedBy' },
      });

      expect(screen.getByTestId('ontology-property-submit')).toBeDisabled();

      fireEvent.click(screen.getByRole('button', { name: /label.range/ }));
      fireEvent.click(await screen.findByRole('option', { name: 'Party' }));
      fireEvent.click(screen.getByTestId('ontology-property-submit'));

      await waitFor(() =>
        expect(onAddProperty).toHaveBeenCalledWith({
          kind: 'object',
          name: 'servedBy',
          rangeIri: party.iri,
        })
      );
    });

    const fillNeverAlsoBeParty = async () => {
      fireEvent.click(await screen.findByTestId('ontology-add-rule'));
      const form = screen.getByTestId('ontology-rule-form');

      expect(form).toHaveTextContent(
        'label.ontology-new-rulemessage.rule-applies-to-every-concept'
      );
      expect(within(form).getByTestId('ontology-rule-submit')).toBeDisabled();

      fireEvent.click(
        within(form).getByRole('button', { name: /label.ontology-rule-type/ })
      );
      fireEvent.click(
        await screen.findByRole('option', {
          name: 'label.can-never-also-be-lowercase',
        })
      );
      const other = within(form).getByRole('combobox', {
        name: /label.concept/,
      });
      fireEvent.focus(other);
      fireEvent.change(other, { target: { value: 'Party' } });
      fireEvent.keyDown(other, { key: 'ArrowDown' });
      fireEvent.click(await screen.findByRole('option', { name: 'Party' }));

      return form;
    };

    it('does not create a rule the server finds invalid and shows why', async () => {
      const onRuleCreated = jest.fn();
      jest.mocked(validateOntologyAxiom).mockResolvedValue({
        valid: false,
        violations: [
          {
            code: Code.InvalidAxiomShape,
            message: 'The statement is not valid OWL',
            path: '/axiomType',
            severity: Severity.Error,
          },
        ],
      } as OntologyProfileReport);
      renderEditable({ onRuleCreated });
      const form = await fillNeverAlsoBeParty();
      await act(async () => {
        fireEvent.click(within(form).getByTestId('ontology-rule-submit'));
      });

      expect(
        await within(form).findByText('The statement is not valid OWL')
      ).toBeInTheDocument();
      expect(validateOntologyAxiom).toHaveBeenCalledWith(
        expect.objectContaining({ subjectIri: concept.iri })
      );
      expect(createOntologyAxiom).not.toHaveBeenCalled();
      expect(onRuleCreated).not.toHaveBeenCalled();
      expect(screen.getByTestId('ontology-rule-form')).toBeVisible();
    });

    it('adds a rule about the concept with the quick rule fields', async () => {
      const onRuleCreated = jest.fn();
      jest.mocked(validateOntologyAxiom).mockResolvedValue({
        valid: true,
        violations: [],
      } as OntologyProfileReport);
      jest.mocked(createOntologyAxiom).mockResolvedValue(customerIsParty);
      renderEditable({ onRuleCreated });
      const form = await fillNeverAlsoBeParty();
      fireEvent.click(within(form).getByTestId('ontology-rule-submit'));

      await waitFor(() => expect(onRuleCreated).toHaveBeenCalledTimes(1));

      expect(createOntologyAxiom).toHaveBeenCalledWith(
        expect.objectContaining({
          axiomType: AxiomType.DisjointWith,
          ontology: 'Sales',
          subjectIri: concept.iri,
        })
      );
      expect(
        screen.queryByTestId('ontology-rule-form')
      ).not.toBeInTheDocument();
    });

    it('asks before a press outside the drawer drops a rule being written', async () => {
      const onClose = jest.fn();
      renderWithQueryClient(
        <MemoryRouter>
          <OntologyDraftProvider>
            <button data-testid="outside-the-drawer" type="button">
              canvas
            </button>
            <EditableInspector
              canAddProperty
              canAddRelation
              canAddRule
              concept={concept}
              model={authoringModel}
              relationTypeGroups={relationTypeGroups}
              relations={getModelRelations(authoringModel)}
              onAddProperty={jest.fn().mockResolvedValue(true)}
              onAddRelation={jest.fn().mockResolvedValue(true)}
              onClose={onClose}
              onRuleCreated={jest.fn()}
              onSelectConcept={jest.fn()}
            />
          </OntologyDraftProvider>
        </MemoryRouter>
      );
      await fillNeverAlsoBeParty();

      fireEvent.pointerDown(screen.getByTestId('outside-the-drawer'));

      expect(
        await screen.findByText('message.discard-your-changes')
      ).toBeInTheDocument();
      expect(onClose).not.toHaveBeenCalled();
    });
  });
});
