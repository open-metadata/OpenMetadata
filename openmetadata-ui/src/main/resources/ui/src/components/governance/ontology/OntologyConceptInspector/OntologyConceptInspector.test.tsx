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
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { UpdateOntologyConceptBinding } from '../../../../generated/api/data/updateOntologyConceptBinding';
import { OntologyConceptType } from '../../../../generated/entity/data/ontologyConcept';
import {
  Kind,
  OntologyProperty,
} from '../../../../generated/entity/data/ontologyProperty';
import {
  AssetType,
  OntologyConceptBindingsResponse,
  State,
} from '../../../../generated/type/ontologyConceptBindingsResponse';
import { BindingSnapshot } from '../../../../interface/governance/ontology/ontologyConceptBindings.types';
import APIClient from '../../../../rest/axiosClient';
import {
  deleteOntologyConceptBinding,
  getOntologyConceptBindings,
  putOntologyConceptBinding,
} from '../../../../rest/ontologyAPI';
import { getEntityPermissionById } from '../../../../rest/permissionAPI';
import { renderWithQueryClient } from '../../../../test/unit/test-utils';
import {
  getModelRelations,
  OntologyStudioModel,
} from '../../../../utils/governance/ontology/OntologyStudioModel.utils';
import OntologyConceptInspector from './OntologyConceptInspector';

jest.mock('../../../../rest/ontologyAPI');
jest.mock('../../../../rest/permissionAPI');
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
      within(picker).getByRole('checkbox', { name: 'label.select-all' })
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
        within(assets).getByText(/label.ontology-column-binding-count/)
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

  it('reads an incoming relation backwards when no inverse is declared', () => {
    renderRelations([partOf]);

    expect(
      screen.getByTestId('ontology-concept-relationships')
    ).toHaveTextContent(/Account\s*part of/);
  });
});
