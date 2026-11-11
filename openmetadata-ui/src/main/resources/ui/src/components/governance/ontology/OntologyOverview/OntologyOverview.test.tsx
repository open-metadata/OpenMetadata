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
import { getOntologyWorkingValidation } from '../../../../rest/ontologyAPI';
import { renderWithQueryClient } from '../../../../test/unit/test-utils';
import OntologyOverview from './OntologyOverview';

jest.mock(
  '../../../../hooks/governance/ontology/useOntologyStudioModel',
  () => ({
    useOntologyStudioModel: () => ({
      graph: { nodes: [], edges: [] },
      isError: false,
      isLoading: false,
      model: { axioms: [{ id: 'a-1' }], concepts: [], properties: [] },
      relations: [],
    }),
  })
);

jest.mock('../../../../rest/ontologyAPI', () => ({
  getOntologyWorkingValidation: jest.fn(),
}));

const ontology = {
  id: 'o-1',
  name: 'Clinical',
  fullyQualifiedName: 'Clinical',
} as Ontology;

describe('OntologyOverview validation', () => {
  it('reports a failed validation as an error, never as a clean draft', async () => {
    (getOntologyWorkingValidation as jest.Mock).mockRejectedValue(
      new Error('500')
    );
    renderWithQueryClient(<OntologyOverview ontology={ontology} />);

    expect(
      await screen.findByText('server.unexpected-error')
    ).toBeInTheDocument();
    expect(
      screen.queryByText('message.ontology-validate-all-clean')
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText('message.ontology-overview-in-conflict')
    ).not.toBeInTheDocument();
  });

  it('says it is still validating until the run answers', () => {
    (getOntologyWorkingValidation as jest.Mock).mockReturnValue(
      new Promise(() => undefined)
    );
    renderWithQueryClient(<OntologyOverview ontology={ontology} />);

    expect(
      screen.getByTestId('ontology-overview-validation-message')
    ).toHaveTextContent('message.validating-ellipsis');
  });

  it('reads clean only once validation found no conflicts', async () => {
    (getOntologyWorkingValidation as jest.Mock).mockResolvedValue({
      violations: [],
    });
    renderWithQueryClient(<OntologyOverview ontology={ontology} />);

    expect(
      await screen.findByText('message.ontology-validate-all-clean')
    ).toBeInTheDocument();
    expect(
      screen.getByText('message.ontology-overview-in-conflict')
    ).toBeInTheDocument();
  });
});
