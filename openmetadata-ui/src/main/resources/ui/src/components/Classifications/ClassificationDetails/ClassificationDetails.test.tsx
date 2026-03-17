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

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React, { act } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { ProviderType } from '../../../generated/entity/bot';
import { Classification } from '../../../generated/entity/classification/classification';
import { Tag } from '../../../generated/entity/classification/tag';
import { ENTITY_PERMISSIONS } from '../../../mocks/Permissions.mock';
import { getTags } from '../../../rest/tagAPI';
import ClassificationDetails from './ClassificationDetails';

const mockNavigate = jest.fn();

jest.mock('@openmetadata/ui-core-components', () => ({
  Tooltip: ({
    children,
    title,
  }: {
    children: React.ReactNode;
    title?: React.ReactNode;
  }) => (
    <div data-testid="tooltip" title={title as string}>
      {children}
    </div>
  ),
  TooltipTrigger: ({
    children,
    className,
  }: {
    children: React.ReactNode;
    className?: string;
  }) => <button className={className}>{children}</button>,
  Badge: ({
    children,
    'data-testid': testId,
  }: {
    children: React.ReactNode;
    'data-testid'?: string;
  }) => <span data-testid={testId}>{children}</span>,
  Toggle: ({
    isSelected,
    onChange,
    isDisabled,
    'data-testid': testId,
  }: {
    isSelected?: boolean;
    onChange?: (val: boolean) => void;
    isDisabled?: boolean;
    'data-testid'?: string;
  }) => (
    <button
      aria-checked={isSelected}
      aria-disabled={isDisabled}
      data-testid={testId}
      role="switch"
      onClick={() => onChange?.(!isSelected)}>
      toggle
    </button>
  ),
  SlideoutMenu: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
}));

jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate,
}));

jest.mock('../../../hooks/useFqn', () => ({
  useFqn: () => ({ fqn: 'TestClassification' }),
}));

jest.mock('../../../hooks/useApplicationStore', () => ({
  useApplicationStore: () => ({
    theme: { primaryColor: '#1890ff' },
  }),
}));

jest.mock('../../../context/PermissionProvider/PermissionProvider', () => ({
  usePermissionProvider: () => ({
    permissions: {
      tag: ENTITY_PERMISSIONS,
      classification: ENTITY_PERMISSIONS,
    },
  }),
}));

jest.mock('../../../rest/tagAPI', () => ({
  getTags: jest.fn().mockResolvedValue({
    data: [],
    paging: { total: 0 },
  }),
}));

jest.mock('../../common/EntityDescription/DescriptionV1', () =>
  jest.fn().mockImplementation(({ onDescriptionUpdate }) => (
    <div data-testid="description-container">
      <button
        data-testid="edit-description"
        onClick={() => onDescriptionUpdate?.('Updated description')}>
        Edit Description
      </button>
    </div>
  ))
);

jest.mock('../../common/EntityPageInfos/ManageButton/ManageButton', () =>
  jest
    .fn()
    .mockImplementation(({ onEditDisplayName, extraDropdownContent }) => (
      <div data-testid="manage-button">
        <button
          data-testid="edit-display-name"
          onClick={() =>
            onEditDisplayName?.({ name: 'test', displayName: 'New Display' })
          }>
          Edit Display Name
        </button>
        {extraDropdownContent?.map(
          (item: { key: string; onClick?: () => void }) => (
            <button
              data-testid={item.key}
              key={item.key}
              onClick={item.onClick}>
              {item.key}
            </button>
          )
        )}
      </div>
    ))
);

jest.mock('../../Entity/EntityHeaderTitle/EntityHeaderTitle.component', () =>
  jest.fn().mockImplementation(({ displayName, name, isDisabled, badge }) => (
    <div data-testid="entity-header-title">
      <span data-testid="classification-name">{name}</span>
      <span data-testid="classification-display-name">{displayName}</span>
      {isDisabled && <span data-testid="disabled-indicator">Disabled</span>}
      {badge}
    </div>
  ))
);

jest.mock('../../common/Table/Table', () =>
  jest.fn().mockImplementation(({ columns, dataSource, loading, locale }) => (
    <div data-testid="tags-table">
      {loading && <span data-testid="table-loading">Loading...</span>}
      {dataSource?.length === 0 && !loading && locale?.emptyText}
      {dataSource?.map((tag: Tag) => (
        <div data-testid={`tag-row-${tag.name}`} key={tag.id}>
          {tag.name}
          {/* Render column cells to test toggle behavior */}
          {columns?.map(
            (col: {
              key: string;
              render?: (value: unknown, record: Tag) => React.ReactNode;
            }) =>
              col.render ? (
                <span key={col.key}>{col.render(null, tag)}</span>
              ) : null
          )}
        </div>
      ))}
    </div>
  ))
);

jest.mock('../../common/ErrorWithPlaceholder/ErrorPlaceHolder', () =>
  jest
    .fn()
    .mockImplementation(({ placeholderText }) => (
      <div data-testid="empty-tags-placeholder">{placeholderText}</div>
    ))
);

jest.mock('../../Customization/GenericProvider/GenericProvider', () => ({
  GenericProvider: jest
    .fn()
    .mockImplementation(({ children }) => <div>{children}</div>),
}));

jest.mock('../../DataAssets/DomainLabelV2/DomainLabelV2', () => ({
  DomainLabelV2: jest
    .fn()
    .mockImplementation(() => <div data-testid="domain-label">Domain</div>),
}));

jest.mock('../../DataAssets/OwnerLabelV2/OwnerLabelV2', () => ({
  OwnerLabelV2: jest
    .fn()
    .mockImplementation(() => <div data-testid="owner-label">Owner</div>),
}));

jest.mock('../../common/Badge/Badge.component', () =>
  jest
    .fn()
    .mockImplementation(({ label }) => (
      <span data-testid="system-badge">{label}</span>
    ))
);

jest.mock('../../common/Loader/Loader', () =>
  jest.fn().mockImplementation(() => <div data-testid="loader">Loading...</div>)
);

const mockClassification: Classification = {
  id: 'classification-id-1',
  name: 'TestClassification',
  displayName: 'Test Classification Display',
  description: 'Test classification description',
  fullyQualifiedName: 'TestClassification',
  version: 0.1,
  updatedAt: 1672922279939,
  updatedBy: 'admin',
  href: 'http://localhost:8585/api/v1/classifications/classification-id-1',
  deleted: false,
  provider: ProviderType.User,
  mutuallyExclusive: false,
};

const mockTags: Tag[] = [
  {
    id: 'tag-1',
    name: 'Tag1',
    displayName: 'Tag One',
    description: 'First tag',
    fullyQualifiedName: 'TestClassification.Tag1',
    provider: ProviderType.User,
  },
  {
    id: 'tag-2',
    name: 'Tag2',
    displayName: 'Tag Two',
    description: 'Second tag',
    fullyQualifiedName: 'TestClassification.Tag2',
    provider: ProviderType.User,
  },
];

const mockGetTags = getTags as jest.MockedFunction<typeof getTags>;

const defaultProps = {
  classificationPermissions: ENTITY_PERMISSIONS,
  currentClassification: mockClassification,
  handleAfterDeleteAction: jest.fn(),
  handleUpdateClassification: jest.fn().mockResolvedValue(undefined),
  handleEditTagClick: jest.fn(),
  handleActionDeleteTag: jest.fn(),
  handleAddNewTagClick: jest.fn(),
  handleToggleDisable: jest.fn(),
  deleteTags: undefined,
  isAddingTag: false,
  disableEditButton: false,
  isVersionView: false,
};

describe('ClassificationDetails', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetTags.mockResolvedValue({
      data: mockTags,
      paging: { total: 2 },
    });
  });

  it('should display classification name, tags, and sidebar info', async () => {
    render(
      <MemoryRouter>
        <ClassificationDetails {...defaultProps} />
      </MemoryRouter>
    );

    await waitFor(() =>
      expect(screen.getByTestId('tag-row-Tag1')).toBeInTheDocument()
    );

    expect(screen.getByTestId('classification-name')).toHaveTextContent(
      'TestClassification'
    );
    expect(screen.getByTestId('tag-row-Tag2')).toBeInTheDocument();
    expect(screen.getByTestId('domain-label')).toBeInTheDocument();
    expect(screen.getByTestId('owner-label')).toBeInTheDocument();
  });

  it('should show empty state when classification has no tags', async () => {
    mockGetTags.mockResolvedValueOnce({ data: [], paging: { total: 0 } });

    render(
      <MemoryRouter>
        <ClassificationDetails {...defaultProps} />
      </MemoryRouter>
    );

    await waitFor(() =>
      expect(screen.getByTestId('empty-tags-placeholder')).toBeInTheDocument()
    );
  });

  it('should allow user to add a new tag', async () => {
    render(
      <MemoryRouter>
        <ClassificationDetails {...defaultProps} />
      </MemoryRouter>
    );

    await waitFor(() =>
      expect(screen.getByTestId('add-new-tag-button')).toBeInTheDocument()
    );

    fireEvent.click(screen.getByTestId('add-new-tag-button'));

    expect(defaultProps.handleAddNewTagClick).toHaveBeenCalled();
  });

  it('should allow user to edit description', async () => {
    render(
      <MemoryRouter>
        <ClassificationDetails {...defaultProps} />
      </MemoryRouter>
    );

    await waitFor(() =>
      expect(screen.getByTestId('edit-description')).toBeInTheDocument()
    );

    fireEvent.click(screen.getByTestId('edit-description'));

    expect(defaultProps.handleUpdateClassification).toHaveBeenCalledWith(
      expect.objectContaining({ description: 'Updated description' })
    );
  });

  it('should allow user to edit display name', async () => {
    render(
      <MemoryRouter>
        <ClassificationDetails {...defaultProps} />
      </MemoryRouter>
    );

    await waitFor(() =>
      expect(screen.getByTestId('edit-display-name')).toBeInTheDocument()
    );

    fireEvent.click(screen.getByTestId('edit-display-name'));

    expect(defaultProps.handleUpdateClassification).toHaveBeenCalledWith(
      expect.objectContaining({ displayName: 'New Display' })
    );
  });

  it('should navigate to version history when version button is clicked', async () => {
    render(
      <MemoryRouter>
        <ClassificationDetails {...defaultProps} />
      </MemoryRouter>
    );

    await waitFor(() =>
      expect(screen.getByTestId('version-button')).toBeInTheDocument()
    );

    fireEvent.click(screen.getByTestId('version-button'));

    expect(mockNavigate).toHaveBeenCalled();
  });

  it('should show mutually exclusive badge when classification is mutually exclusive', async () => {
    render(
      <MemoryRouter>
        <ClassificationDetails
          {...defaultProps}
          currentClassification={{
            ...mockClassification,
            mutuallyExclusive: true,
          }}
        />
      </MemoryRouter>
    );

    await waitFor(() =>
      expect(
        screen.getByTestId('mutually-exclusive-container')
      ).toBeInTheDocument()
    );
  });

  it('should show system badge and enable/disable option for system classifications', async () => {
    const systemClassification = {
      ...mockClassification,
      provider: ProviderType.System,
    };

    render(
      <MemoryRouter>
        <ClassificationDetails
          {...defaultProps}
          currentClassification={systemClassification}
        />
      </MemoryRouter>
    );

    await waitFor(() =>
      expect(screen.getByTestId('system-badge')).toBeInTheDocument()
    );

    expect(screen.getByTestId('disable-button')).toBeInTheDocument();
  });

  it('should toggle classification enabled state when disable button is clicked', async () => {
    const systemClassification = {
      ...mockClassification,
      provider: ProviderType.System,
    };

    render(
      <MemoryRouter>
        <ClassificationDetails
          {...defaultProps}
          currentClassification={systemClassification}
        />
      </MemoryRouter>
    );

    await waitFor(() =>
      expect(screen.getByTestId('disable-button')).toBeInTheDocument()
    );

    fireEvent.click(screen.getByTestId('disable-button'));

    expect(defaultProps.handleUpdateClassification).toHaveBeenCalledWith(
      expect.objectContaining({ disabled: true })
    );
  });

  it('should show disabled state and prevent adding tags when classification is disabled', async () => {
    const disabledClassification = { ...mockClassification, disabled: true };

    render(
      <MemoryRouter>
        <ClassificationDetails
          {...defaultProps}
          currentClassification={disabledClassification}
        />
      </MemoryRouter>
    );

    await waitFor(() =>
      expect(screen.getByTestId('disabled-indicator')).toBeInTheDocument()
    );

    expect(screen.getByTestId('add-new-tag-button')).toBeDisabled();
  });

  it('should hide edit controls when user is in version view or lacks permissions', async () => {
    const { unmount } = render(
      <MemoryRouter>
        <ClassificationDetails {...defaultProps} isVersionView />
      </MemoryRouter>
    );

    await waitFor(() =>
      expect(screen.queryByTestId('manage-button')).not.toBeInTheDocument()
    );

    expect(screen.queryByTestId('add-new-tag-button')).not.toBeInTheDocument();

    unmount();

    const noEditPermissions = {
      ...ENTITY_PERMISSIONS,
      EditAll: false,
      Delete: false,
      EditDisplayName: false,
    };

    render(
      <MemoryRouter>
        <ClassificationDetails
          {...defaultProps}
          classificationPermissions={noEditPermissions}
        />
      </MemoryRouter>
    );

    await waitFor(() =>
      expect(screen.queryByTestId('manage-button')).not.toBeInTheDocument()
    );
  });

  it('should disable tag toggles when user lacks EditAll permission or classification is disabled', async () => {
    const { unmount } = render(
      <MemoryRouter>
        <ClassificationDetails {...defaultProps} />
      </MemoryRouter>
    );

    await waitFor(() =>
      expect(screen.getByTestId('tag-disable-toggle-Tag1')).toBeInTheDocument()
    );

    expect(screen.getByTestId('tag-disable-toggle-Tag1')).not.toHaveAttribute(
      'aria-disabled',
      'true'
    );

    unmount();

    const noEditPermissions = {
      ...ENTITY_PERMISSIONS,
      EditAll: false,
    };

    const { unmount: unmount2 } = render(
      <MemoryRouter>
        <ClassificationDetails
          {...defaultProps}
          classificationPermissions={noEditPermissions}
        />
      </MemoryRouter>
    );

    await waitFor(() =>
      expect(screen.getByTestId('tag-disable-toggle-Tag1')).toHaveAttribute(
        'aria-disabled',
        'true'
      )
    );

    unmount2();

    const disabledClassification = { ...mockClassification, disabled: true };

    render(
      <MemoryRouter>
        <ClassificationDetails
          {...defaultProps}
          currentClassification={disabledClassification}
        />
      </MemoryRouter>
    );

    await waitFor(() =>
      expect(screen.getByTestId('tag-disable-toggle-Tag1')).toHaveAttribute(
        'aria-disabled',
        'true'
      )
    );
  });

  it('should show loader when classification is loading and data is not available', async () => {
    await act(async () => {
      render(
        <MemoryRouter>
          <ClassificationDetails
            {...defaultProps}
            isClassificationLoading
            currentClassification={undefined}
          />
        </MemoryRouter>
      );
    });

    expect(screen.getByTestId('loader')).toBeInTheDocument();
    expect(screen.queryByTestId('header')).not.toBeInTheDocument();
    expect(screen.queryByTestId('tags-table')).not.toBeInTheDocument();
    expect(screen.queryByTestId('domain-label')).not.toBeInTheDocument();
    expect(screen.queryByTestId('owner-label')).not.toBeInTheDocument();
  });

  it('should not show loader or content when classification is undefined and not loading', async () => {
    await act(async () => {
      render(
        <MemoryRouter>
          <ClassificationDetails
            {...defaultProps}
            currentClassification={undefined}
            isClassificationLoading={false}
          />
        </MemoryRouter>
      );
    });

    expect(screen.queryByTestId('loader')).not.toBeInTheDocument();
    expect(screen.queryByTestId('header')).not.toBeInTheDocument();
    expect(screen.queryByTestId('tags-table')).not.toBeInTheDocument();
  });

  it('should render content and not loader when classification is available', async () => {
    await act(async () => {
      render(
        <MemoryRouter>
          <ClassificationDetails {...defaultProps} />
        </MemoryRouter>
      );
    });

    expect(screen.queryByTestId('loader')).not.toBeInTheDocument();
    expect(screen.getByTestId('header')).toBeInTheDocument();
    expect(screen.getByTestId('tags-table')).toBeInTheDocument();
    expect(screen.getByTestId('domain-label')).toBeInTheDocument();
    expect(screen.getByTestId('owner-label')).toBeInTheDocument();
  });

  it('should pass currentClassification directly to GenericProvider', async () => {
    const { GenericProvider } = jest.requireMock(
      '../../Customization/GenericProvider/GenericProvider'
    );

    await act(async () => {
      render(
        <MemoryRouter>
          <ClassificationDetails {...defaultProps} />
        </MemoryRouter>
      );
    });

    expect(GenericProvider).toHaveBeenCalledWith(
      expect.objectContaining({
        data: mockClassification,
      }),
      expect.anything()
    );
  });

  it('should show content when classification exists even if isClassificationLoading is true', async () => {
    await act(async () => {
      render(
        <MemoryRouter>
          <ClassificationDetails {...defaultProps} isClassificationLoading />
        </MemoryRouter>
      );
    });

    expect(screen.queryByTestId('loader')).not.toBeInTheDocument();
    expect(screen.getByTestId('header')).toBeInTheDocument();
    expect(screen.getByTestId('tags-table')).toBeInTheDocument();
  });
});
