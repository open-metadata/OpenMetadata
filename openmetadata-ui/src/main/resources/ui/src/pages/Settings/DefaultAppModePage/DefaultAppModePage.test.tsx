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
    waitFor
} from '@testing-library/react';
import {
    getAppConfiguration,
    patchAppConfiguration
} from '../../../rest/settingConfigAPI';
import DefaultAppModePage from './DefaultAppModePage';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

jest.mock('../../../rest/settingConfigAPI', () => ({
  getAppConfiguration: jest.fn().mockResolvedValue({ defaultAppMode: null }),
  patchAppConfiguration: jest.fn().mockResolvedValue({ defaultAppMode: 'ai' }),
}));

jest.mock('../../../utils/ToastUtils', () => ({
  showErrorToast: jest.fn(),
  showSuccessToast: jest.fn(),
}));

jest.mock('../../../components/common/DocumentTitle/DocumentTitle', () =>
  jest.fn().mockImplementation(() => <div>DocumentTitle</div>)
);

const mockGetAppConfiguration = getAppConfiguration as jest.Mock;
const mockPatchAppConfiguration = patchAppConfiguration as jest.Mock;

const renderPage = async () => {
  await act(async () => {
    render(<DefaultAppModePage />);
  });
};

describe('DefaultAppModePage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetAppConfiguration.mockResolvedValue({ defaultAppMode: null });
    mockPatchAppConfiguration.mockResolvedValue({ defaultAppMode: 'ai' });
  });

  it('renders the three tenant-default options', async () => {
    await renderPage();

    expect(screen.getByTestId('app-mode-radio-group')).toBeInTheDocument();
    expect(screen.getByTestId('app-mode-option-null')).toBeInTheDocument();
    expect(screen.getByTestId('app-mode-option-classic')).toBeInTheDocument();
    expect(screen.getByTestId('app-mode-option-ai')).toBeInTheDocument();
  });

  it('keeps Save disabled until the selection changes', async () => {
    await renderPage();

    const saveButton = screen.getByTestId('save-app-mode-settings');

    await waitFor(() => expect(saveButton).toBeDisabled());

    fireEvent.click(screen.getByTestId('app-mode-option-ai'));

    expect(saveButton).toBeEnabled();
  });

  it('sends the selected mode on Save', async () => {
    await renderPage();

    fireEvent.click(screen.getByTestId('app-mode-option-ai'));
    fireEvent.click(screen.getByTestId('save-app-mode-settings'));

    await waitFor(() =>
      expect(mockPatchAppConfiguration).toHaveBeenCalledWith({
        defaultAppMode: 'ai',
      })
    );
  });

  it('sends null when "No default" is selected', async () => {
    mockGetAppConfiguration.mockResolvedValue({ defaultAppMode: 'ai' });

    await renderPage();

    fireEvent.click(screen.getByTestId('app-mode-option-null'));
    fireEvent.click(screen.getByTestId('save-app-mode-settings'));

    await waitFor(() =>
      expect(mockPatchAppConfiguration).toHaveBeenCalledWith({
        defaultAppMode: null,
      })
    );
  });
});
