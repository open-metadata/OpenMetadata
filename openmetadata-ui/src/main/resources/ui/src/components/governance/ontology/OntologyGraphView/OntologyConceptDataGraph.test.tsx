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
import { MemoryRouter, useLocation } from 'react-router-dom';
import {
  OntologyConcept,
  OntologyConceptType,
} from '../../../../generated/entity/data/ontologyConcept';
import {
  AssetType,
  OntologyConceptBindingsResponse,
} from '../../../../generated/type/ontologyConceptBindingsResponse';
import APIClient from '../../../../rest/axiosClient';
import { renderWithQueryClient } from '../../../../test/unit/test-utils';
import { OntologyStudioModel } from '../../../../utils/governance/ontology/OntologyStudioModel.utils';
import {
  OntologyGraphHandle,
  OntologyGraphProps,
} from '../../../OntologyExplorer/OntologyExplorer.interface';
import OntologyConceptDataGraph from './OntologyConceptDataGraph';

jest.mock('../../../../rest/axiosClient', () => ({
  get: jest.fn(),
  put: jest.fn(),
  delete: jest.fn(),
}));
jest.mock('../../../OntologyExplorer/OntologyGraphG6', () => {
  const React = jest.requireActual<typeof import('react')>('react');

  return {
    __esModule: true,
    default: React.forwardRef<OntologyGraphHandle, OntologyGraphProps>(
      (props, ref) => {
        const [zoom, setZoom] = React.useState(1);
        React.useImperativeHandle(ref, () => ({
          fitView: async () => setZoom(1),
          zoomIn: () => setZoom((value) => value * 2),
          zoomOut: () => setZoom((value) => value / 2),
          runLayout: () => undefined,
          focusNode: () => undefined,
          getNodePositions: () => ({}),
          exportAsPng: async () => undefined,
          exportAsSvg: async () => undefined,
          clearEdgeSelection: () => undefined,
        }));

        return (
          <div>
            <output data-testid="graph-zoom">{zoom}</output>
            {props.nodes.map((node) => (
              <button key={node.id} onClick={() => props.onNodeClick?.(node)}>
                {node.label}
              </button>
            ))}
          </div>
        );
      }
    ),
  };
});

const http = APIClient as jest.Mocked<typeof APIClient>;
const concept: OntologyConcept = {
  id: 'customer',
  name: 'Customer',
  fullyQualifiedName: 'Owner.Customer',
  iri: 'urn:Customer',
  ontology: { id: 'owner', type: 'ontology' },
  conceptType: OntologyConceptType.OwlClass,
};
const model: OntologyStudioModel = {
  ontology: {
    id: 'owner',
    name: 'Owner',
    fullyQualifiedName: 'Owner',
    iri: 'urn:Owner',
    namespace: 'urn:',
  },
  concepts: [concept],
  properties: [],
  axioms: [],
};
const page = (
  id: string,
  revision: number
): OntologyConceptBindingsResponse => ({
  revision,
  assets: [
    {
      assetId: id,
      assetType: AssetType.Table,
      asset: {
        id,
        type: 'table',
        name: id,
        fullyQualifiedName: `svc.db.schema.${id}`,
      },
      columns: [],
    },
  ],
});
const Location = () => (
  <output data-testid="location">{useLocation().pathname}</output>
);
const view = (selected?: OntologyConcept) => (
  <MemoryRouter>
    <OntologyConceptDataGraph concept={selected} model={model} />
    <Location />
  </MemoryRouter>
);

beforeEach(() => {
  jest.clearAllMocks();
  http.get.mockReset();
});

it('keeps the complete graph during a failed refresh and only replaces it after every recovery page', async () => {
  http.get.mockResolvedValue({ data: page('customers', 1) });
  const { queryClient } = renderWithQueryClient(view(concept));
  await screen.findByRole('button', { name: 'customers' });
  http.get.mockRejectedValueOnce(new Error('read unavailable'));
  fireEvent.click(screen.getByTestId('refresh'));
  await screen.findByText('message.ontology-binding-read-unavailable');

  expect(screen.getByRole('button', { name: 'customers' })).toBeVisible();

  let finish!: () => void;
  http.get
    .mockResolvedValueOnce({ data: { revision: 2, assets: [], after: 'tail' } })
    .mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = () => resolve({ data: page('orders', 3) });
        })
    );
  fireEvent.click(screen.getByRole('button', { name: 'label.retry' }));
  await waitFor(() =>
    expect(http.get).toHaveBeenLastCalledWith(
      '/ontologyConcepts/customer/bindings',
      expect.objectContaining({ params: { after: 'tail', limit: 100 } })
    )
  );

  expect(screen.getByRole('button', { name: 'customers' })).toBeVisible();
  expect(
    screen.queryByRole('button', { name: 'orders' })
  ).not.toBeInTheDocument();

  await act(async () => finish());
  fireEvent.click(await screen.findByRole('button', { name: 'orders' }));

  expect(screen.getByTestId('location')).toHaveTextContent(
    '/table/svc.db.schema.orders'
  );
  expect(
    queryClient.getQueryData(['ontology-concept-bindings', 'customer'])
  ).toEqual({ kind: 'complete', ...page('orders', 2) });
  expect(http.put).not.toHaveBeenCalled();
  expect(http.delete).not.toHaveBeenCalled();
});

it('waits for a concept and recovers an initial read failure to an empty graph', async () => {
  const { rerender } = renderWithQueryClient(view());

  expect(screen.getByText('label.select-entity')).toBeVisible();
  expect(http.get).not.toHaveBeenCalled();

  http.get.mockRejectedValueOnce(new Error('read unavailable'));
  rerender(view(concept));
  await screen.findByText('message.ontology-binding-read-unavailable');
  http.get.mockResolvedValue({ data: { revision: 0, assets: [] } });
  fireEvent.click(screen.getByRole('button', { name: 'label.retry' }));
  await screen.findByText('message.no-data-available');

  expect(
    screen.queryByText('message.ontology-binding-read-unavailable')
  ).not.toBeInTheDocument();
});

it('keeps graph navigation controls available without refetching bindings', async () => {
  http.get.mockResolvedValue({ data: page('customers', 1) });
  renderWithQueryClient(view(concept));
  await screen.findByRole('button', { name: 'customers' });
  const viewport = screen.getByTestId('graph-zoom');

  expect(viewport).toHaveTextContent('1');

  fireEvent.click(screen.getByTestId('zoom-in'));

  expect(viewport).toHaveTextContent('2');

  fireEvent.click(screen.getByTestId('zoom-out'));

  expect(viewport).toHaveTextContent('1');

  fireEvent.click(screen.getByTestId('zoom-out'));

  expect(viewport).toHaveTextContent('0.5');

  fireEvent.click(screen.getByTestId('fit-view'));

  expect(viewport).toHaveTextContent('1');
  expect(http.get).toHaveBeenCalledTimes(1);
  expect(http.put).not.toHaveBeenCalled();
  expect(http.delete).not.toHaveBeenCalled();
});
