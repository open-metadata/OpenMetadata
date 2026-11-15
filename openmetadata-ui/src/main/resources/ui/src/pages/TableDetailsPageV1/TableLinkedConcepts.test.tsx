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
import { screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { OntologyAssetConceptLinks } from '../../generated/type/ontologyAssetConceptLinks';
import { getOntologyConceptsBoundToAsset } from '../../rest/ontologyAPI';
import { renderWithQueryClient } from '../../test/unit/test-utils';
import TableLinkedConcepts from './TableLinkedConcepts';

jest.mock('../../rest/ontologyAPI', () => ({
  getOntologyConceptsBoundToAsset: jest.fn(),
}));

const ref = (id: string, name: string, type: string) => ({ id, name, type });

const LINKS = {
  links: [
    {
      concept: ref('c1', 'Prescription', 'ontologyConcept'),
      ontology: ref('o1', 'LC Clinical', 'ontology'),
      columns: [
        {
          columnPath: ['rx_id'],
          column: {
            name: 'rx_id',
            fullyQualifiedName: 'svc.db.sch.prescriptions.rx_id',
            dataType: 'BIGINT',
          },
          propertyId: 'p1',
          property: ref('p1', 'prescriptionId', 'ontologyProperty'),
          state: 'resolved',
        },
        {
          columnPath: ['dose'],
          column: {
            name: 'dose',
            fullyQualifiedName: 'svc.db.sch.prescriptions.dose',
            dataType: 'INT',
          },
          propertyId: 'p2',
          property: ref('p2', 'doseMg', 'ontologyProperty'),
          state: 'resolved',
        },
      ],
    },
  ],
} as unknown as OntologyAssetConceptLinks;

const renderSection = (columnFqn?: string) =>
  renderWithQueryClient(
    <MemoryRouter>
      <TableLinkedConcepts columnFqn={columnFqn} tableId="t1" />
    </MemoryRouter>
  );

describe('TableLinkedConcepts', () => {
  it('lists the linked concept with its ontology and bound columns, linking back to Studio', async () => {
    (getOntologyConceptsBoundToAsset as jest.Mock).mockResolvedValue(LINKS);

    renderSection();

    const link = await screen.findByTestId('table-linked-concept-link');

    expect(link).toHaveTextContent('Prescription');
    expect(link).toHaveAttribute(
      'href',
      '/governance/ontology?ontology=o1&concept=c1'
    );
    expect(screen.getByText('LC Clinical')).toBeInTheDocument();
    expect(
      screen
        .getAllByTestId('table-linked-concept-column')
        .map((row) => row.textContent)
    ).toEqual([
      'svc.db.sch.prescriptions.rx_idprescriptionId',
      'svc.db.sch.prescriptions.dosedoseMg',
    ]);
    expect(getOntologyConceptsBoundToAsset).toHaveBeenCalledWith(
      'table',
      't1',
      expect.anything()
    );
  });

  it('links each concept of the same ontology to its own Studio selection', async () => {
    (getOntologyConceptsBoundToAsset as jest.Mock).mockResolvedValue({
      links: [
        ...LINKS.links,
        {
          concept: ref('c2', 'Dispense', 'ontologyConcept'),
          ontology: ref('o1', 'LC Clinical', 'ontology'),
          columns: [],
        },
      ],
    });

    renderSection();

    await screen.findAllByTestId('table-linked-concept-link');

    expect(
      screen
        .getAllByTestId('table-linked-concept-link')
        .map((a) => [a.textContent, a.getAttribute('href')])
    ).toEqual([
      ['Prescription', '/governance/ontology?ontology=o1&concept=c1'],
      ['Dispense', '/governance/ontology?ontology=o1&concept=c2'],
    ]);
  });

  it('shows only the bindings of the column the page is on', async () => {
    (getOntologyConceptsBoundToAsset as jest.Mock).mockResolvedValue(LINKS);

    renderSection('svc.db.sch.prescriptions.dose');

    await screen.findByTestId('table-linked-concept-link');

    expect(
      screen
        .getAllByTestId('table-linked-concept-column')
        .map((row) => row.textContent)
    ).toEqual(['svc.db.sch.prescriptions.dosedoseMg']);
  });

  it('renders nothing for a column without a binding', async () => {
    (getOntologyConceptsBoundToAsset as jest.Mock).mockResolvedValue(LINKS);

    renderSection('svc.db.sch.prescriptions.unbound');

    await waitFor(() =>
      expect(getOntologyConceptsBoundToAsset).toHaveBeenCalled()
    );

    expect(screen.queryByTestId('table-linked-concepts')).toBeNull();
  });

  it('renders nothing when the table has no links or the read fails', async () => {
    (getOntologyConceptsBoundToAsset as jest.Mock).mockRejectedValue(
      new Error('forbidden')
    );

    renderSection();

    await waitFor(() =>
      expect(getOntologyConceptsBoundToAsset).toHaveBeenCalled()
    );

    expect(screen.queryByTestId('table-linked-concepts')).toBeNull();
  });
});
