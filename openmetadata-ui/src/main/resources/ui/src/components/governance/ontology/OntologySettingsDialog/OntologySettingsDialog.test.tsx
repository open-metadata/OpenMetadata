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
import { screen } from '@testing-library/react';
import { Ontology } from '../../../../generated/entity/data/ontology';
import { getOntology } from '../../../../rest/ontologyAPI';
import { renderWithQueryClient } from '../../../../test/unit/test-utils';
import OntologySettingsDialog from './OntologySettingsDialog';

const mockForm = jest.fn();

jest.mock('../../../../rest/ontologyAPI', () => ({
  getOntology: jest.fn(),
}));
jest.mock(
  '../../../../hooks/useEntityPermissions/useEntityPermissions',
  () => ({ useEntityPermissions: () => ({ canEditAll: true }) })
);
jest.mock(
  '../OntologyCreateForm/OntologyCreateForm',
  () => (props: { ontology: Ontology }) => {
    mockForm(props.ontology);

    return <div data-testid="ontology-create-form" />;
  }
);

const listEntry = { id: 'o-1', name: 'fhir', version: 0.2 } as Ontology;
const owners = [{ id: 'u-1', type: 'user', name: 'admin' }];

describe('OntologySettingsDialog', () => {
  it('edits the full ontology, owners and reviewers included, not the bare picker entry', async () => {
    (getOntology as jest.Mock).mockResolvedValue({
      ...listEntry,
      owners,
      reviewers: [],
    });
    renderWithQueryClient(
      <OntologySettingsDialog
        ontology={listEntry}
        onClose={jest.fn()}
        onSaved={jest.fn()}
      />
    );

    expect(
      await screen.findByTestId('ontology-create-form')
    ).toBeInTheDocument();
    expect(getOntology).toHaveBeenCalledWith(
      'o-1',
      'owners,reviewers,publicationStatus',
      expect.anything()
    );
    expect(mockForm).toHaveBeenCalledTimes(1);
    expect(mockForm).toHaveBeenCalledWith(expect.objectContaining({ owners }));
  });

  it('never shows the form when the ontology cannot be read', async () => {
    (getOntology as jest.Mock).mockRejectedValue(new Error('404'));
    renderWithQueryClient(
      <OntologySettingsDialog
        ontology={listEntry}
        onClose={jest.fn()}
        onSaved={jest.fn()}
      />
    );

    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(
      screen.queryByTestId('ontology-create-form')
    ).not.toBeInTheDocument();
  });
});
