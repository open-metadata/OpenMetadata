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
  getAppConfiguration,
  patchAppConfiguration,
} from '../../../rest/settingConfigAPI';
import DefaultAppModePage from './DefaultAppModePage';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

jest.mock('../../../rest/settingConfigAPI', () => ({
  getAppConfiguration: jest.fn().mockResolvedValue({ defaultAppMode: null }),
  patchAppConfiguration: jest.fn().mockResolvedValue({ defaultAppMode: 'ai' }),
}));

// The real Select is react-aria driven and its overlay cannot be opened
// under jsdom (positioning hangs) — same boundary OMSelectWidget.test.tsx
// works around. Mock it with a native <select> built off the `items` prop,
// which is all this page's rows need for tests to drive `onSelectionChange`.
jest.mock('@openmetadata/ui-core-components', () => {
  const actual = jest.requireActual('@openmetadata/ui-core-components');

  return {
    ...actual,
    Select: ({
      items,
      selectedKey,
      onSelectionChange,
      'data-testid': dataTestId,
      'aria-label': ariaLabel,
    }: {
      items?: { id: string; label: string }[];
      selectedKey?: string | null;
      onSelectionChange?: (key: string | null) => void;
      'data-testid'?: string;
      'aria-label'?: string;
    }) => (
      <select
        aria-label={ariaLabel}
        data-testid={dataTestId}
        value={selectedKey ?? ''}
        onChange={(event) => onSelectionChange?.(event.target.value || null)}>
        <option value="">-</option>
        {(items ?? []).map((item) => (
          <option key={item.id} value={item.id}>
            {item.label}
          </option>
        ))}
      </select>
    ),
    SelectItem: () => null,
  };
});

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

  it('renders the default view section with no rows initially', async () => {
    await renderPage();

    expect(
      screen.getByTestId('default-view-modes-section')
    ).toBeInTheDocument();
    expect(screen.queryByTestId(/^view-mode-row-\d+$/)).not.toBeInTheDocument();
  });

  it('adds a row, picks a page and a view, and saves only that map', async () => {
    await renderPage();

    const appModeSaveButton = screen.getByTestId('save-app-mode-settings');
    const viewModesSaveButton = screen.getByTestId('save-view-modes-settings');

    fireEvent.click(screen.getByTestId('add-view-mode-row'));

    expect(viewModesSaveButton).toBeDisabled();

    fireEvent.change(screen.getByTestId(/^view-mode-row-page-\d+$/), {
      target: { value: 'domains' },
    });
    fireEvent.change(screen.getByTestId(/^view-mode-row-view-\d+$/), {
      target: { value: 'grid' },
    });

    expect(viewModesSaveButton).toBeEnabled();
    expect(appModeSaveButton).toBeDisabled();

    fireEvent.click(viewModesSaveButton);

    await waitFor(() =>
      expect(mockPatchAppConfiguration).toHaveBeenCalledWith({
        defaultViewModes: { domains: 'grid' },
      })
    );

    expect(mockPatchAppConfiguration).toHaveBeenCalledTimes(1);
  });

  it("keeps App Mode's and Default View's Save buttons and saves independent", async () => {
    await renderPage();

    const appModeSaveButton = screen.getByTestId('save-app-mode-settings');
    const viewModesSaveButton = screen.getByTestId('save-view-modes-settings');

    await waitFor(() => {
      expect(appModeSaveButton).toBeDisabled();
      expect(viewModesSaveButton).toBeDisabled();
    });

    // Changing only App Mode enables just its own Save button.
    fireEvent.click(screen.getByTestId('app-mode-option-ai'));

    expect(appModeSaveButton).toBeEnabled();
    expect(viewModesSaveButton).toBeDisabled();

    fireEvent.click(appModeSaveButton);

    await waitFor(() =>
      expect(mockPatchAppConfiguration).toHaveBeenCalledWith({
        defaultAppMode: 'ai',
      })
    );

    expect(mockPatchAppConfiguration).toHaveBeenCalledTimes(1);
    expect(appModeSaveButton).toBeDisabled();
    expect(viewModesSaveButton).toBeDisabled();

    // Changing only a Default View row enables just its own Save button.
    fireEvent.click(screen.getByTestId('add-view-mode-row'));
    fireEvent.change(screen.getByTestId(/^view-mode-row-page-\d+$/), {
      target: { value: 'domains' },
    });
    fireEvent.change(screen.getByTestId(/^view-mode-row-view-\d+$/), {
      target: { value: 'grid' },
    });

    expect(viewModesSaveButton).toBeEnabled();
    expect(appModeSaveButton).toBeDisabled();

    fireEvent.click(viewModesSaveButton);

    await waitFor(() =>
      expect(mockPatchAppConfiguration).toHaveBeenCalledWith({
        defaultViewModes: { domains: 'grid' },
      })
    );

    expect(mockPatchAppConfiguration).toHaveBeenCalledTimes(2);
  });

  it('excludes a page already selected in another row from the remaining rows', async () => {
    await renderPage();

    fireEvent.click(screen.getByTestId('add-view-mode-row'));
    fireEvent.change(screen.getByTestId(/^view-mode-row-page-\d+$/), {
      target: { value: 'domains' },
    });

    fireEvent.click(screen.getByTestId('add-view-mode-row'));

    const pageSelects = screen.getAllByTestId(/^view-mode-row-page-\d+$/);
    const secondRowOptions = Array.from(
      pageSelects[1].querySelectorAll('option')
    ).map((option) => option.getAttribute('value'));

    expect(secondRowOptions).not.toContain('domains');
  });

  it('removes a row', async () => {
    await renderPage();

    fireEvent.click(screen.getByTestId('add-view-mode-row'));

    expect(screen.getAllByTestId(/^view-mode-row-\d+$/)).toHaveLength(1);

    fireEvent.click(screen.getByTestId(/^remove-view-mode-row-\d+$/));

    expect(screen.queryByTestId(/^view-mode-row-\d+$/)).not.toBeInTheDocument();
  });

  it('offers Tree as a View option only when Page is Domains', async () => {
    await renderPage();

    fireEvent.click(screen.getByTestId('add-view-mode-row'));

    const viewSelect = screen.getByTestId(/^view-mode-row-view-\d+$/);
    const viewOptionValues = () =>
      Array.from(viewSelect.querySelectorAll('option')).map((option) =>
        option.getAttribute('value')
      );

    expect(viewOptionValues()).not.toContain('tree');

    fireEvent.change(screen.getByTestId(/^view-mode-row-page-\d+$/), {
      target: { value: 'domains' },
    });

    expect(viewOptionValues()).toContain('tree');

    fireEvent.change(screen.getByTestId(/^view-mode-row-page-\d+$/), {
      target: { value: 'dataProducts' },
    });

    expect(viewOptionValues()).not.toContain('tree');
  });

  it("resets the row's View when its Page changes away from Domains while Tree was selected", async () => {
    await renderPage();

    fireEvent.click(screen.getByTestId('add-view-mode-row'));
    fireEvent.change(screen.getByTestId(/^view-mode-row-page-\d+$/), {
      target: { value: 'domains' },
    });
    fireEvent.change(screen.getByTestId(/^view-mode-row-view-\d+$/), {
      target: { value: 'tree' },
    });

    expect(screen.getByTestId(/^view-mode-row-view-\d+$/)).toHaveValue('tree');

    fireEvent.change(screen.getByTestId(/^view-mode-row-page-\d+$/), {
      target: { value: 'dataProducts' },
    });

    expect(screen.getByTestId(/^view-mode-row-view-\d+$/)).toHaveValue('');
  });
});
