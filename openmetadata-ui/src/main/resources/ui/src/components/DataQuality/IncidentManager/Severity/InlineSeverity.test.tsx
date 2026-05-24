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
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import React from 'react';
import { Severities } from '../../../../generated/tests/testCaseResolutionStatus';
import InlineSeverity from './InlineSeverity.component';

jest.mock('@untitledui/icons', () => ({
  ChevronDown: () => <svg data-testid="icon-chevron-down" />,
  ChevronUp: () => <svg data-testid="icon-chevron-up" />,
}));

jest.mock(
  '../TestCaseStatus/InlineIncidentStatus/ChipTrigger.component',
  () => ({
    ChipTrigger: ({
      chipLabel,
      hasEditPermission,
      overlayOpen,
    }: {
      chipLabel: string;
      hasEditPermission: boolean;
      overlayOpen: boolean;
      [key: string]: unknown;
    }) => (
      <button
        data-overlay-open={overlayOpen}
        data-testid="chip-trigger"
        disabled={!hasEditPermission}
        type="button">
        {chipLabel}
      </button>
    ),
  })
);

jest.mock('@openmetadata/ui-core-components', () => {
  const DropdownMenu = ({
    children,
    onAction,
  }: {
    children: React.ReactNode;
    onAction?: (key: React.Key) => void;
  }) => (
    <div data-testid="dropdown-menu" role="menu">
      {React.Children.map(children, (child) =>
        React.isValidElement(child)
          ? React.cloneElement(
              child as React.ReactElement<{
                onAction?: (key: React.Key) => void;
              }>,
              { onAction }
            )
          : child
      )}
    </div>
  );

  const DropdownItem = ({
    id,
    children,
    label,
    onAction,
  }: {
    id: string;
    children?: React.ReactNode;
    label?: React.ReactNode;
    onAction?: (key: React.Key) => void;
  }) => (
    <div
      data-testid={`dropdown-item-${id}`}
      role="menuitem"
      onClick={() => onAction?.(id)}>
      {children ?? label}
    </div>
  );

  return {
    Dropdown: {
      Root: ({
        children,
        onOpenChange,
      }: {
        children: React.ReactNode;
        onOpenChange?: (open: boolean) => void;
      }) => {
        const [open, setOpen] = React.useState(false);
        const ch = React.Children.toArray(children);

        return (
          <div data-testid="dropdown-root">
            <div
              onClick={() => {
                setOpen(true);
                onOpenChange?.(true);
              }}>
              {ch[0]}
            </div>
            {open ? ch[1] : null}
          </div>
        );
      },
      Popover: ({ children }: { children: React.ReactNode }) => (
        <div data-testid="dropdown-popover">{children}</div>
      ),
      Menu: DropdownMenu,
      Item: DropdownItem,
      Separator: () => <hr data-testid="dropdown-separator" />,
    },
    Typography: ({
      as: Component = 'span',
      children,
      ...props
    }: {
      as?: React.ElementType;
      children: React.ReactNode;
      [key: string]: unknown;
    }) => <Component {...props}>{children}</Component>,
  };
});

const mockOnSubmit = jest.fn().mockResolvedValue(undefined);

const renderComponent = (
  severity: Severities | undefined,
  hasEditPermission = true
) =>
  render(
    <InlineSeverity
      hasEditPermission={hasEditPermission}
      severity={severity}
      onSubmit={mockOnSubmit}
    />
  );

describe('InlineSeverity', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('chip rendering', () => {
    it('renders Severity1 chip label', () => {
      renderComponent(Severities.Severity1);

      expect(screen.getByTestId('chip-trigger')).toHaveTextContent(
        'Severity 1'
      );
    });

    it('renders Severity2 chip label', () => {
      renderComponent(Severities.Severity2);

      expect(screen.getByTestId('chip-trigger')).toHaveTextContent(
        'Severity 2'
      );
    });

    it('renders Severity3 chip label', () => {
      renderComponent(Severities.Severity3);

      expect(screen.getByTestId('chip-trigger')).toHaveTextContent(
        'Severity 3'
      );
    });

    it('renders Severity4 chip label', () => {
      renderComponent(Severities.Severity4);

      expect(screen.getByTestId('chip-trigger')).toHaveTextContent(
        'Severity 4'
      );
    });

    it('renders Severity5 chip label', () => {
      renderComponent(Severities.Severity5);

      expect(screen.getByTestId('chip-trigger')).toHaveTextContent(
        'Severity 5'
      );
    });

    it('renders "No Severity" label when severity is undefined', () => {
      renderComponent(undefined);

      expect(screen.getByTestId('chip-trigger')).toBeInTheDocument();
    });

    it('chip is disabled without edit permission', () => {
      renderComponent(Severities.Severity1, false);

      expect(screen.getByTestId('chip-trigger')).toBeDisabled();
    });

    it('chip is enabled with edit permission', () => {
      renderComponent(Severities.Severity1, true);

      expect(screen.getByTestId('chip-trigger')).not.toBeDisabled();
    });

    it('dropdown root is not rendered without edit permission', () => {
      renderComponent(Severities.Severity1, false);

      expect(screen.queryByTestId('dropdown-root')).not.toBeInTheDocument();
    });

    it('dropdown root is rendered with edit permission', () => {
      renderComponent(Severities.Severity1, true);

      expect(screen.getByTestId('dropdown-root')).toBeInTheDocument();
    });

    it('chip label updates when severity prop changes', () => {
      const { rerender } = renderComponent(Severities.Severity1);

      expect(screen.getByTestId('chip-trigger')).toHaveTextContent(
        'Severity 1'
      );

      rerender(
        <InlineSeverity
          hasEditPermission
          severity={Severities.Severity3}
          onSubmit={mockOnSubmit}
        />
      );

      expect(screen.getByTestId('chip-trigger')).toHaveTextContent(
        'Severity 3'
      );
    });

    it('chip label updates from no-severity to a severity', () => {
      const { rerender } = renderComponent(undefined);

      rerender(
        <InlineSeverity
          hasEditPermission
          severity={Severities.Severity2}
          onSubmit={mockOnSubmit}
        />
      );

      expect(screen.getByTestId('chip-trigger')).toHaveTextContent(
        'Severity 2'
      );
    });
  });

  describe('dropdown interaction', () => {
    it('opens dropdown when chip trigger area is clicked', async () => {
      renderComponent(Severities.Severity1);

      await act(async () => {
        fireEvent.click(screen.getByTestId('chip-trigger'));
      });

      expect(screen.getByTestId('dropdown-popover')).toBeInTheDocument();
    });

    it('shows all severity options in the dropdown', async () => {
      renderComponent(Severities.Severity1);

      await act(async () => {
        fireEvent.click(screen.getByTestId('chip-trigger'));
      });

      Object.values(Severities).forEach((sev) => {
        expect(screen.getByTestId(`dropdown-item-${sev}`)).toBeInTheDocument();
      });
    });

    it('shows "No Severity" option in the dropdown', async () => {
      renderComponent(Severities.Severity1);

      await act(async () => {
        fireEvent.click(screen.getByTestId('chip-trigger'));
      });

      expect(screen.getByTestId('dropdown-item-none')).toBeInTheDocument();
    });

    it('shows a separator between no-severity and severity options', async () => {
      renderComponent(Severities.Severity1);

      await act(async () => {
        fireEvent.click(screen.getByTestId('chip-trigger'));
      });

      expect(screen.getByTestId('dropdown-separator')).toBeInTheDocument();
    });

    it('calls onSubmit with the selected severity', async () => {
      renderComponent(Severities.Severity1);

      await act(async () => {
        fireEvent.click(screen.getByTestId('chip-trigger'));
      });

      await act(async () => {
        fireEvent.click(
          screen.getByTestId(`dropdown-item-${Severities.Severity3}`)
        );
      });

      await waitFor(() => {
        expect(mockOnSubmit).toHaveBeenCalledWith(Severities.Severity3);
      });
    });

    it('calls onSubmit with undefined when "none" option is selected', async () => {
      renderComponent(Severities.Severity2);

      await act(async () => {
        fireEvent.click(screen.getByTestId('chip-trigger'));
      });

      await act(async () => {
        fireEvent.click(screen.getByTestId('dropdown-item-none'));
      });

      await waitFor(() => {
        expect(mockOnSubmit).toHaveBeenCalledWith(undefined);
      });
    });

    it('calls onSubmit with correct severity for each option', async () => {
      for (const sev of Object.values(Severities)) {
        jest.clearAllMocks();

        const { unmount } = renderComponent(undefined);

        await act(async () => {
          fireEvent.click(screen.getByTestId('chip-trigger'));
        });

        await act(async () => {
          fireEvent.click(screen.getByTestId(`dropdown-item-${sev}`));
        });

        await waitFor(() => {
          expect(mockOnSubmit).toHaveBeenCalledWith(sev);
        });

        unmount();
      }
    });
  });

  describe('loading state', () => {
    it('chip is disabled during submission', async () => {
      let resolveSubmit!: () => void;
      const slowSubmit = jest.fn(
        () =>
          new Promise<void>((res) => {
            resolveSubmit = res;
          })
      );

      render(
        <InlineSeverity
          hasEditPermission
          severity={Severities.Severity1}
          onSubmit={slowSubmit}
        />
      );

      await act(async () => {
        fireEvent.click(screen.getByTestId('chip-trigger'));
      });

      await act(async () => {
        fireEvent.click(
          screen.getByTestId(`dropdown-item-${Severities.Severity2}`)
        );
      });

      expect(screen.getByTestId('chip-trigger')).toBeDisabled();

      await act(async () => {
        resolveSubmit();
      });

      await waitFor(() => {
        expect(screen.getByTestId('chip-trigger')).not.toBeDisabled();
      });
    });
  });

  describe('onSubmit callback', () => {
    it('does not call onSubmit on initial render', () => {
      renderComponent(Severities.Severity1);

      expect(mockOnSubmit).not.toHaveBeenCalled();
    });

    it('renders without crashing when onSubmit is undefined', () => {
      render(
        <InlineSeverity
          hasEditPermission
          severity={Severities.Severity1}
          onSubmit={undefined}
        />
      );

      expect(screen.getByTestId('chip-trigger')).toBeInTheDocument();
    });
  });
});
