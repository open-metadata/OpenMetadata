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

import { render, screen } from '@testing-library/react';
import React from 'react';
import { OperationPermission } from '../../../context/PermissionProvider/PermissionProvider.interface';
import {
  mockedGlossaryTerms,
  MOCK_ASSETS_DATA,
} from '../../../mocks/Glossary.mock';
import GlossaryTerms from './GlossaryTermsV1.component';

jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useParams: jest.fn().mockImplementation(() => ({
    glossaryName: 'glossary',
    tab: 'terms',
    version: 'glossaryVersion',
  })),
}));

jest.mock(
  '../../ActivityFeed/ActivityFeedTab/ActivityFeedTab.component',
  () => ({
    ActivityFeedTab: jest
      .fn()
      .mockImplementation(() => <p>testActivityFeedTab</p>),
  })
);

jest.mock('../../../rest/miscAPI', () => ({
  searchData: jest
    .fn()
    .mockImplementation(() => Promise.resolve(MOCK_ASSETS_DATA)),
}));

jest.mock('./tabs/AssetsTabs.component', () =>
  jest.fn().mockReturnValue(<div>AssetsTabs</div>)
);
jest.mock('../GlossaryTermTab/GlossaryTermTab.component', () =>
  jest.fn().mockReturnValue(<div>GlossaryTermTab</div>)
);
jest.mock('../GlossaryHeader/GlossaryHeader.component', () =>
  jest.fn().mockReturnValue(<div>GlossaryHeader.component</div>)
);
jest.mock('./tabs/GlossaryOverviewTab.component', () =>
  jest.fn().mockReturnValue(<div>GlossaryOverviewTab.component</div>)
);

const mockProps = {
  isSummaryPanelOpen: false,
  permissions: {
    Create: true,
    Delete: true,
    ViewAll: true,
    EditAll: true,
    EditDescription: true,
    EditDisplayName: true,
    EditCustomFields: true,
  } as OperationPermission,
  glossaryTerm: mockedGlossaryTerms[0],
  termsLoading: false,
  handleGlossaryTermUpdate: jest.fn(),
  onRelatedTermClick: jest.fn(),
  handleGlossaryTermDelete: jest.fn(),
  refreshGlossaryTerms: jest.fn(),
  refreshActiveGlossaryTerm: jest.fn(),
  onAddGlossaryTerm: jest.fn(),
  onEditGlossaryTerm: jest.fn(),
  onThreadLinkSelect: jest.fn(),
};

jest.mock('../../../utils/GlossaryTerm/GlossaryTermUtil', () => ({
  getGlossaryTermDetailTabs: jest.fn().mockImplementation((itemes) => itemes),
  getTabLabelMap: jest.fn().mockReturnValue({}),
}));

describe.skip('Test Glossary-term component', () => {
  it('Should render Glossary-term component', async () => {
    render(<GlossaryTerms {...mockProps} />);

    const glossaryTerm = screen.getByTestId('glossary-term');
    const tabs = await screen.findAllByRole('tab');

    expect(await screen.findByText('GlossaryTermTab')).toBeInTheDocument();
    expect(glossaryTerm).toBeInTheDocument();
    expect(tabs).toHaveLength(5);
    expect(tabs.map((tab) => tab.textContent)).toStrictEqual([
      'label.overview',
      'label.glossary-term-plural0',
      'label.asset-plural1', // 1 added as its count for assets
      'label.activity-feed-and-task-plural0',
      'label.custom-property-plural',
    ]);
  });
});
