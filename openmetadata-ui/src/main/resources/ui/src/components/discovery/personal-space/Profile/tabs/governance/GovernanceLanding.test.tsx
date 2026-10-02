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

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

// Define Card with sub-components inline to avoid TDZ with const variables
jest.mock('@openmetadata/ui-core-components', () => {
  const CardContent = ({ children }: { children?: React.ReactNode }) => (
    <div>{children}</div>
  );
  const Card = Object.assign(
    ({
      children,
      onClick,
      onKeyDown,
      ...rest
    }: React.PropsWithChildren<{
      onClick?: React.MouseEventHandler<HTMLDivElement>;
      onKeyDown?: React.KeyboardEventHandler<HTMLDivElement>;
      [key: string]: unknown;
    }>) => (
      <div
        role="button"
        tabIndex={0}
        onClick={onClick}
        onKeyDown={onKeyDown}
        {...rest}>
        {children}
      </div>
    ),
    { Content: CardContent }
  );

  return {
    Box: ({
      children,
      ...props
    }: React.PropsWithChildren<Record<string, unknown>>) => (
      <div {...props}>{children}</div>
    ),
    Card,
    Typography: ({ children }: { children: React.ReactNode }) => (
      <span>{children}</span>
    ),
  };
});

jest.mock('@openmetadata/ui-core-components/icons', () => ({
  Documents: () => <svg data-testid="documents-icon" />,
  GlossaryTerm: () => <svg data-testid="glossary-term-icon" />,
}));

import GovernanceLanding from './GovernanceLanding';

describe('GovernanceLanding', () => {
  const mockOnNavigate = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    render(<GovernanceLanding onNavigate={mockOnNavigate} />);
  });

  it('renders the landing container', () => {
    expect(screen.getByTestId('governance-landing')).toBeInTheDocument();
  });

  it('renders both landing cards', () => {
    expect(
      screen.getByTestId('governance-card-glossary-relations')
    ).toBeInTheDocument();
    expect(
      screen.getByTestId('governance-card-intake-forms')
    ).toBeInTheDocument();
  });

  it('calls onNavigate with glossary-list when the glossary card is clicked', () => {
    fireEvent.click(screen.getByTestId('governance-card-glossary-relations'));

    expect(mockOnNavigate).toHaveBeenCalledWith({ type: 'glossary-list' });
  });

  it('calls onNavigate with intake-list when the intake card is clicked', () => {
    fireEvent.click(screen.getByTestId('governance-card-intake-forms'));

    expect(mockOnNavigate).toHaveBeenCalledWith({ type: 'intake-list' });
  });

  it('calls onNavigate on Enter key for the glossary card', () => {
    fireEvent.keyDown(
      screen.getByTestId('governance-card-glossary-relations'),
      { key: 'Enter' }
    );

    expect(mockOnNavigate).toHaveBeenCalledWith({ type: 'glossary-list' });
  });

  it('calls onNavigate on Space key for the intake card', () => {
    fireEvent.keyDown(screen.getByTestId('governance-card-intake-forms'), {
      key: ' ',
    });

    expect(mockOnNavigate).toHaveBeenCalledWith({ type: 'intake-list' });
  });

  it('does not call onNavigate on other keys', () => {
    fireEvent.keyDown(
      screen.getByTestId('governance-card-glossary-relations'),
      { key: 'Tab' }
    );

    expect(mockOnNavigate).not.toHaveBeenCalled();
  });
});
