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
import { showErrorToast } from '../../../../../../utils/ToastUtils';
import CustomPropertiesLandingPage from './CustomPropertiesLandingPage';

const mockTableType = {
  id: 'type-table',
  name: 'table',
  displayName: 'Table',
  fullyQualifiedName: 'table',
} as unknown as Type;

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

const mockUnprotectedItem = {
  key: 'customProperties.dashboard',
  label: 'Dashboards',
  isProtected: false,
};

jest.mock('../../../../../../rest/metadataTypeAPI', () => ({
  getTypeByFQN: jest.fn(),
}));

jest.mock(
  '../../../../../../context/PermissionProvider/PermissionProvider',
  () => ({
    usePermissionProvider: jest.fn().mockReturnValue({ permissions: {} }),
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
    'aria-busy': ariaBusy,
  }: {
    children?: ReactNode;
    onClick?: () => void;
    'data-testid'?: string;
    'aria-busy'?: boolean | string;
  }) => (
    <div
      aria-busy={ariaBusy}
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
    const { getTypeByFQN } = jest.requireMock(
      '../../../../../../rest/metadataTypeAPI'
    );
    getTypeByFQN.mockResolvedValue(mockTableType);

    const globalSettingsClassBase = jest.requireMock(
      '../../../../../../utils/GlobalSettingsClassBase'
    ).default;
    globalSettingsClassBase.getGlobalSettingsMenuWithPermission.mockReturnValue(
      [
        {
          key: 'customProperties',
          items: [mockTableItem, mockPipelineItem, mockUnprotectedItem],
        },
      ]
    );
  });

  it('renders entity type cards for protected items', () => {
    render(
      <CustomPropertiesLandingPage
        onSelectEntityType={mockOnSelectEntityType}
      />
    );

    expect(screen.getByTestId('entity-type-card-table')).toBeInTheDocument();
    expect(screen.getByTestId('entity-type-card-pipeline')).toBeInTheDocument();
  });

  it('does not render cards for unprotected items', () => {
    render(
      <CustomPropertiesLandingPage
        onSelectEntityType={mockOnSelectEntityType}
      />
    );

    expect(
      screen.queryByTestId('entity-type-card-dashboard')
    ).not.toBeInTheDocument();
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

  it('calls getTypeByFQN and then onSelectEntityType when a card is clicked', async () => {
    const { getTypeByFQN } = jest.requireMock(
      '../../../../../../rest/metadataTypeAPI'
    );
    render(
      <CustomPropertiesLandingPage
        onSelectEntityType={mockOnSelectEntityType}
      />
    );

    fireEvent.click(screen.getByTestId('entity-type-card-table'));

    await waitFor(() => {
      expect(getTypeByFQN).toHaveBeenCalledWith('table');
      expect(mockOnSelectEntityType).toHaveBeenCalledWith(mockTableType);
    });
  });

  it('shows error toast when getTypeByFQN fails', async () => {
    const mockError = new Error('API Error');
    const { getTypeByFQN } = jest.requireMock(
      '../../../../../../rest/metadataTypeAPI'
    );
    getTypeByFQN.mockRejectedValueOnce(mockError);

    render(
      <CustomPropertiesLandingPage
        onSelectEntityType={mockOnSelectEntityType}
      />
    );

    fireEvent.click(screen.getByTestId('entity-type-card-table'));

    await waitFor(() => {
      expect(showErrorToast).toHaveBeenCalledWith(mockError);
    });

    expect(mockOnSelectEntityType).not.toHaveBeenCalled();
  });

  it('renders empty placeholder when no protected items exist', () => {
    const { default: globalSettingsClassBase } = jest.requireMock(
      '../../../../../../utils/GlobalSettingsClassBase'
    );
    globalSettingsClassBase.getGlobalSettingsMenuWithPermission.mockReturnValueOnce(
      [{ key: 'customProperties', items: [mockUnprotectedItem] }]
    );

    render(
      <CustomPropertiesLandingPage
        onSelectEntityType={mockOnSelectEntityType}
      />
    );

    expect(screen.getByTestId('empty-placeholder')).toBeInTheDocument();
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

  it('sets aria-busy on the card while loading', async () => {
    const { getTypeByFQN } = jest.requireMock(
      '../../../../../../rest/metadataTypeAPI'
    );
    const deferred = { resolve: (_value: Type) => {} };
    getTypeByFQN.mockImplementationOnce(
      () =>
        new Promise((res) => {
          deferred.resolve = res;
        })
    );

    render(
      <CustomPropertiesLandingPage
        onSelectEntityType={mockOnSelectEntityType}
      />
    );

    fireEvent.click(screen.getByTestId('entity-type-card-table'));

    await waitFor(() => {
      expect(screen.getByTestId('entity-type-card-table')).toHaveAttribute(
        'aria-busy',
        'true'
      );
    });

    deferred.resolve(mockTableType);

    await waitFor(() => {
      expect(screen.getByTestId('entity-type-card-table')).not.toHaveAttribute(
        'aria-busy',
        'true'
      );
    });
  });
});
