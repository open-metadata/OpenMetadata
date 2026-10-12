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

import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import {
  applyPatch,
  deepClone,
  Operation as JsonPatchOperation,
} from 'fast-json-patch';
import React, { useState } from 'react';
import { OperationPermission } from '../../../../../../context/PermissionProvider/PermissionProvider.interface';
import { EntityReference } from '../../../../../../generated/entity/type';
import { useEntityPermissions } from '../../../../../../hooks/useEntityPermissions/useEntityPermissions';
import {
  getPersonaByName,
  updatePersona,
} from '../../../../../../rest/PersonaAPI';
import { hardDeleteEntity } from '../../../../../../utils/DeleteWidget/DeleteWidgetUtils';
import { getDerivedPermissionFlags } from '../../../../../../utils/PermissionDerivation';
import {
  showErrorToast,
  showSuccessToast,
} from '../../../../../../utils/ToastUtils';
import PersonaDetail from './PersonaDetail';
import { PersonaDetailTab } from './Personas.types';

jest.mock('react-i18next', () => {
  // Stable t identity: the header-injection effect depends on t.
  const t = (key: string) => key;

  return { useTranslation: () => ({ t }) };
});

jest.mock('../../../../../../rest/PersonaAPI', () => ({
  getPersonaByName: jest.fn(),
  updatePersona: jest.fn(),
}));

jest.mock('../../../../../../utils/DeleteWidget/DeleteWidgetUtils', () => ({
  hardDeleteEntity: jest.fn(),
}));

jest.mock('../../../../../../utils/ToastUtils', () => ({
  showErrorToast: jest.fn(),
  showSuccessToast: jest.fn(),
}));

jest.mock(
  '../../../../../../hooks/useEntityPermissions/useEntityPermissions',
  () => ({
    useEntityPermissions: jest.fn(),
  })
);

jest.mock('../../../../../common/Loader/Loader', () => () => (
  <div data-testid="loader" />
));

jest.mock('../../../../../common/RichTextEditor/RichTextEditor', () =>
  React.forwardRef((_props: unknown, ref: React.Ref<unknown>) => {
    React.useImperativeHandle(ref, () => ({
      getEditorContent: () => 'updated description',
    }));

    return <div data-testid="rich-text-editor" />;
  })
);

jest.mock(
  '../../../../../common/RichTextEditor/RichTextEditorPreviewerV1',
  () =>
    ({ markdown }: { markdown: string }) =>
      <div data-testid="description-preview">{markdown}</div>
);

jest.mock(
  '../../../../../common/DeleteModal/DeleteModal',
  () =>
    ({
      onCancel,
      onDelete,
      open,
    }: {
      onCancel: () => void;
      onDelete: () => void;
      open: boolean;
    }) =>
      open ? (
        <div data-testid="delete-modal">
          <button data-testid="confirm-delete" type="button" onClick={onDelete}>
            delete
          </button>
          <button data-testid="cancel-delete" type="button" onClick={onCancel}>
            cancel
          </button>
        </div>
      ) : null
);

jest.mock(
  './customize/SubCategoryGrid',
  () =>
    ({
      baseCategory,
      onSelectEntity,
    }: {
      baseCategory: string;
      onSelectEntity: (key: string) => void;
    }) =>
      (
        <div data-testid="persona-sub-category-grid">
          <button
            data-testid={`sub-category-card-${baseCategory}-table`}
            type="button"
            onClick={() => onSelectEntity('Table')}>
            Table
          </button>
        </div>
      )
);

jest.mock(
  './PersonaCustomizeGrid',
  () =>
    ({ onSelectCategory }: { onSelectCategory: (key: string) => void }) =>
      (
        <div data-testid="persona-customize-grid">
          <button
            data-testid="customize-card-navigation"
            type="button"
            onClick={() => onSelectCategory('navigation')}>
            navigation
          </button>
        </div>
      )
);

jest.mock(
  './PersonaUsersTab',
  () =>
    ({
      canEdit,
      onUsersChange,
      users,
    }: {
      canEdit: boolean;
      onUsersChange: (users: EntityReference[]) => void;
      users: EntityReference[];
    }) =>
      (
        <div data-can-edit={String(canEdit)} data-testid="persona-users-tab">
          {users.map((u) => u.name).join(',')}
          <button
            data-testid="remove-all-users"
            type="button"
            onClick={() => onUsersChange([])}>
            remove
          </button>
        </div>
      )
);

jest.mock('@openmetadata/ui-core-components/icons', () => ({
  CheckCircle: () => <span />,
  Copy01: () => <span />,
  Edit01: () => <span />,
  Trash01: () => <span />,
}));

jest.mock('@openmetadata/ui-core-components', () => {
  const ReactActual = jest.requireActual('react');
  const TabsContext = ReactActual.createContext(() => undefined);

  return {
    Box: ({
      children,
      'data-testid': testId,
    }: React.PropsWithChildren<{ 'data-testid'?: string }>) => (
      <div data-testid={testId}>{children}</div>
    ),
    Button: ({
      children,
      'data-testid': testId,
      isDisabled,
      onPress,
    }: React.PropsWithChildren<{
      'data-testid'?: string;
      isDisabled?: boolean;
      onPress?: () => void;
    }>) => (
      <button
        data-testid={testId}
        disabled={isDisabled}
        type="button"
        onClick={onPress}>
        {children}
      </button>
    ),
    ButtonUtility: ({
      'data-testid': testId,
      isDisabled,
      onPress,
      tooltip,
    }: {
      'data-testid'?: string;
      isDisabled?: boolean;
      onPress?: () => void;
      tooltip?: string;
    }) => (
      <button
        aria-label={tooltip}
        data-testid={testId}
        disabled={isDisabled}
        type="button"
        onClick={onPress}
      />
    ),
    Card: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
    Input: ReactActual.forwardRef(
      (
        {
          'data-testid': testId,
          onChange,
          value,
        }: {
          'data-testid'?: string;
          onChange?: (v: string) => void;
          value?: string;
        },
        ref: React.Ref<HTMLInputElement>
      ) => (
        <input
          aria-label={testId}
          data-testid={testId}
          ref={ref}
          value={value}
          onChange={(e) => onChange?.(e.target.value)}
        />
      )
    ),
    Tabs: Object.assign(
      ({
        children,
        onSelectionChange,
      }: React.PropsWithChildren<{
        onSelectionChange: (key: string) => void;
      }>) => (
        <TabsContext.Provider value={onSelectionChange}>
          {children}
        </TabsContext.Provider>
      ),
      {
        Item: ({ children, id }: React.PropsWithChildren<{ id: string }>) => {
          const onSelectionChange = ReactActual.useContext(TabsContext);

          return (
            <button
              data-testid={`tab-${id}`}
              type="button"
              onClick={() => onSelectionChange(id)}>
              {children}
            </button>
          );
        },
        List: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
      }
    ),
    Typography: ({ children }: React.PropsWithChildren) => (
      <span>{children}</span>
    ),
  };
});

const PERSONA = {
  id: 'persona-1',
  name: 'analyst',
  displayName: 'Analyst',
  fullyQualifiedName: 'analyst',
  description: 'Original description',
  default: false,
  users: [
    { id: 'u1', name: 'alice', type: 'user' },
    { id: 'u2', name: 'bob', type: 'user' },
  ],
};

const FULL_PERMISSIONS = {
  EditAll: true,
  EditDescription: true,
  Delete: true,
} as OperationPermission;

const mockPermissions = (permissions: OperationPermission) =>
  (useEntityPermissions as jest.Mock).mockReturnValue({
    permissions,
    isLoading: false,
    error: null,
    refresh: jest.fn(),
    ...getDerivedPermissionFlags(permissions, false),
  });

const mockOnTabChange = jest.fn();
const mockOnSelectCategory = jest.fn();
const mockOnDeleted = jest.fn();
const mockOnRename = jest.fn();

// Renders PersonaDetail with the header nodes it injects via onSetHeader*.
const Harness = ({
  activeTab = 'customize-ui',
  subCategory,
}: {
  activeTab?: PersonaDetailTab;
  subCategory?: string;
}) => {
  const [input, setInput] = useState<React.ReactNode>(null);
  const [suffix, setSuffix] = useState<React.ReactNode>(null);
  const [actions, setActions] = useState<React.ReactNode>(null);

  return (
    <>
      <div data-testid="header-slot">
        {input}
        {suffix}
        {actions}
      </div>
      <PersonaDetail
        activeTab={activeTab}
        fqn="analyst"
        subCategory={subCategory}
        onDeleted={mockOnDeleted}
        onRename={mockOnRename}
        onSelectCategory={mockOnSelectCategory}
        onSetHeaderActions={setActions}
        onSetHeaderTitleInput={setInput}
        onSetHeaderTitleSuffix={setSuffix}
        onTabChange={mockOnTabChange}
      />
    </>
  );
};

const renderDetail = async (
  props: { activeTab?: PersonaDetailTab; subCategory?: string } = {}
) => {
  render(<Harness {...props} />);
  await screen.findByTestId('persona-detail-container');
};

const lastPatch = (): JsonPatchOperation[] =>
  (updatePersona as jest.Mock).mock.calls.at(-1)[1];

describe('PersonaDetail', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPermissions(FULL_PERMISSIONS);
    (getPersonaByName as jest.Mock).mockResolvedValue(PERSONA);
    (updatePersona as jest.Mock).mockImplementation(
      async (_id: string, patch: JsonPatchOperation[]) =>
        applyPatch(deepClone(PERSONA), patch).newDocument
    );
  });

  it('loads the persona by fqn and reports its display name', async () => {
    await renderDetail();

    expect(getPersonaByName).toHaveBeenCalledWith('analyst');
    expect(mockOnRename).toHaveBeenCalledWith('Analyst');
    expect(screen.getByTestId('description-preview')).toHaveTextContent(
      'Original description'
    );
  });

  it('renders nothing but a toast when the persona fails to load', async () => {
    (getPersonaByName as jest.Mock).mockRejectedValueOnce(new Error('nope'));
    render(<Harness />);

    await waitFor(() => expect(showErrorToast).toHaveBeenCalled());

    expect(
      screen.queryByTestId('persona-detail-container')
    ).not.toBeInTheDocument();
    expect(screen.queryByTestId('loader')).not.toBeInTheDocument();
  });

  it('shows the no-description placeholder when description is empty', async () => {
    (getPersonaByName as jest.Mock).mockResolvedValueOnce({
      ...PERSONA,
      description: '',
    });
    await renderDetail();

    expect(screen.getByText('label.no-description')).toBeInTheDocument();
  });

  it('saves an edited description through updatePersona', async () => {
    await renderDetail();

    fireEvent.click(screen.getByTestId('edit-persona-description-btn'));

    expect(screen.getByTestId('rich-text-editor')).toBeInTheDocument();

    fireEvent.click(screen.getByText('label.save'));

    await waitFor(() =>
      expect(screen.getByTestId('description-preview')).toHaveTextContent(
        'updated description'
      )
    );

    expect(updatePersona).toHaveBeenCalledWith('persona-1', [
      { op: 'replace', path: '/description', value: 'updated description' },
    ]);
    expect(showSuccessToast).toHaveBeenCalledWith(
      'server.update-entity-success'
    );
    expect(screen.queryByTestId('rich-text-editor')).not.toBeInTheDocument();
  });

  it('keeps the editor open when saving the description fails', async () => {
    (updatePersona as jest.Mock).mockRejectedValueOnce(new Error('fail'));
    await renderDetail();

    fireEvent.click(screen.getByTestId('edit-persona-description-btn'));
    fireEvent.click(screen.getByText('label.save'));

    await waitFor(() => expect(showErrorToast).toHaveBeenCalled());

    expect(screen.getByTestId('rich-text-editor')).toBeInTheDocument();
  });

  it('hides the description edit button without edit permission', async () => {
    mockPermissions({} as OperationPermission);
    await renderDetail();

    expect(
      screen.queryByTestId('edit-persona-description-btn')
    ).not.toBeInTheDocument();
    expect(screen.getByTestId('rename-persona-btn')).toBeDisabled();
    expect(screen.getByTestId('set-default-persona-btn')).toBeDisabled();
    expect(screen.getByTestId('delete-persona-btn')).toBeDisabled();
  });

  it('renames the persona with a trimmed display name', async () => {
    await renderDetail();

    fireEvent.click(screen.getByTestId('rename-persona-btn'));

    const input = screen.getByTestId('persona-rename-input');

    expect(input).toHaveValue('Analyst');

    fireEvent.change(input, { target: { value: '  Data Analyst  ' } });
    fireEvent.click(
      screen
        .getAllByText('label.save')
        .find((el) =>
          screen.getByTestId('header-slot').contains(el)
        ) as HTMLElement
    );

    await waitFor(() =>
      expect(mockOnRename).toHaveBeenLastCalledWith('Data Analyst')
    );

    expect(lastPatch()).toEqual([
      { op: 'replace', path: '/displayName', value: 'Data Analyst' },
    ]);
    expect(
      screen.queryByTestId('persona-rename-input')
    ).not.toBeInTheDocument();
  });

  it('disables rename save for a blank name and restores controls on cancel', async () => {
    await renderDetail();

    fireEvent.click(screen.getByTestId('rename-persona-btn'));
    fireEvent.change(screen.getByTestId('persona-rename-input'), {
      target: { value: '   ' },
    });

    const headerSlot = screen.getByTestId('header-slot');
    const saveButton = screen
      .getAllByText('label.save')
      .find((el) => headerSlot.contains(el));

    expect(saveButton).toBeDisabled();
    expect(
      screen.queryByTestId('set-default-persona-btn')
    ).not.toBeInTheDocument();

    fireEvent.click(screen.getByText('label.cancel'));

    expect(
      screen.queryByTestId('persona-rename-input')
    ).not.toBeInTheDocument();
    expect(screen.getByTestId('set-default-persona-btn')).toBeInTheDocument();
    expect(updatePersona).not.toHaveBeenCalled();
  });

  it('sets the persona as default and then removes it', async () => {
    await renderDetail();

    const toggle = screen.getByTestId('set-default-persona-btn');

    expect(toggle).toHaveTextContent('label.set-as-default');

    fireEvent.click(toggle);

    await waitFor(() =>
      expect(screen.getByTestId('set-default-persona-btn')).toHaveTextContent(
        'label.remove-default'
      )
    );

    expect(lastPatch()).toEqual([
      { op: 'replace', path: '/default', value: true },
    ]);
    expect(showSuccessToast).toHaveBeenCalledWith(
      'message.default-persona-set-successfully'
    );

    fireEvent.click(screen.getByTestId('set-default-persona-btn'));

    await waitFor(() =>
      expect(showSuccessToast).toHaveBeenCalledWith(
        'message.default-persona-removed-successfully'
      )
    );

    expect(lastPatch()).toEqual([
      { op: 'replace', path: '/default', value: false },
    ]);
  });

  it('hard-deletes the persona from the delete modal and notifies the parent', async () => {
    (hardDeleteEntity as jest.Mock).mockResolvedValueOnce(true);
    await renderDetail();

    expect(screen.queryByTestId('delete-modal')).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId('delete-persona-btn'));
    fireEvent.click(screen.getByTestId('confirm-delete'));

    await waitFor(() => expect(mockOnDeleted).toHaveBeenCalled());

    expect(hardDeleteEntity).toHaveBeenCalledWith(
      'Analyst',
      'persona-1',
      'persona'
    );
    expect(screen.queryByTestId('delete-modal')).not.toBeInTheDocument();
  });

  it('does not notify the parent when deletion fails or is cancelled', async () => {
    (hardDeleteEntity as jest.Mock).mockResolvedValueOnce(false);
    await renderDetail();

    fireEvent.click(screen.getByTestId('delete-persona-btn'));
    fireEvent.click(screen.getByTestId('cancel-delete'));

    expect(screen.queryByTestId('delete-modal')).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId('delete-persona-btn'));
    fireEvent.click(screen.getByTestId('confirm-delete'));

    await waitFor(() =>
      expect(screen.queryByTestId('delete-modal')).not.toBeInTheDocument()
    );

    expect(hardDeleteEntity).toHaveBeenCalledTimes(1);
    expect(mockOnDeleted).not.toHaveBeenCalled();
  });

  it('allows delete with only the Delete permission', async () => {
    mockPermissions({ Delete: true } as OperationPermission);
    await renderDetail();

    expect(screen.getByTestId('delete-persona-btn')).toBeEnabled();
    expect(screen.getByTestId('set-default-persona-btn')).toBeDisabled();
  });

  it('shows the customize grid on the Customize UI tab', async () => {
    await renderDetail();

    expect(screen.getByTestId('persona-customize-grid')).toBeInTheDocument();
    expect(screen.queryByTestId('persona-users-tab')).not.toBeInTheDocument();
    expect(screen.getByTestId('tab-users')).toHaveTextContent(
      'label.user-plural (2)'
    );

    fireEvent.click(screen.getByTestId('customize-card-navigation'));

    expect(mockOnSelectCategory).toHaveBeenCalledWith('navigation');

    fireEvent.click(screen.getByTestId('tab-users'));

    expect(mockOnTabChange).toHaveBeenCalledWith('users');
  });

  it('shows the users tab with the persona users and patches removals', async () => {
    await renderDetail({ activeTab: 'users' });

    const usersTab = screen.getByTestId('persona-users-tab');

    expect(usersTab).toHaveTextContent('alice,bob');
    expect(usersTab).toHaveAttribute('data-can-edit', 'true');
    expect(
      screen.queryByTestId('persona-customize-grid')
    ).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId('remove-all-users'));

    await waitFor(() =>
      expect(screen.getByTestId('tab-users')).toHaveTextContent(
        'label.user-plural (0)'
      )
    );

    expect(lastPatch()).toEqual(
      expect.arrayContaining([
        { op: 'remove', path: '/users/1' },
        { op: 'remove', path: '/users/0' },
      ])
    );
  });

  it('renders the sub-category grid and selects a prefixed category', async () => {
    await renderDetail({ subCategory: 'governance' });

    expect(screen.getByTestId('persona-sub-category-grid')).toBeInTheDocument();
    expect(
      screen.queryByTestId('persona-customize-grid')
    ).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId('sub-category-card-governance-table'));

    expect(mockOnSelectCategory).toHaveBeenCalledWith('governance/Table');
  });

  it('copies a deep link to the persona to the clipboard', async () => {
    const writeText = jest.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    });
    Object.defineProperty(window, 'isSecureContext', {
      configurable: true,
      value: true,
    });
    await renderDetail();

    const copyButton = screen.getByTestId('copy-persona-link');

    expect(copyButton).toHaveAttribute('aria-label', 'label.copy-item');

    await act(async () => {
      fireEvent.click(copyButton);
    });

    expect(writeText).toHaveBeenCalledWith(
      expect.stringContaining('#personas/analyst')
    );
    expect(screen.getByTestId('copy-persona-link')).toHaveAttribute(
      'aria-label',
      'message.link-copy-to-clipboard'
    );
  });
});
