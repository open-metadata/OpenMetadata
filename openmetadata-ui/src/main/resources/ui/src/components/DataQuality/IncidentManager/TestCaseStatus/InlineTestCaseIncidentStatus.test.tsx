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
import {
  TestCaseFailureReasonType,
  TestCaseResolutionStatus,
  TestCaseResolutionStatusTypes,
} from '../../../../generated/tests/testCaseResolutionStatus';
import { transitionIncident } from '../../../../rest/incidentManagerAPI';
import { getUserAndTeamSearch } from '../../../../rest/miscAPI';
import { createTask } from '../../../../rest/tasksAPI';
import { showErrorToast } from '../../../../utils/ToastUtils';

jest.mock('@untitledui/icons', () => ({
  ArrowLeft: () => <svg data-testid="icon-arrow-left" />,
  Check: () => <svg data-testid="icon-check" />,
  ChevronDown: () => <svg data-testid="icon-chevron-down" />,
  ChevronUp: () => <svg data-testid="icon-chevron-up" />,
  XClose: () => <svg data-testid="icon-x-close" />,
}));

jest.mock('./InlineIncidentStatus/ChipTrigger.component', () => ({
  ChipTrigger: ({
    chipLabel,
    dataTestId,
    hasEditPermission,
  }: {
    chipLabel: string;
    dataTestId: string;
    hasEditPermission: boolean;
    [key: string]: unknown;
  }) => (
    <button
      data-testid={dataTestId}
      disabled={!hasEditPermission}
      type="button">
      {chipLabel}
    </button>
  ),
}));

jest.mock('../../../common/UserTag/UserTag.component', () => ({
  UserTag: ({ name }: { name: string }) => <span>{name}</span>,
}));

jest.mock('../../../common/Loader/Loader', () => ({
  __esModule: true,
  default: () => <div data-testid="loader" />,
}));

jest.mock('@openmetadata/ui-core-components', () => {
  const DropdownMenu = ({
    children,
    onAction,
  }: {
    children: React.ReactNode;
    onAction?: (key: React.Key) => void;
  }) => (
    <div role="menu">
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
    <div role="menuitem" onClick={() => onAction?.(id)}>
      {children ?? label}
    </div>
  );

  return {
    Box: ({
      children,
      className,
      inline: _inline,
      align: _align,
      direction: _direction,
      justify: _justify,
      gap: _gap,
      wrap: _wrap,
      style: _style,
      ...props
    }: {
      children: React.ReactNode;
      className?: string;
      [key: string]: unknown;
    }) => (
      <div className={className} {...props}>
        {children}
      </div>
    ),
    Button: React.forwardRef<
      HTMLButtonElement,
      React.ButtonHTMLAttributes<HTMLButtonElement> & {
        children?: React.ReactNode;
        onPress?: () => void;
        iconLeading?: React.ComponentType<{ className?: string }>;
        isDisabled?: boolean;
      }
    >(
      (
        { children, onPress, iconLeading: IconLeading, isDisabled, ...props },
        ref
      ) => (
        <button
          disabled={isDisabled}
          ref={ref}
          type="button"
          onClick={onPress}
          {...props}>
          {IconLeading ? <IconLeading /> : null}
          {children}
        </button>
      )
    ),
    ButtonUtility: ({
      icon: Icon,
      onClick,
      ...props
    }: {
      icon?: React.ComponentType<{ className?: string }>;
      onClick?: () => void;
      [key: string]: unknown;
    }) => (
      <button type="button" onClick={onClick} {...props}>
        {Icon ? <Icon /> : null}
      </button>
    ),
    Divider: () => <hr />,
    Dropdown: {
      Root: ({
        children,
        isOpen,
        onOpenChange,
      }: {
        children: React.ReactNode;
        isOpen?: boolean;
        onOpenChange?: (open: boolean) => void;
      }) => {
        const [open, setOpen] = React.useState(!!isOpen);
        React.useEffect(() => {
          setOpen(!!isOpen);
        }, [isOpen]);
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
    Input: ({
      onChange,
      placeholder,
      ...props
    }: {
      onChange?: (value: string) => void;
      placeholder?: string;
      [key: string]: unknown;
    }) => (
      <input
        placeholder={placeholder}
        type="text"
        onChange={(e) => onChange?.(e.target.value)}
        {...props}
      />
    ),
    Label: ({
      children,
      isRequired,
    }: {
      children: React.ReactNode;
      isRequired?: boolean;
    }) => (
      <label>
        {children}
        {isRequired && <span> *</span>}
      </label>
    ),
    Popover: ({
      children,
      containerClassName,
      ...rest
    }: {
      children: React.ReactNode;
      containerClassName?: string;
      [key: string]: unknown;
    }) => (
      <div className={containerClassName} {...rest}>
        {children}
      </div>
    ),
    PopoverTrigger: ({
      children,
      isOpen,
      onOpenChange,
    }: {
      children: React.ReactNode;
      isOpen?: boolean;
      onOpenChange?: (open: boolean) => void;
    }) => {
      const [open, setOpen] = React.useState(!!isOpen);
      React.useEffect(() => {
        setOpen(!!isOpen);
      }, [isOpen]);
      const ch = React.Children.toArray(children);

      return (
        <div data-testid="popover-trigger-root">
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
    TextArea: ({
      onChange,
      value,
      placeholder,
      rows,
      textAreaClassName: _textAreaClassName,
      ...props
    }: {
      onChange?: (value: string) => void;
      value?: string;
      placeholder?: string;
      rows?: number;
      textAreaClassName?: string;
      [key: string]: unknown;
    }) => (
      <textarea
        placeholder={placeholder}
        rows={rows}
        value={value}
        onChange={(e) => onChange?.(e.target.value)}
        {...props}
      />
    ),
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

jest.mock('../../../../rest/incidentManagerAPI', () => ({
  transitionIncident: jest.fn().mockResolvedValue({}),
  getListTestCaseIncidentByStateId: jest.fn().mockResolvedValue({
    data: [
      {
        id: 'new-status-id',
        stateId: 'state-id',
        testCaseResolutionStatusType: TestCaseResolutionStatusTypes.ACK,
      },
    ],
  }),
}));

jest.mock('../../../../rest/tasksAPI', () => ({
  createTask: jest.fn().mockResolvedValue({ id: 'new-task-id' }),
  TaskCategory: { Incident: 'Incident' },
  TaskEntityType: { TestCaseResolution: 'TestCaseResolution' },
  TaskResolutionType: { Completed: 'Completed' },
}));

jest.mock('../../../../rest/miscAPI', () => ({
  getUserAndTeamSearch: jest.fn().mockResolvedValue({
    data: {
      hits: {
        hits: [
          {
            _id: 'user-1',
            _source: {
              name: 'user1',
              displayName: 'User One',
              entityType: 'user',
            },
          },
        ],
      },
    },
  }),
}));

jest.mock('../../../../utils/ToastUtils', () => ({
  showErrorToast: jest.fn(),
}));

import InlineTestCaseIncidentStatus from './InlineTestCaseIncidentStatus.component';

const CHIP_TEST_ID = 'test_case_name-status';

const mockOnSubmit = jest.fn();

const mockData: TestCaseResolutionStatus = {
  id: 'test-id',
  stateId: 'state-id',
  timestamp: 1703830298324,
  testCaseResolutionStatusType: TestCaseResolutionStatusTypes.New,
  updatedAt: 1703830298324,
  testCaseReference: {
    id: 'testcase-id',
    type: 'testCase',
    name: 'test_case_name',
    fullyQualifiedName: 'test.case.name',
  },
};

const renderComponent = (
  overrides: Partial<TestCaseResolutionStatus> = {},
  hasEditPermission = true
) =>
  render(
    <InlineTestCaseIncidentStatus
      data={{ ...mockData, ...overrides }}
      hasEditPermission={hasEditPermission}
      onSubmit={mockOnSubmit}
    />
  );

const openStatusMenu = async () => {
  await act(async () => {
    fireEvent.click(screen.getByTestId(CHIP_TEST_ID));
  });
  await waitFor(() => {
    expect(screen.getByRole('menu')).toBeInTheDocument();
  });
};

describe('InlineTestCaseIncidentStatus', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('chip rendering', () => {
    it('shows New label for New status', () => {
      renderComponent();

      expect(screen.getByTestId(CHIP_TEST_ID)).toHaveTextContent('label.new');
    });

    it('shows ACK label for ACK status', () => {
      renderComponent({
        testCaseResolutionStatusType: TestCaseResolutionStatusTypes.ACK,
      });

      expect(screen.getByTestId(CHIP_TEST_ID)).toHaveTextContent('label.ack');
    });

    it('shows Assigned label for Assigned status', () => {
      renderComponent({
        testCaseResolutionStatusType: TestCaseResolutionStatusTypes.Assigned,
      });

      expect(screen.getByTestId(CHIP_TEST_ID)).toHaveTextContent(
        'label.assigned'
      );
    });

    it('shows Resolved label for Resolved status', () => {
      renderComponent({
        testCaseResolutionStatusType: TestCaseResolutionStatusTypes.Resolved,
      });

      expect(screen.getByTestId(CHIP_TEST_ID)).toHaveTextContent(
        'label.resolved'
      );
    });

    it('chip is disabled without edit permission', () => {
      renderComponent({}, false);

      expect(screen.getByTestId(CHIP_TEST_ID)).toBeDisabled();
    });

    it('chip is enabled with edit permission', () => {
      renderComponent();

      expect(screen.getByTestId(CHIP_TEST_ID)).not.toBeDisabled();
    });

    it('does not open menu when chip clicked without edit permission', async () => {
      renderComponent({}, false);

      fireEvent.click(screen.getByTestId(CHIP_TEST_ID));

      expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    });
  });

  describe('status menu', () => {
    it('opens status menu when New chip is clicked', async () => {
      renderComponent();

      await openStatusMenu();

      expect(screen.getByRole('menu')).toBeInTheDocument();
    });

    it('opens status menu when ACK chip is clicked', async () => {
      renderComponent({
        testCaseResolutionStatusType: TestCaseResolutionStatusTypes.ACK,
      });

      await openStatusMenu();

      expect(screen.getByRole('menu')).toBeInTheDocument();
    });

    it('status menu shows all status options', async () => {
      renderComponent();

      await openStatusMenu();

      expect(screen.getAllByRole('menuitem')).toHaveLength(
        Object.values(TestCaseResolutionStatusTypes).length
      );
    });

    it('selecting ACK submits directly via API', async () => {
      renderComponent();

      await openStatusMenu();

      await act(async () => {
        fireEvent.click(screen.getByText('label.ack'));
      });

      await waitFor(() => {
        expect(transitionIncident).toHaveBeenCalledWith(
          mockData.stateId,
          expect.objectContaining({ transitionId: 'ack' })
        );
      });
    });

    it('selecting Assigned from menu opens assignee popover', async () => {
      renderComponent();

      await openStatusMenu();

      await act(async () => {
        fireEvent.click(screen.getByText('label.assigned'));
      });

      await waitFor(() => {
        expect(
          screen.getByTestId('test_case_name-assignee-popover')
        ).toBeInTheDocument();
      });
    });

    it('selecting Resolved from menu opens resolved popover', async () => {
      renderComponent();

      await openStatusMenu();

      await act(async () => {
        fireEvent.click(screen.getByText('label.resolved'));
      });

      await waitFor(() => {
        expect(
          screen.getByTestId('test_case_name-resolved-popover')
        ).toBeInTheDocument();
      });
    });
  });

  describe('assignee popover', () => {
    it('opens assignee popover directly when Assigned chip is clicked', async () => {
      renderComponent({
        testCaseResolutionStatusType: TestCaseResolutionStatusTypes.Assigned,
      });

      await act(async () => {
        fireEvent.click(screen.getByTestId(CHIP_TEST_ID));
      });

      await waitFor(() => {
        expect(
          screen.getByTestId('test_case_name-assignee-popover')
        ).toBeInTheDocument();
      });
    });

    it('calls getUserAndTeamSearch on assignee popover open', async () => {
      renderComponent({
        testCaseResolutionStatusType: TestCaseResolutionStatusTypes.Assigned,
      });

      await act(async () => {
        fireEvent.click(screen.getByTestId(CHIP_TEST_ID));
      });

      await waitFor(() => {
        expect(getUserAndTeamSearch).toHaveBeenCalledWith(
          '',
          true,
          expect.any(Number)
        );
      });
    });

    it('renders user results in assignee popover', async () => {
      renderComponent({
        testCaseResolutionStatusType: TestCaseResolutionStatusTypes.Assigned,
      });

      await act(async () => {
        fireEvent.click(screen.getByTestId(CHIP_TEST_ID));
      });

      await waitFor(() => {
        expect(screen.getByTestId('user1')).toBeInTheDocument();
      });
    });

    it('calls getUserAndTeamSearch with query when typing in search', async () => {
      renderComponent({
        testCaseResolutionStatusType: TestCaseResolutionStatusTypes.Assigned,
      });

      await act(async () => {
        fireEvent.click(screen.getByTestId(CHIP_TEST_ID));
      });

      await waitFor(() => {
        expect(screen.getByTestId('assignee-search-input')).toBeInTheDocument();
      });

      await act(async () => {
        fireEvent.change(screen.getByTestId('assignee-search-input'), {
          target: { value: 'user' },
        });
      });

      await waitFor(() => {
        expect(getUserAndTeamSearch).toHaveBeenCalledWith(
          'user',
          true,
          expect.any(Number)
        );
      });
    });

    it('submit button is disabled before user is selected', async () => {
      renderComponent({
        testCaseResolutionStatusType: TestCaseResolutionStatusTypes.Assigned,
      });

      await act(async () => {
        fireEvent.click(screen.getByTestId(CHIP_TEST_ID));
      });

      await waitFor(() => {
        expect(
          screen.getByTestId('submit-assignee-popover-button')
        ).toBeDisabled();
      });
    });

    it('submit button is enabled after user is selected', async () => {
      renderComponent({
        testCaseResolutionStatusType: TestCaseResolutionStatusTypes.Assigned,
      });

      await act(async () => {
        fireEvent.click(screen.getByTestId(CHIP_TEST_ID));
      });

      await waitFor(() => {
        expect(screen.getByTestId('user1')).toBeInTheDocument();
      });

      await act(async () => {
        fireEvent.click(screen.getByTestId('user1'));
      });

      expect(
        screen.getByTestId('submit-assignee-popover-button')
      ).not.toBeDisabled();
    });

    it('submits with selected assignee and calls onSubmit', async () => {
      renderComponent({
        testCaseResolutionStatusType: TestCaseResolutionStatusTypes.Assigned,
      });

      await act(async () => {
        fireEvent.click(screen.getByTestId(CHIP_TEST_ID));
      });

      await waitFor(() => {
        expect(screen.getByTestId('user1')).toBeInTheDocument();
      });

      await act(async () => {
        fireEvent.click(screen.getByTestId('user1'));
      });

      await act(async () => {
        fireEvent.click(screen.getByTestId('submit-assignee-popover-button'));
      });

      await waitFor(() => {
        // Current status is Assigned, so re-assigning uses 'reassign' transition
        expect(transitionIncident).toHaveBeenCalledWith(
          mockData.stateId,
          expect.objectContaining({
            transitionId: 'reassign',
            payload: expect.objectContaining({
              assignees: expect.arrayContaining([
                expect.objectContaining({ name: 'user1' }),
              ]),
            }),
          })
        );
        expect(mockOnSubmit).toHaveBeenCalled();
      });
    });

    it('cancel button closes the assignee popover', async () => {
      renderComponent({
        testCaseResolutionStatusType: TestCaseResolutionStatusTypes.Assigned,
      });

      await act(async () => {
        fireEvent.click(screen.getByTestId(CHIP_TEST_ID));
      });

      await waitFor(() => {
        expect(
          screen.getByTestId('test_case_name-assignee-popover')
        ).toBeInTheDocument();
      });

      await act(async () => {
        fireEvent.click(screen.getByTestId('cancel-assignee-popover-button'));
      });

      await waitFor(() => {
        expect(
          screen.queryByTestId('test_case_name-assignee-popover')
        ).not.toBeInTheDocument();
      });
    });

    it('back button in assignee popover returns to status menu', async () => {
      renderComponent();

      await openStatusMenu();

      await act(async () => {
        fireEvent.click(screen.getByText('label.assigned'));
      });

      await waitFor(() => {
        expect(
          screen.getByTestId('test_case_name-assignee-popover')
        ).toBeInTheDocument();
      });

      const backButton = screen
        .getByTestId('icon-arrow-left')
        .closest('button');

      await act(async () => {
        fireEvent.click(backButton!);
      });

      await waitFor(() => {
        expect(screen.getByRole('menu')).toBeInTheDocument();
      });
    });
  });

  describe('resolved popover', () => {
    it('opens resolved popover directly when Resolved chip is clicked', async () => {
      renderComponent({
        testCaseResolutionStatusType: TestCaseResolutionStatusTypes.Resolved,
      });

      await act(async () => {
        fireEvent.click(screen.getByTestId(CHIP_TEST_ID));
      });

      await waitFor(() => {
        expect(
          screen.getByTestId('test_case_name-resolved-popover')
        ).toBeInTheDocument();
      });
    });

    it('shows failure reason chips in resolved popover', async () => {
      renderComponent({
        testCaseResolutionStatusType: TestCaseResolutionStatusTypes.Resolved,
      });

      await act(async () => {
        fireEvent.click(screen.getByTestId(CHIP_TEST_ID));
      });

      await waitFor(() => {
        Object.values(TestCaseFailureReasonType).forEach((reason) => {
          expect(
            screen.getByTestId(`reason-chip-${reason}`)
          ).toBeInTheDocument();
        });
      });
    });

    it('shows comment textarea in resolved popover', async () => {
      renderComponent({
        testCaseResolutionStatusType: TestCaseResolutionStatusTypes.Resolved,
      });

      await act(async () => {
        fireEvent.click(screen.getByTestId(CHIP_TEST_ID));
      });

      await waitFor(() => {
        expect(
          screen.getByTestId('resolved-comment-textarea')
        ).toBeInTheDocument();
      });
    });

    it('submit is disabled without reason or comment', async () => {
      renderComponent({
        testCaseResolutionStatusType: TestCaseResolutionStatusTypes.Resolved,
      });

      await act(async () => {
        fireEvent.click(screen.getByTestId(CHIP_TEST_ID));
      });

      await waitFor(() => {
        expect(
          screen.getByTestId('submit-resolved-popover-button')
        ).toBeDisabled();
      });
    });

    it('submit is disabled with reason but no comment', async () => {
      renderComponent({
        testCaseResolutionStatusType: TestCaseResolutionStatusTypes.Resolved,
      });

      await act(async () => {
        fireEvent.click(screen.getByTestId(CHIP_TEST_ID));
      });

      await waitFor(() => {
        expect(
          screen.getByTestId(
            `reason-chip-${TestCaseFailureReasonType.FalsePositive}`
          )
        ).toBeInTheDocument();
      });

      fireEvent.click(
        screen.getByTestId(
          `reason-chip-${TestCaseFailureReasonType.FalsePositive}`
        )
      );

      expect(
        screen.getByTestId('submit-resolved-popover-button')
      ).toBeDisabled();
    });

    it('submit is enabled with both reason and comment', async () => {
      renderComponent({
        testCaseResolutionStatusType: TestCaseResolutionStatusTypes.Resolved,
      });

      await act(async () => {
        fireEvent.click(screen.getByTestId(CHIP_TEST_ID));
      });

      await waitFor(() => {
        expect(
          screen.getByTestId(
            `reason-chip-${TestCaseFailureReasonType.FalsePositive}`
          )
        ).toBeInTheDocument();
      });

      fireEvent.click(
        screen.getByTestId(
          `reason-chip-${TestCaseFailureReasonType.FalsePositive}`
        )
      );

      fireEvent.change(screen.getByTestId('resolved-comment-textarea'), {
        target: { value: 'Test comment' },
      });

      expect(
        screen.getByTestId('submit-resolved-popover-button')
      ).not.toBeDisabled();
    });

    it('submits with selected reason and comment and calls onSubmit', async () => {
      renderComponent({
        testCaseResolutionStatusType: TestCaseResolutionStatusTypes.Resolved,
      });

      await act(async () => {
        fireEvent.click(screen.getByTestId(CHIP_TEST_ID));
      });

      await waitFor(() => {
        expect(
          screen.getByTestId(
            `reason-chip-${TestCaseFailureReasonType.FalsePositive}`
          )
        ).toBeInTheDocument();
      });

      fireEvent.click(
        screen.getByTestId(
          `reason-chip-${TestCaseFailureReasonType.FalsePositive}`
        )
      );

      fireEvent.change(screen.getByTestId('resolved-comment-textarea'), {
        target: { value: 'Test comment' },
      });

      await act(async () => {
        fireEvent.click(screen.getByTestId('submit-resolved-popover-button'));
      });

      await waitFor(() => {
        // Current status is Resolved, so submitStatusChange routes to
        // reopenIncident which creates a new task instead of calling
        // transitionIncident with 'resolve'.
        expect(createTask).toHaveBeenCalledWith(
          expect.objectContaining({
            about: mockData.testCaseReference?.fullyQualifiedName,
          })
        );

        expect(mockOnSubmit).toHaveBeenCalled();
      });
    });

    it('cancel button closes the resolved popover', async () => {
      renderComponent({
        testCaseResolutionStatusType: TestCaseResolutionStatusTypes.Resolved,
      });

      await act(async () => {
        fireEvent.click(screen.getByTestId(CHIP_TEST_ID));
      });

      await waitFor(() => {
        expect(
          screen.getByTestId('test_case_name-resolved-popover')
        ).toBeInTheDocument();
      });

      await act(async () => {
        fireEvent.click(screen.getByTestId('cancel-resolved-popover-button'));
      });

      await waitFor(() => {
        expect(
          screen.queryByTestId('test_case_name-resolved-popover')
        ).not.toBeInTheDocument();
      });
    });

    it('back button in resolved popover returns to status menu', async () => {
      renderComponent();

      await openStatusMenu();

      await act(async () => {
        fireEvent.click(screen.getByText('label.resolved'));
      });

      await waitFor(() => {
        expect(
          screen.getByTestId('test_case_name-resolved-popover')
        ).toBeInTheDocument();
      });

      const backButton = screen
        .getByTestId('icon-arrow-left')
        .closest('button');

      await act(async () => {
        fireEvent.click(backButton!);
      });

      await waitFor(() => {
        expect(screen.getByRole('menu')).toBeInTheDocument();
      });
    });
  });

  describe('API interactions', () => {
    it('calls onSubmit after successful API call', async () => {
      renderComponent();

      await openStatusMenu();

      await act(async () => {
        fireEvent.click(screen.getByText('label.ack'));
      });

      await waitFor(() => {
        expect(mockOnSubmit).toHaveBeenCalledTimes(1);
      });
    });

    it('shows error toast when API call fails', async () => {
      (transitionIncident as jest.Mock).mockRejectedValueOnce(
        new Error('API Error')
      );

      renderComponent();

      await openStatusMenu();

      await act(async () => {
        fireEvent.click(screen.getByText('label.ack'));
      });

      await waitFor(() => {
        expect(showErrorToast).toHaveBeenCalled();
        expect(mockOnSubmit).not.toHaveBeenCalled();
      });
    });
  });
});
