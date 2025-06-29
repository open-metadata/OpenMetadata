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
import {
  MOCKED_GLOSSARY_TERMS,
  MOCK_PERMISSIONS,
} from '../../../../mocks/Glossary.mock';
import GlossaryTermSynonyms from './GlossaryTermSynonyms';

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

describe('GlossaryTermSynonyms', () => {
  it('renders synonyms and edit button', () => {
    mockContext.data = mockGlossaryTerm2;
    const { getByTestId, getByText } = render(<GlossaryTermSynonyms />);
    const synonymsContainer = getByTestId('synonyms-container');
    const synonymItem = getByText('accessory');
    const editBtn = getByTestId('edit-button');

    expect(synonymsContainer).toBeInTheDocument();
    expect(synonymItem).toBeInTheDocument();
    expect(editBtn).toBeInTheDocument();
  });

  it('renders add button', () => {
    mockContext.data = mockGlossaryTerm1;
    const { getByTestId } = render(<GlossaryTermSynonyms />);
    const synonymsContainer = getByTestId('synonyms-container');
    const synonymAddBtn = getByTestId('synonym-add-button');

    expect(synonymsContainer).toBeInTheDocument();
    expect(synonymAddBtn).toBeInTheDocument();
  });

  it('should not render add button if no permission', async () => {
    mockContext.data = mockGlossaryTerm1;
    mockContext.permissions = { ...MOCK_PERMISSIONS, EditAll: false };
    const { getByTestId, queryByTestId, findByText } = render(
      <GlossaryTermSynonyms />
    );
    const synonymsContainer = getByTestId('synonyms-container');
    const synonymAddBtn = queryByTestId('synonym-add-button');

    expect(synonymsContainer).toBeInTheDocument();
    expect(synonymAddBtn).toBeNull();

    const noDataPlaceholder = await findByText(/--/i);

    expect(noDataPlaceholder).toBeInTheDocument();
  });

  it('should not render edit button if no permission', () => {
    mockContext.data = mockGlossaryTerm2;
    mockContext.permissions = { ...MOCK_PERMISSIONS, EditAll: false };
    const { getByTestId, queryByTestId } = render(<GlossaryTermSynonyms />);
    const synonymsContainer = getByTestId('synonyms-container');
    const editBtn = queryByTestId('edit-button');

    expect(synonymsContainer).toBeInTheDocument();
    expect(editBtn).toBeNull();
  });
});
