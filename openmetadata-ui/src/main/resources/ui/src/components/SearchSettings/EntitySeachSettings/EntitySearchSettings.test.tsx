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
import React from 'react';
import { MemoryRouter, useParams } from 'react-router-dom';
import {
  BoostMode,
  ScoreMode,
} from '../../../generated/configuration/searchSettings';
import { useApplicationStore } from '../../../hooks/useApplicationStore';
import {
  restoreSettingsConfig,
  updateSettingsConfig,
} from '../../../rest/settingConfigAPI';
import { showSuccessToast } from '../../../utils/ToastUtils';
import EntitySearchSettings from './EntitySearchSettings';

const mockEntityType = 'table';
const mockSearchConfig = {
  assetTypeConfigurations: [
    {
      assetType: 'table',
      searchFields: [
        {
          field: 'description',
          boost: 5,
        },
      ],
      boostMode: BoostMode.Multiply,
      scoreMode: ScoreMode.Avg,
      highlightFields: ['description'],
      fieldValueBoosts: [],
      termBoosts: [],
    },
  ],
};

const mockSetAppPreferences = jest.fn();

const mockUseApplicationStore = useApplicationStore as unknown as jest.Mock;

jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useParams: jest.fn(),
  useHistory: jest.fn().mockReturnValue({ push: jest.fn() }),
}));

jest.mock('../../../hooks/useApplicationStore', () => ({
  useApplicationStore: jest.fn(),
}));

jest.mock('../../../rest/settingConfigAPI', () => ({
  updateSettingsConfig: jest.fn(),
  restoreSettingsConfig: jest.fn(),
}));

jest.mock('../../../utils/ToastUtils', () => ({
  showErrorToast: jest.fn(),
  showSuccessToast: jest.fn(),
}));

jest.mock('../../common/TitleBreadcrumb/TitleBreadcrumb.component', () => {
  return jest.fn().mockImplementation(() => <div>Title Breadcrumb</div>);
});

jest.mock('../SearchPreview/SearchPreview', () => {
  return jest
    .fn()
    .mockImplementation(() => <div data-testid="search-preview" />);
});

jest.mock('../FieldConfiguration/FieldConfiguration', () => {
  return jest.fn().mockImplementation(() => <div data-testid="field-config" />);
});

jest.mock('../../PageLayoutV1/PageLayoutV1', () => {
  return jest.fn().mockImplementation(({ children }) => <div>{children}</div>);
});

jest.mock('../../../context/PermissionProvider/PermissionProvider', () => ({
  usePermissionProvider: jest.fn().mockReturnValue({
    permissions: {
      searchIndex: { Edit: true },
    },
  }),
}));

jest.mock('../../../hooks/authHooks', () => ({
  useAuth: jest.fn().mockReturnValue({
    isAdminUser: true,
  }),
}));

jest.mock('antd', () => ({
  ...jest.requireActual('antd'),
  Select: ({
    value,
    onChange,
    'data-testid': testId,
  }: {
    value: string;
    onChange?: (value: string) => void;
    'data-testid'?: string;
  }) => (
    <select
      data-testid={testId}
      value={value}
      onChange={(e) => onChange?.(e.target.value)}>
      <option value="avg">avg</option>
      <option value="max">max</option>
      <option value="multiply">multiply</option>
      <option value="sum">sum</option>
    </select>
  ),
}));

describe('EntitySearchSettings', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (useParams as jest.Mock).mockReturnValue({ entityType: mockEntityType });
    mockUseApplicationStore.mockReturnValue({
      appPreferences: { searchConfig: mockSearchConfig },
      setAppPreferences: mockSetAppPreferences,
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('Should render the component', () => {
    render(
      <MemoryRouter>
        <EntitySearchSettings />
      </MemoryRouter>
    );

    expect(
      screen.getByTestId('entity-search-settings-header')
    ).toBeInTheDocument();
    expect(screen.getByTestId('search-preview')).toBeInTheDocument();
    expect(screen.getByTestId('field-configurations')).toBeInTheDocument();
  });

  it('Should handle save changes successfully', async () => {
    const mockUpdatedConfig = {
      ...mockSearchConfig,
      assetTypeConfigurations: [
        {
          ...mockSearchConfig.assetTypeConfigurations[0],
          boostMode: BoostMode.Sum,
        },
      ],
    };

    (updateSettingsConfig as jest.Mock).mockResolvedValueOnce({
      data: { config_value: mockUpdatedConfig },
    });
    (useParams as jest.Mock).mockReturnValue({ tab: 'tables' });

    render(
      <MemoryRouter>
        <EntitySearchSettings />
      </MemoryRouter>
    );

    const boostModeSelect = screen.getByTestId('boost-mode-select');
    await act(async () => {
      fireEvent.change(boostModeSelect, { target: { value: 'sum' } });
    });

    const saveButton = screen.getByTestId('save-btn');

    expect(saveButton).not.toBeDisabled();

    await act(async () => {
      fireEvent.click(saveButton);
    });

    expect(updateSettingsConfig).toHaveBeenCalledWith({
      config_type: 'searchSettings',
      config_value: expect.objectContaining({
        assetTypeConfigurations: expect.arrayContaining([
          expect.objectContaining({
            boostMode: BoostMode.Sum,
          }),
        ]),
      }),
    });
    expect(showSuccessToast).toHaveBeenCalled();
    expect(mockSetAppPreferences).toHaveBeenCalled();
  });

  it('Should handle restore defaults successfully', async () => {
    const mockDefaultConfig = {
      ...mockSearchConfig,
      assetTypeConfigurations: [
        {
          ...mockSearchConfig.assetTypeConfigurations[0],
          boostMode: BoostMode.Multiply,
          scoreMode: ScoreMode.Sum,
        },
      ],
    };

    (restoreSettingsConfig as jest.Mock).mockResolvedValueOnce({
      data: mockDefaultConfig,
    });

    render(
      <MemoryRouter>
        <EntitySearchSettings />
      </MemoryRouter>
    );

    const restoreButton = screen.getByTestId('restore-defaults-btn');
    await act(async () => {
      fireEvent.click(restoreButton);
    });

    expect(restoreSettingsConfig).toHaveBeenCalled();
    expect(showSuccessToast).toHaveBeenCalled();
    expect(mockSetAppPreferences).toHaveBeenCalled();
  });
});
