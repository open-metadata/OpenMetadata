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

import { render, screen } from '@testing-library/react';
import { ReactNode } from 'react';
import { getSettingsByType } from '../../../../../../rest/settingConfigAPI';
import LineageSettings from './LineageSettings';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

jest.mock('../../../../../../utils/ToastUtils', () => ({
  showErrorToast: jest.fn(),
}));

jest.mock('../../../../../../rest/settingConfigAPI', () => ({
  getSettingsByType: jest.fn(),
}));

let headerActions: ReactNode;
const onSetHeaderActions = (actions: ReactNode) => {
  headerActions = actions;
};

const renderSettings = () =>
  render(
    <LineageSettings
      onNavigate={jest.fn()}
      onSetHeaderActions={onSetHeaderActions}
    />
  );

describe('Lineage settings', () => {
  beforeEach(() => {
    headerActions = undefined;
  });

  it('shows the stored depths and offers Edit', async () => {
    (getSettingsByType as jest.Mock).mockResolvedValue({
      upstreamDepth: 2,
      downstreamDepth: 4,
    });
    renderSettings();

    expect(await screen.findByTestId('upstream-depth-value')).toHaveTextContent(
      '2'
    );

    render(<>{headerActions}</>);

    expect(screen.getByTestId('edit-button')).toBeInTheDocument();
  });

  it('shows an error with reload and no Edit when the settings fail to load', async () => {
    (getSettingsByType as jest.Mock).mockRejectedValue(new Error('down'));
    renderSettings();

    expect(
      await screen.findByText('message.something-went-wrong')
    ).toBeInTheDocument();
    expect(
      screen.queryByTestId('upstream-depth-value')
    ).not.toBeInTheDocument();

    render(<>{headerActions}</>);

    expect(screen.queryByTestId('edit-button')).not.toBeInTheDocument();
  });
});
