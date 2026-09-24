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
import NotificationLanding from './NotificationLanding';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

jest.mock('@openmetadata/ui-core-components', () => ({
  ...jest.requireActual('@openmetadata/ui-core-components'),
  Box: jest
    .fn()
    .mockImplementation(({ children, ...props }) => (
      <div {...props}>{children}</div>
    )),
  Card: Object.assign(
    jest.fn().mockImplementation(({ children, onClick, isClickable: _isClickable, size: _size, ...props }) => (
      <button {...props} type="button" onClick={onClick}>
        {children}
      </button>
    )),
    {
      Content: jest
        .fn()
        .mockImplementation(({ children }) => <div>{children}</div>),
    }
  ),
  Typography: jest
    .fn()
    .mockImplementation(({ children }) => <span>{children}</span>),
}));

jest.mock('@untitledui/icons', () => ({
  Bell01: jest.fn(() => <span data-testid="bell-icon" />),
}));

describe('NotificationLanding', () => {
  const mockOnNavigate = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render the notification landing card', () => {
    render(<NotificationLanding onNavigate={mockOnNavigate} />);

    expect(screen.getByTestId('notification-landing')).toBeInTheDocument();
    expect(
      screen.getByTestId('notification-card-alerts')
    ).toBeInTheDocument();
  });

  it('should render alert title and description text', () => {
    render(<NotificationLanding onNavigate={mockOnNavigate} />);

    expect(screen.getByText('label.alert-plural')).toBeInTheDocument();
    expect(
      screen.getByText('message.alerts-description')
    ).toBeInTheDocument();
  });

  it('should call onNavigate with list view when card is clicked', () => {
    render(<NotificationLanding onNavigate={mockOnNavigate} />);

    fireEvent.click(screen.getByTestId('notification-card-alerts'));

    expect(mockOnNavigate).toHaveBeenCalledWith({ type: 'list' });
  });
});
