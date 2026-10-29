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
  LineageLayer,
  PipelineViewMode,
} from '../../generated/configuration/lineageSettings';
import {
  getSettingsByType,
  updateSettingsConfig,
} from '../../rest/settingConfigAPI';
import LineageConfigPage from './LineageConfigPage';

jest.mock('../../hoc/withPageLayout', () => ({
  withPageLayout: jest.fn((Component) => Component),
}));

jest.mock('react-router-dom', () => ({
  useNavigate: jest.fn(() => jest.fn()),
}));

jest.mock('../../components/common/ResizablePanels/ResizablePanels', () =>
  jest.fn(({ firstPanel }) => <div>{firstPanel.children}</div>)
);

jest.mock(
  '../../components/common/TitleBreadcrumb/TitleBreadcrumb.component',
  () => jest.fn(() => <div />)
);

jest.mock('../../rest/settingConfigAPI', () => ({
  getSettingsByType: jest.fn(),
  updateSettingsConfig: jest.fn(),
}));

jest.mock('../../hooks/useApplicationStore', () => ({
  useApplicationStore: jest.fn(() => ({
    setAppPreferences: jest.fn(),
    appPreferences: {},
  })),
}));

const savedConfig = {
  upstreamDepth: 2,
  downstreamDepth: 3,
  lineageLayer: LineageLayer.EntityLineage,
  pipelineViewMode: PipelineViewMode.Node,
};

describe('LineageConfigPage', () => {
  beforeEach(() => {
    (getSettingsByType as jest.Mock).mockResolvedValue(savedConfig);
    (updateSettingsConfig as jest.Mock).mockResolvedValue({
      data: { config_value: savedConfig },
    });
  });

  it('saves the edited depths as numbers', async () => {
    await act(async () => {
      render(<LineageConfigPage pageTitle="lineage" />);
    });

    expect(screen.getByTestId('field-upstream')).toHaveValue(2);

    fireEvent.change(screen.getByTestId('field-upstream'), {
      target: { value: '5' },
    });
    await act(async () => {
      fireEvent.click(screen.getByTestId('save-button'));
    });

    expect(updateSettingsConfig).toHaveBeenCalledWith({
      config_type: 'lineageSettings',
      config_value: { ...savedConfig, upstreamDepth: 5 },
    });
  });

  it('rejects a negative depth', async () => {
    await act(async () => {
      render(<LineageConfigPage pageTitle="lineage" />);
    });

    fireEvent.change(screen.getByTestId('field-downstream'), {
      target: { value: '-1' },
    });
    await act(async () => {
      fireEvent.click(screen.getByTestId('save-button'));
    });

    expect(updateSettingsConfig).not.toHaveBeenCalled();
    expect(
      screen.getByText('message.entity-size-less-than')
    ).toBeInTheDocument();
  });
});
