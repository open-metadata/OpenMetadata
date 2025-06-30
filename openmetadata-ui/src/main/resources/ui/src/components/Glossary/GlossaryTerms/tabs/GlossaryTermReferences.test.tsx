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
import {
  MOCKED_GLOSSARY_TERMS,
  MOCK_PERMISSIONS,
} from '../../../../mocks/Glossary.mock';
import GlossaryTermReferences from './GlossaryTermReferences';

const [mockGlossaryTerm1, mockGlossaryTerm2] = MOCKED_GLOSSARY_TERMS;

const mockContext = {
  data: mockGlossaryTerm1,
  onUpdate: jest.fn(),
  isVersionView: false,
  permissions: MOCK_PERMISSIONS,
};

jest.mock('../../../Customization/GenericProvider/GenericProvider', () => ({
  useGenericContext: jest.fn().mockImplementation(() => mockContext),
}));

jest.mock('../../../../utils/TableColumn.util', () => ({
  ownerTableObject: jest.fn().mockReturnValue({}),
}));

describe('GlossaryTermReferences', () => {
  it('renders glossary term references', async () => {
    mockContext.data = mockGlossaryTerm2;
    const { getByText, getByTestId } = render(<GlossaryTermReferences />);

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
    mockContext.data = mockGlossaryTerm1;

    const { getByTestId } = render(<GlossaryTermReferences />);

    expect(getByTestId('term-references-add-button')).toBeInTheDocument();
  });

  it('should not render add button if no permission', async () => {
    mockContext.data = mockGlossaryTerm1;
    mockContext.permissions = { ...MOCK_PERMISSIONS, EditAll: false };

    const { queryByTestId, findByText } = render(<GlossaryTermReferences />);

    expect(queryByTestId('term-references-add-button')).toBeNull();

    const noDataPlaceholder = await findByText(/--/i);

    expect(noDataPlaceholder).toBeInTheDocument();
  });

  it('should not render edit button if no permission', async () => {
    const { queryByTestId } = render(<GlossaryTermReferences />);

    expect(queryByTestId('edit-button')).toBeNull();
  });
});
