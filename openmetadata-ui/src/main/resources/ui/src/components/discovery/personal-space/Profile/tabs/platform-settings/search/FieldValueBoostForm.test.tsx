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
} from '@testing-library/react';
import {
  getSettingsByType,
  updateSettingsConfig,
} from '../../../../../../../rest/settingConfigAPI';
import FieldValueBoostForm from './FieldValueBoostForm';
import { toEntityDraft } from './SearchSettings.utils';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

jest.mock('../../../../../../../rest/settingConfigAPI', () => ({
  getSettingsByType: jest.fn(),
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

const CONFIG = {
  globalSettings: {
    maxAggregateSize: 100,
    fieldValueBoosts: [{ field: 'totalVotes', factor: 2 }],
  },
  allowedFieldValueBoosts: [{ fields: [{ name: 'totalVotes' }] }],
};

const onNavigate = jest.fn();
const onSaveState = jest.fn();

const renderForm = async (itemId: string, savedState?: unknown) => {
  render(
    <FieldValueBoostForm
      itemId={itemId}
      savedState={savedState}
      showHint={false}
      onNavigate={onNavigate}
      onSaveState={onSaveState}
    />
  );
};

const setInput = (testId: string, value: string) =>
  fireEvent.change(
    screen.getByTestId(testId).querySelector('input') as Element,
    { target: { value } }
  );

const submit = () =>
  act(async () => {
    fireEvent.click(screen.getByTestId('save-button'));
  });

describe('FieldValueBoostForm', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (getSettingsByType as jest.Mock).mockResolvedValue(CONFIG);
    (updateSettingsConfig as jest.Mock).mockImplementation(async (body) => ({
      data: body,
    }));
  });

  it('saves an edited global boost straight away and returns to search', async () => {
    await renderForm('field-value-boost/totalVotes');
    await screen.findByTestId('field-value-boost-form');
    setInput('lt-input', '9');
    await submit();

    await waitFor(() => expect(updateSettingsConfig).toHaveBeenCalled());

    const saved = (updateSettingsConfig as jest.Mock).mock.calls[0][0]
      .config_value.globalSettings;

    expect(saved).toEqual({
      maxAggregateSize: 100,
      fieldValueBoosts: [
        expect.objectContaining({
          field: 'totalVotes',
          factor: 2,
          condition: { range: { lt: 9 } },
        }),
      ],
    });
    expect(onNavigate).toHaveBeenCalledWith({
      type: 'page',
      page: 'search',
      isEditing: false,
      itemId: undefined,
    });
  });

  it('hands unsaved term boosts back to the global page on cancel', async () => {
    const termBoosts = [
      { field: 'tags.tagFQN', value: 'PII.Sensitive', boost: 3 },
    ];
    await renderForm('field-value-boost', { termBoosts });
    await screen.findByTestId('field-value-boost-form');
    setInput('lt-input', '9');
    await act(async () => {
      fireEvent.click(screen.getByTestId('cancel-button'));
    });

    expect(onSaveState).toHaveBeenCalledWith({ termBoosts, isReturning: true });
    expect(updateSettingsConfig).not.toHaveBeenCalled();
  });

  it('offers a reload when the settings fail to load', async () => {
    (getSettingsByType as jest.Mock)
      .mockRejectedValueOnce(new Error('boom'))
      .mockResolvedValueOnce(CONFIG);
    await renderForm('field-value-boost');

    const reload = await screen.findByText('label.reload');

    expect(
      screen.queryByTestId('field-value-boost-form')
    ).not.toBeInTheDocument();

    await act(async () => {
      fireEvent.click(reload);
    });

    expect(
      await screen.findByTestId('field-value-boost-form')
    ).toBeInTheDocument();
    expect(getSettingsByType).toHaveBeenCalledTimes(2);
  });

  it('requires a field when adding a boost', async () => {
    await renderForm('field-value-boost');
    await screen.findByTestId('field-value-boost-form');
    await submit();

    expect(
      await screen.findByText('message.field-required')
    ).toBeInTheDocument();
    expect(updateSettingsConfig).not.toHaveBeenCalled();
    expect(onNavigate).not.toHaveBeenCalled();
  });

  it("puts an entity's boost back into its draft without saving", async () => {
    const draft = {
      ...toEntityDraft(),
      fieldValueBoosts: [{ field: 'totalVotes', factor: 3 }],
    };
    await renderForm('tables/field-value-boost/totalVotes', {
      entity: 'tables',
      draft,
      isChanged: false,
    });
    await screen.findByTestId('field-value-boost-form');
    setInput('gte-input', '5');
    await submit();

    expect(onSaveState).toHaveBeenCalledWith({
      entity: 'tables',
      draft: {
        ...draft,
        fieldValueBoosts: [
          expect.objectContaining({
            field: 'totalVotes',
            factor: 3,
            condition: { range: { gte: 5 } },
          }),
        ],
      },
      isChanged: true,
      isReturning: true,
    });
    expect(onNavigate).toHaveBeenCalledWith({
      type: 'page',
      page: 'search',
      isEditing: false,
      itemId: 'tables',
    });
    expect(updateSettingsConfig).not.toHaveBeenCalled();
  });

  it('returns to the entity page when its draft is gone', async () => {
    await renderForm('tables/field-value-boost');

    expect(onNavigate).toHaveBeenCalledWith({
      type: 'page',
      page: 'search',
      isEditing: false,
      itemId: 'tables',
    });
    expect(
      screen.queryByTestId('field-value-boost-form')
    ).not.toBeInTheDocument();
  });
});
