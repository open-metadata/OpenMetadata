/*
 *  Copyright 2021 Collate
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
  findByText,
  getByTestId,
  queryByText,
  render,
} from '@testing-library/react';
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
jest.mock('antd', () => ({
  Col: jest.fn().mockImplementation(({ children }) => <div>{children}</div>),
  Input: jest.fn().mockImplementation(({ children }) => <div>{children}</div>),
  Row: jest.fn().mockImplementation(({ children }) => <div>{children}</div>),
  Space: jest.fn().mockImplementation(({ children }) => <div>{children}</div>),
  Typography: {
    Title: jest
      .fn()
      .mockImplementation(({ children }) => <div>{children}</div>),
  },
  Dropdown: jest.fn().mockImplementation(({ children, overlay }) => (
    <div>
      {children}
      {overlay}
    </div>
  )),
  Menu: jest.fn().mockImplementation(({ items }) => (
    <div>
      {items.map((item: { key: string; label: JSX.Element }) => {
        <div key={item.key}>{item.label}</div>;
      })}
    </div>
  )),
}));

jest.mock('../../components/GlossaryDetails/GlossaryDetails.component', () => {
  return jest.fn().mockReturnValue(<>Glossary-Details component</>);
});

jest.mock('../../components/GlossaryTerms/GlossaryTermsV1.component', () => {
  return jest.fn().mockReturnValue(<>Glossary-Term component</>);
});

jest.mock('../common/title-breadcrumb/title-breadcrumb.component', () => {
  return jest.fn().mockReturnValue(<>TitleBreadcrumb</>);
});

jest.mock('antd', () => ({
  Card: jest.fn().mockImplementation(({ children }) => <div>{children}</div>),
  Col: jest.fn().mockImplementation(({ children }) => <div>{children}</div>),
  Input: jest.fn().mockImplementation(({ children }) => <div>{children}</div>),
  Row: jest.fn().mockImplementation(({ children }) => <div>{children}</div>),
  Space: jest.fn().mockImplementation(({ children }) => <div>{children}</div>),
  Typography: {
    Title: jest
      .fn()
      .mockImplementation(({ children }) => <div>{children}</div>),
  },
  Dropdown: jest.fn().mockImplementation(({ children, overlay }) => (
    <div>
      {children}
      {overlay}
    </div>
  )),
  Menu: jest.fn().mockImplementation(({ items }) => (
    <div>
      {items.map((item: { key: string; label: JSX.Element }) => {
        <div key={item.key}>{item.label}</div>;
      })}
    </div>
  )),
  Button: jest
    .fn()
    .mockImplementation(({ children }) => <button>{children}</button>),
  Tooltip: jest
    .fn()
    .mockImplementation(({ children }) => <span>{children}</span>),
}));

jest.mock('../common/title-breadcrumb/title-breadcrumb.component', () =>
  jest.fn().mockReturnValue(<div>Breadcrumb</div>)
);

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

    const glossaryTerm = await queryByText(
      container,
      /Glossary-Term component/i
    );

    expect(glossaryDetails).toBeInTheDocument();
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
});
