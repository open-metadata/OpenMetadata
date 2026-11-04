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
  LineageLayer,
  PipelineViewMode,
} from '../../../../../../generated/configuration/lineageSettings';
import { SettingType } from '../../../../../../generated/settings/settings';
import {
  getSettingsByType,
  updateSettingsConfig,
} from '../../../../../../rest/settingConfigAPI';
import LineageSettings from './LineageSettings';
import LineageSettingsForm from './LineageSettingsForm';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

jest.mock('../../../../../../utils/DataQuality/FormFieldDocs', () => ({
  loadFormFieldDocs: jest.fn().mockResolvedValue({}),
}));

jest.mock('../../../../../../utils/ToastUtils', () => ({
  showErrorToast: jest.fn(),
  showSuccessToast: jest.fn(),
}));

jest.mock('../../../../../../rest/settingConfigAPI', () => ({
  getSettingsByType: jest.fn(),
  updateSettingsConfig: jest.fn(),
}));

const mockSetAppPreferences = jest.fn();

jest.mock('../../../../../../hooks/useApplicationStore', () => ({
  useApplicationStore: (selector: (state: unknown) => unknown) =>
    selector({ setAppPreferences: mockSetAppPreferences }),
}));

const onNavigate = jest.fn();
const STORED = {
  upstreamDepth: 2,
  downstreamDepth: 3,
  lineageLayer: LineageLayer.ColumnLevelLineage,
  pipelineViewMode: PipelineViewMode.Node,
};

const inputOf = (testId: string) =>
  screen.getByTestId(testId).querySelector('input') as HTMLInputElement;

describe('LineageSettingsForm', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (getSettingsByType as jest.Mock).mockResolvedValue(STORED);
    (updateSettingsConfig as jest.Mock).mockImplementation((settings) =>
      Promise.resolve({ data: settings })
    );
  });

  it('saves depths and keeps the selected layer and view mode', async () => {
    render(<LineageSettingsForm showHint={false} onNavigate={onNavigate} />);
    await waitFor(() => expect(inputOf('field-upstream')).toHaveValue(2));

    fireEvent.change(inputOf('field-upstream'), { target: { value: '4' } });
    await act(async () => {
      fireEvent.click(screen.getByTestId('save-button'));
    });

    const expected = { ...STORED, upstreamDepth: 4 };

    expect(updateSettingsConfig).toHaveBeenCalledWith({
      config_type: SettingType.LineageSettings,
      config_value: expected,
    });
    // Lineage views read the depth from the store, so a save must refresh it.
    expect(mockSetAppPreferences).toHaveBeenCalledWith({
      lineageConfig: expected,
    });
    expect(onNavigate).toHaveBeenCalledWith({
      type: 'page',
      page: 'lineage',
      isEditing: false,
    });
  });

  it('requires both depths', async () => {
    render(<LineageSettingsForm showHint={false} onNavigate={onNavigate} />);
    await waitFor(() => expect(inputOf('field-downstream')).toHaveValue(3));

    fireEvent.change(inputOf('field-downstream'), { target: { value: '' } });
    await act(async () => {
      fireEvent.click(screen.getByTestId('save-button'));
    });

    expect(updateSettingsConfig).not.toHaveBeenCalled();
  });

  it('cancel returns to the read-only view', async () => {
    render(<LineageSettingsForm showHint={false} onNavigate={onNavigate} />);
    await screen.findByTestId('lineage-config-form');

    fireEvent.click(screen.getByTestId('cancel-button'));

    expect(onNavigate).toHaveBeenCalledWith({
      type: 'page',
      page: 'lineage',
      isEditing: false,
    });
  });

  it('read-only view shows the stored settings with readable labels', async () => {
    render(
      <LineageSettings onNavigate={onNavigate} onSetHeaderActions={jest.fn()} />
    );

    expect(await screen.findByTestId('upstream-depth-value')).toHaveTextContent(
      '2'
    );
    expect(screen.getByTestId('downstream-depth-value')).toHaveTextContent('3');
    expect(screen.getByTestId('lineage-layer-value')).toHaveTextContent(
      'label.column-level-lineage'
    );
    expect(screen.getByTestId('pipeline-view-mode-value')).toHaveTextContent(
      'label.node'
    );
  });
});
