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
import { ReactNode } from 'react';
import { DefaultTimeFormat } from '../../../generated/api/configuration/appConfiguration';
import { useApplicationStore } from '../../../hooks/useApplicationStore';
import {
  getAppConfiguration,
  patchAppConfiguration,
} from '../../../rest/settingConfigAPI';
import { showErrorToast } from '../../../utils/ToastUtils';
import DefaultTimeFormatPage from './DefaultTimeFormatPage';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
jest.mock('../../../components/PageLayoutV1/PageLayoutV1', () =>
  jest.fn(({ children }: { children: ReactNode }) => <div>{children}</div>)
);
jest.mock(
  '../../../components/common/TitleBreadcrumb/TitleBreadcrumb.component',
  () => jest.fn(() => <div>TitleBreadcrumb</div>)
);
jest.mock('../../../rest/settingConfigAPI', () => ({
  getAppConfiguration: jest.fn(),
  patchAppConfiguration: jest.fn(),
}));
jest.mock('../../../utils/ToastUtils', () => ({
  showErrorToast: jest.fn(),
  showSuccessToast: jest.fn(),
}));

const renderPage = async () => {
  await act(async () => {
    render(<DefaultTimeFormatPage />);
  });
};

describe('DefaultTimeFormatPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useApplicationStore.getState().setTimeFormat('12h');
    (patchAppConfiguration as jest.Mock).mockResolvedValue({});
  });

  it('selects the stored format and keeps Save disabled until it changes', async () => {
    (getAppConfiguration as jest.Mock).mockResolvedValue({
      defaultTimeFormat: DefaultTimeFormat.The24H,
    });
    await renderPage();

    expect(
      screen.getByRole('radio', { name: 'label.24-hour-format' })
    ).toBeChecked();
    expect(screen.getByTestId('save-time-format-settings')).toBeDisabled();

    fireEvent.click(screen.getByText('label.12-hour-format'));

    expect(screen.getByTestId('save-time-format-settings')).toBeEnabled();
  });

  it('saves the new format and applies it to this session', async () => {
    (getAppConfiguration as jest.Mock).mockResolvedValue({});
    await renderPage();

    fireEvent.click(screen.getByText('label.24-hour-format'));
    await act(async () => {
      fireEvent.click(screen.getByTestId('save-time-format-settings'));
    });

    expect(patchAppConfiguration).toHaveBeenCalledWith({
      defaultTimeFormat: DefaultTimeFormat.The24H,
    });
    expect(useApplicationStore.getState().timeFormat).toBe('24h');
    expect(screen.getByTestId('save-time-format-settings')).toBeDisabled();
  });

  it('reports a failed save and keeps the change unsaved', async () => {
    const error = new Error('Save failed');
    (getAppConfiguration as jest.Mock).mockResolvedValue({});
    (patchAppConfiguration as jest.Mock).mockRejectedValue(error);
    await renderPage();

    fireEvent.click(screen.getByText('label.24-hour-format'));
    await act(async () => {
      fireEvent.click(screen.getByTestId('save-time-format-settings'));
    });

    expect(showErrorToast).toHaveBeenCalledWith(error);
    expect(useApplicationStore.getState().timeFormat).toBe('12h');
    expect(screen.getByTestId('save-time-format-settings')).toBeEnabled();
  });

  it('reports a failed load and falls back to 12-hour', async () => {
    const error = new Error('Load failed');
    (getAppConfiguration as jest.Mock).mockRejectedValue(error);
    await renderPage();

    expect(showErrorToast).toHaveBeenCalledWith(error);
    expect(
      screen.getByRole('radio', { name: 'label.12-hour-format' })
    ).toBeChecked();
  });
});
