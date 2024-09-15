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
import { render } from '@testing-library/react';
import React from 'react';
import {
  MOCKED_GLOSSARY_TERMS,
  MOCK_PERMISSIONS,
} from '../../../../mocks/Glossary.mock';
import GlossaryTermSynonyms from './GlossaryTermSynonyms';

const onGlossaryTermUpdate = jest.fn();

describe('GlossaryTermSynonyms', () => {
  it('renders synonyms and edit button', () => {
    const glossaryTerm = MOCKED_GLOSSARY_TERMS[1];
    const permissions = MOCK_PERMISSIONS;
    const { getByTestId, getByText } = render(
      <GlossaryTermSynonyms
        glossaryTerm={glossaryTerm}
        permissions={permissions}
        onGlossaryTermUpdate={onGlossaryTermUpdate}
      />
    );
    const synonymsContainer = getByTestId('synonyms-container');
    const synonymItem = getByText('accessory');
    const editBtn = getByTestId('edit-button');

    expect(synonymsContainer).toBeInTheDocument();
    expect(synonymItem).toBeInTheDocument();
    expect(editBtn).toBeInTheDocument();
  });

  it('renders add button', () => {
    const glossaryTerm = MOCKED_GLOSSARY_TERMS[0];
    const permissions = MOCK_PERMISSIONS;
    const { getByTestId } = render(
      <GlossaryTermSynonyms
        glossaryTerm={glossaryTerm}
        permissions={permissions}
        onGlossaryTermUpdate={onGlossaryTermUpdate}
      />
    );
    const synonymsContainer = getByTestId('synonyms-container');
    const synonymAddBtn = getByTestId('synonym-add-button');

    expect(synonymsContainer).toBeInTheDocument();
    expect(synonymAddBtn).toBeInTheDocument();
  });

  it('should not render add button if no permission', async () => {
    const glossaryTerm = MOCKED_GLOSSARY_TERMS[0];
    const permissions = { ...MOCK_PERMISSIONS, EditAll: false };
    const { getByTestId, queryByTestId, findByText } = render(
      <GlossaryTermSynonyms
        glossaryTerm={glossaryTerm}
        permissions={permissions}
        onGlossaryTermUpdate={onGlossaryTermUpdate}
      />
    );
    const synonymsContainer = getByTestId('synonyms-container');
    const synonymAddBtn = queryByTestId('synonym-add-button');

    expect(synonymsContainer).toBeInTheDocument();
    expect(synonymAddBtn).toBeNull();

    const noDataPlaceholder = await findByText(/--/i);

    expect(noDataPlaceholder).toBeInTheDocument();
  });

  it('should not render edit button if no permission', () => {
    const glossaryTerm = MOCKED_GLOSSARY_TERMS[1];
    const permissions = { ...MOCK_PERMISSIONS, EditAll: false };
    const { getByTestId, queryByTestId } = render(
      <GlossaryTermSynonyms
        glossaryTerm={glossaryTerm}
        permissions={permissions}
        onGlossaryTermUpdate={onGlossaryTermUpdate}
      />
    );
    const synonymsContainer = getByTestId('synonyms-container');
    const editBtn = queryByTestId('edit-button');

    expect(synonymsContainer).toBeInTheDocument();
    expect(editBtn).toBeNull();
  });
});
