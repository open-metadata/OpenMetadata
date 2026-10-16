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
const mockUseIsAiMode = jest.fn().mockReturnValue(false);
const mockOnClose = jest.fn();

jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate,
}));

jest.mock('../../../hooks/useAppMode', () => ({
  useIsAiMode: () => mockUseIsAiMode(),
}));

jest.mock('../../../context/UntitledUIThemeProvider/theme-provider', () => ({
  useTheme: () => ({ theme: 'light' }),
}));

describe('WelcomeScreen', () => {
  beforeEach(() => mockNavigate.mockClear());

  it('should render the illustration and message', () => {
    render(<WelcomeScreen onClose={mockOnClose} />, { wrapper: MemoryRouter });

    expect(screen.getByTestId('welcome-screen-img')).toBeInTheDocument();
    expect(
      screen.getByText('message.welcome-screen-message')
    ).toBeInTheDocument();
  });

  it('should call onClose when the close button is clicked', () => {
    render(<WelcomeScreen onClose={mockOnClose} />, { wrapper: MemoryRouter });

    fireEvent.click(screen.getByTestId('welcome-screen-close-btn'));

    expect(mockOnClose).toHaveBeenCalled();
  });

  it('should open add database service on connect a data source in classic mode', () => {
    render(<WelcomeScreen onClose={mockOnClose} />, { wrapper: MemoryRouter });

    fireEvent.click(screen.getByTestId('welcome-screen-connect-btn'));

    expect(mockNavigate).toHaveBeenCalledWith('/databaseServices/add-service');
  });

  it('should open add service across all categories in AI mode', () => {
    mockUseIsAiMode.mockReturnValueOnce(true);
    render(<WelcomeScreen onClose={mockOnClose} />, { wrapper: MemoryRouter });

    fireEvent.click(screen.getByTestId('welcome-screen-connect-btn'));

    expect(mockNavigate).toHaveBeenCalledWith('/all/add-service');
  });

  it('should start the tour on take a product tour', () => {
    render(<WelcomeScreen onClose={mockOnClose} />, { wrapper: MemoryRouter });

    fireEvent.click(screen.getByTestId('welcome-screen-tour-btn'));

    expect(mockNavigate).toHaveBeenCalledWith('/tour');
  });
});
