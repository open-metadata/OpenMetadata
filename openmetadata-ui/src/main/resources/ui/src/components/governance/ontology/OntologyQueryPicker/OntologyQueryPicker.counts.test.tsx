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

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AxiosError } from 'axios';
import { Ontology } from '../../../../generated/entity/data/ontology';
import {
  listOntologyConcepts,
  listOntologyProperties,
  listOntologyReleaseMembers,
} from '../../../../rest/ontologyAPI';
import OntologyQueryPicker from './OntologyQueryPicker';

jest.mock('../../../../rest/ontologyAPI');

const concepts = listOntologyConcepts as jest.MockedFunction<
  typeof listOntologyConcepts
>;
const properties = listOntologyProperties as jest.MockedFunction<
  typeof listOntologyProperties
>;
const members = listOntologyReleaseMembers as jest.MockedFunction<
  typeof listOntologyReleaseMembers
>;

const ontology = (index: number, releaseId?: string): Ontology =>
  ({
    id: `o-${index}`,
    name: `onto${index}`,
    displayName: `Onto ${index}`,
    fullyQualifiedName: `onto${index}`,
    publicationStatus: releaseId ? { active: { releaseId } } : undefined,
  } as Ontology);

const forbidden = () =>
  Object.assign(new AxiosError('Forbidden'), { response: { status: 403 } });

const renderPicker = (ontologies: Ontology[]) =>
  render(
    <QueryClientProvider client={new QueryClient()}>
      <OntologyQueryPicker
        ontologies={ontologies}
        surface="console"
        onSelect={jest.fn()}
      />
    </QueryClientProvider>
  );

const optionText = async (name: string, id: string) => {
  await userEvent
    .setup({ advanceTimers: jest.advanceTimersByTime })
    .type(screen.getByRole('combobox'), name);

  return (await screen.findByTestId(`ontology-query-picker-option-${id}`))
    .textContent;
};

describe('OntologyQueryPicker counts', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    concepts.mockResolvedValue({ data: [], paging: { total: 7 } });
    properties.mockResolvedValue({ data: [], paging: { total: 4 } });
  });

  it('counts the first rows, then the rows matching what the user types', async () => {
    renderPicker(Array.from({ length: 45 }, (_, index) => ontology(index)));

    await waitFor(() => expect(concepts).toHaveBeenCalledTimes(20));

    expect(properties).toHaveBeenCalledTimes(20);

    await waitFor(async () =>
      expect(await optionText('Onto 39', 'o-39')).toContain(
        '7 label.concept-plural · 4 label.property-plural'
      )
    );
  });

  it('shows the active release counts to a reader who may not read the working draft', async () => {
    concepts.mockRejectedValue(forbidden());
    properties.mockRejectedValue(forbidden());
    members.mockImplementation(async (_release, kind) => ({
      data: [],
      paging: { total: kind === 'CONCEPT' ? 12 : 5 },
    }));

    renderPicker([ontology(1, 'release-1')]);

    await waitFor(() => expect(members).toHaveBeenCalledTimes(2));

    expect(await optionText('Onto 1', 'o-1')).toContain(
      '12 label.concept-plural · 5 label.property-plural'
    );
  });

  it('shows no count, not 0, for a refused ontology that has no active release', async () => {
    concepts.mockRejectedValue(forbidden());
    properties.mockRejectedValue(forbidden());

    renderPicker([ontology(1)]);

    await waitFor(() => expect(concepts).toHaveBeenCalled());
    await waitFor(() => expect(properties).toHaveBeenCalled());

    expect(await optionText('Onto 1', 'o-1')).toBe('Onto 1');
    expect(members).not.toHaveBeenCalled();
  });
});
