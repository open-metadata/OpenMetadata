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
import {
  deleteOntologyConceptBinding,
  getOntologyConceptBindings,
  putOntologyConceptBinding,
} from '../../../../rest/ontologyAPI';
import { getEntityPermissionById } from '../../../../rest/permissionAPI';
import { renderWithQueryClient } from '../../../../test/unit/test-utils';
import { OntologyStudioModel } from '../../../../utils/governance/ontology/OntologyStudioModel.utils';
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
