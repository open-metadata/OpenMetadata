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
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { Ontology } from '../../../../generated/entity/data/ontology';
import { listOntologyConcepts } from '../../../../rest/ontologyAPI';
import { useKeyEchoTranslations } from '../../../../test/unit/enUsTranslation';
import { renderWithQueryClient } from '../../../../test/unit/test-utils';
import OntologyStudioScopeMenu from './OntologyStudioScopeMenu';

jest.mock('../../../../hooks/useAppMode', () => ({
  ...jest.requireActual('../../../../hooks/useAppMode'),
  useIsAiMode: jest.fn().mockReturnValue(false),
}));
jest.mock('../../../../hooks/useApplicationStore', () => ({
  useApplicationStore: jest.fn().mockReturnValue({}),
}));
jest.mock(
  '../../../../hooks/useEntityPermissions/useEntityPermissions',
  () => ({
    useEntityPermissions: jest.fn().mockReturnValue({}),
  })
);
jest.mock('../../../../rest/ontologyAPI', () => ({
  deleteOntology: jest.fn(),
  listOntologyConcepts: jest.fn(),
  listOntologyProperties: jest.fn(),
  listOntologyReleaseMembers: jest.fn(),
}));

const ontologies = Array.from(
  { length: 45 },
  (_, index) =>
    ({
      id: `ont-${index}`,
      name: `onto${index}`,
      displayName: `Model ${index}`,
      fullyQualifiedName: `onto${index}`,
    } as Ontology)
);

const open = () => {
  renderWithQueryClient(
    <OntologyStudioScopeMenu
      glossaries={[]}
      label="All ontologies"
      ontologies={ontologies}
      scope={{ kind: 'allOntologies' }}
      onScopeChange={jest.fn()}
    />
  );
  fireEvent.click(screen.getByTestId('ontology-scope-menu-trigger'));
};

beforeEach(() => {
  useKeyEchoTranslations();
  (listOntologyConcepts as jest.Mock)
    .mockReset()
    .mockResolvedValue({ data: [], paging: { total: 3 } });
});

it('counts only the 20 rows on screen, not every ontology', async () => {
  open();

  await screen.findByTestId('ontology-scope-ont-0');
  await waitFor(() => expect(listOntologyConcepts).toHaveBeenCalledTimes(20));

  expect(screen.queryByTestId('ontology-scope-ont-20')).toBeNull();
});

it('counts the next 20 rows after Show more', async () => {
  open();
  await waitFor(() => expect(listOntologyConcepts).toHaveBeenCalledTimes(20));

  fireEvent.click(screen.getByTestId('ontology-scope-show-more'));

  await screen.findByTestId('ontology-scope-ont-39');
  await waitFor(() => expect(listOntologyConcepts).toHaveBeenCalledTimes(40));
});

it('counts only the rows matching the search', async () => {
  open();
  await waitFor(() => expect(listOntologyConcepts).toHaveBeenCalledTimes(20));
  (listOntologyConcepts as jest.Mock).mockClear();

  fireEvent.change(screen.getByTestId('ontology-scope-search'), {
    target: { value: 'Model 4' },
  });

  await screen.findByTestId('ontology-scope-ont-4');

  expect(screen.queryByTestId('ontology-scope-ont-3')).toBeNull();

  // Model 4 and Model 40 to 44 match; Model 4 is already cached from the first page.
  await waitFor(() => expect(listOntologyConcepts).toHaveBeenCalledTimes(5));
});
