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
import { render, screen } from '@testing-library/react';
import React from 'react';
import { Severities } from '../../../../generated/tests/testCaseResolutionStatus';
import '../../../../test/unit/mocks/mui.mock';
import InlineSeverity from './InlineSeverity.component';

jest.mock('@openmetadata/ui-core-components', () => ({
  Typography: ({
    as: Component = 'span',
    children,
    ...props
  }: {
    as?: React.ElementType;
    children: React.ReactNode;
    [key: string]: unknown;
  }) => <Component {...props}>{children}</Component>,
  Dropdown: {
    Root: ({
      children,
      onOpenChange: _onOpenChange,
    }: {
      children: React.ReactNode;
      onOpenChange: (open: boolean) => void;
    }) => <div data-testid="dropdown-root">{children}</div>,
    Popover: ({
      children,
      className,
    }: {
      children: React.ReactNode;
      className?: string;
    }) => (
      <div className={className} data-testid="dropdown-popover">
        {children}
      </div>
    ),
    Menu: ({
      children,
      onAction: _onAction,
      selectedKeys: _selectedKeys,
      selectionMode: _selectionMode,
    }: {
      children: React.ReactNode;
      onAction?: (key: React.Key) => void;
      selectedKeys?: React.Key[];
      selectionMode?: string;
    }) => <div data-testid="dropdown-menu">{children}</div>,
    Item: ({ id, label }: { id: string; label: React.ReactNode }) => (
      <div data-testid={`dropdown-item-${id}`}>{label}</div>
    ),
    Separator: () => <hr data-testid="dropdown-separator" />,
  },
}));

describe('InlineSeverity Component', () => {
  const mockOnSubmit = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render component with severity', () => {
    render(
      <InlineSeverity
        hasEditPermission
        severity={Severities.Severity1}
        onSubmit={mockOnSubmit}
      />
    );

    expect(
      screen.getByRole('button', { name: 'Severity 1' })
    ).toBeInTheDocument();
  });

  it('should render "No Severity" when severity is undefined', () => {
    render(
      <InlineSeverity
        hasEditPermission
        severity={undefined}
        onSubmit={mockOnSubmit}
      />
    );

    expect(
      screen.getByRole('button', { name: /no severity|label\.no-entity/i })
    ).toBeInTheDocument();
  });

  it('should render all severity levels correctly', () => {
    const severities = [
      { value: Severities.Severity1, label: 'Severity 1' },
      { value: Severities.Severity2, label: 'Severity 2' },
      { value: Severities.Severity3, label: 'Severity 3' },
      { value: Severities.Severity4, label: 'Severity 4' },
      { value: Severities.Severity5, label: 'Severity 5' },
    ];

    severities.forEach(({ value, label }) => {
      const { unmount } = render(
        <InlineSeverity
          hasEditPermission
          severity={value}
          onSubmit={mockOnSubmit}
        />
      );

      expect(screen.getByRole('button', { name: label })).toBeInTheDocument();

      unmount();
    });
  });

  it('should render with hasEditPermission true', () => {
    render(
      <InlineSeverity
        hasEditPermission
        severity={Severities.Severity1}
        onSubmit={mockOnSubmit}
      />
    );

    expect(
      screen.getByRole('button', { name: 'Severity 1' })
    ).toBeInTheDocument();
  });

  it('should render with hasEditPermission false', () => {
    render(
      <InlineSeverity
        hasEditPermission={false}
        severity={Severities.Severity1}
        onSubmit={mockOnSubmit}
      />
    );

    expect(
      screen.getByRole('button', { name: 'Severity 1' })
    ).toBeInTheDocument();
  });

  it('should handle onSubmit prop correctly', () => {
    const customMockSubmit = jest.fn();
    render(
      <InlineSeverity
        hasEditPermission
        severity={Severities.Severity2}
        onSubmit={customMockSubmit}
      />
    );

    expect(customMockSubmit).not.toHaveBeenCalled();
  });

  it('should render without crashing when onSubmit is undefined', () => {
    render(
      <InlineSeverity
        hasEditPermission
        severity={Severities.Severity1}
        onSubmit={undefined}
      />
    );

    expect(
      screen.getByRole('button', { name: 'Severity 1' })
    ).toBeInTheDocument();
  });

  it('should render component when severity changes', () => {
    const { rerender } = render(
      <InlineSeverity
        hasEditPermission
        severity={Severities.Severity1}
        onSubmit={mockOnSubmit}
      />
    );

    expect(
      screen.getByRole('button', { name: 'Severity 1' })
    ).toBeInTheDocument();

    rerender(
      <InlineSeverity
        hasEditPermission
        severity={Severities.Severity3}
        onSubmit={mockOnSubmit}
      />
    );

    expect(
      screen.getByRole('button', { name: 'Severity 3' })
    ).toBeInTheDocument();
  });

  it('should switch between No Severity and actual severity', () => {
    const { rerender } = render(
      <InlineSeverity
        hasEditPermission
        severity={undefined}
        onSubmit={mockOnSubmit}
      />
    );

    expect(
      screen.getByRole('button', { name: /no severity|label\.no-entity/i })
    ).toBeInTheDocument();

    rerender(
      <InlineSeverity
        hasEditPermission
        severity={Severities.Severity2}
        onSubmit={mockOnSubmit}
      />
    );

    expect(
      screen.getByRole('button', { name: 'Severity 2' })
    ).toBeInTheDocument();
  });
});
