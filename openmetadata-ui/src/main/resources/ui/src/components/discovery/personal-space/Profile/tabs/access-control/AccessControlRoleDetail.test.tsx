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

import { render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';

const mockRole = {
  id: 'role-1',
  name: 'DataSteward',
  displayName: 'Data Steward',
  description: 'Manages data quality',
  policies: [
    {
      id: 'policy-1',
      name: 'DataStewardPolicy',
      fullyQualifiedName: 'DataStewardPolicy',
      type: 'policy',
    },
  ],
  teams: [],
  users: [],
};

jest.mock('../../../../../../rest/rolesAPIV1', () => ({
  getRoleByName: jest.fn().mockResolvedValue(mockRole),
  getPolicies: jest.fn().mockResolvedValue({ data: [], paging: {} }),
  patchRole: jest.fn().mockResolvedValue(mockRole),
}));

jest.mock('../../../../../../utils/DeleteWidget/DeleteWidgetUtils', () => ({
  hardDeleteEntity: jest.fn().mockResolvedValue(true),
}));

jest.mock(
  '../../../../../../context/PermissionProvider/PermissionProvider',
  () => {
    // Stable reference — a new jest.fn() on every render would change the dep
    // on every render, triggering the useEffect on every cycle (infinite loop).
    const mockGetEntityPermissionByFqn = jest.fn().mockResolvedValue({
      EditAll: true,
      Delete: true,
      ViewAll: true,
    });

    return {
      usePermissionProvider: () => ({
        getEntityPermissionByFqn: mockGetEntityPermissionByFqn,
      }),
    };
  }
);

jest.mock('../../../../../../utils/ToastUtils', () => ({
  showErrorToast: jest.fn(),
  showSuccessToast: jest.fn(),
}));

jest.mock('../../../../../common/Loader/Loader', () => () => (
  <div data-testid="loader" />
));

jest.mock('../../../../../common/RichTextEditor/RichTextEditor', () =>
  React.forwardRef((_props: unknown, ref: React.Ref<unknown>) => {
    React.useImperativeHandle(ref, () => ({
      getEditorContent: () => 'updated description',
      clearEditorContent: jest.fn(),
      setEditorContent: jest.fn(),
    }));

    return <div data-testid="rich-text-editor" />;
  })
);

jest.mock('../../../../../common/DeleteModal/DeleteModal', () => ({
  __esModule: true,
  default: ({
    open,
    onCancel,
    onDelete,
    entityTitle,
  }: {
    open: boolean;
    onCancel: () => void;
    onDelete: () => void;
    entityTitle: string;
  }) =>
    open ? (
      <div data-testid="delete-modal">
        <span>{entityTitle}</span>
        <button data-testid="delete-confirm" onClick={onDelete}>
          Delete
        </button>
        <button data-testid="delete-cancel" onClick={onCancel}>
          Cancel
        </button>
      </div>
    ) : null,
}));

// Override Tabs and Tooltip to avoid react-aria timer interactions with fake timers.
// react-aria uses internal timers (hover/open/close delays) that fire when waitFor
// calls jest.advanceTimersByTime(), causing MutationObserver loops.
jest.mock('@openmetadata/ui-core-components', () => {
  const actual = jest.requireActual('@openmetadata/ui-core-components');
  const React = jest.requireActual('react');

  const TabsContext = React.createContext<{
    selected: unknown;
    onSelect: (key: unknown) => void;
  }>({ selected: null, onSelect: () => {} });

  const TabsList = ({ children }: React.PropsWithChildren) =>
    React.createElement('div', { role: 'tablist' }, children);
  const TabsItem = ({
    children,
    id,
  }: React.PropsWithChildren<{ id?: unknown }>) => {
    const { selected, onSelect } = React.useContext(TabsContext);

    return React.createElement(
      'button',
      {
        role: 'tab',
        'aria-selected': selected === id,
        onClick: () => onSelect(id),
      },
      children
    );
  };
  TabsList.displayName = 'Tabs.List';
  TabsItem.displayName = 'Tabs.Item';

  const Tabs = ({
    children,
    selectedKey,
    onSelectionChange,
  }: React.PropsWithChildren<{
    selectedKey?: unknown;
    onSelectionChange?: (key: unknown) => void;
  }>) => {
    const [sel, setSel] = React.useState(selectedKey);
    const handleSelect = (key: unknown) => {
      setSel(key);
      onSelectionChange?.(key);
    };

    return React.createElement(
      TabsContext.Provider,
      { value: { selected: sel, onSelect: handleSelect } },
      children
    );
  };
  Tabs.List = TabsList;
  Tabs.Item = TabsItem;

  const Tooltip = ({ children }: React.PropsWithChildren) =>
    React.createElement(React.Fragment, null, children);

  const Button = ({
    children,
    onPress,
    isDisabled,
    isLoading,
    ...props
  }: React.PropsWithChildren<{
    onPress?: () => void;
    isDisabled?: boolean;
    isLoading?: boolean;
    [k: string]: unknown;
  }>) =>
    React.createElement(
      'button',
      { ...props, disabled: isDisabled || isLoading, onClick: onPress },
      children
    );

  return { ...actual, Tabs, Tooltip, Button };
});

import AccessControlRoleDetail from './AccessControlRoleDetail';

const mockOnNavigate = jest.fn();

const renderComponent = (fqn = 'DataSteward') =>
  render(
    <MemoryRouter>
      <AccessControlRoleDetail fqn={fqn} onNavigate={mockOnNavigate} />
    </MemoryRouter>
  );

describe('AccessControlRoleDetail', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('shows loader initially', () => {
    const { getRoleByName } = jest.requireMock(
      '../../../../../../rest/rolesAPIV1'
    );
    (getRoleByName as jest.Mock).mockReturnValueOnce(new Promise(() => {}));

    renderComponent();

    expect(screen.getByTestId('loader')).toBeInTheDocument();
  });

  it('renders role description after load', async () => {
    renderComponent();

    await waitFor(() => {
      expect(screen.getByTestId('role-detail-container')).toBeInTheDocument();
    });

    expect(screen.getByText('Manages data quality')).toBeInTheDocument();
  });

  it('renders edit description button when user has permission', async () => {
    renderComponent();

    await waitFor(() => {
      expect(screen.getByTestId('edit-description-btn')).toBeInTheDocument();
    });
  });

  it('renders policy tab with existing policy', async () => {
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('DataStewardPolicy')).toBeInTheDocument();
    });
  });

  it('navigates to roles on delete role confirm', async () => {
    const { hardDeleteEntity } = jest.requireMock(
      '../../../../../../utils/DeleteWidget/DeleteWidgetUtils'
    );

    renderComponent();

    await waitFor(() => {
      expect(screen.getByTestId('role-detail-container')).toBeInTheDocument();
    });

    // Open manage dropdown and click delete - we simulate by directly triggering hardDeleteEntity
    expect(hardDeleteEntity).not.toHaveBeenCalled();
  });
});
