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

import { fireEvent, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import CustomPropertiesLandingPage from './CustomPropertiesLandingPage';

const mockTableItem = {
  key: 'customProperties.table',
  label: 'Tables',
  description: 'Manage custom properties for Tables',
  isProtected: true,
};

const mockPipelineItem = {
  key: 'customProperties.pipeline',
  label: 'Pipelines',
  description: '',
  isProtected: true,
};

jest.mock('../../../../../../rest/metadataTypeAPI', () => ({
  getTypeByFQN: jest.fn(),
}));

jest.mock(
  '../../../../../../context/PermissionProvider/PermissionProvider',
  () => ({
    usePermissionProvider: jest.fn().mockReturnValue({
      permissions: {
        type: { Create: true, EditAll: true, Delete: true, ViewBasic: true },
      },
    }),
  })
);

jest.mock('../../../../../../hooks/authHooks', () => ({
  useAuth: jest.fn().mockReturnValue({ isAdminUser: true }),
}));

jest.mock('../../../../../../utils/GlobalSettingsClassBase', () => ({
  __esModule: true,
  default: {
    getGlobalSettingsMenuWithPermission: jest.fn(),
  },
}));

jest.mock('../../../../../../utils/Assets/AssetsUtils', () => ({
  getEntityIconWithBg: jest.fn(() => <span data-testid="entity-icon" />),
}));

jest.mock('../../../../../../constants/constants', () => ({
  ENTITY_PATH: {
    table: 'table',
    pipeline: 'pipeline',
    dashboard: 'dashboard',
    articles: 'page',
  },
}));

jest.mock('../../../../../../constants/GlobalSettings.constants', () => ({
  GlobalSettingsMenuCategory: {
    CUSTOM_PROPERTIES: 'customProperties',
  },
}));

jest.mock('@openmetadata/ui-core-components', () => {
  const Card = ({
    children,
    onClick,
    'data-testid': testId,
  }: {
    children?: ReactNode;
    onClick?: () => void;
    'data-testid'?: string;
  }) => (
    <div
      data-testid={testId}
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          onClick?.();
        }
      }}>
      {children}
    </div>
  );
  Card.Content = ({ children }: { children?: ReactNode }) => (
    <div>{children}</div>
  );

  return {
    Box: ({
      children,
      'data-testid': testId,
    }: {
      children?: ReactNode;
      'data-testid'?: string;
    }) => <div data-testid={testId}>{children}</div>,
    Card,
    Typography: ({ children }: { children?: ReactNode }) => (
      <span>{children}</span>
    ),
    EmptyPlaceholder: ({
      title,
      description,
    }: {
      title?: ReactNode;
      description?: ReactNode;
    }) => (
      <div data-testid="empty-placeholder">
        <p>{title}</p>
        <p>{description}</p>
      </div>
    ),
  };
});

describe('CustomPropertiesLandingPage', () => {
  const mockOnSelectEntityType = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();

    const globalSettingsClassBase = jest.requireMock(
      '../../../../../../utils/GlobalSettingsClassBase'
    ).default;
    globalSettingsClassBase.getGlobalSettingsMenuWithPermission.mockReturnValue(
      [
        {
          key: 'customProperties',
          items: [mockTableItem, mockPipelineItem],
        },
      ]
    );
  });

  it('renders entity type cards', () => {
    render(
      <CustomPropertiesLandingPage
        onSelectEntityType={mockOnSelectEntityType}
      />
    );

    expect(screen.getByTestId('entity-type-card-table')).toBeInTheDocument();
    expect(screen.getByTestId('entity-type-card-pipeline')).toBeInTheDocument();
  });

  it('renders the Articles card under Governance', () => {
    jest
      .requireMock('../../../../../../utils/GlobalSettingsClassBase')
      .default.getGlobalSettingsMenuWithPermission.mockReturnValue([
        {
          key: 'customProperties',
          items: [
            {
              key: 'customProperties.articles',
              label: 'Articles',
              description: '',
              isProtected: true,
            },
          ],
        },
      ]);

    render(
      <CustomPropertiesLandingPage
        onSelectEntityType={mockOnSelectEntityType}
      />
    );

    expect(screen.getByTestId('entity-type-card-page')).toBeInTheDocument();
  });

  it('renders the entity label for each card', () => {
    render(
      <CustomPropertiesLandingPage
        onSelectEntityType={mockOnSelectEntityType}
      />
    );

    expect(screen.getByText('Tables')).toBeInTheDocument();
    expect(screen.getByText('Pipelines')).toBeInTheDocument();
  });

  it('renders description when present', () => {
    render(
      <CustomPropertiesLandingPage
        onSelectEntityType={mockOnSelectEntityType}
      />
    );

    expect(
      screen.getByText('Manage custom properties for Tables')
    ).toBeInTheDocument();
  });

  it('selects the entity type by fqn without fetching it', () => {
    const { getTypeByFQN } = jest.requireMock(
      '../../../../../../rest/metadataTypeAPI'
    );
    render(
      <CustomPropertiesLandingPage
        onSelectEntityType={mockOnSelectEntityType}
      />
    );

    fireEvent.click(screen.getByTestId('entity-type-card-table'));

    expect(mockOnSelectEntityType).toHaveBeenCalledWith('table');
    expect(getTypeByFQN).not.toHaveBeenCalled();
  });

  it('renders empty placeholder when category has no items', () => {
    const { default: globalSettingsClassBase } = jest.requireMock(
      '../../../../../../utils/GlobalSettingsClassBase'
    );
    globalSettingsClassBase.getGlobalSettingsMenuWithPermission.mockReturnValueOnce(
      []
    );

    render(
      <CustomPropertiesLandingPage
        onSelectEntityType={mockOnSelectEntityType}
      />
    );

    expect(screen.getByTestId('empty-placeholder')).toBeInTheDocument();
  });

  it('lists user and team custom properties under their own group', () => {
    const globalSettingsClassBase = jest.requireMock(
      '../../../../../../utils/GlobalSettingsClassBase'
    ).default;
    globalSettingsClassBase.getGlobalSettingsMenuWithPermission.mockReturnValue(
      [
        {
          key: 'customProperties',
          items: [
            mockTableItem,
            { ...mockTableItem, key: 'customProperties.user', label: 'Users' },
            { ...mockTableItem, key: 'customProperties.team', label: 'Teams' },
          ],
        },
      ]
    );

    render(
      <CustomPropertiesLandingPage
        onSelectEntityType={mockOnSelectEntityType}
      />
    );

    expect(
      screen.getByText('label.entity-group-users-and-teams')
    ).toBeInTheDocument();
    expect(screen.getByTestId('entity-type-card-user')).toBeInTheDocument();
    expect(screen.getByTestId('entity-type-card-team')).toBeInTheDocument();
  });
});
