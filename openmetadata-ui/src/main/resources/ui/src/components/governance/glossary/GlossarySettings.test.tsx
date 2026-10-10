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
import { act, fireEvent, screen } from '@testing-library/react';
import {
  getGlossarySettings,
  updateGlossarySettings,
} from '../../../rest/settingConfigAPI';
import {
  renderWithQueryClient,
  runQueryNotificationsSynchronously,
} from '../../../test/unit/test-utils';
import { showErrorToast } from '../../../utils/ToastUtils';
import GlossarySettings from './GlossarySettings';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
jest.mock('../../../rest/settingConfigAPI', () => ({
  getGlossarySettings: jest.fn(),
  updateGlossarySettings: jest.fn(),
}));
jest.mock('../../../utils/ToastUtils', () => ({
  showErrorToast: jest.fn(),
  showSuccessToast: jest.fn(),
}));

runQueryNotificationsSynchronously();

const renderSettings = async () => {
  await act(async () => {
    renderWithQueryClient(<GlossarySettings />);
  });
};

describe('Glossary settings', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (getGlossarySettings as jest.Mock).mockResolvedValue({
      enableTagPropagation: true,
    });
    (updateGlossarySettings as jest.Mock).mockImplementation(
      async (config) => config
    );
  });

  it('persists each toggle and renders the saved value', async () => {
    await renderSettings();
    const toggle = screen.getByRole('switch', {
      name: /label.glossary-tag-propagation/,
    });

    expect(toggle).toBeChecked();

    await act(async () => {
      fireEvent.click(toggle);
    });

    expect(
      (updateGlossarySettings as jest.Mock).mock.calls.at(-1)?.[0]
    ).toEqual({ enableTagPropagation: false });
    expect(toggle).not.toBeChecked();

    await act(async () => {
      fireEvent.click(toggle);
    });

    expect(
      (updateGlossarySettings as jest.Mock).mock.calls.at(-1)?.[0]
    ).toEqual({ enableTagPropagation: true });
    expect(toggle).toBeChecked();
  });

  it('loads the disabled preference', async () => {
    (getGlossarySettings as jest.Mock).mockResolvedValue({
      enableTagPropagation: false,
    });
    await renderSettings();

    expect(screen.getByRole('switch')).not.toBeChecked();
  });

  it('keeps the saved value and reports a failed update', async () => {
    const error = new Error('Update failed');
    (updateGlossarySettings as jest.Mock).mockRejectedValue(error);
    await renderSettings();

    await act(async () => {
      fireEvent.click(screen.getByRole('switch'));
    });

    expect(screen.getByRole('switch')).toBeChecked();
    expect(showErrorToast).toHaveBeenCalledWith(error);
  });

  it('offers retry instead of an editable switch after a failed read', async () => {
    (getGlossarySettings as jest.Mock).mockRejectedValueOnce(
      new Error('Read failed')
    );
    await renderSettings();

    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.queryByRole('switch')).not.toBeInTheDocument();

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'label.retry' }));
    });

    expect(screen.getByRole('switch')).toBeChecked();
  });
});
