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
import { act, fireEvent, screen, waitFor } from '@testing-library/react';
import { UpdateOntologyConceptBinding } from '../../../../generated/api/data/updateOntologyConceptBinding';
import { DataType } from '../../../../generated/entity/data/table';
import {
  AssetType,
  OntologyConceptBindingsResponse,
  State,
} from '../../../../generated/type/ontologyConceptBindingsResponse';
import { useOntologyConceptBindings } from '../../../../hooks/governance/ontology/useOntologyConceptBindings';
import APIClient from '../../../../rest/axiosClient';
import { renderWithQueryClient } from '../../../../test/unit/test-utils';
import { showSuccessToast } from '../../../../utils/ToastUtils';
import OntologyPropertyBindings from './OntologyPropertyBindings';

jest.mock('../../../../rest/axiosClient', () => ({
  get: jest.fn(),
  put: jest.fn(),
  delete: jest.fn(),
}));
jest.mock('../../../../utils/ToastUtils', () => ({
  showErrorToast: jest.fn(),
  showSuccessToast: jest.fn(),
}));
const http = APIClient as jest.Mocked<typeof APIClient>;
const Harness = () => {
  const bindings = useOntologyConceptBindings('concept');

  return (
    <>
      <OntologyPropertyBindings
        canEdit
        bindings={bindings}
        conceptId="concept"
        propertyId="first"
      />
      <OntologyPropertyBindings
        canEdit
        bindings={bindings}
        canAdd={false}
        conceptId="concept"
        propertyId="second"
      />
      <button onClick={() => void bindings.retryRead()}>Read bindings</button>
    </>
  );
};

it('blocks every mounted column action after a confirmed removal until a complete read recovers', async () => {
  jest.clearAllMocks();
  const state: OntologyConceptBindingsResponse = {
    revision: 0,
    assets: [
      {
        assetId: 'table',
        assetType: AssetType.Table,
        asset: {
          id: 'table',
          type: 'table',
          name: 'customers',
          fullyQualifiedName: 'svc.db.schema.customers',
        },
        columns: [
          { propertyId: 'first', columnPath: ['name'], state: State.Resolved },
          {
            propertyId: 'second',
            columnPath: ['legacy'],
            state: State.Unresolved,
          },
        ],
      },
    ],
  };
  let failRead = false;
  http.get.mockImplementation(async (url) => {
    if (url.includes('/columns/search')) {
      return {
        data: {
          data: [{ name: 'id', dataType: DataType.String }],
          paging: { total: 1 },
        },
      };
    }
    if (failRead) {
      throw new Error('read unavailable');
    }

    return { data: structuredClone(state) };
  });
  let finish!: () => void;
  http.put
    .mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = () => {
            state.revision = 1;
            state.assets[0].columns = [
              state.assets[0].columns[0],
              {
                propertyId: 'concurrent',
                columnPath: ['retained'],
                state: State.Resolved,
              },
            ];
            failRead = true;
            resolve({ data: state });
          };
        })
    )
    .mockImplementationOnce(async (_url, data) => {
      const body = data as UpdateOntologyConceptBinding;
      state.revision = 2;
      state.assets[0].columns = (body.asset.columns ?? []).map((column) => ({
        ...column,
        state: State.Resolved,
      }));

      return { data: state };
    });
  renderWithQueryClient(<Harness />);
  const open = await screen.findByTestId('ontology-bind-property-first');
  await waitFor(() => expect(open).toBeEnabled());
  fireEvent.click(open);
  const columns = await screen.findByRole('button', { name: /label.column/ });
  await waitFor(() => expect(columns).toBeEnabled());
  fireEvent.click(columns);
  fireEvent.click(await screen.findByRole('option', { name: 'id' }));
  await waitFor(() =>
    expect(screen.getByTestId('ontology-binding-save')).toBeEnabled()
  );
  fireEvent.click(screen.getByTestId('ontology-binding-remove-second'));
  await waitFor(() => expect(http.put).toHaveBeenCalledTimes(1));

  expect(screen.getByTestId('ontology-column-binding-editor')).toBeVisible();
  expect(screen.getByTestId('ontology-binding-save')).toBeDisabled();
  expect(screen.getByTestId('ontology-binding-remove-first')).toBeDisabled();

  await act(async () => finish());
  await waitFor(() =>
    expect(showSuccessToast).toHaveBeenCalledWith(
      'message.ontology-binding-saved-read-unavailable'
    )
  );

  expect(screen.getByTestId('ontology-binding-save')).toBeDisabled();

  fireEvent.click(screen.getByTestId('ontology-binding-remove-first'));

  expect(http.put).toHaveBeenCalledTimes(1);

  failRead = false;
  fireEvent.click(screen.getByRole('button', { name: 'Read bindings' }));
  await waitFor(() =>
    expect(screen.getByTestId('ontology-binding-remove-first')).toBeEnabled()
  );

  expect(
    screen.queryByTestId('ontology-binding-remove-second')
  ).not.toBeInTheDocument();
  expect(http.put).toHaveBeenCalledTimes(1);

  fireEvent.click(screen.getByTestId('ontology-binding-remove-first'));
  await waitFor(() => expect(http.put).toHaveBeenCalledTimes(2));

  expect(http.put).toHaveBeenLastCalledWith(
    '/ontologyConcepts/concept/bindings',
    {
      expectedRevision: 1,
      asset: {
        assetId: 'table',
        assetType: 'table',
        columns: [{ propertyId: 'concurrent', columnPath: ['retained'] }],
      },
    }
  );

  await waitFor(() =>
    expect(
      screen.queryByTestId('ontology-binding-remove-first')
    ).not.toBeInTheDocument()
  );
});
