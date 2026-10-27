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
import { UpdateOntologyConceptBinding } from '../../../../generated/api/data/updateOntologyConceptBinding';
import {
  Access,
  Operation,
} from '../../../../generated/entity/policies/accessControl/resourcePermission';
import {
  AssetBinding,
  AssetType,
  OntologyConceptBindingsResponse,
  State,
} from '../../../../generated/type/ontologyConceptBindingsResponse';
import APIClient from '../../../../rest/axiosClient';
import { renderWithQueryClient } from '../../../../test/unit/test-utils';
import { showSuccessToast } from '../../../../utils/ToastUtils';
import OntologyConceptAssets from './OntologyConceptAssets';

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
const asset = (id: string): AssetBinding => ({
  assetId: id,
  assetType: AssetType.Table,
  asset: {
    id,
    name: id,
    type: 'table',
    fullyQualifiedName: `service.db.schema.${id}`,
  },
  columns: [],
});
const retainedColumns = [
  {
    propertyId: 'retained',
    columnPath: ['customer_id'],
    state: State.Resolved,
  },
];
const stored = (): OntologyConceptBindingsResponse => ({
  revision: 4,
  assets: [{ ...asset('old-table'), columns: retainedColumns }],
});
const renderAssets = (id = 'customer') =>
  renderWithQueryClient(
    <MemoryRouter>
      <OntologyConceptAssets
        canEdit
        conceptId={id}
        key={id}
        presentation={{ kind: 'edit' }}
      />
    </MemoryRouter>
  );
const selectAll = async (firstOption = 'new-one') => {
  const add = await screen.findByTestId('ontology-native-link-assets');
  await waitFor(() => expect(add).toBeEnabled());
  fireEvent.click(add);
  const picker = await screen.findByTestId('ontology-data-asset-picker');
  await within(picker).findByRole('checkbox', { name: firstOption });
  fireEvent.click(
    within(picker).getByRole('checkbox', { name: 'label.select-all' })
  );
  fireEvent.click(within(picker).getByTestId('ontology-data-asset-save'));

  return picker;
};
const searchResult = (ids: string[]) => ({
  data: {
    hits: {
      total: { value: ids.length },
      hits: ids.map((id) => ({
        _source: { ...asset(id).asset, entityType: 'table' },
      })),
    },
  },
});
const permissions = (operations: Operation[]) => ({
  data: {
    resource: 'table',
    permissions: operations.map((operation) => ({
      operation,
      access: Access.Allow,
    })),
  },
});
// A small stateful server: reads return a copy of the state, writes advance
// its revision after checking the expected one, as the real service does.
const serve = (
  state: OntologyConceptBindingsResponse,
  searchIds: string[],
  granted: Operation[] = []
) => {
  http.get.mockImplementation(async (url) => {
    if (url.startsWith('/search/query?')) {
      return searchResult(searchIds);
    }
    if (!url.includes('/bindings')) {
      return permissions(granted);
    }

    return { data: { revision: state.revision, assets: [...state.assets] } };
  });
  http.put.mockImplementation(async (_url, data) => {
    const body = data as UpdateOntologyConceptBinding;

    expect(body.expectedRevision).toBe(state.revision);

    state.assets.push(asset(body.asset.assetId));
    state.revision += 1;

    return { data: { revision: 999, assets: [] } };
  });
  http.delete.mockImplementation(async (url) => {
    const assetId = url.slice(url.lastIndexOf('/') + 1);
    state.assets = state.assets.filter((item) => item.assetId !== assetId);
    state.revision += 1;

    return { data: { revision: 999, assets: [] } };
  });
};

beforeEach(() => {
  jest.clearAllMocks();
  http.get.mockReset();
  http.put.mockReset();
  http.delete.mockReset();
});

it('keeps confirmed and unattempted selections separate after a failed complete read', async () => {
  const state = stored();
  let failRead = false;
  http.get.mockImplementation(async (url, config) => {
    if (url.startsWith('/search/query?')) {
      return searchResult(['old-table', 'new-one', 'new-two']);
    }
    if (!url.includes('/bindings')) {
      return { data: { resource: 'table', permissions: [] } };
    }
    const after = (config?.params as { after?: string } | undefined)?.after;
    if (after === 'hidden') {
      if (failRead) {
        throw new Error('continuation unavailable');
      }

      return { data: { revision: state.revision, assets: [], after: 'last' } };
    }

    return {
      data:
        after === 'last'
          ? state
          : { revision: state.revision, assets: [], after: 'hidden' },
    };
  });
  http.put.mockImplementation(async (_url, data) => {
    const body = data as UpdateOntologyConceptBinding;

    expect(body.expectedRevision).toBe(state.revision);

    state.assets.push(asset(body.asset.assetId));
    state.revision += 1;
    failRead = true;

    return { data: { revision: 999, assets: [], after: 'ignored' } };
  });
  renderAssets();
  const picker = await selectAll();
  const status = await within(picker).findByTestId(
    'ontology-native-batch-status'
  );

  expect(status).toHaveTextContent('message.ontology-binding-read-unavailable');
  expect(
    within(picker).getByRole('checkbox', { name: 'new-one' })
  ).not.toBeChecked();
  expect(
    within(picker).getByRole('checkbox', { name: 'new-two' })
  ).toBeChecked();
  expect(within(picker).getByTestId('ontology-data-asset-save')).toBeDisabled();
  expect(
    screen.getByTestId('ontology-native-asset-remove-old-table')
  ).toBeDisabled();
  expect(http.put).toHaveBeenCalledTimes(1);

  failRead = false;
  fireEvent.click(screen.getByRole('button', { name: 'label.retry' }));
  await waitFor(() =>
    expect(within(picker).getByTestId('ontology-data-asset-save')).toBeEnabled()
  );

  expect(http.put).toHaveBeenCalledTimes(1);
  expect(
    within(picker).getByRole('checkbox', { name: 'new-one' })
  ).toBeDisabled();
  expect(
    within(picker).getByRole('checkbox', { name: 'old-table' })
  ).toBeDisabled();
  expect(state.assets[0].columns).toEqual(retainedColumns);

  fireEvent.click(within(picker).getByTestId('ontology-data-asset-save'));
  await waitFor(() => expect(http.put).toHaveBeenCalledTimes(2));

  expect(http.put.mock.calls[1][1]).toEqual({
    expectedRevision: 5,
    asset: { assetId: 'new-two', assetType: 'table', columns: [] },
  });
});

it.each([
  { status: 409, committed: false, message: 'conflict' },
  { status: undefined, committed: false, message: 'unconfirmed' },
  { status: undefined, committed: true, message: 'unconfirmed' },
])(
  'stops a $message batch and does not replay an ambiguous committed write ($committed)',
  async ({ status, committed, message }) => {
    const state = stored();
    http.get.mockImplementation(async (url) => {
      if (url.startsWith('/search/query?')) {
        return searchResult(['new-one', 'new-two', 'new-three']);
      }

      return {
        data: url.includes('/bindings')
          ? state
          : { resource: 'table', permissions: [] },
      };
    });
    let attempts = 0;
    http.put.mockImplementation(async (_url, data) => {
      const body = data as UpdateOntologyConceptBinding;

      expect(body.expectedRevision).toBe(state.revision);

      attempts += 1;
      if (attempts === 2) {
        if (committed) {
          state.assets.push({
            ...asset('new-two'),
            columns: retainedColumns,
          });
          state.revision += 1;
        }

        throw status
          ? { isAxiosError: true, response: { status } }
          : new Error('response lost');
      }
      state.assets.push(asset(body.asset.assetId));
      state.revision += 1;

      return { data: { revision: 999, assets: [] } };
    });
    renderAssets();
    const picker = await selectAll();

    expect(
      await within(picker).findByTestId('ontology-native-batch-status')
    ).toHaveTextContent(`message.ontology-binding-${message}`);
    expect(http.put).toHaveBeenCalledTimes(2);
    expect(
      within(picker).getByRole('checkbox', { name: 'new-one' })
    ).not.toBeChecked();
    expect(
      within(picker).getByRole('checkbox', { name: 'new-three' })
    ).toBeChecked();

    await waitFor(() =>
      expect(
        within(picker).getByTestId('ontology-data-asset-save')
      ).toBeEnabled()
    );
    fireEvent.click(within(picker).getByTestId('ontology-data-asset-save'));
    await waitFor(() =>
      expect(
        screen.queryByTestId('ontology-data-asset-picker')
      ).not.toBeInTheDocument()
    );

    expect(
      http.put.mock.calls
        .slice(2)
        .map((call) => (call[1] as UpdateOntologyConceptBinding).asset.assetId)
    ).toEqual(committed ? ['new-three'] : ['new-two', 'new-three']);
    expect(
      state.assets.find((item) => item.assetId === 'new-two')?.columns
    ).toEqual(committed ? retainedColumns : []);
  }
);

it('keeps a successful removal confirmed and restores the list using GET only', async () => {
  const state = stored();
  let failRead = false;
  http.get.mockImplementation(async (url) => {
    if (!url.includes('/bindings')) {
      return { data: { resource: 'table', permissions: [] } };
    }
    if (failRead) {
      throw new Error('read failed');
    }

    return { data: state };
  });
  http.delete.mockImplementation(async () => {
    state.assets = [];
    state.revision += 1;
    failRead = true;

    return { data: state };
  });
  renderAssets();
  const remove = await screen.findByTestId(
    'ontology-native-asset-remove-old-table'
  );
  await waitFor(() => expect(remove).toBeEnabled());
  fireEvent.click(remove);
  await waitFor(() =>
    expect(showSuccessToast).toHaveBeenCalledWith(
      'message.ontology-binding-saved-read-unavailable'
    )
  );
  await waitFor(() =>
    expect(
      screen.getByTestId('ontology-native-asset-remove-old-table')
    ).toBeDisabled()
  );
  failRead = false;
  fireEvent.click(screen.getByRole('button', { name: 'label.retry' }));
  await waitFor(() =>
    expect(
      screen.queryByTestId('ontology-native-asset-remove-old-table')
    ).not.toBeInTheDocument()
  );

  expect(http.delete).toHaveBeenCalledTimes(1);
  expect(http.put).not.toHaveBeenCalled();
});

it('stops the unsent picker tail when the concept switches during a write', async () => {
  const state = stored();
  http.get.mockImplementation(async (url) => {
    if (url.startsWith('/search/query?')) {
      return searchResult(['new-one', 'new-two']);
    }
    if (!url.includes('/bindings')) {
      return { data: { resource: 'table', permissions: [] } };
    }

    return {
      data: url.includes('/order/') ? { revision: 9, assets: [] } : state,
    };
  });
  let finish!: () => void;
  http.put.mockImplementation(
    () =>
      new Promise((resolve) => {
        finish = () => {
          state.assets.push(asset('new-one'));
          state.revision += 1;
          resolve({ data: state });
        };
      })
  );
  const { rerender, queryClient } = renderAssets();
  await selectAll();
  await waitFor(() => expect(http.put).toHaveBeenCalledTimes(1));
  rerender(
    <MemoryRouter>
      <OntologyConceptAssets
        canEdit
        conceptId="order"
        key="order"
        presentation={{ kind: 'edit' }}
      />
    </MemoryRouter>
  );
  await act(async () => finish());
  await waitFor(() => expect(queryClient.isMutating()).toBe(0));

  expect(http.put).toHaveBeenCalledTimes(1);
  expect(
    queryClient.getQueryData(['ontology-concept-bindings', 'customer'])
  ).toEqual({ kind: 'complete', ...state });
  expect(
    queryClient.getQueryData(['ontology-concept-bindings', 'order'])
  ).toEqual({ kind: 'complete', revision: 9, assets: [] });
  expect(
    screen.queryByTestId('ontology-data-asset-picker')
  ).not.toBeInTheDocument();
  expect(screen.queryByText('old-table')).not.toBeInTheDocument();
});

it('adds selected assets serially using re-read revisions and removes a linked asset', async () => {
  const state: OntologyConceptBindingsResponse = { revision: 0, assets: [] };
  serve(state, ['first', 'second'], [Operation.ViewSampleData]);
  renderAssets('concept');
  await selectAll('first');
  await waitFor(() =>
    expect(
      screen.queryByTestId('ontology-data-asset-picker')
    ).not.toBeInTheDocument()
  );

  expect(await screen.findByRole('link', { name: 'first' })).toBeVisible();
  expect(screen.getByRole('link', { name: 'second' })).toBeVisible();
  expect(
    http.put.mock.calls.map(
      ([, body]) => (body as UpdateOntologyConceptBinding).expectedRevision
    )
  ).toEqual([0, 1]);

  await waitFor(() =>
    expect(
      screen.getAllByRole('link', { name: 'label.sample-data' })
    ).toHaveLength(2)
  );
  const remove = screen.getByTestId('ontology-native-asset-remove-first');
  await waitFor(() => expect(remove).toBeEnabled());
  fireEvent.click(remove);
  await waitFor(() =>
    expect(
      screen.queryByRole('link', { name: 'first' })
    ).not.toBeInTheDocument()
  );

  expect(http.delete).toHaveBeenCalledWith(
    '/ontologyConcepts/concept/bindings/table/first',
    { params: { expectedRevision: 2 } }
  );
  expect(screen.getByRole('link', { name: 'second' })).toBeVisible();
});

it('keeps a refused selection available for retry and closes the picker without dropping successful links', async () => {
  const state: OntologyConceptBindingsResponse = { revision: 0, assets: [] };
  serve(state, ['first', 'second']);
  let attempts = 0;
  http.put.mockImplementation(async (_url, data) => {
    attempts += 1;
    if (attempts === 2) {
      throw new Error('Denied');
    }
    const body = data as UpdateOntologyConceptBinding;
    state.assets.push(asset(body.asset.assetId));
    state.revision += 1;

    return { data: { revision: 999, assets: [] } };
  });
  renderAssets('concept');
  const picker = await selectAll('first');

  expect(
    await within(picker).findByTestId('ontology-native-batch-status')
  ).toHaveTextContent('message.ontology-binding-unconfirmed');
  expect(await screen.findByRole('link', { name: 'first' })).toBeVisible();
  expect(
    within(picker).getByRole('checkbox', { name: 'second' })
  ).toBeChecked();
  expect(
    within(picker).getByRole('checkbox', { name: 'first' })
  ).toBeDisabled();
  expect(http.put).toHaveBeenCalledTimes(2);

  fireEvent.click(
    within(picker).getByTestId('ontology-data-asset-picker-close')
  );

  expect(
    screen.queryByTestId('ontology-data-asset-picker')
  ).not.toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'first' })).toBeVisible();
});

it('retries failed binding reads before offering editing', async () => {
  const state: OntologyConceptBindingsResponse = { revision: 0, assets: [] };
  let failRead = true;
  serve(state, []);
  http.get.mockImplementation(async (url) => {
    if (!url.includes('/bindings')) {
      return permissions([]);
    }
    if (failRead) {
      throw new Error('Offline');
    }

    return { data: { revision: state.revision, assets: [...state.assets] } };
  });
  renderAssets('concept');
  const retry = await screen.findByRole('button', { name: 'label.retry' });

  expect(screen.getByTestId('ontology-native-link-assets')).toBeDisabled();

  failRead = false;
  fireEvent.click(retry);
  await waitFor(() =>
    expect(screen.getByTestId('ontology-native-link-assets')).toBeEnabled()
  );

  expect(screen.getByText('message.no-data-available')).toBeVisible();
  expect(
    screen.queryByRole('button', { name: 'label.retry' })
  ).not.toBeInTheDocument();
});

it('does not repeat a link that the re-read already reports as present', async () => {
  const state: OntologyConceptBindingsResponse = { revision: 0, assets: [] };
  serve(state, ['first', 'second']);
  http.put.mockImplementation(async (_url, data) => {
    const body = data as UpdateOntologyConceptBinding;

    expect(body.expectedRevision).toBe(state.revision);

    state.assets.push(asset(body.asset.assetId), asset('second'));
    state.revision += 1;

    return { data: { revision: 999, assets: [] } };
  });
  renderAssets('concept');
  await selectAll('first');
  await waitFor(() =>
    expect(
      screen.queryByTestId('ontology-data-asset-picker')
    ).not.toBeInTheDocument()
  );

  expect(screen.getByRole('link', { name: 'second' })).toBeVisible();
  expect(http.put).toHaveBeenCalledTimes(1);
});
