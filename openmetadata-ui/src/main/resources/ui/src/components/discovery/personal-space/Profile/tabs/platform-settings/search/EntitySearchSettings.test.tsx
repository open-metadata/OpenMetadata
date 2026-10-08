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
import userEvent from '@testing-library/user-event';
import { ReactNode } from 'react';
import { SearchIndex } from '../../../../../../../enums/search.enum';
import { getCustomPropertiesByEntityType } from '../../../../../../../rest/metadataTypeAPI';
import { searchPreview } from '../../../../../../../rest/searchAPI';
import {
  getSettingsByType,
  restoreSettingsConfig,
  updateSettingsConfig,
} from '../../../../../../../rest/settingConfigAPI';
import tagClassBase from '../../../../../../../utils/TagClassBase';
import { showSuccessToast } from '../../../../../../../utils/ToastUtils';
import EntitySearchSettings from './EntitySearchSettings';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

jest.mock('../../../../../../../rest/settingConfigAPI', () => ({
  getSettingsByType: jest.fn(),
  restoreSettingsConfig: jest.fn(),
  updateSettingsConfig: jest.fn(),
}));

jest.mock('../../../../../../../rest/metadataTypeAPI', () => ({
  getCustomPropertiesByEntityType: jest.fn(),
}));

jest.mock('../../../../../../../rest/searchAPI', () => ({
  searchPreview: jest.fn(),
}));

jest.mock('../../../../../../../utils/ToastUtils', () => ({
  showErrorToast: jest.fn(),
  showSuccessToast: jest.fn(),
}));

jest.mock('../../../../../../../utils/TagClassBase', () => ({
  __esModule: true,
  default: { getTags: jest.fn().mockResolvedValue({ data: [] }) },
}));

const mockSetAppPreferences = jest.fn();
jest.mock('../../../../../../../hooks/useApplicationStore', () => ({
  useApplicationStore: (
    selector: (state: { setAppPreferences: jest.Mock }) => unknown
  ) => selector({ setAppPreferences: mockSetAppPreferences }),
}));

jest.mock(
  '../../../../../../ExploreV1/ExploreSearchCard/ExploreSearchCard',
  () =>
    ({ source }: { source: { fullyQualifiedName: string } }) =>
      <div data-testid="preview-result">{source.fullyQualifiedName}</div>
);

const TABLE_CONFIG = {
  assetType: 'table',
  searchFields: [
    { field: 'name', boost: 10, matchType: 'exact' },
    { field: 'description', boost: 2 },
  ],
  highlightFields: ['name'],
  termBoosts: [{ field: 'tier.tagFQN', value: 'Tier.Tier1', boost: 5 }],
  fieldValueBoosts: [{ field: 'totalVotes', factor: 2 }],
  scoreMode: 'sum',
  boostMode: 'multiply',
  ranking: {
    algorithm: 'nameFirst',
    enabled: true,
    stages: [
      {
        name: 'exactName',
        weight: 100,
        matchType: 'exact',
        fields: ['name.keyword'],
      },
    ],
    signals: { boostMode: 'sum', scoreMode: 'sum', maxBoost: 2 },
  },
};
const TOPIC_CONFIG = { assetType: 'topic', searchFields: [] };
const CONFIG = {
  allowedFields: [
    {
      entityType: 'table',
      fields: [
        { name: 'name', description: 'Table name', highlight: true },
        { name: 'description', description: 'Table description' },
        { name: 'columns.name', description: 'Column names' },
      ],
    },
  ],
  allowedFieldValueBoosts: [{ fields: [{ name: 'totalVotes' }] }],
  assetTypeConfigurations: [TABLE_CONFIG, TOPIC_CONFIG],
};

const onNavigate = jest.fn();
let headerActions: ReactNode;
const onSetHeaderActions = (actions: ReactNode) => {
  headerActions = actions;
};

const renderPage = async (itemId = 'tables') => {
  render(
    <EntitySearchSettings
      itemId={itemId}
      onNavigate={onNavigate}
      onSetHeaderActions={onSetHeaderActions}
    />
  );
  await screen.findByTestId('entity-search-settings');
};

const renderHeader = () => render(<>{headerActions}</>);

const savedTableConfig = () =>
  (
    updateSettingsConfig as jest.Mock
  ).mock.calls[0][0].config_value.assetTypeConfigurations.find(
    (config: { assetType: string }) => config.assetType === 'table'
  );

const lastPreviewTableConfig = () => {
  const calls = (searchPreview as jest.Mock).mock.calls;

  return calls[calls.length - 1][0].searchSettings.assetTypeConfigurations[0];
};

describe('EntitySearchSettings', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    headerActions = undefined;
    (getSettingsByType as jest.Mock).mockResolvedValue(CONFIG);
    (getCustomPropertiesByEntityType as jest.Mock).mockResolvedValue([
      { name: 'owner_team', description: 'Owning team' },
    ]);
    (searchPreview as jest.Mock).mockResolvedValue({
      hits: {
        hits: [
          { _id: '1', _source: { fullyQualifiedName: 'db.schema.orders' } },
        ],
        total: { value: 1 },
      },
    });
    (updateSettingsConfig as jest.Mock).mockImplementation(async (body) => ({
      data: body,
    }));
    (restoreSettingsConfig as jest.Mock).mockResolvedValue({ data: {} });
  });

  it('shows the entity ranking, matching fields and a preview, with Save disabled', async () => {
    await renderPage();

    expect(screen.getByTestId('ranking-stage-exactName')).toBeInTheDocument();
    expect(screen.getByTestId('ranking-stage-weight-0')).toHaveValue(100);
    expect(screen.getByTestId('field-configurations')).toHaveTextContent('2');
    expect(
      screen.getByTestId('field-configuration-panel-name')
    ).toHaveTextContent('Table name');
    expect(await screen.findByTestId('preview-result')).toHaveTextContent(
      'db.schema.orders'
    );
    expect(searchPreview).toHaveBeenCalledWith(
      expect.objectContaining({ index: SearchIndex.TABLE, query: '' })
    );

    renderHeader();

    expect(screen.getByTestId('save-btn')).toBeDisabled();
  });

  it('previews and saves the draft for this entity only', async () => {
    await renderPage();
    fireEvent.change(screen.getByTestId('ranking-stage-weight-0'), {
      target: { value: '80' },
    });
    fireEvent.click(
      within(
        screen.getByTestId('field-configuration-panel-description')
      ).getByTestId('delete-search-field')
    );

    await waitFor(() =>
      expect(lastPreviewTableConfig().searchFields).toEqual([
        TABLE_CONFIG.searchFields[0],
      ])
    );

    renderHeader();
    fireEvent.click(screen.getByTestId('save-btn'));

    await waitFor(() => expect(updateSettingsConfig).toHaveBeenCalled());

    expect(savedTableConfig().ranking.stages[0].weight).toBe(80);
    expect(savedTableConfig().searchFields).toEqual([
      TABLE_CONFIG.searchFields[0],
    ]);
    expect(
      (updateSettingsConfig as jest.Mock).mock.calls[0][0].config_value
        .assetTypeConfigurations[1]
    ).toEqual(TOPIC_CONFIG);
    expect(mockSetAppPreferences).toHaveBeenLastCalledWith({
      searchConfig: expect.objectContaining({
        allowedFields: CONFIG.allowedFields,
      }),
    });
  });

  it('adds unselected and custom-property fields from the Add menu', async () => {
    await renderPage();
    fireEvent.click(screen.getByTestId('add-field-btn'));

    expect(
      await screen.findByTestId('add-field-columns.name')
    ).toBeInTheDocument();
    expect(screen.queryByTestId('add-field-name')).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId('add-field-extension.owner_team'));

    const panel = await screen.findByTestId(
      'field-configuration-panel-extension.owner_team'
    );

    expect(
      within(panel).getByTestId('custom-property-badge')
    ).toBeInTheDocument();
    // A newly added field opens so its weight can be set straight away.
    expect(within(panel).getByTestId('field-weight-value')).toHaveTextContent(
      '0'
    );
  });

  it('only lets the server-highlightable fields be highlighted', async () => {
    await renderPage();
    const toggleOf = (field: string) => {
      const panel = screen.getByTestId(`field-configuration-panel-${field}`);
      fireEvent.click(within(panel).getByTestId('field-configuration-toggle'));

      return within(panel)
        .getByTestId('highlight-field-switch')
        .querySelector('input') as HTMLInputElement;
    };

    expect(toggleOf('name')).toBeChecked();
    expect(toggleOf('description')).toBeDisabled();
  });

  it('edits a field value boost into the draft without saving', async () => {
    await renderPage();
    fireEvent.click(
      within(screen.getByTestId('field-value-boost-totalVotes')).getByTestId(
        'edit-field-value-boost-btn'
      )
    );
    const dialog = await screen.findByTestId('field-value-boost-dialog');
    fireEvent.change(
      within(dialog).getByTestId('gte-input').querySelector('input') as Element,
      { target: { value: '5' } }
    );
    await act(async () => {
      fireEvent.click(within(dialog).getByTestId('save-field-value-boost'));
    });

    await waitFor(() =>
      expect(lastPreviewTableConfig().fieldValueBoosts).toEqual([
        expect.objectContaining({
          field: 'totalVotes',
          factor: 2,
          condition: { range: { gte: 5 } },
        }),
      ])
    );

    expect(updateSettingsConfig).not.toHaveBeenCalled();
  });

  const choose = async (selectTestId: string, option: string) => {
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    await act(async () => {
      await user.click(
        within(screen.getByTestId(selectTestId)).getByRole('button')
      );
    });
    await act(async () => {
      await user.click(await screen.findByRole('option', { name: option }));
    });
  };

  it('edits the ranking switch, signals and modes into the draft', async () => {
    await renderPage();
    fireEvent.click(
      screen
        .getByTestId('ranking-enabled-switch')
        .querySelector('input') as HTMLInputElement
    );
    fireEvent.change(screen.getByTestId('ranking-max-boost'), {
      target: { value: '' },
    });
    await choose('ranking-boost-mode-select', 'Multiply');
    await choose('ranking-score-mode-select', 'Max');
    await choose('score-mode-select', 'First');
    await choose('boost-mode-select', 'Replace');

    await waitFor(() =>
      expect(lastPreviewTableConfig()).toEqual(
        expect.objectContaining({
          scoreMode: 'first',
          boostMode: 'replace',
          ranking: expect.objectContaining({
            enabled: false,
            signals: { boostMode: 'multiply', scoreMode: 'max' },
          }),
        })
      )
    );
  });

  it('edits a matching field weight and match type into the draft', async () => {
    await renderPage();
    const panel = screen.getByTestId('field-configuration-panel-description');
    fireEvent.click(within(panel).getByTestId('field-configuration-toggle'));
    act(() => {
      fireEvent.keyDown(within(panel).getByRole('slider'), {
        key: 'ArrowRight',
      });
    });
    await choose('match-type-select', 'label.phrase-match');

    await waitFor(() =>
      expect(lastPreviewTableConfig().searchFields[1]).toEqual({
        field: 'description',
        boost: 2.1,
        matchType: 'phrase',
      })
    );
  });

  it('adds and removes term boosts in the draft only', async () => {
    await renderPage();
    fireEvent.click(screen.getByTestId('add-term-boost-btn'));

    expect(await screen.findByTestId('term-boost-new')).toBeInTheDocument();
    expect(screen.getByTestId('add-term-boost-btn')).toBeDisabled();

    fireEvent.click(
      within(screen.getByTestId('term-boost-new')).getByTestId(
        'delete-term-boost'
      )
    );

    expect(screen.queryByTestId('term-boost-new')).not.toBeInTheDocument();

    fireEvent.click(
      within(screen.getByTestId('term-boost-Tier.Tier1')).getByTestId(
        'delete-term-boost'
      )
    );

    await waitFor(() =>
      expect(lastPreviewTableConfig().termBoosts).toEqual([])
    );

    expect(updateSettingsConfig).not.toHaveBeenCalled();
  });

  it('closes a new term boost card whose tag was picked but not boosted', async () => {
    (tagClassBase.getTags as jest.Mock).mockResolvedValue({
      data: [{ data: { fullyQualifiedName: 'PII.Sensitive' } }],
    });
    await renderPage();
    fireEvent.click(screen.getByTestId('add-term-boost-btn'));
    const card = await screen.findByTestId('term-boost-new');
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    await act(async () => {
      await user.click(within(card).getByRole('combobox'));
    });
    await act(async () => {
      await user.keyboard('{ArrowDown}{Enter}');
    });
    const picked = await screen.findByTestId('term-boost-PII.Sensitive');
    fireEvent.click(within(picked).getByTestId('delete-term-boost'));

    await waitFor(() =>
      expect(
        screen.queryByTestId('term-boost-PII.Sensitive')
      ).not.toBeInTheDocument()
    );

    expect(screen.getByTestId('add-term-boost-btn')).toBeEnabled();
  });

  it('removes a field value boost and opens an empty dialog to add one', async () => {
    await renderPage();
    fireEvent.click(
      within(screen.getByTestId('field-value-boost-totalVotes')).getByTestId(
        'delete-field-value-boost-btn'
      )
    );

    await waitFor(() =>
      expect(lastPreviewTableConfig().fieldValueBoosts).toEqual([])
    );

    fireEvent.click(screen.getByTestId('add-field-value-boost-btn'));
    const dialog = await screen.findByTestId('field-value-boost-dialog');
    await act(async () => {
      fireEvent.click(within(dialog).getByTestId('save-field-value-boost'));
    });

    expect(
      await within(dialog).findByText('message.field-required')
    ).toBeInTheDocument();
  });

  it('restores the defaults after confirmation and reloads them', async () => {
    await renderPage();
    renderHeader();
    fireEvent.click(screen.getByTestId('restore-defaults-btn'));
    fireEvent.click(
      await screen.findByTestId('restore-defaults-dialog-confirm')
    );

    await waitFor(() =>
      expect(showSuccessToast).toHaveBeenCalledWith(
        'server.restore-entity-success'
      )
    );

    expect(restoreSettingsConfig).toHaveBeenCalled();
    expect(getSettingsByType).toHaveBeenCalledTimes(2);
  });

  it('returns to the entity list for an unknown entity', async () => {
    render(
      <EntitySearchSettings
        itemId="not-an-entity"
        onNavigate={onNavigate}
        onSetHeaderActions={onSetHeaderActions}
      />
    );

    await waitFor(() =>
      expect(onNavigate).toHaveBeenCalledWith({
        type: 'page',
        page: 'search',
        isEditing: false,
      })
    );

    expect(getSettingsByType).not.toHaveBeenCalled();
  });
});
