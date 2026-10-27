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
import { MemoryRouter } from 'react-router-dom';
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
const response: OntologyConceptBindingsResponse = {
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
        onOpenData={jest.fn()}
        onSelectConcept={jest.fn()}
      />
    </MemoryRouter>
  );

describe('OntologyConceptInspector column assignment cleanup', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetBindings.mockResolvedValue(response);
    mockGetPermission.mockResolvedValue({ resource: 'table', permissions: [] });
    mockPutBinding.mockResolvedValue({
      revision: 5,
      assets: [
        { ...response.assets[0], columns: [response.assets[0].columns[1]] },
      ],
    });
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
          onOpenData={jest.fn()}
          onSelectConcept={jest.fn()}
        />
      </MemoryRouter>
    );
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockGetBindings.mockResolvedValue({ revision: 0, assets: [] });
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

describe('OntologyConceptInspector view rail', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetBindings.mockResolvedValue({
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
    'shows %s, owner and three assets with a Data handoff',
    async (lifecycleStatus, label) => {
      const onOpenData = jest.fn();
      renderWithQueryClient(
        <MemoryRouter>
          <OntologyConceptInspector
            concept={{ ...concept, lifecycleStatus }}
            model={model}
            relations={[]}
            onClose={jest.fn()}
            onOpenData={onOpenData}
            onSelectConcept={jest.fn()}
          />
        </MemoryRouter>
      );

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

      expect(onOpenData).toHaveBeenCalledTimes(1);
      expect(
        screen.queryByTestId('ontology-native-link-assets')
      ).not.toBeInTheDocument();
    }
  );

  it('retains asset paging in Edit', async () => {
    mockGetBindings.mockResolvedValue({
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
  mockGetBindings.mockResolvedValue({ revision: 0, assets: [] });
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
        onOpenData={jest.fn()}
        onSelectConcept={jest.fn()}
      />
    </MemoryRouter>
  );
  fireEvent.click(screen.getByTestId('ontology-add-relationship'));
  fireEvent.click(screen.getByTestId('relation-type-isA'));
  fireEvent.click(screen.getByRole('button', { name: 'label.change' }));
  fireEvent.click(screen.getByTestId('relation-type-isA'));
  fireEvent.click(screen.getByRole('button', { name: /label.target/ }));
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
