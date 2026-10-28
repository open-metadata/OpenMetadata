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
import React from 'react';
import BotsPanel from './BotsPanel';

const mockSetHash = jest.fn();
const mockClearHash = jest.fn();
const mockUpdateParams = jest.fn();
let mockHashState = { tab: 'bots', subPath: '', params: {} };

jest.mock('../../../../../../hooks/useSettingsHash', () => ({
  useSettingsHash: () => ({
    state: mockHashState,
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

const mockBotsListPanel = jest.fn();

jest.mock('./BotsListPanel', () => ({
  __esModule: true,
  default: (props: {
    refreshKey?: number;
    onNavigate: (view: { type: string; fqn: string; name: string }) => void;
  }) => {
    mockBotsListPanel(props);

    return (
      <button
        data-testid="bots-list-panel-mock"
        onClick={() =>
          props.onNavigate({
            type: 'detail',
            fqn: 'my bot/100%',
            name: 'my bot/100%',
          })
        }>
        open-bot
      </button>
    );
  },
}));

jest.mock('./BotAddForm', () => ({
  __esModule: true,
  default: () => <div data-testid="bot-add-form-mock" />,
}));

jest.mock('./BotDetailPanel', () => ({
  __esModule: true,
  default: ({ fqn }: { fqn: string }) => (
    <div data-testid="bot-detail-panel-mock">{fqn}</div>
  ),
}));

describe('BotsPanel', () => {
  const mockOnHeaderChange = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    mockHashState = { tab: 'bots', subPath: '', params: {} };
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

  // Hash contract: bot names travel URL-encoded and are decoded once.
  it('opens the bot named by an encoded hash segment, decoded once', () => {
    mockHashState = {
      tab: 'bots',
      subPath: encodeURIComponent('my bot/100%'),
      params: {},
    };
    render(<BotsPanel onHeaderChange={mockOnHeaderChange} />);

    expect(screen.getByTestId('bot-detail-panel-mock')).toHaveTextContent(
      'my bot/100%'
    );
  });

  it('encodes the bot name once when navigating to it', () => {
    render(<BotsPanel onHeaderChange={mockOnHeaderChange} />);
    fireEvent.click(screen.getByTestId('bots-list-panel-mock'));

    expect(mockSetHash).toHaveBeenCalledWith('bots', 'my%20bot%2F100%25');
  });

  it('does not reload the bots list when the Settings crumb is clicked', () => {
    render(<BotsPanel onHeaderChange={mockOnHeaderChange} />);
    const { onBreadcrumbAction } =
      mockOnHeaderChange.mock.calls[
        mockOnHeaderChange.mock.calls.length - 1
      ][0];
    const refreshKeyBefore =
      mockBotsListPanel.mock.calls[mockBotsListPanel.mock.calls.length - 1][0]
        .refreshKey;

    act(() => onBreadcrumbAction('settings'));

    expect(mockSetHash).not.toHaveBeenCalled();
    expect(
      mockBotsListPanel.mock.calls[mockBotsListPanel.mock.calls.length - 1][0]
        .refreshKey
    ).toBe(refreshKeyBefore);
  });
});
