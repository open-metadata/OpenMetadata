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
import { LOGGED_IN_USER_STORAGE_KEY } from '../../../constants/constants';
import WelcomeScreenGate from './WelcomeScreenGate';

const mockTour = { isTourPage: false };
const mockWelcome = { isWelcomeVisible: true };

jest.mock('../../../hooks/useApplicationStore', () => ({
  useApplicationStore: () => ({ currentUser: { name: 'alex' } }),
}));

jest.mock('../../../hooks/useWelcomeStore', () => ({
  useWelcomeStore: () => mockWelcome,
}));

jest.mock('../../../context/TourProvider/TourProvider', () => ({
  useTourProvider: () => mockTour,
}));

jest.mock('./WelcomeScreen.component', () =>
  jest.fn(({ onClose }) => (
    <button data-testid="welcome" onClick={onClose}>
      welcome
    </button>
  ))
);

const renderGate = () =>
  render(
    <WelcomeScreenGate>
      <div data-testid="home">home</div>
    </WelcomeScreenGate>
  );

describe('WelcomeScreenGate', () => {
  beforeEach(() => {
    localStorage.clear();
    mockTour.isTourPage = false;
    mockWelcome.isWelcomeVisible = true;
  });

  it('shows the welcome screen to a first-time user and remembers them', async () => {
    renderGate();

    expect(await screen.findByTestId('welcome')).toBeInTheDocument();
    expect(screen.queryByTestId('home')).not.toBeInTheDocument();
    expect(localStorage.getItem(LOGGED_IN_USER_STORAGE_KEY)).toBe('alex');
  });

  it('shows the home route once the welcome screen is closed', async () => {
    renderGate();

    fireEvent.click(await screen.findByTestId('welcome'));

    expect(screen.getByTestId('home')).toBeInTheDocument();
  });

  it('skips the welcome screen for a user who has already seen it', () => {
    localStorage.setItem(LOGGED_IN_USER_STORAGE_KEY, 'someone,alex');
    renderGate();

    expect(screen.getByTestId('home')).toBeInTheDocument();
    expect(screen.queryByTestId('welcome')).not.toBeInTheDocument();
  });

  it('skips the welcome screen on the tour', () => {
    mockTour.isTourPage = true;
    renderGate();

    expect(screen.getByTestId('home')).toBeInTheDocument();
  });

  it('skips the welcome screen when it is switched off', () => {
    mockWelcome.isWelcomeVisible = false;
    renderGate();

    expect(screen.getByTestId('home')).toBeInTheDocument();
  });
});
