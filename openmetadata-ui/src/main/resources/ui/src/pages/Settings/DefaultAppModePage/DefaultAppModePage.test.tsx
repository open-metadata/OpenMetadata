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
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import {
  AI_APP_MODE,
  DEFAULT_APP_MODE,
} from '../../../constants/appMode.constants';
import { useAppRoutesRegistry } from '../../../hooks/useAppRoutesRegistry';
import * as api from '../../../rest/settingConfigAPI';
import DefaultAppModePage from './DefaultAppModePage';

jest.mock('../../../rest/settingConfigAPI');
jest.mock('../../../utils/ToastUtils', () => ({
  showErrorToast: jest.fn(),
  showSuccessToast: jest.fn(),
}));

// The global react-i18next mock in setupTests.js echoes the raw key back
// (`t: (key) => key`), which every other suite in this repo asserts against
// directly. This page's radio labels come straight from the registry's
// `labelKey`s though, so asserting on human-readable text here is more
// faithful to what a user actually sees — override locally with the real
// English strings for just the keys this page renders.
const TRANSLATIONS: Record<string, string> = {
  'label.no-default': 'No default',
  'label.default': 'Default',
  'label.ai': 'AI',
  'label.save': 'Save',
  'label.saving': 'Saving',
  'label.default-app-mode': 'Default App Mode',
  'message.default-app-mode-description':
    "The 'first impression' mode for users who haven't picked one.",
};

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => TRANSLATIONS[key] ?? key,
  }),
}));

const mockGet = api.getAppConfiguration as jest.Mock;
const mockPatch = api.patchAppConfiguration as jest.Mock;

const Component = () => null;

describe('DefaultAppModePage', () => {
  beforeEach(() => {
    useAppRoutesRegistry.setState({ routes: {}, metadata: {} });
    useAppRoutesRegistry
      .getState()
      .registerRoutes(DEFAULT_APP_MODE, Component, {
        labelKey: 'label.default',
      });
    mockGet.mockResolvedValue({ defaultAppMode: null });
    mockPatch.mockResolvedValue({ defaultAppMode: 'ai' });
  });

  it('renders "No default" and every registered mode as radios', async () => {
    useAppRoutesRegistry
      .getState()
      .registerRoutes(AI_APP_MODE, Component, { labelKey: 'label.ai' });
    render(<DefaultAppModePage />);
    await waitFor(() => expect(mockGet).toHaveBeenCalled());

    expect(
      screen.getByRole('radio', { name: /no default/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('radio', { name: /^default$/i })
    ).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /^ai$/i })).toBeInTheDocument();
  });

  it('marks "No default" selected initially when defaultAppMode is null', async () => {
    render(<DefaultAppModePage />);
    await waitFor(() => expect(mockGet).toHaveBeenCalled());

    expect(screen.getByRole('radio', { name: /no default/i })).toBeChecked();
  });

  it('Save button is disabled until the value changes', async () => {
    render(<DefaultAppModePage />);
    await waitFor(() => expect(mockGet).toHaveBeenCalled());

    const save = screen.getByRole('button', { name: /save/i });

    expect(save).toBeDisabled();

    fireEvent.click(screen.getByRole('radio', { name: /^default$/i }));

    expect(save).toBeEnabled();
  });

  it('Save calls patchAppConfiguration with the new value', async () => {
    useAppRoutesRegistry
      .getState()
      .registerRoutes(AI_APP_MODE, Component, { labelKey: 'label.ai' });
    render(<DefaultAppModePage />);
    await waitFor(() => expect(mockGet).toHaveBeenCalled());

    fireEvent.click(screen.getByRole('radio', { name: /^ai$/i }));
    fireEvent.click(screen.getByRole('button', { name: /save/i }));

    await waitFor(() =>
      expect(mockPatch).toHaveBeenCalledWith({ defaultAppMode: 'ai' })
    );
  });
});
