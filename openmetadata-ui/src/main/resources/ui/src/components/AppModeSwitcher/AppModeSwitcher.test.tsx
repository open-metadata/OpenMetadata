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

import { fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import AppModeSwitcher from './AppModeSwitcher';

const mockNavigate = jest.fn();
const mockWriteAppMode = jest.fn();
const mockSetPreference = jest.fn();
let currentMode = 'default';
let preferenceMode: string | null = null;

jest.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, opts?: Record<string, unknown>) => {
      if (opts?.mode) {
        return `${opts.mode} mode`;
      }

      return key;
    },
  }),
  Trans: ({
    i18nKey: _i18nKey,
    values,
    components,
  }: {
    i18nKey: string;
    values?: Record<string, unknown>;
    components?: Record<string, React.ReactElement>;
  }) => {
    const mode = String(values?.mode ?? '');
    const Bold = (components?.bold ??
      React.createElement('b')) as React.ReactElement<React.PropsWithChildren>;

    return React.createElement(
      React.Fragment,
      null,
      'Open in ',
      React.cloneElement(Bold, undefined, mode),
      ' when I log in'
    );
  },
}));

jest.mock('@openmetadata/ui-core-components', () => ({
  Box: ({
    children,
    ...props
  }: React.PropsWithChildren<Record<string, unknown>>) =>
    React.createElement('div', props, children),
  Popover: ({
    children,
    isOpen,
  }: {
    children: React.ReactNode;
    isOpen: boolean;
  }) =>
    isOpen
      ? React.createElement(
          'div',
          { 'data-testid': 'mode-switcher-popover' },
          children
        )
      : null,
  Typography: ({ children }: React.PropsWithChildren) =>
    React.createElement(React.Fragment, null, children),
}));

jest.mock('../../hooks/useAppMode', () => ({
  useAppMode: () => currentMode,
  useIsAiMode: () => currentMode === 'ai',
  writeAppMode: (mode: string, personaAppMode?: string | null) =>
    mockWriteAppMode(mode, personaAppMode),
  RUNTIME_TO_PREFERENCE_WIRE: { default: 'classic', ai: 'ai' },
}));

jest.mock('../../hooks/currentUserStore/useCurrentUserStore', () => ({
  useCurrentUserPreferences: () => ({
    preferences: { appMode: preferenceMode },
    setPreference: (p: { appMode: string | null }) => mockSetPreference(p),
  }),
}));

jest.mock('../../constants/appMode.constants', () => ({
  AI_APP_MODE: 'ai',
  DEFAULT_APP_MODE: 'default',
}));

const getTrigger = () => screen.getByTestId('app-mode-switcher-trigger');
const getCard = () => screen.queryByTestId('app-mode-switcher-card');

describe('AppModeSwitcher', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    currentMode = 'default';
    preferenceMode = null;
  });

  it('renders current mode label', () => {
    render(<AppModeSwitcher />);

    // The mocked t() renders `t('label.mode-label', { mode })` as
    // `${mode} mode`, and `modeLabel` itself resolves to the raw key
    // (`label.classic`) since the mock only interpolates when passed
    // an explicit `mode` option.
    expect(getTrigger()).toHaveTextContent('label.classic mode');
  });

  it('renders both Classic and AI options', () => {
    render(<AppModeSwitcher />);

    expect(getCard()).not.toBeInTheDocument();

    fireEvent.click(getTrigger());

    expect(getCard()).toBeInTheDocument();
    expect(screen.getByTestId('app-mode-option-classic')).toBeInTheDocument();
    expect(screen.getByTestId('app-mode-option-ai')).toBeInTheDocument();
  });

  it('both options are always enabled (Classic and AI both ship in-tree, no install-gate)', () => {
    render(<AppModeSwitcher />);
    fireEvent.click(getTrigger());

    expect(screen.getByTestId('app-mode-option-classic')).not.toBeDisabled();
    expect(screen.getByTestId('app-mode-option-ai')).not.toBeDisabled();
  });

  it('clicking Classic writes DEFAULT_APP_MODE and navigates to /', () => {
    currentMode = 'ai';
    render(<AppModeSwitcher />);
    fireEvent.click(getTrigger());
    fireEvent.click(screen.getByTestId('app-mode-option-classic'));

    expect(mockWriteAppMode).toHaveBeenCalledWith('default', undefined);
    expect(mockNavigate).toHaveBeenCalledWith('/');
    expect(getCard()).not.toBeInTheDocument();
  });

  it('clicking AI writes AI_APP_MODE and navigates to / (default aiHref)', () => {
    currentMode = 'default';
    render(<AppModeSwitcher />);
    fireEvent.click(getTrigger());
    fireEvent.click(screen.getByTestId('app-mode-option-ai'));

    expect(mockWriteAppMode).toHaveBeenCalledWith('ai', undefined);
    expect(mockNavigate).toHaveBeenCalledWith('/');
  });

  it('respects classicHref prop for Classic navigation', () => {
    currentMode = 'ai';
    render(<AppModeSwitcher classicHref="/classic-home" />);
    fireEvent.click(getTrigger());
    fireEvent.click(screen.getByTestId('app-mode-option-classic'));

    expect(mockNavigate).toHaveBeenCalledWith('/classic-home');
  });

  it('respects aiHref prop for AI navigation', () => {
    currentMode = 'default';
    render(<AppModeSwitcher aiHref="/ai-home" />);
    fireEvent.click(getTrigger());
    fireEvent.click(screen.getByTestId('app-mode-option-ai'));

    expect(mockNavigate).toHaveBeenCalledWith('/ai-home');
  });

  it('remember checkbox writes the wire token "classic" (not the runtime "default") when off', () => {
    currentMode = 'default';
    preferenceMode = null;
    render(<AppModeSwitcher />);
    fireEvent.click(getTrigger());
    fireEvent.click(screen.getByTestId('app-mode-remember-toggle'));

    expect(mockSetPreference).toHaveBeenCalledWith({ appMode: 'classic' });
  });

  it('remember checkbox writes the wire token "ai" when currentMode is AI', () => {
    currentMode = 'ai';
    preferenceMode = null;
    render(<AppModeSwitcher />);
    fireEvent.click(getTrigger());
    fireEvent.click(screen.getByTestId('app-mode-remember-toggle'));

    expect(mockSetPreference).toHaveBeenCalledWith({ appMode: 'ai' });
  });

  it('remember checkbox writes preferences.appMode = null when currently remembered (wire token match)', () => {
    currentMode = 'default';
    preferenceMode = 'classic';
    render(<AppModeSwitcher />);
    fireEvent.click(getTrigger());
    fireEvent.click(screen.getByTestId('app-mode-remember-toggle'));

    expect(mockSetPreference).toHaveBeenCalledWith({ appMode: null });
  });

  it('does NOT gate on isDesktop (component always renders when props allow)', () => {
    // Regression guard: the OSS variant drops the useIsDesktop gating
    // that exists downstream (Electron shell). This component must
    // always render its trigger regardless of any desktop state.
    const { container } = render(<AppModeSwitcher />);

    expect(container).not.toBeEmptyDOMElement();
    expect(getTrigger()).toBeInTheDocument();
  });
});
