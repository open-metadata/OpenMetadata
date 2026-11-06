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
