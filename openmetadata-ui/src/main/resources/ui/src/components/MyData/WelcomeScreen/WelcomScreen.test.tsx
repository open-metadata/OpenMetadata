/*
 *  Copyright 2023 Collate.
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
import { MemoryRouter } from 'react-router-dom';
import WelcomeScreen from './WelcomeScreen.component';

const mockNavigate = jest.fn();
const mockOnClose = jest.fn();
const mockAddService = jest.fn();
const mockUseAddServiceAction = jest.fn();
const mockUseIsAiMode = jest.fn();

jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate,
}));

jest.mock('../../../hooks/useAppMode', () => ({
  useIsAiMode: () => mockUseIsAiMode(),
}));

jest.mock('../../integration/ConnectionsPage/useAddServiceAction', () => ({
  useAddServiceAction: (category: string) => mockUseAddServiceAction(category),
}));

jest.mock('../../../context/UntitledUIThemeProvider/theme-provider', () => ({
  useTheme: () => ({ theme: 'light' }),
}));

const renderScreen = () =>
  render(<WelcomeScreen onClose={mockOnClose} />, { wrapper: MemoryRouter });

describe('WelcomeScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseIsAiMode.mockReturnValue(false);
    mockUseAddServiceAction.mockReturnValue({
      addService: mockAddService,
      canAddService: true,
    });
  });

  it('should render the illustration and message', () => {
    renderScreen();

    expect(screen.getByTestId('welcome-screen-img')).toBeInTheDocument();
    expect(
      screen.getByText('message.welcome-screen-message')
    ).toBeInTheDocument();
  });

  it('should call onClose when the close button is clicked', () => {
    renderScreen();

    fireEvent.click(screen.getByTestId('welcome-screen-close-btn'));

    expect(mockOnClose).toHaveBeenCalled();
  });

  it('should add a database service from classic mode', () => {
    renderScreen();

    fireEvent.click(screen.getByTestId('welcome-screen-connect-btn'));

    expect(mockUseAddServiceAction).toHaveBeenCalledWith('databaseServices');
    expect(mockOnClose).toHaveBeenCalled();
    expect(mockAddService).toHaveBeenCalled();
  });

  it('should add a service from any category in AI mode', () => {
    mockUseIsAiMode.mockReturnValue(true);
    renderScreen();

    expect(mockUseAddServiceAction).toHaveBeenCalledWith('all');
  });

  it('should hide connect a data source from users who cannot create services', () => {
    mockUseAddServiceAction.mockReturnValue({
      addService: mockAddService,
      canAddService: false,
    });
    renderScreen();

    expect(
      screen.queryByTestId('welcome-screen-connect-btn')
    ).not.toBeInTheDocument();
    expect(screen.getByTestId('welcome-screen-tour-btn')).toBeInTheDocument();
  });

  it('should close the welcome screen and start the tour', () => {
    renderScreen();

    fireEvent.click(screen.getByTestId('welcome-screen-tour-btn'));

    expect(mockOnClose).toHaveBeenCalled();
    expect(mockNavigate).toHaveBeenCalledWith('/tour');
  });
});
