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

import { render, screen } from '@testing-library/react';
import { OperationPermission } from '../../../context/PermissionProvider/PermissionProvider.interface';
import { MOCK_SEARCH_INDEX_FIELDS } from '../../../mocks/SearchIndex.mock';
import SearchIndexFieldsTab from './SearchIndexFieldsTab';

const mockSearchIndexFieldsTable = jest
  .fn()
  .mockImplementation(() => <div>SearchIndexFieldsTable</div>);

jest.mock(
  '../SearchIndexFieldsTable/SearchIndexFieldsTable',
  () => (props: unknown) => mockSearchIndexFieldsTable(props)
);

jest.mock('../../../utils/StringUtils', () => ({
  ...jest.requireActual('../../../utils/StringUtils'),
  stringToHTML: jest.fn((text) => text),
}));

jest.mock('../../../utils/EntitySearchUtils', () => ({
  ...jest.requireActual('../../../utils/EntitySearchUtils'),
  highlightSearchText: jest.fn((text) => text),
}));

const mockUseGenericContext = jest.fn(() => ({
  data: {
    fields: MOCK_SEARCH_INDEX_FIELDS,
  },
  permissions: {
    ViewAll: true,
  } as OperationPermission,
  onUpdate: jest.fn(),
}));

jest.mock(
  '../../../components/Customization/GenericProvider/GenericContext',
  () => ({
    ...jest.requireActual(
      '../../../components/Customization/GenericProvider/GenericProvider'
    ),
    useGenericContext: () => mockUseGenericContext(),
  })
);

jest.mock('../../../hooks/useFqn', () => ({
  useFqn: jest.fn(() => ({
    fqn: 'search_service.search_index_fqn',
  })),
}));

describe('SearchIndexFieldsTab component', () => {
  beforeEach(() => {
    mockSearchIndexFieldsTable.mockClear();
  });

  it('SearchIndexFieldsTab should be visible', async () => {
    render(<SearchIndexFieldsTab />);

    expect(
      await screen.findByText('SearchIndexFieldsTable')
    ).toBeInTheDocument();
  });

  // Explicit-deny-wins fix (Task 8): the old `permissions.EditAll ||
  // permissions.EditDescription` raw OR would have returned true here (EditAll
  // granted). getDerivedPermissionFlags prioritizes the field-specific key —
  // EditDescription explicitly false wins over EditAll.
  it('prioritizes an explicit field-level deny over a granted EditAll', async () => {
    mockUseGenericContext.mockReturnValueOnce({
      data: { fields: MOCK_SEARCH_INDEX_FIELDS },
      permissions: {
        EditAll: true,
        EditDescription: false,
        EditTags: false,
        EditGlossaryTerms: false,
      } as OperationPermission,
      onUpdate: jest.fn(),
    });

    render(<SearchIndexFieldsTab />);

    await screen.findByText('SearchIndexFieldsTable');

    expect(mockSearchIndexFieldsTable).toHaveBeenCalledWith(
      expect.objectContaining({
        hasDescriptionEditAccess: false,
        hasTagEditAccess: false,
        hasGlossaryTermEditAccess: false,
      })
    );
  });
});
