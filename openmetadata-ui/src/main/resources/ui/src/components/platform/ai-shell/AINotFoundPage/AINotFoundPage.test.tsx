/*
 *  Copyright 2025 Collate.
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
import { ROUTES } from '../../../../constants/constants';
import AINotFoundPage from './AINotFoundPage';

const mockNavigate = jest.fn();

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

jest.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
}));

jest.mock('utils/EntityDisplayUtils', () => ({
  getServiceLogo: (service: string) => <span>{service}</span>,
}));

describe('AINotFoundPage', () => {
  beforeEach(() => {
    mockNavigate.mockClear();
  });

  it('renders the not-found title and description', () => {
    render(<AINotFoundPage />);

    expect(screen.getByTestId('ai-not-found-page')).toBeInTheDocument();
    expect(
      screen.getByText('message.ai-asset-not-found-title')
    ).toBeInTheDocument();
    expect(
      screen.getByText('message.ai-asset-not-found-description')
    ).toBeInTheDocument();
  });

  it('navigates home when clicking Back to home', () => {
    render(<AINotFoundPage />);

    fireEvent.click(screen.getByTestId('ai-not-found-home-button'));

    expect(mockNavigate).toHaveBeenCalledWith(ROUTES.HOME);
  });

  it('navigates to Explore when clicking Explore', () => {
    render(<AINotFoundPage />);

    fireEvent.click(screen.getByTestId('ai-not-found-explore-button'));

    expect(mockNavigate).toHaveBeenCalledWith(ROUTES.EXPLORE);
  });
});
