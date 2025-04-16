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
import { MOCK_SEARCH_INDEX_FIELDS } from '../../../mocks/SearchIndex.mock';
import SearchIndexFieldsTab from './SearchIndexFieldsTab';

jest.mock('../SearchIndexFieldsTable/SearchIndexFieldsTable', () =>
  jest.fn().mockImplementation(() => <div>SearchIndexFieldsTable</div>)
);

jest.mock('../../../utils/StringsUtils', () => ({
  ...jest.requireActual('../../../utils/StringsUtils'),
  stringToHTML: jest.fn((text) => text),
}));

jest.mock('../../../utils/EntityUtils', () => ({
  ...jest.requireActual('../../../utils/EntityUtils'),
  highlightSearchText: jest.fn((text) => text),
}));

jest.mock(
  '../../../components/Customization/GenericProvider/GenericProvider',
  () => ({
    useGenericContext: jest.fn(() => ({
      data: {
        fields: MOCK_SEARCH_INDEX_FIELDS,
      },
      permissions: {
        ViewAll: true,
      },
      onUpdate: jest.fn(),
    })),
  })
);

jest.mock('../../../hooks/useFqn', () => ({
  useFqn: jest.fn(() => ({
    fqn: 'search_service.search_index_fqn',
  })),
}));

describe('SearchIndexFieldsTab component', () => {
  it('SearchIndexFieldsTab should be visible', () => {
    render(<SearchIndexFieldsTab />);

    expect(screen.getByText('SearchIndexFieldsTable')).toBeInTheDocument();
  });
});
