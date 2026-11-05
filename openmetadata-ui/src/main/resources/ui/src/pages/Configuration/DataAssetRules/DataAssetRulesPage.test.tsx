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
import { act, fireEvent, render, screen } from '@testing-library/react';
import {
  getSettingsConfigFromConfigType,
  patchEntityRule,
  updateSettingsConfig,
} from '../../../rest/settingConfigAPI';
import DataAssetRulesPage from './DataAssetRulesPage';

jest.mock('../../../rest/settingConfigAPI', () => ({
  getSettingsConfigFromConfigType: jest.fn(),
  patchEntityRule: jest.fn(),
  updateSettingsConfig: jest.fn(),
}));

jest.mock('../../../utils/ToastUtils', () => ({
  showErrorToast: jest.fn(),
  showSuccessToast: jest.fn(),
}));

jest.mock(
  '../../../components/common/TitleBreadcrumb/TitleBreadcrumb.component',
  () => () => <div />
);

jest.mock('../../../components/PageHeader/PageHeader.component', () => () => (
  <div />
));

jest.mock(
  '../../../components/PageLayoutV1/PageLayoutV1',
  () =>
    ({ children }: { children: React.ReactNode }) =>
      <div>{children}</div>
);

jest.mock(
  '../../../components/common/RichTextEditor/RichTextEditorPreviewNew',
  () =>
    ({ markdown }: { markdown: string }) =>
      <span>{markdown}</span>
);

describe('DataAssetRulesPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (getSettingsConfigFromConfigType as jest.Mock).mockResolvedValue({
      data: {
        config_value: {
          entitySemantics: [
            {
              name: 'Single Domain',
              description: 'One domain per asset.',
              enabled: true,
              rule: '{"==":[1,1]}',
            },
          ],
        },
      },
    });
    (patchEntityRule as jest.Mock).mockResolvedValue({});
  });

  it('toggling a rule patches only that rule, never the whole list', async () => {
    render(<DataAssetRulesPage />);

    const toggle = await screen.findByRole('switch');
    await act(async () => {
      fireEvent.click(toggle);
    });

    expect(patchEntityRule).toHaveBeenCalledWith('Single Domain', [
      { op: 'replace', path: '/enabled', value: false },
    ]);
    expect(updateSettingsConfig).not.toHaveBeenCalled();
  });
});
