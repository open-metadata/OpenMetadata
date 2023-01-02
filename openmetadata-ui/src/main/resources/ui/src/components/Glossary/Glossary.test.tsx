/*
 *  Copyright 2022 Collate.
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

import {
  act,
  findByTestId,
  findByText,
  getByTestId,
  queryByTestId,
  queryByText,
  render,
} from '@testing-library/react';
import { omit } from 'lodash';
import { LoadingState } from 'Models';
import React from 'react';
import { mockedAssetData, mockedGlossaries } from '../../mocks/Glossary.mock';
import GlossaryV1 from './GlossaryV1.component';

jest.mock('../PermissionProvider/PermissionProvider', () => ({
  usePermissionProvider: jest.fn().mockReturnValue({
    getEntityPermission: jest.fn().mockReturnValue({
      Create: true,
      Delete: true,
      ViewAll: true,
      EditAll: true,
      EditDescription: true,
      EditDisplayName: true,
      EditCustomFields: true,
    }),
    permissions: {
      glossaryTerm: {
        Create: true,
        Delete: true,
        ViewAll: true,
        EditAll: true,
        EditDescription: true,
        EditDisplayName: true,
        EditCustomFields: true,
      },
      glossary: {
        Create: true,
        Delete: true,
        ViewAll: true,
        EditAll: true,
        EditDescription: true,
        EditDisplayName: true,
        EditCustomFields: true,
      },
    },
  }),
}));

jest.mock('../../utils/PermissionsUtils', () => ({
  checkPermission: jest.fn().mockReturnValue(true),
  DEFAULT_ENTITY_PERMISSION: {
    Create: true,
    Delete: true,
    ViewAll: true,
    EditAll: true,
    EditDescription: true,
    EditDisplayName: true,
    EditCustomFields: true,
  },
}));

jest.mock('react-router-dom', () => ({
  useHistory: jest.fn(),
  useParams: jest.fn().mockReturnValue({
    glossaryName: 'GlossaryName',
  }),
}));

jest.mock('../../components/GlossaryDetails/GlossaryDetails.component', () => {
  return jest.fn().mockReturnValue(<>Glossary-Details component</>);
});
jest.mock('react-router-dom', () => ({
  Link: jest.fn().mockImplementation(({ children }) => <a>{children}</a>),
}));

jest.mock('../../components/GlossaryTerms/GlossaryTermsV1.component', () => {
  return jest.fn().mockReturnValue(<>Glossary-Term component</>);
});

jest.mock('../common/title-breadcrumb/title-breadcrumb.component', () => {
  return jest.fn().mockReturnValue(<>TitleBreadcrumb</>);
});

jest.mock('../common/title-breadcrumb/title-breadcrumb.component', () =>
  jest.fn().mockReturnValue(<div>Breadcrumb</div>)
);

jest.mock('../Modals/EntityDeleteModal/EntityDeleteModal', () =>
  jest.fn().mockReturnValue(<div>Entity Delete Modal</div>)
);
jest.mock('../common/ProfilePicture/ProfilePicture', () =>
  jest.fn().mockReturnValue(<span>U</span>)
);
jest.mock('../../utils/TimeUtils', () => ({
  formatDateTime: jest.fn().mockReturnValue('Jan 15, 1970, 12:26 PM'),
}));

const mockProps = {
  assetData: mockedAssetData,
  currentPage: 1,
  deleteStatus: 'initial' as LoadingState,
  isSearchResultEmpty: false,
  isHasAccess: true,
  glossaryList: mockedGlossaries,
  selectedKey: 'Mock Glossary',
  expandedKey: ['Mock Glossary'],
  loadingKey: [],
  handleExpandedKey: jest.fn(),
  searchText: '',
  selectedData: mockedGlossaries[0],
  isGlossaryActive: true,
  isChildLoading: false,
  handleSelectedData: jest.fn(),
  handleAddGlossaryClick: jest.fn(),
  handleAddGlossaryTermClick: jest.fn(),
  handleGlossaryTermUpdate: jest.fn(),
  updateGlossary: jest.fn(),
  handleChildLoading: jest.fn(),
  handleSearchText: jest.fn(),
  onGlossaryDelete: jest.fn(),
  onGlossaryTermDelete: jest.fn(),
  onAssetPaginate: jest.fn(),
  onRelatedTermClick: jest.fn(),
  handleUserRedirection: jest.fn(),
};

describe('Test Glossary component', () => {
  it('Should render Glossary header', async () => {
    await act(async () => {
      const { container } = render(<GlossaryV1 {...mockProps} />);

      const header = getByTestId(container, 'header');

      expect(header).toBeInTheDocument();
    });
  });

  it('Should render Glossary-details', async () => {
    const { container } = render(<GlossaryV1 {...mockProps} />);

    const glossaryDetails = await findByText(
      container,
      /Glossary-Details component/i
    );
    const updateByContainer = await findByTestId(
      container,
      'updated-by-container'
    );
    const updateByDetails = await findByTestId(container, 'updated-by-details');

    const glossaryTerm = await queryByText(
      container,
      /Glossary-Term component/i
    );

    expect(glossaryDetails).toBeInTheDocument();
    expect(updateByContainer).toBeInTheDocument();
    expect(updateByDetails).toBeInTheDocument();
    expect(updateByDetails.textContent).toContain(
      'mocked_user label.on-lowercase Jan 15, 1970, 12:26 PM'
    );
    expect(glossaryTerm).not.toBeInTheDocument();
  });

  it('Should render Glossary-term', async () => {
    const { container } = render(
      <GlossaryV1
        {...mockProps}
        isGlossaryActive={false}
        selectedData={mockedGlossaries[0].children[0]}
      />
    );

    const glossaryTerm = await findByText(
      container,
      /Glossary-Term component/i
    );

    const glossaryDetails = await queryByText(
      container,
      /Glossary-Details component/i
    );

    expect(glossaryTerm).toBeInTheDocument();
    expect(glossaryDetails).not.toBeInTheDocument();
  });

  it('UpdatedBy and updatedAt should not visible if not available', async () => {
    const updatedData = omit(mockedGlossaries[0].children[0], [
      'updatedAt',
      'updatedBy',
    ]);
    const { container } = render(
      <GlossaryV1
        {...mockProps}
        isGlossaryActive={false}
        selectedData={updatedData}
      />
    );

    const updateByContainer = await findByTestId(
      container,
      'updated-by-container'
    );
    const updateByDetails = queryByTestId(container, 'updated-by-details');

    expect(updateByContainer).toBeInTheDocument();
    expect(updateByDetails).not.toBeInTheDocument();
  });
});
