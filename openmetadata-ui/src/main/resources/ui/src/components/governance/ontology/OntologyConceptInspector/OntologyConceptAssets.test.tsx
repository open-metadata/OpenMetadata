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
import {
  Access,
  Operation,
} from '../../../../generated/entity/policies/accessControl/resourcePermission';
import {
  AssetType,
  OntologyConceptBindingsResponse,
} from '../../../../generated/type/ontologyConceptBindingsResponse';
import {
  deleteOntologyConceptBinding,
  getOntologyConceptBindings,
  putOntologyConceptBinding,
} from '../../../../rest/ontologyAPI';
import { getEntityPermissionById } from '../../../../rest/permissionAPI';
import { searchQuery } from '../../../../rest/searchAPI';
import { renderWithQueryClient } from '../../../../test/unit/test-utils';
import OntologyConceptAssets from './OntologyConceptAssets';

jest.mock('../../../../rest/ontologyAPI');
jest.mock('../../../../rest/permissionAPI');
jest.mock('../../../../rest/searchAPI', () => ({ searchQuery: jest.fn() }));
jest.mock('../../../../utils/ToastUtils', () => ({
  showErrorToast: jest.fn(),
}));
const getBindings = getOntologyConceptBindings as jest.MockedFunction<
  typeof getOntologyConceptBindings
>;
const update = putOntologyConceptBinding as jest.MockedFunction<
  typeof putOntologyConceptBinding
>;
const remove = deleteOntologyConceptBinding as jest.MockedFunction<
  typeof deleteOntologyConceptBinding
>;
const permission = getEntityPermissionById as jest.MockedFunction<
  typeof getEntityPermissionById
>;
const search = searchQuery as jest.Mock;
const binding = (id: string) => ({
  assetId: id,
  assetType: AssetType.Table,
  columns: [],
  asset: {
    id,
    type: 'table',
    name: id,
    fullyQualifiedName: 'service.db.schema.' + id,
  },
});
const renderAssets = () =>
  renderWithQueryClient(
    <MemoryRouter>
      <OntologyConceptAssets
        canEdit
        conceptId="concept"
        presentation={{ kind: 'edit' }}
      />
    </MemoryRouter>
  );

beforeEach(() => {
  jest.clearAllMocks();
  getBindings.mockReset();
  update.mockReset();
  remove.mockReset();
  permission.mockReset();
  search.mockReset();
  getBindings.mockResolvedValue({ revision: 0, assets: [] });
  permission.mockResolvedValue({
    resource: 'table',
    permissions: [
      { operation: Operation.ViewSampleData, access: Access.Allow },
    ],
  });
  search.mockResolvedValue({
    hits: {
      hits: ['first', 'second'].map((id) => ({
        _source: {
          entityType: 'table',
          id,
          name: id,
          fullyQualifiedName: 'service.db.schema.' + id,
        },
      })),
      total: { value: 2 },
    },
  });
});

it('adds selected assets serially using returned revisions and removes a linked asset', async () => {
  update
    .mockResolvedValueOnce({ revision: 1, assets: [binding('first')] })
    .mockResolvedValueOnce({
      revision: 2,
      assets: [binding('first'), binding('second')],
    });
  remove.mockResolvedValue({ revision: 3, assets: [binding('second')] });
  renderAssets();
  fireEvent.click(await screen.findByTestId('ontology-native-link-assets'));
  await screen.findByTestId('ontology-data-asset-option-first');
  fireEvent.click(screen.getByRole('checkbox', { name: 'label.select-all' }));
  fireEvent.click(screen.getByTestId('ontology-data-asset-save'));
  await waitFor(() =>
    expect(
      screen.queryByTestId('ontology-data-asset-picker')
    ).not.toBeInTheDocument()
  );

  expect(await screen.findByRole('link', { name: 'first' })).toBeVisible();
  expect(screen.getByRole('link', { name: 'second' })).toBeVisible();
  expect(
    update.mock.calls.map(([, request]) => request.expectedRevision)
  ).toEqual([0, 1]);

  await waitFor(() =>
    expect(
      screen.getAllByRole('link', { name: 'label.sample-data' })
    ).toHaveLength(2)
  );
  fireEvent.click(screen.getByTestId('ontology-native-asset-remove-first'));
  await waitFor(() =>
    expect(
      screen.queryByRole('link', { name: 'first' })
    ).not.toBeInTheDocument()
  );

  expect(remove).toHaveBeenCalledWith('concept', 'table', 'first', 2);
  expect(screen.getByRole('link', { name: 'second' })).toBeVisible();
});

it('keeps a refused selection available for retry and closes the picker without dropping successful links', async () => {
  const partial: OntologyConceptBindingsResponse = {
    revision: 1,
    assets: [binding('first')],
  };
  update
    .mockResolvedValueOnce(partial)
    .mockRejectedValueOnce(new Error('Denied'));
  getBindings
    .mockResolvedValueOnce({ revision: 0, assets: [] })
    .mockResolvedValue(partial);
  renderAssets();
  fireEvent.click(await screen.findByTestId('ontology-native-link-assets'));
  await screen.findByTestId('ontology-data-asset-option-first');
  fireEvent.click(screen.getByRole('checkbox', { name: 'label.select-all' }));
  fireEvent.click(screen.getByTestId('ontology-data-asset-save'));

  expect(
    await screen.findByTestId('ontology-data-asset-error-second')
  ).toHaveTextContent('message.temporary-error-try-reloading');
  expect(screen.getByRole('link', { name: 'first' })).toBeVisible();

  fireEvent.click(
    within(screen.getByTestId('ontology-data-asset-picker')).getByRole(
      'button',
      { name: 'label.close' }
    )
  );

  expect(
    screen.queryByTestId('ontology-data-asset-picker')
  ).not.toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'first' })).toBeVisible();
});

it('retries failed binding reads before offering editing', async () => {
  getBindings
    .mockRejectedValueOnce(new Error('Offline'))
    .mockResolvedValue({ revision: 0, assets: [] });
  renderAssets();
  fireEvent.click(await screen.findByRole('button', { name: 'label.retry' }));

  expect(
    await screen.findByTestId('ontology-native-link-assets')
  ).toBeVisible();
  expect(screen.getByText('message.no-data-available')).toBeVisible();
});

it('does not repeat a link that the previous response reports as already present', async () => {
  update.mockResolvedValue({
    revision: 1,
    assets: [binding('first'), binding('second')],
  });
  renderAssets();
  fireEvent.click(await screen.findByTestId('ontology-native-link-assets'));
  await screen.findByTestId('ontology-data-asset-option-first');
  fireEvent.click(screen.getByRole('checkbox', { name: 'label.select-all' }));
  fireEvent.click(screen.getByTestId('ontology-data-asset-save'));
  await waitFor(() =>
    expect(
      screen.queryByTestId('ontology-data-asset-picker')
    ).not.toBeInTheDocument()
  );

  expect(screen.getByRole('link', { name: 'second' })).toBeVisible();
  expect(update).toHaveBeenCalledTimes(1);
});
