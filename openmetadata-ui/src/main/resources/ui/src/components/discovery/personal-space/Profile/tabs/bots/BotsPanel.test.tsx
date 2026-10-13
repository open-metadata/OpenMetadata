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
import React from 'react';
import BotsPanel from './BotsPanel';

const mockSetHash = jest.fn();
const mockClearHash = jest.fn();
const mockUpdateParams = jest.fn();

jest.mock('../../../../../../hooks/useSettingsHash', () => ({
  useSettingsHash: () => ({
    state: { tab: 'bots', subPath: '', params: {} },
    setHash: mockSetHash,
    clearHash: mockClearHash,
    updateParams: mockUpdateParams,
  }),
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

jest.mock('../../../../../../hoc/LimitWrapper', () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
}));

jest.mock('./BotsListPanel', () => ({
  __esModule: true,
  default: () => <div data-testid="bots-list-panel-mock" />,
}));

jest.mock('./BotAddForm', () => ({
  __esModule: true,
  default: () => <div data-testid="bot-add-form-mock" />,
}));

jest.mock('./BotDetailPanel', () => ({
  __esModule: true,
  default: () => <div data-testid="bot-detail-panel-mock" />,
}));

describe('BotsPanel', () => {
  const mockOnHeaderChange = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render BotsListPanel by default', () => {
    render(<BotsPanel onHeaderChange={mockOnHeaderChange} />);

    expect(screen.getByTestId('bots-list-panel-mock')).toBeInTheDocument();
  });

  it('should call onHeaderChange with bots breadcrumbs', () => {
    render(<BotsPanel onHeaderChange={mockOnHeaderChange} />);

    expect(mockOnHeaderChange).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'label.bot-plural',
        breadcrumbs: expect.arrayContaining([
          expect.objectContaining({ label: 'label.setting-plural' }),
        ]),
      })
    );
  });
});
