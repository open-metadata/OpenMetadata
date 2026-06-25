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
import { act, render, screen, waitFor } from '@testing-library/react';
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
import SearchPreview from '../SearchPreview/SearchPreview';
import EntitySearchSettings from './EntitySearchSettings';

const mockSearchConfig = {
  assetTypeConfigurations: [
    {
      assetType: 'table',
      searchFields: [
        { field: 'name.ngram', boost: 1 },
        { field: 'description', boost: 5 },
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
}));

jest.mock('../../../hooks/useApplicationStore', () => ({
  useApplicationStore: jest.fn(),
}));

jest.mock('../../../rest/settingConfigAPI', () => ({
  updateSettingsConfig: jest.fn(),
  restoreSettingsConfig: jest.fn(),
  getSettingsByType: jest.fn(),
}));

jest.mock('../../../rest/metadataTypeAPI', () => ({
  getCustomPropertiesByEntityType: jest.fn().mockResolvedValue([]),
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
    permissions: { searchIndex: { Edit: true } },
  }),
}));

jest.mock('../../../hooks/authHooks', () => ({
  useAuth: jest.fn().mockReturnValue({ isAdminUser: true }),
}));

const getLastSearchPreviewProps = () => {
  const mock = SearchPreview as jest.Mock;

  return mock.mock.calls[mock.mock.calls.length - 1]?.[0] ?? {};
};

describe('EntitySearchSettings', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (useParams as jest.Mock).mockReturnValue({ fqn: 'tables' });
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

  it('Should not override preview config with undefined searchFields before entity config loads', async () => {
    // With fqn: undefined, entityType resolves to undefined and getEntityConfiguration
    // is null, so searchSettings.searchFields stays undefined. The guard
    // (searchFields !== undefined) must prevent overriding previewSearchConfig with
    // a config that has searchFields: undefined for the entity.
    (useParams as jest.Mock).mockReturnValue({ fqn: undefined });

    await act(async () => {
      render(
        <MemoryRouter>
          <EntitySearchSettings />
        </MemoryRouter>
      );
    });

    const props = getLastSearchPreviewProps();

    // Preview must receive the original searchConfig, not a partially-overridden copy.
    expect(props.searchConfig).toEqual(mockSearchConfig);
  });

  it('Should update preview config when restore defaults returns empty searchFields', async () => {
    const restoredConfig = {
      ...mockSearchConfig,
      assetTypeConfigurations: [
        {
          assetType: 'table',
          searchFields: [],
          boostMode: BoostMode.Multiply,
          scoreMode: ScoreMode.Avg,
          highlightFields: [],
          fieldValueBoosts: [],
          termBoosts: [],
        },
      ],
    };

    (restoreSettingsConfig as jest.Mock).mockResolvedValue({
      data: restoredConfig,
    });

    await act(async () => {
      render(
        <MemoryRouter>
          <EntitySearchSettings />
        </MemoryRouter>
      );
    });

    // Call handleRestoreDefaults directly from the props passed to the mocked SearchPreview.
    const { handleRestoreDefaults } = getLastSearchPreviewProps();

    await act(async () => {
      await handleRestoreDefaults();
    });

    await waitFor(() => {
      const entityConfig =
        getLastSearchPreviewProps()?.searchConfig?.assetTypeConfigurations?.find(
          (c: { assetType: string }) => c.assetType === 'table'
        );

      expect(entityConfig?.searchFields).toEqual([]);
    });
  });

  it('Should set entity-specific config after save, not full SearchSettings', async () => {
    const savedConfig = {
      ...mockSearchConfig,
      assetTypeConfigurations: [
        {
          assetType: 'table',
          searchFields: [{ field: 'name.ngram', boost: 5 }],
          boostMode: BoostMode.Multiply,
          scoreMode: ScoreMode.Avg,
          highlightFields: ['description'],
          fieldValueBoosts: [],
          termBoosts: [],
        },
      ],
    };

    (updateSettingsConfig as jest.Mock).mockResolvedValue({
      data: { config_type: 'searchSettings', config_value: savedConfig },
    });

    await act(async () => {
      render(
        <MemoryRouter>
          <EntitySearchSettings />
        </MemoryRouter>
      );
    });

    // Call handleSaveChanges directly from the props passed to the mocked SearchPreview.
    const { handleSaveChanges } = getLastSearchPreviewProps();

    await act(async () => {
      await handleSaveChanges();
    });

    await waitFor(() => {
      expect(updateSettingsConfig).toHaveBeenCalled();
    });

    // After save the preview config must reflect only entity-specific fields.
    const entityConfig =
      getLastSearchPreviewProps()?.searchConfig?.assetTypeConfigurations?.find(
        (c: { assetType: string }) => c.assetType === 'table'
      );

    // Verify no full-SearchSettings properties (e.g. allowedFields) leaked into
    // the entity config after the save response is processed.
    expect(entityConfig).not.toHaveProperty('allowedFields');
    expect(entityConfig).not.toHaveProperty('assetTypeConfigurations');
  });
});
