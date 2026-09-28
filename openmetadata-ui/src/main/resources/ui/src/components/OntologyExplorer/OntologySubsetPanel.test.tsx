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
import { Glossary } from '../../generated/entity/data/glossary';
import { buildOntologySubset } from '../../rest/ontologyAPI';
import OntologySubsetPanel from './OntologySubsetPanel';

jest.mock('../../rest/ontologyAPI', () => ({
  buildOntologySubset: jest.fn(),
}));
jest.mock('./OntologyTermSelection', () => ({
  __esModule: true,
  default: ({ onChange }: { onChange: (ids: string[]) => void }) => (
    <button
      data-testid="select-source-term"
      type="button"
      onClick={() => onChange(['term-id'])}>
      Select source term
    </button>
  ),
}));

const mockBuildSubset = buildOntologySubset as jest.MockedFunction<
  typeof buildOntologySubset
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

describe('OntologySubsetPanel', () => {
  it('pins source identity when creating an application subset Draft', async () => {
    mockBuildSubset.mockResolvedValue({
      changeSet: {
        id: 'change-set-id',
        name: 'subset-draft',
        type: 'ontologyChangeSet',
      },
      relationships: [],
      sourceGlossary: { id: SOURCE.id, type: 'glossary' },
      sourceGlossaryVersion: 2,
      sources: [],
      targetGlossary: { id: TARGET.id, type: 'glossary' },
      terms: [],
    });
    render(
      <OntologySubsetPanel
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
    fireEvent.click(screen.getByTestId('select-source-term'));
    fireEvent.click(screen.getByTestId('ontology-subset-submit'));

    await waitFor(() =>
      expect(mockBuildSubset).toHaveBeenCalledWith({
        changeSetDescription: TARGET.description,
        changeSetDisplayName: TARGET.displayName,
        changeSetName: `subset-${TARGET.name}`,
        includeDescendants: true,
        includeRelationships: true,
        sourceGlossaryId: SOURCE.id,
        sourceTermIds: ['term-id'],
        targetGlossaryId: TARGET.id,
      })
    );
  });
});
