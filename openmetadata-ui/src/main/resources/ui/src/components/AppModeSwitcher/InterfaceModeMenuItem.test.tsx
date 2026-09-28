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
import {
  AI_APP_MODE,
  DEFAULT_APP_MODE,
} from '../../constants/appMode.constants';
import InterfaceModeMenuItem from './InterfaceModeMenuItem';

const mockNavigate = jest.fn();
const mockWriteAppMode = jest.fn();
let isAiMode = false;

jest.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

jest.mock('../../hooks/useAppMode', () => ({
  useIsAiMode: () => isAiMode,
  writeAppMode: (mode: string) => mockWriteAppMode(mode),
}));

const ACTIVE_CLASS = 'tw:text-utility-blue-700';

const getButton = (label: string) =>
  screen.getByText(label).closest('button') as HTMLButtonElement;

describe('InterfaceModeMenuItem', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    isAiMode = false;
  });

  it('renders the interface heading with Classic and AI options', () => {
    render(<InterfaceModeMenuItem />);

    expect(screen.getByText('label.user-interface')).toBeInTheDocument();
    expect(screen.getByText('label.classic')).toBeInTheDocument();
    expect(screen.getByText('label.ai')).toBeInTheDocument();
  });

  it('marks Classic active when the current mode is not AI', () => {
    isAiMode = false;

    render(<InterfaceModeMenuItem />);

    expect(getButton('label.classic').className).toContain(ACTIVE_CLASS);
    expect(getButton('label.ai').className).not.toContain(ACTIVE_CLASS);
  });

  it('marks AI active when the current mode is AI', () => {
    isAiMode = true;

    render(<InterfaceModeMenuItem />);

    expect(getButton('label.ai').className).toContain(ACTIVE_CLASS);
    expect(getButton('label.classic').className).not.toContain(ACTIVE_CLASS);
  });

  it('switches to Classic mode and navigates home', () => {
    isAiMode = true;

    render(<InterfaceModeMenuItem />);
    fireEvent.click(getButton('label.classic'));

    expect(mockWriteAppMode).toHaveBeenCalledWith(DEFAULT_APP_MODE);
    expect(mockNavigate).toHaveBeenCalledWith('/');
  });

  it('switches to AI mode and navigates home', () => {
    render(<InterfaceModeMenuItem />);
    fireEvent.click(getButton('label.ai'));

    expect(mockWriteAppMode).toHaveBeenCalledWith(AI_APP_MODE);
    expect(mockNavigate).toHaveBeenCalledWith('/');
  });
});
