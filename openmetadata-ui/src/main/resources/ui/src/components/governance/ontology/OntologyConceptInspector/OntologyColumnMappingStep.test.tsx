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
import { DataType } from '../../../../generated/entity/data/table';
import {
  AssetType,
  OntologyConceptBindingsResponse,
  State,
} from '../../../../generated/type/ontologyConceptBindingsResponse';
import APIClient from '../../../../rest/axiosClient';
import {
  useEnUsTranslations,
  useKeyEchoTranslations,
} from '../../../../test/unit/enUsTranslation';
import { renderWithQueryClient } from '../../../../test/unit/test-utils';
import { showErrorToast, showSuccessToast } from '../../../../utils/ToastUtils';
import OntologyColumnMappingStep from './OntologyColumnMappingStep';

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
const TABLE_FQN = 'service.db.schema.patients';
const table = {
  id: 'table',
  type: 'table',
  name: 'patients',
  fullyQualifiedName: TABLE_FQN,
};
const properties = [
  { id: 'p-key', label: 'Patient Key', isIdentifier: true },
  { id: 'p-dob', label: 'dateOfBirth' },
  { id: 'p-name', label: 'Patient Name' },
];
const columnPage = {
  data: ['patient_id', 'date_of_birth', 'patient_name', 'created_at'].map(
    (name) => ({
      name,
      dataType: DataType.String,
      fullyQualifiedName: `${TABLE_FQN}.${name}`,
    })
  ),
  paging: { total: 4 },
};
const bindings = (
  revision: number,
  columns: OntologyConceptBindingsResponse['assets'][number]['columns'] = []
): OntologyConceptBindingsResponse => ({
  revision,
  assets: [
    {
      assetId: 'table',
      assetType: AssetType.Table,
      asset: table,
      columns,
    },
  ],
});

const renderStep = (
  snapshot: OntologyConceptBindingsResponse,
  onClose = jest.fn()
) => {
  http.get.mockImplementation(async (url) => ({
    data: url.includes('/columns/search') ? columnPage : snapshot,
  }));
  const view = renderWithQueryClient(<div />);
  view.queryClient.setQueryData(['ontology-concept-bindings', 'concept'], {
    kind: 'complete',
    ...snapshot,
  });
  view.rerender(
    <OntologyColumnMappingStep
      assets={[table]}
      conceptId="concept"
      conceptName="Patient"
      properties={properties}
      onClose={onClose}
    />
  );

  return { ...view, onClose };
};

const row = async (column: string) =>
  (await screen.findByTestId(
    `ontology-column-mapping-row-${column}`
  )) as HTMLElement;
const propertyButton = (element: HTMLElement) =>
  within(element).getByRole('button', { name: /label.property/ });

beforeEach(() => {
  jest.clearAllMocks();
  http.get.mockReset();
  http.put.mockReset();
});

it('pre-fills each column with the property its name suggests and marks it', async () => {
  renderStep(bindings(3));

  const id = await row('patient_id');
  const dob = await row('date_of_birth');
  const created = await row('created_at');

  expect(propertyButton(id)).toHaveTextContent('Patient Key');
  expect(propertyButton(dob)).toHaveTextContent('dateOfBirth');
  expect(propertyButton(await row('patient_name'))).toHaveTextContent(
    'Patient Name'
  );
  expect(within(id).getByText('label.ontology-suggested-column')).toBeVisible();
  expect(within(id).getByRole('checkbox')).toBeChecked();
  expect(within(created).getByRole('checkbox')).not.toBeChecked();
  expect(
    within(created).queryByText('label.ontology-suggested-column')
  ).not.toBeInTheDocument();
});

it('saves exactly the checked rows, with one row unchecked and one changed, in one write', async () => {
  const { onClose } = renderStep(bindings(3));
  http.put.mockResolvedValue({ data: {} });

  fireEvent.click(within(await row('patient_name')).getByRole('checkbox'));
  const dob = await row('date_of_birth');
  fireEvent.click(propertyButton(dob));
  fireEvent.click(await screen.findByRole('option', { name: 'Patient Name' }));

  expect(
    within(dob).queryByText('label.ontology-suggested-column')
  ).not.toBeInTheDocument();

  fireEvent.click(screen.getByTestId('ontology-column-mapping-save'));
  await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));

  expect(http.put).toHaveBeenCalledTimes(1);
  expect(http.put).toHaveBeenCalledWith('/ontologyConcepts/concept/bindings', {
    expectedRevision: 3,
    asset: {
      assetId: 'table',
      assetType: 'table',
      columns: [
        { propertyId: 'p-key', columnPath: ['patient_id'] },
        { propertyId: 'p-name', columnPath: ['date_of_birth'] },
      ],
    },
  });
  expect(showSuccessToast).toHaveBeenCalledWith('label.saved');
});

it('checks a row when a property is chosen for it', async () => {
  renderStep(bindings(3));
  http.put.mockResolvedValue({ data: {} });

  const created = await row('created_at');
  fireEvent.click(propertyButton(created));
  fireEvent.click(await screen.findByRole('option', { name: 'dateOfBirth' }));

  expect(within(created).getByRole('checkbox')).toBeChecked();
});

it('leaves the table linked with no column bindings when skipped', async () => {
  const { onClose } = renderStep(bindings(3));
  await row('patient_id');

  fireEvent.click(screen.getByTestId('ontology-column-mapping-skip'));

  expect(onClose).toHaveBeenCalledTimes(1);
  expect(http.put).not.toHaveBeenCalled();
});

it('shows a table that is already bound as it is, and keeps bindings the list cannot show', async () => {
  const { onClose } = renderStep(
    bindings(5, [
      {
        propertyId: 'p-name',
        columnPath: ['created_at'],
        state: State.Resolved,
      },
      { propertyId: 'p-dob', columnPath: ['dropped'], state: State.Unresolved },
    ])
  );
  http.put.mockResolvedValue({ data: {} });

  const created = await row('created_at');

  expect(propertyButton(created)).toHaveTextContent('Patient Name');
  expect(within(created).getByRole('checkbox')).toBeChecked();
  expect(
    within(created).queryByText('label.ontology-suggested-column')
  ).not.toBeInTheDocument();

  fireEvent.click(within(await row('patient_id')).getByRole('checkbox'));
  fireEvent.click(within(await row('patient_name')).getByRole('checkbox'));
  fireEvent.click(within(await row('date_of_birth')).getByRole('checkbox'));
  fireEvent.click(screen.getByTestId('ontology-column-mapping-save'));
  await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));

  expect(http.put.mock.calls[0][1]).toEqual({
    expectedRevision: 5,
    asset: {
      assetId: 'table',
      assetType: 'table',
      columns: [
        { propertyId: 'p-name', columnPath: ['created_at'] },
        { propertyId: 'p-dob', columnPath: ['dropped'] },
      ],
    },
  });
});

it('reports a conflict and stays open so the person can retry', async () => {
  const { onClose } = renderStep(bindings(3));
  http.put.mockRejectedValue({ isAxiosError: true, response: { status: 409 } });
  await row('patient_id');

  fireEvent.click(screen.getByTestId('ontology-column-mapping-save'));
  await waitFor(() =>
    expect(showErrorToast).toHaveBeenCalledWith(
      'message.ontology-binding-conflict'
    )
  );

  expect(onClose).not.toHaveBeenCalled();
  expect(screen.getByTestId('ontology-column-mapping-step')).toBeVisible();
});

const putBody = () =>
  http.put.mock.calls[0][1] as {
    asset: { columns: { propertyId: string; columnPath: string[] }[] };
  };

it('keeps a column second bound property when an unrelated row changes', async () => {
  const { onClose } = renderStep(
    bindings(7, [
      {
        propertyId: 'p-key',
        columnPath: ['patient_id'],
        state: State.Resolved,
      },
      {
        propertyId: 'p-name',
        columnPath: ['patient_id'],
        state: State.Resolved,
      },
    ])
  );
  http.put.mockResolvedValue({ data: {} });

  const id = await row('patient_id');

  expect(propertyButton(id)).toHaveTextContent('Patient Key');
  expect(
    within(id).getByText('message.ontology-column-extra-bindings')
  ).toBeVisible();

  fireEvent.click(within(await row('date_of_birth')).getByRole('checkbox'));
  fireEvent.click(screen.getByTestId('ontology-column-mapping-save'));
  await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));

  expect(putBody().asset.columns).toEqual(
    expect.arrayContaining([
      { propertyId: 'p-key', columnPath: ['patient_id'] },
      { propertyId: 'p-name', columnPath: ['patient_id'] },
    ])
  );
  expect(putBody().asset.columns).toHaveLength(3);
});

it('keeps a resolved binding on a column the step does not list', async () => {
  const { onClose } = renderStep(
    bindings(7, [
      {
        propertyId: 'p-dob',
        columnPath: ['legacy_dob'],
        state: State.Resolved,
      },
    ])
  );
  http.put.mockResolvedValue({ data: {} });
  await row('patient_id');

  fireEvent.click(screen.getByTestId('ontology-column-mapping-save'));
  await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));

  expect(putBody().asset.columns).toEqual([
    { propertyId: 'p-key', columnPath: ['patient_id'] },
    { propertyId: 'p-dob', columnPath: ['date_of_birth'] },
    { propertyId: 'p-name', columnPath: ['patient_name'] },
    { propertyId: 'p-dob', columnPath: ['legacy_dob'] },
  ]);
});

it('says so when the column cap cuts a table list, and still keeps bindings past it', async () => {
  const page = (offset: number) => ({
    data: Array.from({ length: 100 }, (_, i) => ({
      name: `c${offset + i}`,
      dataType: DataType.String,
      fullyQualifiedName: `${TABLE_FQN}.c${offset + i}`,
    })),
    paging: { total: 5000 },
  });
  const snapshot = bindings(4, [
    { propertyId: 'p-dob', columnPath: ['c4999'], state: State.Resolved },
  ]);
  http.get.mockImplementation(async (url, config) => ({
    data: url.includes('/columns/search')
      ? page((config?.params as { offset: number }).offset)
      : snapshot,
  }));
  const view = renderWithQueryClient(<div />);
  view.queryClient.setQueryData(['ontology-concept-bindings', 'concept'], {
    kind: 'complete',
    ...snapshot,
  });
  const onClose = jest.fn();
  http.put.mockResolvedValue({ data: {} });
  view.rerender(
    <OntologyColumnMappingStep
      assets={[table]}
      conceptId="concept"
      conceptName="Patient"
      properties={properties}
      onClose={onClose}
    />
  );

  expect(
    await screen.findByText('message.ontology-column-list-truncated')
  ).toBeVisible();

  fireEvent.click(screen.getByTestId('ontology-column-mapping-save'));
  await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));

  expect(putBody().asset.columns).toContainEqual({
    propertyId: 'p-dob',
    columnPath: ['c4999'],
  });
}, 60_000);

describe('when a table columns fail to load', () => {
  const second = { id: 'table-2', type: 'table', name: 'visits' };
  const snapshot: OntologyConceptBindingsResponse = {
    revision: 9,
    assets: [
      {
        assetId: 'table',
        assetType: AssetType.Table,
        asset: table,
        columns: [
          {
            propertyId: 'p-key',
            columnPath: ['patient_id'],
            state: State.Resolved,
          },
        ],
      },
      {
        assetId: 'table-2',
        assetType: AssetType.Table,
        asset: { ...second, fullyQualifiedName: 'service.db.schema.visits' },
        columns: [
          {
            propertyId: 'p-dob',
            columnPath: ['visit_date'],
            state: State.Resolved,
          },
        ],
      },
    ],
  };
  const renderTwo = (failing: string, onClose = jest.fn()) => {
    let failures = 1;
    http.get.mockImplementation(async (url) => {
      if (url.includes(`/${failing}/columns/search`) && failures-- > 0) {
        throw new Error('boom');
      }
      if (url.includes('/table-2/columns/search')) {
        return {
          data: {
            data: [
              {
                name: 'visit_date',
                dataType: DataType.Date,
                fullyQualifiedName: 'service.db.schema.visits.visit_date',
              },
            ],
            paging: { total: 1 },
          },
        };
      }

      return { data: url.includes('/columns/search') ? columnPage : snapshot };
    });
    const view = renderWithQueryClient(<div />);
    view.queryClient.setQueryData(['ontology-concept-bindings', 'concept'], {
      kind: 'complete',
      ...snapshot,
    });
    view.rerender(
      <OntologyColumnMappingStep
        assets={[
          table,
          { ...second, fullyQualifiedName: 'service.db.schema.visits' },
        ]}
        conceptId="concept"
        conceptName="Patient"
        properties={properties}
        onClose={onClose}
      />
    );

    return onClose;
  };

  it('shows an error with Retry, and writes only the table that loaded', async () => {
    const onClose = renderTwo('table');
    http.put.mockResolvedValue({ data: {} });
    const failed = await screen.findByTestId(
      'ontology-column-mapping-table-table'
    );
    await within(failed).findByText('message.temporary-error-try-reloading');
    await row('visit_date');

    fireEvent.click(screen.getByTestId('ontology-column-mapping-save'));
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));

    expect(http.put).toHaveBeenCalledTimes(1);
    expect(putBody()).toEqual({
      expectedRevision: 9,
      asset: {
        assetId: 'table-2',
        assetType: 'table',
        columns: [{ propertyId: 'p-dob', columnPath: ['visit_date'] }],
      },
    });
  });

  it('lists the columns once Retry succeeds', async () => {
    renderTwo('table');
    const failed = await screen.findByTestId(
      'ontology-column-mapping-table-table'
    );
    await within(failed).findByText('message.temporary-error-try-reloading');
    fireEvent.click(
      within(failed).getByRole('button', { name: 'label.retry' })
    );

    expect(await row('patient_id')).toBeVisible();
    expect(
      within(failed).queryByText('message.temporary-error-try-reloading')
    ).not.toBeInTheDocument();
  });

  it('disables Save when every table failed to load', async () => {
    http.get.mockImplementation(async (url) => {
      if (url.includes('/columns/search')) {
        throw new Error('boom');
      }

      return { data: bindings(3) };
    });
    const view = renderWithQueryClient(<div />);
    view.queryClient.setQueryData(['ontology-concept-bindings', 'concept'], {
      kind: 'complete',
      ...bindings(3),
    });
    view.rerender(
      <OntologyColumnMappingStep
        assets={[table]}
        conceptId="concept"
        conceptName="Patient"
        properties={properties}
        onClose={jest.fn()}
      />
    );
    await screen.findByText('message.temporary-error-try-reloading');

    expect(screen.getByTestId('ontology-column-mapping-save')).toBeDisabled();
  });
});

describe('when a write is saved but the bindings cannot be re-read', () => {
  const second = { id: 'table-2', type: 'table', name: 'visits' };
  const visits = { ...second, fullyQualifiedName: 'service.db.schema.visits' };
  const snapshot: OntologyConceptBindingsResponse = {
    revision: 9,
    assets: [
      {
        assetId: 'table',
        assetType: AssetType.Table,
        asset: table,
        columns: [],
      },
      {
        assetId: 'table-2',
        assetType: AssetType.Table,
        asset: visits,
        columns: [
          {
            propertyId: 'p-dob',
            columnPath: ['visit_date'],
            state: State.Resolved,
          },
        ],
      },
    ],
  };
  const visitColumns = {
    data: [
      {
        name: 'visit_date',
        dataType: DataType.Date,
        fullyQualifiedName: 'service.db.schema.visits.visit_date',
      },
    ],
    paging: { total: 1 },
  };
  let rereadsToFail = 1;
  let written = false;

  const renderAssets = (
    assets: (typeof table)[],
    view: OntologyConceptBindingsResponse,
    onClose = jest.fn()
  ) => {
    http.get.mockImplementation(async (url) => {
      if (url.includes('/table-2/columns/search')) {
        return { data: visitColumns };
      }
      if (url.includes('/columns/search')) {
        return { data: columnPage };
      }
      if (written && rereadsToFail-- > 0) {
        throw new Error('offline');
      }

      return { data: { ...view, revision: written ? 10 : view.revision } };
    });
    http.put.mockImplementation(async () => {
      written = true;

      return { data: {} };
    });
    const rendered = renderWithQueryClient(<div />);
    rendered.queryClient.setQueryData(
      ['ontology-concept-bindings', 'concept'],
      { kind: 'complete', ...view }
    );
    rendered.rerender(
      <OntologyColumnMappingStep
        assets={assets}
        conceptId="concept"
        conceptName="Patient"
        properties={properties}
        onClose={onClose}
      />
    );

    return onClose;
  };

  beforeEach(() => {
    rereadsToFail = 1;
    written = false;
    useEnUsTranslations();
  });

  afterEach(() => {
    useKeyEchoTranslations();
  });

  it('stops, names the table it did not save, and stays open with the rows kept', async () => {
    const onClose = renderAssets([table, visits], snapshot);
    await row('visit_date');
    fireEvent.click(within(await row('patient_name')).getByRole('checkbox'));

    fireEvent.click(screen.getByTestId('ontology-column-mapping-save'));

    expect(await screen.findByText(/Not saved: visits\./)).toBeVisible();
    expect(http.put).toHaveBeenCalledTimes(1);
    expect(http.put.mock.calls[0][1]).toMatchObject({
      asset: { assetId: 'table' },
    });
    expect(showSuccessToast).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
    expect(
      within(await row('patient_name')).getByRole('checkbox')
    ).not.toBeChecked();
  });

  it('writes the remaining table on the next Save, against the re-read revision', async () => {
    const onClose = renderAssets([table, visits], snapshot);
    await row('visit_date');
    fireEvent.click(screen.getByTestId('ontology-column-mapping-save'));
    await screen.findByText(/Not saved: visits\./);

    await waitFor(() =>
      expect(screen.getByTestId('ontology-column-mapping-save')).toBeEnabled()
    );
    fireEvent.click(screen.getByTestId('ontology-column-mapping-save'));
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));

    expect(http.put.mock.calls.map(([, body]) => body)).toEqual([
      expect.objectContaining({
        expectedRevision: 9,
        asset: expect.objectContaining({ assetId: 'table' }),
      }),
      expect.objectContaining({
        expectedRevision: 10,
        asset: expect.objectContaining({ assetId: 'table' }),
      }),
      expect.objectContaining({
        expectedRevision: 10,
        asset: expect.objectContaining({ assetId: 'table-2' }),
      }),
    ]);
  });

  it('keeps closing with the saved-but-stale message when no later table has anything to write', async () => {
    const onClose = renderAssets([table, visits], {
      ...snapshot,
      assets: [snapshot.assets[0], { ...snapshot.assets[1], columns: [] }],
    });
    const visitDate = await row('visit_date');
    if ((within(visitDate).getByRole('checkbox') as HTMLInputElement).checked) {
      fireEvent.click(within(visitDate).getByRole('checkbox'));
    }
    fireEvent.click(screen.getByTestId('ontology-column-mapping-save'));
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));

    expect(http.put).toHaveBeenCalledTimes(1);
    expect(showSuccessToast).toHaveBeenCalledWith(
      'The change was saved, but the bindings could not refresh. Retry to load them before editing.'
    );
  });

  it('closes with the saved-but-stale message when the only table was written', async () => {
    const onClose = renderAssets([table], snapshot);
    await row('patient_id');
    fireEvent.click(screen.getByTestId('ontology-column-mapping-save'));
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));

    expect(http.put).toHaveBeenCalledTimes(1);
    expect(showSuccessToast).toHaveBeenCalledWith(
      'The change was saved, but the bindings could not refresh. Retry to load them before editing.'
    );
  });
});
