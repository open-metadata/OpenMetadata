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

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { Field as MergeField } from '../../generated/api/data/mergeOntologyStructure';
import {
  Field as DiffField,
  State as DiffState,
} from '../../generated/api/data/ontologyStructuralDiff';
import { Glossary } from '../../generated/entity/data/glossary';
import {
  diffOntologyStructure,
  mergeOntologyStructure,
} from '../../rest/ontologyAPI';
import OntologyStructurePanel from './OntologyStructurePanel';

jest.mock('../../rest/ontologyAPI', () => ({
  diffOntologyStructure: jest.fn(),
  mergeOntologyStructure: jest.fn(),
}));
jest.mock('./OntologyTermSelection', () => ({
  __esModule: true,
  default: ({ onChange }: { onChange: (ids: string[]) => void }) => (
    <button
      data-testid="select-context-term"
      type="button"
      onClick={() => onChange(['subset-term-id'])}>
      Select context term
    </button>
  ),
}));

const mockDiff = diffOntologyStructure as jest.MockedFunction<
  typeof diffOntologyStructure
>;
const mockMerge = mergeOntologyStructure as jest.MockedFunction<
  typeof mergeOntologyStructure
>;
const SOURCE: Glossary = {
  description: 'Source concepts',
  displayName: 'Source glossary',
  id: 'source-glossary-id',
  name: 'SourceGlossary',
};
const TARGET: Glossary = {
  description: 'Application concepts',
  displayName: 'Application glossary',
  id: 'target-glossary-id',
  name: 'ApplicationGlossary',
};
const EMPTY_STRUCTURE = {
  attributes: [],
  conceptMappings: [],
  description: 'Description',
  name: 'Concept',
  relationships: [],
};

describe('OntologyStructurePanel', () => {
  it('excludes conflicting fields from a selective three-way merge Draft', async () => {
    mockDiff.mockResolvedValue({
      data: [
        {
          base: EMPTY_STRUCTURE,
          baseVersion: 1,
          conflictingFields: [DiffField.DisplayName],
          currentSource: EMPTY_STRUCTURE,
          currentSourceVersion: 2,
          currentSubset: EMPTY_STRUCTURE,
          sourceChangedFields: [DiffField.Description, DiffField.DisplayName],
          sourceTerm: { id: 'source-term-id', type: 'glossaryTerm' },
          state: DiffState.Conflict,
          subsetChangedFields: [DiffField.DisplayName],
          subsetTerm: {
            displayName: 'Application concept',
            id: 'subset-term-id',
            type: 'glossaryTerm',
          },
          subsetVersion: 3,
        },
      ],
      sourceGlossary: { id: SOURCE.id, type: 'glossary' },
      targetGlossary: { id: TARGET.id, type: 'glossary' },
    });
    mockMerge.mockResolvedValue({
      changeSet: {
        id: 'change-set-id',
        name: 'merge-draft',
        type: 'ontologyChangeSet',
      },
      relationshipOperations: [],
      sourceGlossary: { id: SOURCE.id, type: 'glossary' },
      targetGlossary: { id: TARGET.id, type: 'glossary' },
      terms: [],
    });
    render(
      <OntologyStructurePanel
        glossaries={[SOURCE, TARGET]}
        selectedGlossary={TARGET}
      />
    );

    fireEvent.click(
      screen.getByRole('button', { name: /label\.source label\.glossary/ })
    );
    fireEvent.click(
      await screen.findByRole('option', { name: SOURCE.displayName })
    );
    fireEvent.click(screen.getByTestId('select-context-term'));
    fireEvent.click(screen.getByTestId('ontology-structure-diff'));

    await screen.findByText('Application concept');
    fireEvent.click(screen.getByTestId('ontology-structure-merge'));

    await waitFor(() =>
      expect(mockMerge).toHaveBeenCalledWith(
        expect.objectContaining({
          contextTermIds: ['subset-term-id'],
          selections: [
            {
              fields: [MergeField.Description],
              subsetTermId: 'subset-term-id',
            },
          ],
          sourceGlossaryId: SOURCE.id,
          targetGlossaryId: TARGET.id,
        })
      )
    );
  });
});
