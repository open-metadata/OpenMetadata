/*
 *  Copyright 2023 Collate.
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
import { SettingType } from '../../../../../../generated/settings/settings';
import {
  getSettingsConfigFromConfigType,
  updateSettingsConfig,
} from '../../../../../../rest/settingConfigAPI';
import DataAssetRulesSettings from './DataAssetRulesSettings';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

jest.mock('../../../../../../rest/settingConfigAPI', () => ({
  getSettingsConfigFromConfigType: jest.fn(),
  updateSettingsConfig: jest.fn(),
}));

jest.mock('../../../../../../utils/ToastUtils', () => ({
  showErrorToast: jest.fn(),
  showSuccessToast: jest.fn(),
}));

jest.mock(
  '../../../../../common/RichTextEditor/RichTextEditorPreviewNew',
  () =>
    ({ markdown }: { markdown: string }) =>
      <span>{markdown}</span>
);

const RULES = [
  {
    name: 'Single Domain',
    description: 'One domain per asset.',
    enabled: true,
    rule: '{"==":[1,1]}',
  },
  {
    name: 'Single Glossary Term',
    description: 'One glossary term per table.',
    enabled: false,
    rule: '{"==":[1,1]}',
  },
];

const mockRules = (rules: unknown[]) =>
  (getSettingsConfigFromConfigType as jest.Mock).mockResolvedValue({
    data: { config_value: { entitySemantics: rules } },
  });

describe('Data Asset Rules settings', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (updateSettingsConfig as jest.Mock).mockResolvedValue({ data: {} });
  });

  it('lists the rules with their enabled state', async () => {
    mockRules(RULES);
    render(<DataAssetRulesSettings />);

    expect(
      await screen.findByTestId('data-asset-rule-Single Domain')
    ).toHaveTextContent('One domain per asset.');
    expect(
      screen.getByTestId('toggle-Single Domain').querySelector('input')
    ).toBeChecked();
    expect(
      screen.getByTestId('toggle-Single Glossary Term').querySelector('input')
    ).not.toBeChecked();
  });

  it('toggling a rule saves the whole rule list with only that rule flipped', async () => {
    mockRules(RULES);
    render(<DataAssetRulesSettings />);
    const toggle = await screen.findByTestId('toggle-Single Glossary Term');

    await act(async () => {
      fireEvent.click(toggle.querySelector('input') as Element);
    });

    expect(updateSettingsConfig).toHaveBeenCalledWith({
      config_type: SettingType.EntityRulesSettings,
      config_value: {
        entitySemantics: [RULES[0], { ...RULES[1], enabled: true }],
      },
    });
  });

  it('shows an empty state without an Add action, as adding is not supported yet', async () => {
    mockRules([]);
    render(<DataAssetRulesSettings />);

    expect(
      await screen.findByTestId('data-asset-rules-empty')
    ).toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });
});
