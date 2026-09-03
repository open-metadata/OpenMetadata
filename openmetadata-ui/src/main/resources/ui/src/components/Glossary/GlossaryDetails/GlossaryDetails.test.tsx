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

import { act, render, screen, within } from '@testing-library/react';
import React from 'react';
import { OperationPermission } from '../../../context/PermissionProvider/PermissionProvider.interface';
import {
  mockedGlossaries,
  MOCK_PERMISSIONS,
} from '../../../mocks/Glossary.mock';
import { useGlossaryStore } from '../useGlossary.store';
import GlossaryDetails from './GlossaryDetails.component';

jest.mock('../GlossaryTermTab/GlossaryTermTab.component', () => {
  return jest.fn().mockReturnValue(<p>GlossaryTermTab.component</p>);
});
jest.mock('../GlossaryHeader/GlossaryHeader.component', () => {
  return jest.fn().mockReturnValue(<p>GlossaryHeader.component</p>);
});
jest.mock('react-router-dom', () => ({
  Link: jest
    .fn()
    .mockImplementation(({ children }: { children: React.ReactNode }) => (
      <p>{children}</p>
    )),
  useParams: jest.fn().mockImplementation(() => ({
    glossaryName: 'GlossaryName',
    tab: 'terms',
  })),
  useNavigate: jest.fn().mockReturnValue(jest.fn()),
}));

jest.mock(
  '../../ActivityFeed/ActivityFeedTab/ActivityFeedTab.component',
  () => ({
    ActivityFeedTab: jest
      .fn()
      .mockImplementation(() => <p>testActivityFeedTab</p>),
  })
);

jest.mock('../../common/EntityDescription/Description', () =>
  jest.fn().mockImplementation(() => <div>Description</div>)
);

jest.mock('../../../hooks/useCustomPages', () => ({
  useCustomPages: jest.fn().mockReturnValue({
    customizedPage: null,
    navigation: null,
    isLoading: false,
  }),
}));

const mockProps = {
  glossary: mockedGlossaries[0],
  glossaryTerms: [],
  termsLoading: false,
  permissions: {
    Create: true,
    Delete: true,
    ViewAll: true,
    EditAll: true,
    EditDescription: true,
    EditDisplayName: true,
    EditCustomFields: true,
  } as OperationPermission,
  updateGlossary: jest.fn(),
  handleGlossaryDelete: jest.fn(),
  refreshGlossaryTerms: jest.fn(),
  onAddGlossaryTerm: jest.fn(),
  onEditGlossaryTerm: jest.fn(),
  updateVote: jest.fn(),
  onThreadLinkSelect: jest.fn(),
  toggleTabExpanded: jest.fn(),
  isTabExpanded: false,
};

jest.mock('../../Customization/GenericProvider/GenericContext', () => ({
  ...jest.requireActual('../../Customization/GenericProvider/GenericContext'),
  useGenericContext: jest.fn().mockImplementation(() => ({
    permissions: MOCK_PERMISSIONS,
  })),
}));

jest.mock('../../Customization/GenericTab/GenericTab', () => ({
  GenericTab: jest.fn().mockImplementation(() => <div>GenericTab</div>),
}));

describe('Test Glossary-details component', () => {
  afterEach(async () => {
    await act(async () => {
      useGlossaryStore.setState({
        activeGlossary: {} as ReturnType<
          typeof useGlossaryStore.getState
        >['activeGlossary'],
        filteredChildrenCount: {},
      });
    });
  });

  it('Should render Glossary-details component', async () => {
    await act(async () => {
      render(<GlossaryDetails {...mockProps} />);
    });

    const glossaryDetails = screen.getByTestId('glossary-details');
    const headerComponent = await screen.findByText('GlossaryHeader.component');

    expect(headerComponent).toBeInTheDocument();
    expect(glossaryDetails).toBeInTheDocument();
    expect(await screen.findByText('GenericTab')).toBeInTheDocument();
  });

  it('shows the status-filtered children count on the Terms tab badge over the raw termCount', async () => {
    useGlossaryStore.setState({
      activeGlossary: {
        ...mockedGlossaries[0],
        fullyQualifiedName: 'GlossaryName',
        termCount: 4,
      },
      filteredChildrenCount: { GlossaryName: 2 },
    });

    await act(async () => {
      render(<GlossaryDetails {...mockProps} />);
    });

    const termsTab = await screen.findByTestId('terms');

    expect(within(termsTab).getByTestId('filter-count')).toHaveTextContent('2');
  });

  it('falls back to the raw termCount when no filtered count is stored yet', async () => {
    useGlossaryStore.setState({
      activeGlossary: {
        ...mockedGlossaries[0],
        fullyQualifiedName: 'GlossaryName',
        termCount: 4,
      },
      filteredChildrenCount: {},
    });

    await act(async () => {
      render(<GlossaryDetails {...mockProps} />);
    });

    const termsTab = await screen.findByTestId('terms');

    expect(within(termsTab).getByTestId('filter-count')).toHaveTextContent('4');
  });
});
