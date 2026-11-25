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

import { fireEvent, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { ProviderType } from '../../../generated/entity/bot';
import { Classification } from '../../../generated/entity/classification/classification';
import { Tag } from '../../../generated/entity/classification/tag';
import { ENTITY_PERMISSIONS } from '../../../mocks/Permissions.mock';
import { getTags } from '../../../rest/tagAPI';
import { renderWithQueryClient as render } from '../../../test/unit/test-utils';
import ClassificationDetails from './ClassificationDetails';

jest.mock('@openmetadata/ui-core-components', () => ({
  // Spread the real module: TableV2 pulls Table/Button/Dropdown/Typography
  // from here, and a wholesale mock leaves them undefined.
  ...jest.requireActual('@openmetadata/ui-core-components'),
  Tooltip: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="tooltip">{children}</div>
  ),
  TooltipTrigger: ({
    children,
    className,
  }: {
    children: React.ReactNode;
    className?: string;
  }) => <span className={className}>{children}</span>,
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
  Box: ({
    children,
    'data-testid': testId,
  }: {
    children: React.ReactNode;
    'data-testid'?: string;
  }) => <div data-testid={testId}>{children}</div>,
  EmptyPlaceholder: ({ title }: { title?: string }) => (
    <div data-testid="empty-tags-placeholder">{title}</div>
  ),
  Owner: ({ owners }: { owners?: unknown[] }) => (
    <div data-testid="owner-label">{owners?.length ? 'Owner' : ''}</div>
  ),
  toOwnerRef: (ref: {
    id: string;
    type?: string;
    name?: string;
    displayName?: string;
    href?: string;
    profileUrl?: string;
  }) => ({
    id: ref.id,
    name: ref.name,
    displayName: ref.displayName,
    type: ref.type ?? 'user',
    href: ref.href,
    profileUrl: ref.profileUrl,
  }),
  toOwnerRefs: (
    refs?: Array<{
      id: string;
      type?: string;
      name?: string;
      displayName?: string;
      href?: string;
      profileUrl?: string;
    }>
  ) =>
    (refs ?? []).map(
      (ref: {
        id: string;
        type?: string;
        name?: string;
        displayName?: string;
        href?: string;
        profileUrl?: string;
      }) => ({
        id: ref.id,
        name: ref.name,
        displayName: ref.displayName,
        type: ref.type ?? 'user',
        href: ref.href,
        profileUrl: ref.profileUrl,
      })
    ),
}));

const mockIsAiMode = jest.fn().mockReturnValue(false);
jest.mock('../../../hooks/useAppMode', () => ({
  useIsAiMode: () => mockIsAiMode(),
}));

jest.mock('../../../hooks/useFqn', () => ({
  useFqn: () => ({ fqn: 'TestClassification' }),
}));

jest.mock('../../../hooks/useEntityRules', () => ({
  useEntityRules: jest.fn().mockImplementation(() => ({
    entityRules: {
      canAddMultipleUserOwners: true,
      canAddMultipleTeamOwner: true,
    },
  })),
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

jest.mock('../../../rest/miscAPI', () => ({
  postExactAggregateFieldOptions: jest.fn(),
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

jest.mock('../../common/Table/TableV2', () =>
  jest.fn().mockImplementation(({ dataSource, customPaginationProps }) => (
    <div data-testid="tags-table">
      {dataSource?.map((tag: Tag) => (
        <div data-testid={`tag-row-${tag.name}`} key={tag.id}>
          {tag.name}
        </div>
      ))}
      <button
        data-testid="next"
        onClick={() =>
          customPaginationProps?.pagingHandler({
            cursorType: 'after',
            currentPage: 2,
          })
        }>
        Next
      </button>
    </div>
  ))
);

jest.mock('../../Customization/GenericProvider/GenericProvider', () => ({
  GenericProvider: jest
    .fn()
    .mockImplementation(({ children }) => <div>{children}</div>),
}));

jest.mock('../../common/WidgetCard/WidgetCard', () =>
  jest
    .fn()
    .mockImplementation(
      ({ children, title }: { children?: React.ReactNode; title?: string }) => (
        <div data-testid="widget-card">
          {title && <div>{title}</div>}
          {children}
        </div>
      )
    )
);

jest.mock('../../common/DomainLabel/DomainLabel.component', () => ({
  DomainLabel: jest
    .fn()
    .mockImplementation(() => <div data-testid="domain-label">Domain</div>),
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
  handleEditClassificationClick: jest.fn(),
  deleteTags: undefined,
  isAddingTag: false,
  disableEditButton: false,
  isVersionView: false,
};

describe('ClassificationDetails paging', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetTags.mockResolvedValue({
      data: mockTags,
      paging: { total: 30, after: 'cursor-2' },
    });
  });

  it('fetches the next page after switching classification on page 1', async () => {
    const { rerender } = render(
      <MemoryRouter>
        <ClassificationDetails {...defaultProps} />
      </MemoryRouter>
    );

    await waitFor(() => expect(mockGetTags).toHaveBeenCalled());

    rerender(
      <MemoryRouter>
        <ClassificationDetails
          {...defaultProps}
          currentClassification={{
            ...mockClassification,
            id: 'classification-id-2',
            name: 'Other',
            fullyQualifiedName: 'Other',
          }}
        />
      </MemoryRouter>
    );

    await waitFor(() =>
      expect(mockGetTags).toHaveBeenLastCalledWith(
        expect.objectContaining({ parent: 'Other' })
      )
    );

    mockGetTags.mockClear();
    fireEvent.click(screen.getByTestId('next'));

    await waitFor(() =>
      expect(mockGetTags).toHaveBeenCalledWith(
        expect.objectContaining({ parent: 'Other', after: 'cursor-2' })
      )
    );
  });
});
