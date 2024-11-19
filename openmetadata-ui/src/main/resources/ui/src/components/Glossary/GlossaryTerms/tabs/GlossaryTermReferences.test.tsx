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
import { fireEvent, render } from '@testing-library/react';
import React from 'react';
import {
  MOCKED_GLOSSARY_TERMS,
  MOCK_PERMISSIONS,
} from '../../../../mocks/Glossary.mock';
import GlossaryTermReferences from './GlossaryTermReferences';

const mockOnGlossaryTermUpdate = jest.fn();

describe('GlossaryTermReferences', () => {
  it('renders glossary term references', async () => {
    const mockGlossaryTerm = MOCKED_GLOSSARY_TERMS[1];
    const mockPermissions = MOCK_PERMISSIONS;
    const { getByText, getByTestId } = render(
      <GlossaryTermReferences
        glossaryTerm={mockGlossaryTerm}
        permissions={mockPermissions}
        onGlossaryTermUpdate={mockOnGlossaryTermUpdate}
      />
    );

    const sectionTitle = getByTestId('section-label.reference-plural');
    const editBtn = getByTestId('edit-button');

    expect(sectionTitle).toBeInTheDocument();
    expect(sectionTitle).toHaveTextContent('label.reference-plural');

    const reference = getByText('google');

    expect(reference).toBeInTheDocument();
    expect(reference.closest('a')).toHaveAttribute(
      'href',
      'https://www.google.com'
    );
    expect(editBtn).toBeInTheDocument();

    fireEvent.click(editBtn);

    expect(getByTestId('glossary-term-references-modal')).toBeInTheDocument();
  });

  it('renders add button', async () => {
    const mockGlossaryTerm = MOCKED_GLOSSARY_TERMS[0];
    const mockPermissions = MOCK_PERMISSIONS;
    const { getByTestId } = render(
      <GlossaryTermReferences
        glossaryTerm={mockGlossaryTerm}
        permissions={mockPermissions}
        onGlossaryTermUpdate={mockOnGlossaryTermUpdate}
      />
    );

    expect(getByTestId('term-references-add-button')).toBeInTheDocument();
  });

  it('should not render add button if no permission', async () => {
    const mockGlossaryTerm = MOCKED_GLOSSARY_TERMS[0];
    const mockPermissions = { ...MOCK_PERMISSIONS, EditAll: false };
    const { queryByTestId, findByText } = render(
      <GlossaryTermReferences
        glossaryTerm={mockGlossaryTerm}
        permissions={mockPermissions}
        onGlossaryTermUpdate={mockOnGlossaryTermUpdate}
      />
    );

    expect(queryByTestId('term-references-add-button')).toBeNull();

    const noDataPlaceholder = await findByText(/--/i);

    expect(noDataPlaceholder).toBeInTheDocument();
  });

  it('should not render edit button if no permission', async () => {
    const mockGlossaryTerm = MOCKED_GLOSSARY_TERMS[1];
    const mockPermissions = { ...MOCK_PERMISSIONS, EditAll: false };
    const { queryByTestId } = render(
      <GlossaryTermReferences
        glossaryTerm={mockGlossaryTerm}
        permissions={mockPermissions}
        onGlossaryTermUpdate={mockOnGlossaryTermUpdate}
      />
    );

    expect(queryByTestId('edit-button')).toBeNull();
  });
});
