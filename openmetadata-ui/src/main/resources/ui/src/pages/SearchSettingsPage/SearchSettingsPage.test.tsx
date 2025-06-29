/*
 *  Copyright 2025 Collate.
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
import { act, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { SearchSettings } from '../../generated/configuration/searchSettings';
import { useApplicationStore } from '../../hooks/useApplicationStore';
import {
  getSettingsByType,
  updateSettingsConfig,
} from '../../rest/settingConfigAPI';
import SearchSettingsPage from './SearchSettingsPage';

const mockSearchSettings: SearchSettings = {
  globalSettings: {
    enableAccessControl: true,
    maxAggregateSize: 10000,
    maxResultHits: 10000,
  },
};

const mockAppState = {
  appPreferences: { searchConfig: mockSearchSettings },
  setAppPreferences: jest.fn(),
};

const mockSettingCategories = [
  {
    key: 'search-settings/table',
    label: 'Tables',
    icon: () => <span>Icon</span>,
    description: 'Search Settings for Tables',
  },
];

const mockUseApplicationStore = useApplicationStore as unknown as jest.Mock;

jest.mock('../../hooks/useApplicationStore', () => ({
  useApplicationStore: jest.fn().mockReturnValue({
    appPreferences: { searchConfig: {} },
    setAppPreferences: jest.fn(),
  }),
}));

jest.mock('../../rest/settingConfigAPI', () => ({
  getSettingsByType: jest.fn(),
  updateSettingsConfig: jest.fn(),
}));

jest.mock('../../utils/GlobalSettingsUtils', () => ({
  getSettingPageEntityBreadCrumb: jest.fn(),
}));

jest.mock('../../utils/SearchSettingsUtils', () => ({
  getSearchSettingCategories: jest.fn().mockReturnValue(mockSettingCategories),
}));

jest.mock('../../components/PageLayoutV1/PageLayoutV1', () => {
  return jest.fn().mockImplementation(({ children }) => <div>{children}</div>);
});

jest.mock(
  '../../components/common/TitleBreadcrumb/TitleBreadcrumb.component',
  () => {
    return jest.fn().mockImplementation(() => <p>TitleBreadcrumb</p>);
  }
);

describe('Test SearchSettingsPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseApplicationStore.mockImplementation(() => mockAppState);
    (getSettingsByType as jest.Mock).mockResolvedValue(mockSearchSettings);
  });

  it('Should render the search settings page', async () => {
    await act(async () => {
      render(
        <MemoryRouter>
          <SearchSettingsPage />
        </MemoryRouter>
      );
    });

    expect(getSettingsByType).toHaveBeenCalled();
  });

  it('Handles enable roles and polices search toggle', async () => {
    (updateSettingsConfig as jest.Mock).mockResolvedValue({
      data: {
        config_type: 'searchSettings',
        config_value: {
          globalSettings: {
            ...mockSearchSettings.globalSettings,
          },
        },
      },
    });

    await act(async () => {
      render(
        <MemoryRouter>
          <SearchSettingsPage />
        </MemoryRouter>
      );
    });

    const accessControlSwitch = screen.getByTestId(
      'enable-roles-polices-in-search-switch'
    );

    await act(async () => {
      fireEvent.click(accessControlSwitch);
    });

    expect(updateSettingsConfig).toHaveBeenCalledWith({
      config_type: 'searchSettings',
      config_value: {
        globalSettings: {
          ...mockSearchSettings.globalSettings,
          enableAccessControl: false,
        },
      },
    });
  });
});
