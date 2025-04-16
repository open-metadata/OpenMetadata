/*
 *  Copyright 2024 Collate.
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
import { MemoryRouter } from 'react-router-dom';
import WelcomeScreen from './WelcomeScreen.component';

const mockProps = {
  onCloseMock: jest.fn(),
};

describe('WelcomeScreen', () => {
  it('should render WelcomeScreen', async () => {
    await act(async () => {
      render(<WelcomeScreen onClose={mockProps.onCloseMock} />, {
        wrapper: MemoryRouter,
      });
    });
    const welcomeImg = screen.getByTestId('welcome-screen-img');

    expect(welcomeImg).toBeInTheDocument();
  });

  it('should call onClose when the close button is clicked', () => {
    const { getByTestId } = render(
      <WelcomeScreen onClose={mockProps.onCloseMock} />,
      {
        wrapper: MemoryRouter,
      }
    );

    const closeButton = getByTestId('welcome-screen-close-btn');
    fireEvent.click(closeButton);

    expect(mockProps.onCloseMock).toHaveBeenCalled();
  });

  it('should display the correct welcome message', () => {
    const { getByText } = render(
      <WelcomeScreen onClose={mockProps.onCloseMock} />,
      {
        wrapper: MemoryRouter,
      }
    );

    const welcomeMessage = getByText('message.welcome-screen-message');

    expect(welcomeMessage).toBeInTheDocument();
  });
});
