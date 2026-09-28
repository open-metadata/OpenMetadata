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
import { PatternType } from '../../generated/api/data/ontologyPatternTemplate';
import { Glossary } from '../../generated/entity/data/glossary';
import {
  instantiateOntologyPattern,
  listOntologyPatterns,
} from '../../rest/ontologyAPI';
import OntologyPatternPanel from './OntologyPatternPanel';

jest.mock('../../rest/ontologyAPI', () => ({
  instantiateOntologyPattern: jest.fn(),
  listOntologyPatterns: jest.fn(),
}));

const mockInstantiate = instantiateOntologyPattern as jest.MockedFunction<
  typeof instantiateOntologyPattern
>;
const mockList = listOntologyPatterns as jest.MockedFunction<
  typeof listOntologyPatterns
>;

const GLOSSARY: Glossary = {
  description: 'Governed concepts',
  displayName: 'Governed glossary',
  id: 'glossary-id',
  name: 'GovernedGlossary',
};

describe('OntologyPatternPanel', () => {
  it('creates a typed regulatory-control Draft from the server catalog', async () => {
    mockList.mockResolvedValue({
      data: [
        {
          description: 'Control, requirement, and evidence pattern',
          displayName: 'Regulatory control',
          patternType: PatternType.RegulatoryControl,
          relationshipRoles: [],
          termRoles: [
            {
              description: 'Control role',
              displayName: 'Control',
              key: 'control',
            },
            {
              description: 'Requirement role',
              displayName: 'Requirement',
              key: 'requirement',
            },
            {
              description: 'Evidence role',
              displayName: 'Evidence',
              key: 'evidence',
            },
          ],
        },
      ],
    });
    mockInstantiate.mockResolvedValue({
      changeSet: {
        id: 'change-set-id',
        name: 'draft',
        type: 'ontologyChangeSet',
      },
      patternType: PatternType.RegulatoryControl,
      relationships: [],
      terms: [],
    });
    render(<OntologyPatternPanel glossary={GLOSSARY} />);

    await screen.findByText('Control role');
    const inputs = screen.getAllByRole('textbox');
    [0, 2, 3, 5, 6, 8].forEach((index) =>
      fireEvent.change(inputs[index], {
        target: { value: `required-${index}` },
      })
    );
    fireEvent.click(screen.getByTestId('ontology-pattern-submit'));

    await waitFor(() => expect(mockInstantiate).toHaveBeenCalledTimes(1));

    expect(mockInstantiate).toHaveBeenCalledWith(
      expect.objectContaining({
        glossaryId: GLOSSARY.id,
        patternType: PatternType.RegulatoryControl,
        regulatoryControl: {
          control: {
            description: 'required-2',
            displayName: undefined,
            name: 'required-0',
          },
          evidence: {
            description: 'required-8',
            displayName: undefined,
            name: 'required-6',
          },
          requirement: {
            description: 'required-5',
            displayName: undefined,
            name: 'required-3',
          },
        },
      })
    );
  });
});
