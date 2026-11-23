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

import { fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { ProviderType } from '../../../generated/entity/bot';
import { Classification } from '../../../generated/entity/classification/classification';
import { Tag } from '../../../generated/entity/classification/tag';
import { ENTITY_PERMISSIONS } from '../../../mocks/Permissions.mock';
import { getTags } from '../../../rest/tagAPI';
import ClassificationDetails from './ClassificationDetails';

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
  Box: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  EmptyPlaceholder: ({ title }: { title?: string }) => (
    <div data-testid="empty-tags-placeholder">{title}</div>
  ),
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

jest.mock('../../common/EntityDescription/Description', () =>
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
  handleEditClassificationClick: jest.fn(),
  deleteTags: undefined,
  isAddingTag: false,
  disableEditButton: false,
  isVersionView: false,
};

describe('ClassificationDetails paging with the real table', () => {
  const tag = (name: string): Tag => ({
    id: name,
    name,
    displayName: name,
    fullyQualifiedName: `Other.${name}`,
    provider: ProviderType.User,
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockGetTags.mockResolvedValue({
      data: [tag('first-tag')],
      paging: { total: 30, after: 'cursor-2' },
    });
  });

  it('fetches the next page once and displays the returned tags', async () => {
    render(
      <MemoryRouter>
        <ClassificationDetails {...defaultProps} />
      </MemoryRouter>
    );

    expect(
      await screen.findByRole('link', { name: 'first-tag' })
    ).toBeInTheDocument();

    mockGetTags.mockClear().mockResolvedValue({
      data: [tag('next-tag')],
      paging: { total: 30, before: 'cursor-1' },
    });
    fireEvent.click(screen.getByTestId('next'));

    expect(
      await screen.findByRole('link', { name: 'next-tag' })
    ).toBeInTheDocument();
    expect(mockGetTags).toHaveBeenCalledTimes(1);
    expect(mockGetTags).toHaveBeenCalledWith(
      expect.objectContaining({ after: 'cursor-2' })
    );
    expect(screen.getByTestId('page-indicator')).toHaveTextContent(
      'label.page 2'
    );
  });

  it('fetches the next page after switching classification on page 1', async () => {
    const { rerender } = render(
      <MemoryRouter>
        <ClassificationDetails {...defaultProps} />
      </MemoryRouter>
    );

    expect(
      await screen.findByRole('link', { name: 'first-tag' })
    ).toBeInTheDocument();

    mockGetTags.mockResolvedValueOnce({
      data: [tag('other-first-tag')],
      paging: { total: 30, after: 'cursor-2' },
    });

    rerender(
      <MemoryRouter>
        <ClassificationDetails
          {...defaultProps}
          currentClassification={{
            ...mockClassification,
            id: 'other-classification',
            name: 'Other',
            fullyQualifiedName: 'Other',
          }}
        />
      </MemoryRouter>
    );

    expect(
      await screen.findByRole('link', { name: 'other-first-tag' })
    ).toBeInTheDocument();

    mockGetTags.mockClear().mockResolvedValue({
      data: [tag('other-next-tag')],
      paging: { total: 30, before: 'cursor-1' },
    });
    fireEvent.click(screen.getByTestId('next'));

    expect(
      await screen.findByRole('link', { name: 'other-next-tag' })
    ).toBeInTheDocument();
    expect(mockGetTags).toHaveBeenCalledTimes(1);
    expect(mockGetTags).toHaveBeenCalledWith(
      expect.objectContaining({ parent: 'Other', after: 'cursor-2' })
    );
    expect(
      screen.queryByRole('link', { name: 'other-first-tag' })
    ).not.toBeInTheDocument();
  });
});
