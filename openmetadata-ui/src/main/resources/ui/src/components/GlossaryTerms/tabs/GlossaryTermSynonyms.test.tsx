/*
 *  Copyright 2023 Collate.
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
import { getByTestId, getByText, render } from '@testing-library/react';
import { MOCKED_GLOSSARY_TERMS, MOCK_PERMISSIONS } from 'mocks/Glossary.mock';
import React from 'react';
import GlossaryTermSynonyms from './GlossaryTermSynonyms';

describe('GlossaryTermSynonyms', () => {
  const permissions = MOCK_PERMISSIONS;
  const glossaryTerm = MOCKED_GLOSSARY_TERMS[1];
  const onGlossaryTermUpdate = jest.fn();

  it('renders synonyms', () => {
    const { container } = render(
      <GlossaryTermSynonyms
        glossaryTerm={glossaryTerm}
        permissions={permissions}
        onGlossaryTermUpdate={onGlossaryTermUpdate}
      />
    );
    const synonymsContainer = getByTestId(container, 'synonyms-container');
    const synonymItem = getByText(container, 'accessory');

    expect(synonymsContainer).toBeInTheDocument();
    expect(synonymItem).toBeInTheDocument();
  });
});
