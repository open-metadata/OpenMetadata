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

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import type { Type } from '../../../../../../generated/entity/type';
import type { CustomProperty } from '../../../../../../generated/type/customProperty';
import { showErrorToast } from '../../../../../../utils/ToastUtils';
import CustomPropertiesDetailPage from './CustomPropertiesDetailPage';

const mockProperty1 = {
  name: 'stringProp',
  displayName: 'String Property',
  description: 'A string property',
  propertyType: { id: 'str-type', name: 'string' },
};

const mockProperty2 = {
  name: 'enumProp',
  displayName: 'Enum Property',
  description: 'An enum property',
  propertyType: { id: 'enum-type', name: 'enum' },
  customPropertyConfig: {
    config: { values: ['opt1', 'opt2'], multiSelect: false },
  },
};

const mockEntityType = {
  id: 'type-table',
  name: 'table',
  displayName: 'Table',
  fullyQualifiedName: 'table',
  schema: '{}',
  customProperties: [mockProperty1, mockProperty2],
};

const mockGetTypeByFQN = jest.fn().mockResolvedValue(mockEntityType);
const mockUpdateType = jest.fn().mockResolvedValue(mockEntityType);
const mockGetEntityPermission = jest.fn().mockResolvedValue({
  EditAll: true,
  Delete: true,
});

jest.mock('../../../../../../rest/metadataTypeAPI', () => ({
  getTypeByFQN: (fqn: string) => mockGetTypeByFQN(fqn),
  updateType: (id: string, patches: unknown) => mockUpdateType(id, patches),
}));

jest.mock(
  '../../../../../../context/PermissionProvider/PermissionProvider',
  () => ({
    usePermissionProvider: () => ({
      getEntityPermission: mockGetEntityPermission,
    }),
  })
);

jest.mock('../../../../../../utils/PermissionsUtils', () => ({
  DEFAULT_ENTITY_PERMISSION: {
    Create: false,
    Delete: false,
    EditAll: false,
    EditCustomFields: false,
    EditDataProfile: false,
    EditDescription: false,
    EditDisplayName: false,
    EditLineage: false,
    EditOwners: false,
    EditPolicy: false,
    EditQueries: false,
    EditReviewers: false,
    EditRole: false,
    EditSampleData: false,
    EditStatus: false,
    EditTags: false,
    EditTeams: false,
    EditTier: false,
    EditUsage: false,
    EditUsers: false,
    ViewAll: false,
    ViewBasic: false,
    ViewDataProfile: false,
    ViewQueries: false,
    ViewSampleData: false,
    ViewTests: false,
    ViewUsage: false,
  },
}));

jest.mock(
  '../../../../../../context/PermissionProvider/PermissionProvider.interface',
  () => ({
    ResourceEntity: { TYPE: 'type' },
  })
);

jest.mock('../../../../../../utils/EntityNameUtils', () => ({
  getEntityName: (entity: { displayName?: string; name?: string }) =>
    entity?.displayName ?? entity?.name ?? '',
}));

jest.mock('../../../../../../constants/CustomProperty.constants', () => ({
  CUSTOM_PROPERTIES_ICON_MAP: {},
}));

jest.mock('../../../../../common/DeleteModal/DeleteModal', () => ({
  __esModule: true,
  default: ({
    open,
    onDelete,
    onCancel,
    entityTitle,
  }: {
    open: boolean;
    onDelete: () => void;
    onCancel: () => void;
    entityTitle?: string;
  }) =>
    open ? (
      <div data-testid="delete-modal">
        <span>{entityTitle}</span>
        <button data-testid="confirm-delete-btn" onClick={onDelete}>
          Confirm Delete
        </button>
        <button data-testid="cancel-delete-btn" onClick={onCancel}>
          Cancel
        </button>
      </div>
    ) : null,
}));

jest.mock('@openmetadata/ui-core-components', () => {
  const Table = ({
    children,
    'data-testid': testId,
    'aria-label': ariaLabel,
  }: {
    children?: ReactNode;
    'data-testid'?: string;
    'aria-label'?: string;
  }) => (
    <table aria-label={ariaLabel} data-testid={testId}>
      {children}
    </table>
  );
  Table.Header = ({
    children,
    columns,
  }: {
    children?: ((col: { id: string; label: string }) => ReactNode) | ReactNode;
    columns?: { id: string; label: string }[];
  }) => (
    <thead>
      <tr>
        {typeof children === 'function'
          ? columns?.map((col) => children(col))
          : children}
      </tr>
    </thead>
  );
  Table.Head = ({ label }: { label?: ReactNode }) => <th>{label}</th>;
  Table.Body = ({
    children,
    items,
    renderEmptyState,
  }: {
    children: (item: CustomProperty) => ReactNode;
    items?: CustomProperty[];
    renderEmptyState?: () => ReactNode;
  }) => {
    if (!items || items.length === 0) {
      return (
        <tbody>
          <tr>
            <td>{renderEmptyState?.()}</td>
          </tr>
        </tbody>
      );
    }

    return <tbody>{items.map((item) => children(item))}</tbody>;
  };
  Table.Row = ({ children, id }: { children?: ReactNode; id?: string }) => (
    <tr data-testid={`row-${id}`}>{children}</tr>
  );
  Table.Cell = ({ children }: { children?: ReactNode }) => <td>{children}</td>;

  const TableCard = ({
    children,
    className,
  }: {
    children?: ReactNode;
    className?: string;
  }) => <div className={className}>{children}</div>;
  TableCard.Root = ({
    children,
    className,
  }: {
    children?: ReactNode;
    className?: string;
  }) => <div className={className}>{children}</div>;

  const Tabs = ({ children }: { children?: ReactNode }) => (
    <div data-testid="tabs">{children}</div>
  );
  Tabs.List = ({ children }: { children?: ReactNode }) => (
    <div role="tablist">{children}</div>
  );
  Tabs.Item = ({
    label,
    id,
    badge,
  }: {
    label?: ReactNode;
    id?: string;
    badge?: ReactNode;
  }) => (
    <button id={id} role="tab">
      {label}
      {badge ? ` (${badge})` : ''}
    </button>
  );
  Tabs.Panel = ({ children, id }: { children?: ReactNode; id?: string }) => (
    <div data-testid={`tab-panel-${id}`}>{children}</div>
  );

  return {
    Box: ({
      children,
      'data-testid': testId,
      direction: _direction,
      ...rest
    }: {
      children?: ReactNode;
      'data-testid'?: string;
      direction?: string;
      [key: string]: unknown;
    }) => (
      <div data-testid={testId} {...rest}>
        {children}
      </div>
    ),
    Button: ({
      children,
      onPress,
      'data-testid': testId,
      'aria-label': ariaLabel,
      isDisabled,
    }: {
      children?: ReactNode;
      onPress?: () => void;
      'data-testid'?: string;
      'aria-label'?: string;
      isDisabled?: boolean;
    }) => (
      <button
        aria-label={ariaLabel}
        data-testid={testId}
        disabled={isDisabled}
        onClick={() => onPress?.()}>
        {children}
      </button>
    ),
    Typography: ({ children }: { children?: ReactNode }) => (
      <span>{children}</span>
    ),
    EmptyPlaceholder: ({
      title,
      description,
      actions,
    }: {
      title?: ReactNode;
      description?: ReactNode;
      actions?: { key: string; label: ReactNode; onPress?: () => void }[];
    }) => (
      <div data-testid="empty-placeholder">
        <p>{title}</p>
        <p>{description}</p>
        {actions?.map((action) => (
          <button key={action.key} onClick={() => action.onPress?.()}>
            {action.label}
          </button>
        ))}
      </div>
    ),
    Table,
    TableCard,
    Tabs,
  };
});

jest.mock('@openmetadata/ui-core-components/icons', () => ({
  Delete: () => <span>Delete</span>,
  Edit: () => <span>Edit</span>,
  Expand: () => <span>Expand</span>,
}));

describe('CustomPropertiesDetailPage', () => {
  const mockOnAddProperty = jest.fn();
  const mockOnEditProperty = jest.fn();

  const defaultProps = {
    entityType: mockEntityType as unknown as Type,
    onAddProperty: mockOnAddProperty,
    onEditProperty: mockOnEditProperty,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockGetTypeByFQN.mockResolvedValue(mockEntityType);
    mockGetEntityPermission.mockResolvedValue({ EditAll: true, Delete: true });
  });

  it('renders the component with table', async () => {
    render(<CustomPropertiesDetailPage {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByTestId('custom-property-table')).toBeInTheDocument();
    });
  });

  it('renders a row for each custom property after loading', async () => {
    render(<CustomPropertiesDetailPage {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByTestId('row-stringProp')).toBeInTheDocument();
      expect(screen.getByTestId('row-enumProp')).toBeInTheDocument();
    });
  });

  it('renders property display names in the table', async () => {
    render(<CustomPropertiesDetailPage {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText('String Property')).toBeInTheDocument();
      expect(screen.getByText('Enum Property')).toBeInTheDocument();
    });
  });

  it('shows Add Property button when user has EditAll permission', async () => {
    render(<CustomPropertiesDetailPage {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByTestId('add-custom-property-btn')).toBeInTheDocument();
    });
  });

  it('hides Add Property button when user lacks EditAll permission', async () => {
    mockGetEntityPermission.mockResolvedValueOnce({ EditAll: false });

    render(<CustomPropertiesDetailPage {...defaultProps} />);

    await waitFor(() => {
      expect(
        screen.queryByTestId('add-custom-property-btn')
      ).not.toBeInTheDocument();
    });
  });

  it('calls onAddProperty when Add Property button is clicked', async () => {
    render(<CustomPropertiesDetailPage {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByTestId('add-custom-property-btn')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByTestId('add-custom-property-btn'));

    expect(mockOnAddProperty).toHaveBeenCalledTimes(1);
  });

  it('calls onEditProperty when edit button is clicked for a row', async () => {
    render(<CustomPropertiesDetailPage {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByTestId('row-stringProp')).toBeInTheDocument();
    });

    const editButtons = screen.getAllByLabelText('label.edit');
    fireEvent.click(editButtons[0]);

    expect(mockOnEditProperty).toHaveBeenCalledWith(mockProperty1);
  });

  it('opens delete modal when delete button is clicked', async () => {
    render(<CustomPropertiesDetailPage {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByTestId('row-stringProp')).toBeInTheDocument();
    });

    const deleteButtons = screen.getAllByLabelText('label.delete');
    fireEvent.click(deleteButtons[0]);

    expect(screen.getByTestId('delete-modal')).toBeInTheDocument();
  });

  it('calls updateType when delete is confirmed', async () => {
    render(<CustomPropertiesDetailPage {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByTestId('row-stringProp')).toBeInTheDocument();
    });

    const deleteButtons = screen.getAllByLabelText('label.delete');
    fireEvent.click(deleteButtons[0]);
    fireEvent.click(screen.getByTestId('confirm-delete-btn'));

    await waitFor(() => {
      expect(mockUpdateType).toHaveBeenCalledWith(
        mockEntityType.id,
        expect.any(Array)
      );
    });
  });

  it('closes delete modal when cancel is clicked', async () => {
    render(<CustomPropertiesDetailPage {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByTestId('row-stringProp')).toBeInTheDocument();
    });

    const deleteButtons = screen.getAllByLabelText('label.delete');
    fireEvent.click(deleteButtons[0]);

    expect(screen.getByTestId('delete-modal')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('cancel-delete-btn'));

    expect(screen.queryByTestId('delete-modal')).not.toBeInTheDocument();
  });

  it('shows error toast when getTypeByFQN fails', async () => {
    const mockError = new Error('API Error');
    mockGetTypeByFQN.mockRejectedValueOnce(mockError);

    render(<CustomPropertiesDetailPage {...defaultProps} />);

    await waitFor(() => {
      expect(showErrorToast).toHaveBeenCalledWith(mockError);
    });
  });

  it('shows error toast when updateType fails on delete', async () => {
    const mockError = new Error('Delete failed');
    mockUpdateType.mockRejectedValueOnce(mockError);

    render(<CustomPropertiesDetailPage {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByTestId('row-stringProp')).toBeInTheDocument();
    });

    const deleteButtons = screen.getAllByLabelText('label.delete');
    fireEvent.click(deleteButtons[0]);
    fireEvent.click(screen.getByTestId('confirm-delete-btn'));

    await waitFor(() => {
      expect(showErrorToast).toHaveBeenCalledWith(mockError);
    });
  });

  it('shows empty placeholder when entity has no custom properties', async () => {
    const emptyEntityType = { ...mockEntityType, customProperties: [] };
    mockGetTypeByFQN.mockResolvedValueOnce(emptyEntityType);

    render(
      <CustomPropertiesDetailPage
        entityType={emptyEntityType as unknown as Type}
        onAddProperty={mockOnAddProperty}
        onEditProperty={mockOnEditProperty}
      />
    );

    await waitFor(() => {
      expect(screen.getByTestId('empty-placeholder')).toBeInTheDocument();
    });
  });
});
