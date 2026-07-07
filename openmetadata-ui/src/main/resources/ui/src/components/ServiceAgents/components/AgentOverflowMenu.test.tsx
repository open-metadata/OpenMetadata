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

import { render, screen } from '@testing-library/react';
import { ReactNode } from 'react';
import { AgentActionPermissions, AgentStatus } from '../AgentsPage.interface';
import AgentOverflowMenu from './AgentOverflowMenu.component';

jest.mock('@openmetadata/ui-core-components', () => ({
  Dropdown: {
    Root: ({ children }: { children: ReactNode }) => <div>{children}</div>,
    Popover: ({
      children,
      ...props
    }: {
      children: ReactNode;
      'data-testid'?: string;
    }) => <div data-testid={props['data-testid']}>{children}</div>,
    Menu: ({ children }: { children: ReactNode }) => <div>{children}</div>,
    Item: ({
      children,
      ...props
    }: {
      children: ReactNode;
      'data-testid'?: string;
    }) => <button data-testid={props['data-testid']}>{children}</button>,
  },
}));

const mockOnAction = jest.fn();

const renderMenu = (
  status: AgentStatus,
  permissions?: AgentActionPermissions
) =>
  render(
    <AgentOverflowMenu
      permissions={permissions}
      status={status}
      onAction={mockOnAction}
    />
  );

describe('AgentOverflowMenu', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render run, redeploy, edit and delete for an inactive agent', () => {
    renderMenu('success');

    expect(screen.getByTestId('more-actions')).toBeInTheDocument();
    expect(screen.getByTestId('run-button')).toBeInTheDocument();
    expect(screen.getByTestId('re-deploy-button')).toBeInTheDocument();
    expect(screen.getByTestId('edit-button')).toBeInTheDocument();
    expect(screen.getByTestId('delete-button')).toBeInTheDocument();
  });

  it('should render pause, kill, edit and delete for an active agent', () => {
    renderMenu('running');

    expect(screen.getByTestId('pause-button')).toBeInTheDocument();
    expect(screen.getByTestId('kill-button')).toBeInTheDocument();
    expect(screen.getByTestId('edit-button')).toBeInTheDocument();
    expect(screen.getByTestId('delete-button')).toBeInTheDocument();
    expect(screen.queryByTestId('run-button')).not.toBeInTheDocument();
  });

  it('should only render run when the user has trigger permission alone', () => {
    renderMenu('success', { trigger: true, edit: false, delete: false });

    expect(screen.getByTestId('run-button')).toBeInTheDocument();
    expect(screen.queryByTestId('re-deploy-button')).not.toBeInTheDocument();
    expect(screen.queryByTestId('edit-button')).not.toBeInTheDocument();
    expect(screen.queryByTestId('delete-button')).not.toBeInTheDocument();
  });

  it('should hide run but keep edit actions for edit-only permission', () => {
    renderMenu('success', { trigger: false, edit: true, delete: false });

    expect(screen.queryByTestId('run-button')).not.toBeInTheDocument();
    expect(screen.getByTestId('re-deploy-button')).toBeInTheDocument();
    expect(screen.getByTestId('edit-button')).toBeInTheDocument();
    expect(screen.queryByTestId('delete-button')).not.toBeInTheDocument();
  });

  it('should gate pause and kill behind edit permission for an active agent', () => {
    renderMenu('running', { trigger: true, edit: false, delete: false });

    expect(screen.queryByTestId('pause-button')).not.toBeInTheDocument();
    expect(screen.queryByTestId('kill-button')).not.toBeInTheDocument();
    expect(screen.queryByTestId('edit-button')).not.toBeInTheDocument();
  });

  it('should render nothing when the user has no permissions', () => {
    renderMenu('success', { trigger: false, edit: false, delete: false });

    expect(screen.queryByTestId('more-actions')).not.toBeInTheDocument();
  });
});
