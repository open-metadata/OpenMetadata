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
import { StrictMode } from 'react';
import { DataType } from '../../../../generated/entity/data/table';
import {
  AssetType,
  OntologyConceptBindingsResponse,
  State,
} from '../../../../generated/type/ontologyConceptBindingsResponse';
import APIClient from '../../../../rest/axiosClient';
import { renderWithQueryClient } from '../../../../test/unit/test-utils';
import { showSuccessToast } from '../../../../utils/ToastUtils';
import OntologyColumnBindingEditor from './OntologyColumnBindingEditor';

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
const columnPage = {
  data: [
    {
      name: 'id.code',
      dataType: DataType.String,
      fullyQualifiedName: 'service.db.schema.customers."id.code"',
    },
  ],
  paging: { total: 1 },
};
const selectColumn = async (editor: HTMLElement) => {
  const button = within(editor).getByRole('button', { name: /label.column/ });
  await waitFor(() => expect(button).toBeEnabled());
  fireEvent.click(button);
  fireEvent.click(await screen.findByRole('option', { name: /id.code/ }));
};

beforeEach(() => {
  jest.clearAllMocks();
  http.get.mockReset();
  http.put.mockReset();
});

it('reports and closes a confirmed edit after StrictMode effect replay', async () => {
  http.get.mockImplementation(async (url) => ({
    data: url.includes('/columns/search') ? columnPage : response(1),
  }));
  http.put.mockResolvedValue({ data: response(1) });
  const onClose = jest.fn();
  const { queryClient, rerender } = renderWithQueryClient(<div />);
  queryClient.setQueryData(['ontology-concept-bindings', 'concept'], {
    kind: 'complete',
    ...response(0),
  });
  rerender(
    <StrictMode>
      <OntologyColumnBindingEditor
        conceptId="concept"
        propertyId="customer-id"
        onClose={onClose}
      />
    </StrictMode>
  );
  await selectColumn(screen.getByTestId('ontology-column-binding-editor'));
  fireEvent.click(screen.getByTestId('ontology-binding-save'));
  await waitFor(() => expect(http.put).toHaveBeenCalledTimes(1));
  await waitFor(() => expect(queryClient.isMutating()).toBe(0));

  expect(showSuccessToast).toHaveBeenCalledWith('label.saved');
  expect(onClose).toHaveBeenCalledTimes(1);
});

it('recovers from a real 409 and preserves concurrently added assignments on explicit retry', async () => {
  let revision = 0;
  http.get.mockImplementation(async (url) => ({
    data: url.includes('/columns/search') ? columnPage : response(revision),
  }));
  http.put
    .mockImplementationOnce(async () => {
      revision = 1;

      throw { isAxiosError: true, response: { status: 409 } };
    })
    .mockImplementationOnce(async () => {
      revision = 2;

      return { data: response(revision) };
    });
  const onClose = jest.fn();
  const { queryClient } = renderWithQueryClient(
    <OntologyColumnBindingEditor
      conceptId="concept"
      propertyId="customer-id"
      onClose={onClose}
    />
  );
  const editor = screen.getByTestId('ontology-column-binding-editor');
  await waitFor(() =>
    expect(
      within(editor).queryByRole('button', { name: /label.column/ })
    ).toBeInTheDocument()
  );
  fireEvent.click(within(editor).getByRole('button', { name: /label.table/ }));
  fireEvent.click(await screen.findByRole('option', { name: /customers/ }));
  await selectColumn(editor);
  fireEvent.click(screen.getByTestId('ontology-binding-save'));
  await waitFor(() =>
    expect(
      queryClient.getQueryData(['ontology-concept-bindings', 'concept'])
    ).toEqual({ kind: 'complete', ...response(1) })
  );

  expect(onClose).not.toHaveBeenCalled();

  await waitFor(() =>
    expect(screen.getByTestId('ontology-binding-save')).toBeEnabled()
  );
  fireEvent.click(screen.getByTestId('ontology-binding-save'));
  await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));

  expect(http.put).toHaveBeenLastCalledWith(
    '/ontologyConcepts/concept/bindings',
    {
      expectedRevision: 1,
      asset: {
        assetId: 'table',
        assetType: 'table',
        columns: [
          { propertyId: 'other', columnPath: ['retained'] },
          { propertyId: 'customer-id', columnPath: ['id.code'] },
        ],
      },
    }
  );
});

it('closes a confirmed column edit after a failed read and blocks another mounted editor', async () => {
  let failRead = false;
  http.get.mockImplementation(async (url) => {
    if (url.includes('/columns/search')) {
      return { data: columnPage };
    }
    if (failRead) {
      throw new Error('read failed');
    }

    return { data: response(0) };
  });
  http.put.mockImplementation(async () => {
    failRead = true;

    return { data: response(50) };
  });
  const onClose = jest.fn();
  const secondClose = jest.fn();
  const { queryClient, rerender } = renderWithQueryClient(<div />);
  queryClient.setQueryData(['ontology-concept-bindings', 'concept'], {
    kind: 'complete',
    ...response(0),
  });
  rerender(
    <>
      <OntologyColumnBindingEditor
        conceptId="concept"
        propertyId="first"
        onClose={onClose}
      />
      <OntologyColumnBindingEditor
        conceptId="concept"
        propertyId="second"
        onClose={secondClose}
      />
    </>
  );
  const [first, second] = screen.getAllByTestId(
    'ontology-column-binding-editor'
  );
  await selectColumn(first);
  await selectColumn(second);
  fireEvent.click(within(first).getByTestId('ontology-binding-save'));
  await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));

  expect(showSuccessToast).toHaveBeenCalledWith(
    'message.ontology-binding-saved-read-unavailable'
  );
  expect(within(second).getByTestId('ontology-binding-save')).toBeDisabled();

  fireEvent.click(within(second).getByTestId('ontology-binding-save'));

  expect(http.put).toHaveBeenCalledTimes(1);
  expect(secondClose).not.toHaveBeenCalled();
});

it('does not close a different concept when an origin write completes', async () => {
  http.get.mockImplementation(async (url) => ({
    data: url.includes('/columns/search') ? columnPage : response(0),
  }));
  let finish!: () => void;
  http.put.mockImplementation(
    () =>
      new Promise((resolve) => {
        finish = () => resolve({ data: response(1) });
      })
  );
  const onClose = jest.fn();
  const { queryClient, rerender } = renderWithQueryClient(<div />);
  queryClient.setQueryData(['ontology-concept-bindings', 'first'], {
    kind: 'complete',
    ...response(0),
  });
  rerender(
    <OntologyColumnBindingEditor
      conceptId="first"
      propertyId="prop"
      onClose={onClose}
    />
  );
  await selectColumn(screen.getByTestId('ontology-column-binding-editor'));
  fireEvent.click(screen.getByTestId('ontology-binding-save'));
  await waitFor(() => expect(http.put).toHaveBeenCalledTimes(1));
  rerender(
    <OntologyColumnBindingEditor
      conceptId="second"
      propertyId="prop"
      onClose={onClose}
    />
  );
  await act(async () => finish());
  await waitFor(() => expect(queryClient.isMutating()).toBe(0));

  expect(onClose).not.toHaveBeenCalled();
  expect(screen.getByTestId('ontology-column-binding-editor')).toBeVisible();
});

it('retries column search and preserves existing assignments while paging to an exact column', async () => {
  let failSearch = true;
  http.get.mockImplementation(async (url, config) => {
    if (!url.includes('/columns/search')) {
      return { data: response(2) };
    }
    if (failSearch) {
      throw new Error('column search unavailable');
    }
    const offset = (config?.params as { offset?: number } | undefined)?.offset;
    const name = offset === 25 ? 'id.code' : 'other';

    return {
      data: {
        data: [{ name, dataType: DataType.String }],
        paging: { total: 26 },
      },
    };
  });
  http.put.mockResolvedValue({ data: response(2) });
  const onClose = jest.fn();
  const { queryClient, rerender } = renderWithQueryClient(<div />);
  queryClient.setQueryData(['ontology-concept-bindings', 'concept'], {
    kind: 'complete',
    ...response(1),
  });
  rerender(
    <OntologyColumnBindingEditor
      conceptId="concept"
      propertyId="selected"
      onClose={onClose}
    />
  );
  const retry = await screen.findByRole('button', { name: 'label.retry' });

  expect(screen.getByTestId('ontology-binding-save')).toBeDisabled();

  failSearch = false;
  fireEvent.click(retry);
  fireEvent.click(await screen.findByRole('button', { name: 'label.next' }));
  await waitFor(() =>
    expect(screen.getByRole('button', { name: 'label.previous' })).toBeEnabled()
  );
  fireEvent.click(screen.getByRole('button', { name: 'label.previous' }));
  await waitFor(() =>
    expect(
      screen.getByRole('button', { name: 'label.previous' })
    ).toBeDisabled()
  );
  fireEvent.change(screen.getByTestId('ontology-binding-column-search'), {
    target: { value: 'id' },
  });
  await waitFor(() =>
    expect(http.get).toHaveBeenLastCalledWith('/tables/table/columns/search', {
      params: expect.objectContaining({ q: 'id', offset: 0 }),
    })
  );
  await waitFor(() =>
    expect(screen.getByRole('button', { name: 'label.next' })).toBeEnabled()
  );
  fireEvent.click(screen.getByRole('button', { name: 'label.next' }));
  await selectColumn(screen.getByTestId('ontology-column-binding-editor'));
  fireEvent.click(screen.getByTestId('ontology-binding-save'));
  await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));

  expect(http.put).toHaveBeenCalledWith('/ontologyConcepts/concept/bindings', {
    expectedRevision: 1,
    asset: {
      assetId: 'table',
      assetType: 'table',
      columns: [
        { propertyId: 'other', columnPath: ['retained'] },
        { propertyId: 'selected', columnPath: ['id.code'] },
      ],
    },
  });
});
