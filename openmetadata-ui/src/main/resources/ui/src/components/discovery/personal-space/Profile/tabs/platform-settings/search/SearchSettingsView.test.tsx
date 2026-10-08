/*
 *  Copyright 2026 Collate.
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
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import { ReactNode } from 'react';
import {
  getSettingsByType,
  restoreSettingsConfig,
  updateSettingsConfig,
} from '../../../../../../../rest/settingConfigAPI';
import searchSettingsClassBase from '../../../../../../../utils/SearchSettingsClassBase';
import {
  showErrorToast,
  showSuccessToast,
} from '../../../../../../../utils/ToastUtils';
import SearchSettingsView from './SearchSettingsView';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

jest.mock('../../../../../../../rest/settingConfigAPI', () => ({
  getSettingsByType: jest.fn(),
  restoreSettingsConfig: jest.fn(),
  updateSettingsConfig: jest.fn(),
}));

jest.mock('../../../../../../../utils/ToastUtils', () => ({
  showErrorToast: jest.fn(),
  showSuccessToast: jest.fn(),
}));

const mockSetAppPreferences = jest.fn();
jest.mock('../../../../../../../hooks/useApplicationStore', () => ({
  useApplicationStore: (
    selector: (state: { setAppPreferences: jest.Mock }) => unknown
  ) => selector({ setAppPreferences: mockSetAppPreferences }),
}));

let mockIsAdmin = true;
jest.mock('../../../../../../../hooks/authHooks', () => ({
  useAuth: () => ({ isAdminUser: mockIsAdmin }),
}));

jest.mock(
  '../../../../../../../context/PermissionProvider/PermissionProvider',
  () => ({ usePermissionProvider: () => ({ permissions: {} }) })
);

jest.mock('../../../../../../../utils/SearchSettingsUtils', () => ({
  getSearchSettingCategories: () => [
    {
      key: 'preferences.search-settings.tables',
      label: 'Tables',
      description: 'Table search',
      isProtected: true,
    },
  ],
}));

jest.mock('../../../../../../../utils/TagClassBase', () => ({
  __esModule: true,
  default: { getTags: jest.fn().mockResolvedValue({ data: [] }) },
}));

const CONFIG = {
  globalSettings: {
    enableAccessControl: false,
    enableColumnIndexing: true,
    maxAggregateSize: 10000,
    maxResultHits: 10000,
    maxAnalyzedOffset: 1000,
    termBoosts: [
      { field: 'tier.tagFQN', value: 'Tier.Tier1', boost: 5 },
      { field: 'tags.tagFQN', value: 'PII.Sensitive', boost: 2 },
    ],
    fieldValueBoosts: [
      { field: 'totalVotes', factor: 0.0015 },
      { field: 'usageSummary.weeklyStats.count', factor: 0.00005 },
    ],
  },
  allowedFieldValueBoosts: [{ fields: [{ name: 'totalVotes' }] }],
  assetTypeConfigurations: [{ assetType: 'table' }],
};

const onNavigate = jest.fn();
let headerActions: ReactNode;
const onSetHeaderActions = (actions: ReactNode) => {
  headerActions = actions;
};

const renderView = async () => {
  render(
    <SearchSettingsView
      onNavigate={onNavigate}
      onSetHeaderActions={onSetHeaderActions}
    />
  );
  await screen.findByTestId('search-settings');
};

const savedGlobalSettings = (call = 0) =>
  (updateSettingsConfig as jest.Mock).mock.calls[call][0].config_value
    .globalSettings;

const clickToggle = (testId: string) =>
  fireEvent.click(
    screen.getByTestId(testId).querySelector('input') as HTMLInputElement
  );

describe('SearchSettingsView', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockIsAdmin = true;
    headerActions = undefined;
    (getSettingsByType as jest.Mock).mockResolvedValue(CONFIG);
    (updateSettingsConfig as jest.Mock).mockImplementation(async (body) => ({
      data: body,
    }));
    (restoreSettingsConfig as jest.Mock).mockResolvedValue({ data: {} });
  });

  it('shows the global settings, boosts and one card per entity', async () => {
    await renderView();

    expect(
      screen.getByTestId('global-setting-value-maxAggregateSize')
    ).toHaveTextContent('10000');
    expect(screen.getByTestId('term-boosts')).toHaveTextContent('2');
    expect(screen.getByTestId('term-boost-Tier.Tier1')).toBeInTheDocument();
    expect(
      within(screen.getByTestId('field-value-boost-table')).getByText(
        'totalVotes'
      )
    ).toBeInTheDocument();
    expect(screen.getByTestId('search-entity-card-tables')).toHaveTextContent(
      'Tables'
    );
    expect(mockSetAppPreferences).toHaveBeenCalledWith({
      searchConfig: CONFIG,
    });
  });

  it('saves the full config when access control is toggled', async () => {
    await renderView();
    clickToggle('enable-roles-polices-in-search-switch');

    await waitFor(() => expect(updateSettingsConfig).toHaveBeenCalled());

    const body = (updateSettingsConfig as jest.Mock).mock.calls[0][0];

    expect(body.config_value.assetTypeConfigurations).toEqual(
      CONFIG.assetTypeConfigurations
    );
    expect(savedGlobalSettings()).toEqual({
      ...CONFIG.globalSettings,
      enableAccessControl: true,
    });
  });

  it('asks before turning column indexing off', async () => {
    await renderView();
    clickToggle('enable-column-indexing-switch');

    expect(updateSettingsConfig).not.toHaveBeenCalled();

    fireEvent.click(
      await screen.findByTestId('disable-column-indexing-dialog-confirm')
    );

    await waitFor(() =>
      expect(savedGlobalSettings().enableColumnIndexing).toBe(false)
    );
  });

  it('tells the admin to reindex when column indexing is turned on', async () => {
    (getSettingsByType as jest.Mock).mockResolvedValue({
      ...CONFIG,
      globalSettings: { ...CONFIG.globalSettings, enableColumnIndexing: false },
    });
    await renderView();
    clickToggle('enable-column-indexing-switch');

    await waitFor(() =>
      expect(showSuccessToast).toHaveBeenCalledWith(
        'message.column-indexing-enabled-reindex'
      )
    );

    expect(savedGlobalSettings().enableColumnIndexing).toBe(true);
  });

  it('saves a number setting only when it is within range', async () => {
    await renderView();
    fireEvent.click(screen.getByTestId('global-setting-edit-maxAggregateSize'));
    const input = screen.getByTestId('global-setting-input-maxAggregateSize');

    fireEvent.change(input, { target: { value: '50' } });

    expect(
      screen.getByTestId('global-setting-save-maxAggregateSize')
    ).toBeDisabled();

    fireEvent.change(input, { target: { value: '500' } });
    fireEvent.click(screen.getByTestId('global-setting-save-maxAggregateSize'));

    await waitFor(() =>
      expect(savedGlobalSettings().maxAggregateSize).toBe(500)
    );
  });

  it('saves straight away when an existing term boost is deleted', async () => {
    await renderView();
    fireEvent.click(
      within(screen.getByTestId('term-boost-Tier.Tier1')).getByTestId(
        'delete-term-boost'
      )
    );

    await waitFor(() =>
      expect(savedGlobalSettings().termBoosts).toEqual([
        CONFIG.globalSettings.termBoosts[1],
      ])
    );
  });

  it('drops an unsaved new term boost without saving', async () => {
    await renderView();
    fireEvent.click(screen.getByTestId('term-boost-add-btn'));
    const newCard = await screen.findByTestId('term-boost-new');

    expect(screen.getByTestId('term-boost-save-btn')).toBeDisabled();

    fireEvent.click(within(newCard).getByTestId('delete-term-boost'));

    expect(screen.queryByTestId('term-boost-new')).not.toBeInTheDocument();
    expect(updateSettingsConfig).not.toHaveBeenCalled();
  });

  it('saves straight away when a field value boost is deleted', async () => {
    await renderView();
    fireEvent.click(
      within(screen.getByTestId('field-value-boost-totalVotes')).getByTestId(
        'delete-field-value-boost-btn'
      )
    );

    await waitFor(() =>
      expect(savedGlobalSettings().fieldValueBoosts).toEqual([
        CONFIG.globalSettings.fieldValueBoosts[1],
      ])
    );
  });

  it('saves an edited term boost with Save', async () => {
    await renderView();
    const card = screen.getByTestId('term-boost-PII.Sensitive');
    act(() => {
      fireEvent.keyDown(within(card).getByRole('slider'), {
        key: 'ArrowRight',
      });
    });
    fireEvent.click(screen.getByTestId('term-boost-save-btn'));

    await waitFor(() =>
      expect(savedGlobalSettings().termBoosts).toEqual([
        CONFIG.globalSettings.termBoosts[0],
        { ...CONFIG.globalSettings.termBoosts[1], boost: 2.1 },
      ])
    );
  });

  it('keeps unsaved term boost edits when another setting saves', async () => {
    await renderView();
    act(() => {
      fireEvent.keyDown(
        within(screen.getByTestId('term-boost-PII.Sensitive')).getByRole(
          'slider'
        ),
        { key: 'ArrowRight' }
      );
    });
    clickToggle('enable-roles-polices-in-search-switch');

    await waitFor(() => expect(updateSettingsConfig).toHaveBeenCalled());

    // The toggle saves the stored boosts, not the unsaved edit...
    expect(savedGlobalSettings().termBoosts).toEqual(
      CONFIG.globalSettings.termBoosts
    );
    // ...and the edit is still on screen, waiting for its own Save.
    expect(
      within(screen.getByTestId('term-boost-PII.Sensitive')).getByTestId(
        'term-boost-value'
      )
    ).toHaveTextContent('2.1');
    expect(screen.getByTestId('term-boost-save-btn')).toBeEnabled();
  });

  it('saves an edited field value boost straight away', async () => {
    await renderView();
    fireEvent.click(
      within(screen.getByTestId('field-value-boost-totalVotes')).getByTestId(
        'edit-field-value-boost-btn'
      )
    );
    const dialog = await screen.findByTestId('field-value-boost-dialog');
    fireEvent.change(
      within(dialog).getByTestId('lt-input').querySelector('input') as Element,
      { target: { value: '9' } }
    );
    await act(async () => {
      fireEvent.click(within(dialog).getByTestId('save-field-value-boost'));
    });

    await waitFor(() =>
      expect(savedGlobalSettings().fieldValueBoosts[0]).toEqual(
        expect.objectContaining({
          field: 'totalVotes',
          condition: { range: { lt: 9 } },
        })
      )
    );
  });

  it('toasts and keeps the settings when a save fails', async () => {
    (updateSettingsConfig as jest.Mock).mockRejectedValue(new Error('boom'));
    await renderView();
    clickToggle('enable-roles-polices-in-search-switch');

    await waitFor(() => expect(showErrorToast).toHaveBeenCalled());

    expect(
      screen
        .getByTestId('enable-roles-polices-in-search-switch')
        .querySelector('input')
    ).not.toBeChecked();
  });

  it('keeps the limit editor and the boost dialog open when a save fails', async () => {
    (updateSettingsConfig as jest.Mock).mockRejectedValue(new Error('boom'));
    await renderView();

    fireEvent.click(screen.getByTestId('global-setting-edit-maxAggregateSize'));
    fireEvent.change(
      screen.getByTestId('global-setting-input-maxAggregateSize'),
      { target: { value: '500' } }
    );
    await act(async () => {
      fireEvent.click(
        screen.getByTestId('global-setting-save-maxAggregateSize')
      );
    });

    expect(showErrorToast).toHaveBeenCalled();
    expect(
      screen.getByTestId('global-setting-input-maxAggregateSize')
    ).toHaveValue(500);

    fireEvent.click(
      within(screen.getByTestId('field-value-boost-totalVotes')).getByTestId(
        'edit-field-value-boost-btn'
      )
    );
    const dialog = await screen.findByTestId('field-value-boost-dialog');
    await act(async () => {
      fireEvent.click(within(dialog).getByTestId('save-field-value-boost'));
    });

    expect(updateSettingsConfig).toHaveBeenCalledTimes(2);
    expect(screen.getByTestId('field-value-boost-dialog')).toBeInTheDocument();
  });

  it('leaves column indexing on when the confirmation is cancelled', async () => {
    await renderView();
    clickToggle('enable-column-indexing-switch');
    fireEvent.click(
      await screen.findByTestId('disable-column-indexing-dialog-cancel')
    );

    expect(updateSettingsConfig).not.toHaveBeenCalled();
  });

  it('restores the defaults after confirmation', async () => {
    await renderView();
    render(<>{headerActions}</>);
    fireEvent.click(screen.getByTestId('reset-search-settings-btn'));
    fireEvent.click(
      await screen.findByTestId('reset-search-settings-dialog-confirm')
    );

    await waitFor(() => expect(restoreSettingsConfig).toHaveBeenCalled());
    await waitFor(() => expect(getSettingsByType).toHaveBeenCalledTimes(2));
  });

  it('closes the reset confirmation with Escape without resetting', async () => {
    await renderView();
    render(<>{headerActions}</>);
    fireEvent.click(screen.getByTestId('reset-search-settings-btn'));
    const dialog = await screen.findByTestId('reset-search-settings-dialog');
    fireEvent.keyDown(dialog, { key: 'Escape' });

    await waitFor(() =>
      expect(
        screen.queryByTestId('reset-search-settings-dialog')
      ).not.toBeInTheDocument()
    );

    expect(restoreSettingsConfig).not.toHaveBeenCalled();
  });

  it('offers no reset to non-admins', async () => {
    mockIsAdmin = false;
    await renderView();

    expect(headerActions).toBeUndefined();
  });

  it('opens the entity page from its card by keyboard', async () => {
    await renderView();
    fireEvent.keyDown(screen.getByTestId('search-entity-card-tables'), {
      key: 'Enter',
    });

    expect(onNavigate).toHaveBeenCalledWith({
      type: 'page',
      page: 'search',
      isEditing: false,
      itemId: 'tables',
    });
  });

  it('saves hybrid weights as complements when the edition offers them', async () => {
    jest
      .spyOn(searchSettingsClassBase, 'showHybridSearchWeights')
      .mockReturnValue(true);
    await renderView();
    const save = screen.getByTestId('hybrid-weights-save-btn');

    expect(save).toBeDisabled();
    expect(screen.getByTestId('keyword-weight')).toHaveTextContent('0.6');

    const thumb = within(screen.getByTestId('hybrid-search-weights')).getByRole(
      'slider'
    );
    act(() => {
      fireEvent.keyDown(thumb, { key: 'ArrowRight' });
    });
    fireEvent.click(save);

    await waitFor(() =>
      expect(savedGlobalSettings()).toEqual(
        expect.objectContaining({ semanticWeight: 0.5, keywordWeight: 0.5 })
      )
    );
  });
});
