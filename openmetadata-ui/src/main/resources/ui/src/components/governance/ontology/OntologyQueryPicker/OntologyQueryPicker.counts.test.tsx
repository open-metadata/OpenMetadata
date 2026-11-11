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
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
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

const countsOf = (id: string) =>
  screen
    .getByTestId(`ontology-query-picker-option-${id}`)
    .querySelector('[data-testid="ontology-query-picker-counts"]');

describe('OntologyQueryPicker counts', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    concepts.mockResolvedValue({ data: [], paging: { total: 7 } });
    properties.mockResolvedValue({ data: [], paging: { total: 4 } });
  });

  it('requests counts only for the rows on screen and counts more rows when asked to show more', async () => {
    renderPicker(Array.from({ length: 45 }, (_, index) => ontology(index)));

    await waitFor(() => expect(concepts).toHaveBeenCalledTimes(20));

    expect(properties).toHaveBeenCalledTimes(20);
    expect(
      screen.queryByTestId('ontology-query-picker-option-o-20')
    ).toBeNull();

    fireEvent.click(screen.getByTestId('ontology-query-picker-show-more'));

    await waitFor(() => expect(concepts).toHaveBeenCalledTimes(40));

    expect(
      screen.getByTestId('ontology-query-picker-option-o-39')
    ).toBeInTheDocument();
  });

  it('shows the active release counts to a reader who may not read the working draft', async () => {
    concepts.mockRejectedValue(forbidden());
    properties.mockRejectedValue(forbidden());
    members.mockImplementation(async (_release, kind) => ({
      data: [],
      paging: { total: kind === 'CONCEPT' ? 12 : 5 },
    }));

    renderPicker([ontology(1, 'release-1')]);

    await waitFor(() =>
      expect(countsOf('o-1')).toHaveTextContent(
        '12 label.concept-plural · 5 label.property-plural'
      )
    );
  });

  it('shows no count, not 0, for a refused ontology that has no active release', async () => {
    concepts.mockRejectedValue(forbidden());
    properties.mockRejectedValue(forbidden());

    renderPicker([ontology(1)]);

    await waitFor(() => expect(concepts).toHaveBeenCalled());
    await waitFor(() => expect(properties).toHaveBeenCalled());

    expect(countsOf('o-1')).toBeEmptyDOMElement();
    expect(members).not.toHaveBeenCalled();
  });
});
