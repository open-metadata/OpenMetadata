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
import { MemoryRouter } from 'react-router-dom';
import { getTypeByFQN } from '../../../../../../rest/metadataTypeAPI';
import CustomPropertiesPanel from './CustomPropertiesPanel';

const mockGetTypeByFQN = getTypeByFQN as jest.Mock;
const mockOnHeaderChange = jest.fn();

const renderPanel = () =>
  render(
    <MemoryRouter>
      <CustomPropertiesPanel onHeaderChange={mockOnHeaderChange} />
    </MemoryRouter>
  );

const mockEntityType = {
  id: 'type-1',
  name: 'table',
  displayName: 'Table',
  fullyQualifiedName: 'table',
};

const mockProperty = {
  name: 'myProp',
  displayName: 'My Property',
  propertyType: { id: 'string-type', name: 'string' },
};

jest.mock('./CustomPropertiesLandingPage', () => ({
  __esModule: true,
  default: jest.fn(
    ({
      onSelectEntityType,
    }: {
      onSelectEntityType: (entityType: unknown) => void;
    }) => (
      <div data-testid="landing-page">
        <button
          data-testid="select-entity-btn"
          onClick={() => onSelectEntityType(mockEntityType)}>
          Select Table
        </button>
      </div>
    )
  ),
}));

jest.mock('./CustomPropertiesDetailPage', () => ({
  __esModule: true,
  default: jest.fn(
    ({
      onAddProperty,
      onEditProperty,
    }: {
      onAddProperty: () => void;
      onEditProperty: (property: unknown) => void;
    }) => (
      <div data-testid="detail-page">
        <button data-testid="add-prop-btn" onClick={onAddProperty}>
          Add
        </button>
        <button
          data-testid="edit-prop-btn"
          onClick={() => onEditProperty(mockProperty)}>
          Edit
        </button>
      </div>
    )
  ),
}));

jest.mock('./CustomPropertiesAddPage', () => ({
  __esModule: true,
  default: jest.fn(
    ({
      onSuccess,
      onCancel,
    }: {
      onSuccess: () => void;
      onCancel: () => void;
    }) => (
      <div data-testid="add-page">
        <button data-testid="add-success-btn" onClick={onSuccess}>
          Success
        </button>
        <button data-testid="add-cancel-btn" onClick={onCancel}>
          Cancel
        </button>
      </div>
    )
  ),
}));

jest.mock('./CustomPropertiesEditPage', () => ({
  __esModule: true,
  default: jest.fn(
    ({
      onSuccess,
      onCancel,
    }: {
      onSuccess: () => void;
      onCancel: () => void;
    }) => (
      <div data-testid="edit-page">
        <button data-testid="edit-success-btn" onClick={onSuccess}>
          Success
        </button>
        <button data-testid="edit-cancel-btn" onClick={onCancel}>
          Cancel
        </button>
      </div>
    )
  ),
}));

jest.mock('@openmetadata/ui-core-components', () => ({
  Box: ({
    children,
    'data-testid': testId,
  }: {
    children?: ReactNode;
    'data-testid'?: string;
  }) => <div data-testid={testId}>{children}</div>,
  FeaturedIcon: () => <span data-testid="featured-icon" />,
  Toggle: ({ onChange }: { onChange: (value: boolean) => void }) => (
    <button
      aria-label="toggle"
      data-testid="hint-toggle"
      onClick={() => onChange(true)}
    />
  ),
  Typography: ({ children }: { children?: ReactNode }) => (
    <span>{children}</span>
  ),
}));

jest.mock('@openmetadata/ui-core-components/icons', () => ({
  Hint: () => <span data-testid="hint-icon" />,
  Settings02: () => <span data-testid="settings-icon" />,
}));

jest.mock(
  '../../../../../../context/PermissionProvider/PermissionProvider',
  () => ({
    usePermissionProvider: jest.fn().mockReturnValue({ permissions: {} }),
  })
);

jest.mock('../../../../../../hooks/authHooks', () => ({
  useAuth: jest.fn().mockReturnValue({ isAdminUser: false }),
}));

jest.mock('../../../../../../utils/GlobalSettingsClassBase', () => ({
  __esModule: true,
  default: {
    getGlobalSettingsMenuWithPermission: jest.fn().mockReturnValue([]),
  },
}));

jest.mock('../../../../../../utils/Assets/AssetsUtils', () => ({
  getEntityIconWithBg: jest.fn(() => <span data-testid="entity-icon" />),
}));

jest.mock('../../../../../../constants/constants', () => ({
  ENTITY_PATH: {},
}));

jest.mock('../../../../../../constants/GlobalSettings.constants', () => ({
  GlobalSettingsMenuCategory: {
    CUSTOM_PROPERTIES: 'customProperties',
  },
}));

jest.mock('../../../../../../rest/metadataTypeAPI', () => ({
  getTypeByFQN: jest.fn(),
}));

jest.mock('../../../../../../utils/ToastUtils', () => ({
  showErrorToast: jest.fn(),
}));

describe('CustomPropertiesPanel', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetTypeByFQN.mockResolvedValue(mockEntityType);
  });

  it('renders the landing page by default', () => {
    renderPanel();

    expect(screen.getByTestId('landing-page')).toBeInTheDocument();
    expect(screen.queryByTestId('detail-page')).not.toBeInTheDocument();
  });

  it('calls onHeaderChange when component mounts', () => {
    renderPanel();

    expect(mockOnHeaderChange).toHaveBeenCalled();
  });

  it('transitions to detail page when an entity type is selected', async () => {
    renderPanel();

    fireEvent.click(screen.getByTestId('select-entity-btn'));

    expect(await screen.findByTestId('detail-page')).toBeInTheDocument();
    expect(screen.queryByTestId('landing-page')).not.toBeInTheDocument();
  });

  it('calls onHeaderChange again after transitioning to detail', async () => {
    renderPanel();
    const callCountAfterMount = mockOnHeaderChange.mock.calls.length;

    fireEvent.click(screen.getByTestId('select-entity-btn'));
    await screen.findByTestId('detail-page');

    expect(mockOnHeaderChange.mock.calls.length).toBeGreaterThan(
      callCountAfterMount
    );
  });

  it('transitions to add page when onAddProperty is triggered from detail', async () => {
    renderPanel();
    fireEvent.click(screen.getByTestId('select-entity-btn'));
    fireEvent.click(await screen.findByTestId('add-prop-btn'));

    expect(await screen.findByTestId('add-page')).toBeInTheDocument();
    expect(screen.queryByTestId('detail-page')).not.toBeInTheDocument();
  });

  it('transitions to edit page when onEditProperty is triggered from detail', async () => {
    renderPanel();
    fireEvent.click(screen.getByTestId('select-entity-btn'));
    fireEvent.click(await screen.findByTestId('edit-prop-btn'));

    expect(await screen.findByTestId('edit-page')).toBeInTheDocument();
    expect(screen.queryByTestId('detail-page')).not.toBeInTheDocument();
  });

  it('returns to detail page when onSuccess is called from add page', async () => {
    renderPanel();
    fireEvent.click(screen.getByTestId('select-entity-btn'));
    fireEvent.click(await screen.findByTestId('add-prop-btn'));
    fireEvent.click(await screen.findByTestId('add-success-btn'));

    expect(await screen.findByTestId('detail-page')).toBeInTheDocument();
    expect(screen.queryByTestId('add-page')).not.toBeInTheDocument();
  });

  it('returns to detail page when onCancel is called from add page', async () => {
    renderPanel();
    fireEvent.click(screen.getByTestId('select-entity-btn'));
    fireEvent.click(await screen.findByTestId('add-prop-btn'));
    fireEvent.click(await screen.findByTestId('add-cancel-btn'));

    expect(await screen.findByTestId('detail-page')).toBeInTheDocument();
    expect(screen.queryByTestId('add-page')).not.toBeInTheDocument();
  });

  it('returns to detail page when onSuccess is called from edit page', async () => {
    renderPanel();
    fireEvent.click(screen.getByTestId('select-entity-btn'));
    fireEvent.click(await screen.findByTestId('edit-prop-btn'));
    fireEvent.click(await screen.findByTestId('edit-success-btn'));

    expect(await screen.findByTestId('detail-page')).toBeInTheDocument();
    expect(screen.queryByTestId('edit-page')).not.toBeInTheDocument();
  });

  it('returns to detail page when onCancel is called from edit page', async () => {
    renderPanel();
    fireEvent.click(screen.getByTestId('select-entity-btn'));
    fireEvent.click(await screen.findByTestId('edit-prop-btn'));
    fireEvent.click(await screen.findByTestId('edit-cancel-btn'));

    expect(await screen.findByTestId('detail-page')).toBeInTheDocument();
    expect(screen.queryByTestId('edit-page')).not.toBeInTheDocument();
  });

  it('shows hint toggle on add page', async () => {
    renderPanel();
    fireEvent.click(screen.getByTestId('select-entity-btn'));
    fireEvent.click(await screen.findByTestId('add-prop-btn'));
    await screen.findByTestId('add-page');

    // The actions area with toggle is passed to the header; verify onHeaderChange was
    // called with a non-undefined actions argument
    const lastCall = mockOnHeaderChange.mock.calls.at(-1)?.[0];

    expect(lastCall?.actions).toBeDefined();
  });

  it('does not show hint toggle on landing page', () => {
    renderPanel();

    const lastCall = mockOnHeaderChange.mock.calls.at(-1)?.[0];

    expect(lastCall?.actions).toBeUndefined();
  });

  it('passes breadcrumbs and title to onHeaderChange', () => {
    renderPanel();

    const lastCall = mockOnHeaderChange.mock.calls.at(-1)?.[0];

    expect(lastCall).toMatchObject({
      breadcrumbs: expect.any(Array),
      title: expect.any(String),
    });
  });

  it('calls onHeaderChange multiple times as state changes', async () => {
    renderPanel();
    const mountCallCount = mockOnHeaderChange.mock.calls.length;

    fireEvent.click(screen.getByTestId('select-entity-btn'));
    fireEvent.click(await screen.findByTestId('add-prop-btn'));
    await screen.findByTestId('add-page');

    expect(mockOnHeaderChange.mock.calls.length).toBeGreaterThan(
      mountCallCount
    );
  });
});
