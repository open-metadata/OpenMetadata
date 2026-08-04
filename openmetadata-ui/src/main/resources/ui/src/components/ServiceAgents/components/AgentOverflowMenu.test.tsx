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

import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { FC, ReactNode } from 'react';
import { AgentActionPermissions, AgentStatus } from '../AgentsPage.interface';
import AgentOverflowMenu from './AgentOverflowMenu.component';

const MORE_ACTIONS = 'more-actions';
const PAUSE_BUTTON = 'pause-button';
const RE_DEPLOY_BUTTON = 're-deploy-button';
const EDIT_BUTTON = 'edit-button';
const DELETE_BUTTON = 'delete-button';
const RESUME_BUTTON = 'resume-button';
const KILL_BUTTON = 'kill-button';
const OPEN_DROPDOWN = 'open-dropdown';
const DROPDOWN_ROOT = 'dropdown-root';

// react-aria fires the menu's `onAction` and then closes the trigger within the
// same press, so the mocked item replicates that ordering.
const mockMenuAction: { current?: (key: string) => void } = {};
const mockOpenChange: { current?: (open: boolean) => void } = {};

jest.mock('@openmetadata/ui-core-components', () => ({
  Dropdown: {
    Root: ({
      children,
      isOpen,
      onOpenChange,
    }: {
      children: ReactNode;
      isOpen?: boolean;
      onOpenChange?: (open: boolean) => void;
    }) => {
      mockOpenChange.current = onOpenChange;

      return (
        <div data-open={String(Boolean(isOpen))} data-testid="dropdown-root">
          <button
            aria-label="open-dropdown"
            data-testid="open-dropdown"
            onClick={() => onOpenChange?.(true)}
          />
          {children}
        </div>
      );
    },
    Popover: ({
      children,
      ...props
    }: {
      children: ReactNode;
      'data-testid'?: string;
    }) => <div data-testid={props['data-testid']}>{children}</div>,
    Menu: ({
      children,
      onAction,
    }: {
      children: ReactNode;
      onAction?: (key: string) => void;
    }) => {
      mockMenuAction.current = onAction;

      return <div>{children}</div>;
    },
    Item: ({
      children,
      icon: Icon,
      id,
      isDisabled,
      ...props
    }: {
      children: ReactNode;
      icon?: FC;
      id?: string;
      isDisabled?: boolean;
      'data-testid'?: string;
    }) => (
      <button
        data-testid={props['data-testid']}
        disabled={isDisabled}
        onClick={() => {
          mockMenuAction.current?.(id ?? '');
          mockOpenChange.current?.(false);
        }}>
        {Icon && <Icon />}
        {children}
      </button>
    ),
  },
}));

const mockOnAction = jest.fn();

const FULL_PERMISSIONS: AgentActionPermissions = {
  trigger: true,
  edit: true,
  delete: true,
};

const renderMenu = (
  status: AgentStatus,
  permissions?: AgentActionPermissions,
  allowedActions?: string[],
  enabled?: boolean
) =>
  render(
    <AgentOverflowMenu
      allowedActions={allowedActions}
      enabled={enabled}
      permissions={permissions}
      status={status}
      onAction={mockOnAction}
    />
  );

describe('AgentOverflowMenu', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render pause, redeploy, edit and delete for an enabled inactive agent', () => {
    renderMenu('success', FULL_PERMISSIONS, undefined, true);

    expect(screen.getByTestId(MORE_ACTIONS)).toBeInTheDocument();
    expect(screen.getByTestId(PAUSE_BUTTON)).toBeInTheDocument();
    expect(screen.getByTestId(RE_DEPLOY_BUTTON)).toBeInTheDocument();
    expect(screen.getByTestId(EDIT_BUTTON)).toBeInTheDocument();
    expect(screen.getByTestId(DELETE_BUTTON)).toBeInTheDocument();
    expect(screen.queryByTestId(RESUME_BUTTON)).not.toBeInTheDocument();
    expect(screen.queryByTestId(KILL_BUTTON)).not.toBeInTheDocument();
  });

  it('should render resume instead of pause for a disabled agent', () => {
    renderMenu('success', FULL_PERMISSIONS, undefined, false);

    expect(screen.getByTestId(RESUME_BUTTON)).toBeInTheDocument();
    expect(screen.queryByTestId(PAUSE_BUTTON)).not.toBeInTheDocument();
    expect(screen.getByTestId(RE_DEPLOY_BUTTON)).toBeInTheDocument();
  });

  it('should render pause when the enabled flag is absent, since it defaults to true', () => {
    renderMenu('success', FULL_PERMISSIONS);

    expect(screen.getByTestId(PAUSE_BUTTON)).toBeInTheDocument();
    expect(screen.queryByTestId(RESUME_BUTTON)).not.toBeInTheDocument();
  });

  it('should render pause, kill, edit and delete for an enabled active agent', () => {
    renderMenu('running', FULL_PERMISSIONS, undefined, true);

    expect(screen.getByTestId(PAUSE_BUTTON)).toBeInTheDocument();
    expect(screen.getByTestId(KILL_BUTTON)).toBeInTheDocument();
    expect(screen.getByTestId(EDIT_BUTTON)).toBeInTheDocument();
    expect(screen.getByTestId(DELETE_BUTTON)).toBeInTheDocument();
    expect(screen.queryByTestId(RE_DEPLOY_BUTTON)).not.toBeInTheDocument();
  });

  it('should render resume and kill for a disabled active agent', () => {
    renderMenu('queued', FULL_PERMISSIONS, undefined, false);

    expect(screen.getByTestId(RESUME_BUTTON)).toBeInTheDocument();
    expect(screen.getByTestId(KILL_BUTTON)).toBeInTheDocument();
    expect(screen.queryByTestId(RE_DEPLOY_BUTTON)).not.toBeInTheDocument();
  });

  it('should never render a run action, which lives on the agent card', () => {
    renderMenu('success', FULL_PERMISSIONS, undefined, true);

    expect(screen.queryByTestId('run-button')).not.toBeInTheDocument();
  });

  it('should render nothing when the user only has trigger permission', () => {
    renderMenu(
      'success',
      { trigger: true, edit: false, delete: false },
      [],
      true
    );

    expect(screen.queryByTestId(MORE_ACTIONS)).not.toBeInTheDocument();
  });

  it('should keep pause, redeploy and edit for edit-only permission', () => {
    renderMenu(
      'success',
      { trigger: false, edit: true, delete: false },
      undefined,
      true
    );

    expect(screen.getByTestId(PAUSE_BUTTON)).toBeInTheDocument();
    expect(screen.getByTestId(RE_DEPLOY_BUTTON)).toBeInTheDocument();
    expect(screen.getByTestId(EDIT_BUTTON)).toBeInTheDocument();
    expect(screen.queryByTestId(DELETE_BUTTON)).not.toBeInTheDocument();
  });

  it('should only keep delete for delete-only permission', () => {
    renderMenu(
      'success',
      { trigger: false, edit: false, delete: true },
      undefined,
      true
    );

    expect(screen.getByTestId(DELETE_BUTTON)).toBeInTheDocument();
    expect(screen.queryByTestId(PAUSE_BUTTON)).not.toBeInTheDocument();
    expect(screen.queryByTestId(RE_DEPLOY_BUTTON)).not.toBeInTheDocument();
    expect(screen.queryByTestId(EDIT_BUTTON)).not.toBeInTheDocument();
  });

  it('should gate pause, resume and kill behind edit permission', () => {
    renderMenu(
      'running',
      { trigger: true, edit: false, delete: true },
      undefined,
      true
    );

    expect(screen.queryByTestId(PAUSE_BUTTON)).not.toBeInTheDocument();
    expect(screen.queryByTestId(RESUME_BUTTON)).not.toBeInTheDocument();
    expect(screen.queryByTestId(KILL_BUTTON)).not.toBeInTheDocument();
    expect(screen.queryByTestId(EDIT_BUTTON)).not.toBeInTheDocument();
    expect(screen.getByTestId(DELETE_BUTTON)).toBeInTheDocument();
  });

  it('should render nothing when the user has no permissions', () => {
    renderMenu('success', { trigger: false, edit: false, delete: false });

    expect(screen.queryByTestId(MORE_ACTIONS)).not.toBeInTheDocument();
  });

  it('should render nothing while permissions are unresolved', () => {
    renderMenu('success');

    expect(screen.queryByTestId(MORE_ACTIONS)).not.toBeInTheDocument();
  });

  it('should only render whitelisted actions when allowedActions is provided', () => {
    renderMenu('success', FULL_PERMISSIONS, ['pause', 'edit'], true);

    expect(screen.getByTestId(PAUSE_BUTTON)).toBeInTheDocument();
    expect(screen.getByTestId(EDIT_BUTTON)).toBeInTheDocument();
    expect(screen.queryByTestId(RE_DEPLOY_BUTTON)).not.toBeInTheDocument();
    expect(screen.queryByTestId(DELETE_BUTTON)).not.toBeInTheDocument();
  });

  it('should whitelist resume separately from pause for a disabled agent', () => {
    renderMenu('success', FULL_PERMISSIONS, ['resume', 'edit'], false);

    expect(screen.getByTestId(RESUME_BUTTON)).toBeInTheDocument();
    expect(screen.getByTestId(EDIT_BUTTON)).toBeInTheDocument();
    expect(screen.queryByTestId(DELETE_BUTTON)).not.toBeInTheDocument();
  });

  it('should hide the pause item when only resume is whitelisted', () => {
    renderMenu('success', FULL_PERMISSIONS, ['resume', 'edit'], true);

    expect(screen.queryByTestId(PAUSE_BUTTON)).not.toBeInTheDocument();
    expect(screen.getByTestId(EDIT_BUTTON)).toBeInTheDocument();
  });

  it('should apply allowedActions to active-state items too', () => {
    renderMenu('running', FULL_PERMISSIONS, ['kill', 'edit'], true);

    expect(screen.getByTestId(KILL_BUTTON)).toBeInTheDocument();
    expect(screen.getByTestId(EDIT_BUTTON)).toBeInTheDocument();
    expect(screen.queryByTestId(PAUSE_BUTTON)).not.toBeInTheDocument();
    expect(screen.queryByTestId(DELETE_BUTTON)).not.toBeInTheDocument();
  });

  it('should still gate whitelisted actions behind permissions', () => {
    renderMenu(
      'success',
      { trigger: false, edit: true, delete: false },
      ['pause', 'delete'],
      true
    );

    expect(screen.getByTestId(PAUSE_BUTTON)).toBeInTheDocument();
    expect(screen.queryByTestId(DELETE_BUTTON)).not.toBeInTheDocument();
  });

  it('should keep the menu open with a loader while an async action is pending', async () => {
    let resolveAction: () => void = () => undefined;
    mockOnAction.mockReturnValue(
      new Promise<void>((resolve) => {
        resolveAction = resolve;
      })
    );
    renderMenu('success', FULL_PERMISSIONS, undefined, true);

    fireEvent.click(screen.getByTestId(OPEN_DROPDOWN));
    fireEvent.click(screen.getByTestId(RE_DEPLOY_BUTTON));

    expect(mockOnAction).toHaveBeenCalledWith('redeploy');
    expect(screen.getByTestId(DROPDOWN_ROOT)).toHaveAttribute(
      'data-open',
      'true'
    );
    expect(
      within(screen.getByTestId(RE_DEPLOY_BUTTON)).getByTestId('loader')
    ).toBeInTheDocument();
    expect(screen.getByTestId(PAUSE_BUTTON)).toBeDisabled();
    expect(screen.getByTestId(DELETE_BUTTON)).toBeDisabled();

    await act(async () => {
      resolveAction();
    });

    expect(screen.queryByTestId('loader')).not.toBeInTheDocument();
    expect(screen.getByTestId(DROPDOWN_ROOT)).toHaveAttribute(
      'data-open',
      'false'
    );
    expect(screen.getByTestId(PAUSE_BUTTON)).not.toBeDisabled();
  });

  it('should close the menu without a loader for a synchronous action', () => {
    mockOnAction.mockReturnValue(undefined);
    renderMenu('success', FULL_PERMISSIONS, undefined, true);

    fireEvent.click(screen.getByTestId(OPEN_DROPDOWN));
    fireEvent.click(screen.getByTestId(EDIT_BUTTON));

    expect(mockOnAction).toHaveBeenCalledWith('edit');
    expect(screen.getByTestId(DROPDOWN_ROOT)).toHaveAttribute(
      'data-open',
      'false'
    );
    expect(screen.queryByTestId('loader')).not.toBeInTheDocument();
    expect(screen.getByTestId(PAUSE_BUTTON)).not.toBeDisabled();
  });

  it('should close the menu and clear the loader when an async action rejects', async () => {
    let rejectAction: () => void = () => undefined;
    mockOnAction.mockReturnValue(
      new Promise<void>((_, reject) => {
        rejectAction = () => reject(new Error('failed'));
      })
    );
    renderMenu('running', FULL_PERMISSIONS, undefined, true);

    fireEvent.click(screen.getByTestId(OPEN_DROPDOWN));
    fireEvent.click(screen.getByTestId(KILL_BUTTON));

    expect(
      within(screen.getByTestId(KILL_BUTTON)).getByTestId('loader')
    ).toBeInTheDocument();

    await act(async () => {
      rejectAction();
    });

    expect(screen.queryByTestId('loader')).not.toBeInTheDocument();
    expect(screen.getByTestId(DROPDOWN_ROOT)).toHaveAttribute(
      'data-open',
      'false'
    );
  });
});
