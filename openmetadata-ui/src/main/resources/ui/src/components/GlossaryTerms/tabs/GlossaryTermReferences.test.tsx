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
import { MOCKED_GLOSSARY_TERMS, MOCK_PERMISSIONS } from 'mocks/Glossary.mock';
import React from 'react';
import GlossaryTermReferences from './GlossaryTermReferences';

describe('GlossaryTermReferences', () => {
  const mockGlossaryTerm = MOCKED_GLOSSARY_TERMS[1];
  const mockPermissions = MOCK_PERMISSIONS;
  const mockOnGlossaryTermUpdate = jest.fn();

  it('renders glossary term references', async () => {
    const { getByText, getByTestId } = render(
      <GlossaryTermReferences
        glossaryTerm={mockGlossaryTerm}
        permissions={mockPermissions}
        onGlossaryTermUpdate={mockOnGlossaryTermUpdate}
      />
    );

    const sectionTitle = getByTestId('section-label.reference-plural');

    expect(sectionTitle).toBeInTheDocument();
    expect(sectionTitle).toHaveTextContent('label.reference-plural');

    const reference = getByText('google');

    expect(reference).toBeInTheDocument();
    expect(reference.closest('a')).toHaveAttribute(
      'href',
      'https://www.google.com'
    );
  });
});
