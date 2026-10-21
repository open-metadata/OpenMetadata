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
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { DataType } from '../../../../generated/entity/data/table';
import {
  AssetType,
  OntologyConceptBindingsResponse,
  State,
} from '../../../../generated/type/ontologyConceptBindingsResponse';
import {
  getOntologyConceptBindings,
  putOntologyConceptBinding,
} from '../../../../rest/ontologyAPI';
import { searchTableColumnsById } from '../../../../rest/tableAPI';
import { renderWithQueryClient } from '../../../../test/unit/test-utils';
import OntologyColumnBindingEditor from './OntologyColumnBindingEditor';

jest.mock('../../../../rest/ontologyAPI');
jest.mock('../../../../rest/tableAPI');
jest.mock('../../../../utils/ToastUtils', () => ({
  showErrorToast: jest.fn(),
}));

it('recovers from a stale revision and preserves concurrently added assignments on retry', async () => {
  const response = (revision: number): OntologyConceptBindingsResponse => ({
    revision,
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
        columns: revision
          ? [
              {
                propertyId: 'other',
                columnPath: ['retained'],
                state: State.Unresolved,
              },
            ]
          : [],
      },
    ],
  });
  (
    getOntologyConceptBindings as jest.MockedFunction<
      typeof getOntologyConceptBindings
    >
  ).mockResolvedValue(response(1));
  const update = putOntologyConceptBinding as jest.MockedFunction<
    typeof putOntologyConceptBinding
  >;
  update
    .mockRejectedValueOnce(new Error('Conflict'))
    .mockResolvedValueOnce(response(2));
  (
    searchTableColumnsById as jest.MockedFunction<typeof searchTableColumnsById>
  ).mockResolvedValue({
    data: [
      {
        name: 'id.code',
        dataType: DataType.String,
        fullyQualifiedName: 'service.db.schema.customers."id.code"',
      },
    ],
    paging: { total: 1 },
  });
  const onClose = jest.fn();
  const { queryClient, rerender } = renderWithQueryClient(<div />);
  queryClient.setQueryData(
    ['ontology-concept-bindings', 'concept'],
    response(0)
  );
  rerender(
    <OntologyColumnBindingEditor
      conceptId="concept"
      propertyId="customer-id"
      onClose={onClose}
    />
  );
  await waitFor(() =>
    expect(screen.getByRole('button', { name: /label.column/ })).toBeEnabled()
  );
  fireEvent.click(screen.getByRole('button', { name: /label.column/ }));
  fireEvent.click(await screen.findByRole('option', { name: /id.code/ }));
  fireEvent.click(screen.getByTestId('ontology-binding-save'));
  await waitFor(() =>
    expect(update).toHaveBeenCalledWith(
      'concept',
      expect.objectContaining({ expectedRevision: 0 })
    )
  );
  await waitFor(() =>
    expect(
      queryClient.getQueryData(['ontology-concept-bindings', 'concept'])
    ).toEqual(response(1))
  );

  expect(onClose).not.toHaveBeenCalled();

  await waitFor(() =>
    expect(screen.getByTestId('ontology-binding-save')).toBeEnabled()
  );
  fireEvent.click(screen.getByTestId('ontology-binding-save'));
  await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));

  expect(update).toHaveBeenLastCalledWith('concept', {
    expectedRevision: 1,
    asset: {
      assetId: 'table',
      assetType: 'table',
      columns: [
        { propertyId: 'other', columnPath: ['retained'] },
        { propertyId: 'customer-id', columnPath: ['id.code'] },
      ],
    },
  });
});
