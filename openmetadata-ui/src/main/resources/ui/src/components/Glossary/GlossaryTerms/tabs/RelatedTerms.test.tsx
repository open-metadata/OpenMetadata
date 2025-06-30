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
import RelatedTerms from './RelatedTerms';

const mockContext = {
  data: MOCKED_GLOSSARY_TERMS[2],
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

jest.mock('react-router-dom', () => ({
  useNavigate: jest.fn().mockReturnValue(jest.fn()),
}));

describe('RelatedTerms', () => {
  it('should render the component', () => {
    const { container } = render(<RelatedTerms />);

    expect(container).toBeInTheDocument();
  });

  it('should show the related terms', () => {
    const { getByText } = render(<RelatedTerms />);

    expect(getByText('Business Customer')).toBeInTheDocument();
  });

  it('should show the add button if there are no related terms and the user has edit permissions', () => {
    mockContext.data = { ...mockContext.data, relatedTerms: [] };
    const { getByTestId } = render(<RelatedTerms />);

    expect(getByTestId('related-term-add-button')).toBeInTheDocument();
  });

  it('should not show the add button if there are no related terms and the user does not have edit permissions', async () => {
    mockContext.permissions = { ...mockContext.permissions, EditAll: false };
    const { queryByTestId, findByText } = render(<RelatedTerms />);

    expect(queryByTestId('related-term-add-button')).toBeNull();

    const noDataPlaceholder = await findByText(/--/i);

    expect(noDataPlaceholder).toBeInTheDocument();
  });

  it('should show the edit button if there are related terms and the user has edit permissions', () => {
    mockContext.permissions = MOCK_PERMISSIONS;
    mockContext.data = { ...MOCKED_GLOSSARY_TERMS[2] };
    const { getByTestId } = render(<RelatedTerms />);

    expect(getByTestId('edit-button')).toBeInTheDocument();
  });

  it('should not show the edit button if there are no related terms and the user has edit permissions', () => {
    mockContext.data = { ...MOCKED_GLOSSARY_TERMS[2], relatedTerms: [] };
    const { queryByTestId } = render(<RelatedTerms />);

    expect(queryByTestId('edit-button')).toBeNull();
  });
});
