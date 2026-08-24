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
import * as toastUtils from '../../../utils/ToastUtils';
import DefaultAppModePage from './DefaultAppModePage';

jest.mock('../../../rest/settingConfigAPI');
jest.mock('../../../utils/ToastUtils', () => ({
  showErrorToast: jest.fn(),
  showSuccessToast: jest.fn(),
}));

// Uses the global react-i18next mock from setupTests.js (`t: (key) => key`),
// so assertions below match against raw i18n keys rather than human-readable
// English strings — consistent with every other suite in this repo, and it
// catches a typo'd/nonexistent key that a canned translations map would hide.
const mockGet = api.getAppConfiguration as jest.Mock;
const mockPatch = api.patchAppConfiguration as jest.Mock;
const mockShowSuccessToast = toastUtils.showSuccessToast as jest.Mock;

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
      screen.getByRole('radio', { name: 'label.no-default' })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('radio', { name: 'label.default' })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('radio', { name: 'label.ai' })
    ).toBeInTheDocument();
  });

  it('marks "No default" selected initially when defaultAppMode is null', async () => {
    render(<DefaultAppModePage />);
    await waitFor(() => expect(mockGet).toHaveBeenCalled());

    expect(
      screen.getByRole('radio', { name: 'label.no-default' })
    ).toBeChecked();
  });

  it('Save button is disabled until the value changes', async () => {
    render(<DefaultAppModePage />);
    await waitFor(() => expect(mockGet).toHaveBeenCalled());

    const save = screen.getByRole('button', { name: 'label.save' });

    expect(save).toBeDisabled();

    fireEvent.click(screen.getByRole('radio', { name: 'label.default' }));

    expect(save).toBeEnabled();
  });

  it('Save calls patchAppConfiguration with the new value and shows the correct success toast key', async () => {
    useAppRoutesRegistry
      .getState()
      .registerRoutes(AI_APP_MODE, Component, { labelKey: 'label.ai' });
    render(<DefaultAppModePage />);
    await waitFor(() => expect(mockGet).toHaveBeenCalled());

    fireEvent.click(screen.getByRole('radio', { name: 'label.ai' }));
    fireEvent.click(screen.getByRole('button', { name: 'label.save' }));

    await waitFor(() =>
      expect(mockPatch).toHaveBeenCalledWith({ defaultAppMode: 'ai' })
    );

    // Guards against the toast call regressing to a nonexistent i18n key
    // (e.g. a typo'd `server.entity-updated-successfully`) — a future typo
    // here fails this assertion instead of silently rendering the raw key.
    expect(mockShowSuccessToast).toHaveBeenCalledWith(
      'server.entity-updated-success'
    );
  });
});
