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
import { OperationPermission } from '../../../context/PermissionProvider/PermissionProvider.interface';
import { EntityTabs } from '../../../enums/entity.enum';
import {
  mockedGlossaryTerms,
  MOCK_ASSETS_DATA,
  MOCK_PERMISSIONS,
} from '../../../mocks/Glossary.mock';
import { useRequiredParams } from '../../../utils/useRequiredParams';
import GlossaryTerms from './GlossaryTermsV1.component';

const mockPush = jest.fn();

jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: jest.fn().mockImplementation(() => mockPush),
}));

jest.mock('../../../utils/useRequiredParams', () => ({
  useRequiredParams: jest.fn().mockReturnValue({
    tab: undefined,
    version: 'glossaryVersion',
  }),
}));

jest.mock('../../../hooks/useFqn', () => ({
  useFqn: jest.fn().mockReturnValue({ fqn: 'glossaryTerm' }),
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
jest.mock('../../Customization/GenericTab/GenericTab', () => ({
  GenericTab: jest.fn().mockImplementation(() => <div>GenericTab</div>),
}));

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
  isTabExpanded: false,
  toggleTabExpanded: jest.fn(),
};

jest.mock('../../../utils/GlossaryTerm/GlossaryTermUtil', () => ({
  getGlossaryTermDetailTabs: jest.fn().mockImplementation((items) => items),
  getTabLabelMap: jest.fn().mockReturnValue({}),
}));

jest.mock('../../Customization/GenericProvider/GenericProvider', () => {
  return {
    useGenericContext: jest.fn().mockImplementation(() => ({
      permissions: MOCK_PERMISSIONS,
    })),
    GenericProvider: jest.fn().mockImplementation(({ children }) => children),
    _esModule: true,
  };
});

jest.mock('../../../utils/TableColumn.util', () => ({
  ownerTableObject: jest.fn().mockReturnValue({}),
}));

describe('Test Glossary-term component', () => {
  it('Should render overview tab when activeTab is undefined', async () => {
    render(<GlossaryTerms {...mockProps} />);

    expect(screen.getByTestId('glossary-term')).toBeInTheDocument();

    const tabs = await screen.findAllByRole('tab');

    expect(tabs).toHaveLength(5);
    expect(tabs[0].textContent).toBe('label.overview');

    tabs
      .filter((tab) => tab.textContent !== 'label.overview')
      .forEach((tab) => {
        expect(tab).not.toHaveAttribute('aria-selected', 'true');
      });

    expect(mockPush).not.toHaveBeenCalled();
  });

  it('Should render GlossaryTermTab component', async () => {
    const useRequiredParamsMock = useRequiredParams as jest.Mock;
    useRequiredParamsMock.mockReturnValue({
      tab: EntityTabs.GLOSSARY_TERMS,
      version: 'glossaryVersion',
    });

    render(<GlossaryTerms {...mockProps} />);

    const tabs = await screen.findAllByRole('tab');

    expect(await screen.findByText('GlossaryTermTab')).toBeInTheDocument();

    expect(tabs).toHaveLength(5);
    expect(tabs.map((tab) => tab.textContent)).toStrictEqual([
      'label.overview',
      'label.glossary-term-plural0',
      'label.asset-plural0',
      'label.activity-feed-and-task-plural0',
      'label.custom-property-plural',
    ]);
  });
});
