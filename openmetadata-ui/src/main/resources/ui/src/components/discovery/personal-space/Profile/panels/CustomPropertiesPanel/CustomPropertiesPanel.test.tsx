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

import { act, fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import CustomPropertiesPanel from './CustomPropertiesPanel';

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
  default: jest.fn(({ onSelectEntityType }: any) => (
    <div data-testid="landing-page">
      <button
        data-testid="select-entity-btn"
        onClick={() => onSelectEntityType(mockEntityType)}>
        Select Table
      </button>
    </div>
  )),
}));

jest.mock('./CustomPropertiesDetailPage', () => ({
  __esModule: true,
  default: jest.fn(({ onAddProperty, onEditProperty }: any) => (
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
  )),
}));

jest.mock('./CustomPropertiesAddPage', () => ({
  __esModule: true,
  default: jest.fn(({ onSuccess, onCancel }: any) => (
    <div data-testid="add-page">
      <button data-testid="add-success-btn" onClick={onSuccess}>
        Success
      </button>
      <button data-testid="add-cancel-btn" onClick={onCancel}>
        Cancel
      </button>
    </div>
  )),
}));

jest.mock('./CustomPropertiesEditPage', () => ({
  __esModule: true,
  default: jest.fn(({ onSuccess, onCancel }: any) => (
    <div data-testid="edit-page">
      <button data-testid="edit-success-btn" onClick={onSuccess}>
        Success
      </button>
      <button data-testid="edit-cancel-btn" onClick={onCancel}>
        Cancel
      </button>
    </div>
  )),
}));

jest.mock('@openmetadata/ui-core-components', () => ({
  Box: ({ children, 'data-testid': testId }: any) => (
    <div data-testid={testId}>{children}</div>
  ),
  FeaturedIcon: () => <span data-testid="featured-icon" />,
  Toggle: ({ onChange }: any) => (
    <button data-testid="hint-toggle" onClick={() => onChange(true)} />
  ),
  Typography: ({ children }: any) => <span>{children}</span>,
}));

jest.mock('@openmetadata/ui-core-components/icons', () => ({
  Hint: () => <span data-testid="hint-icon" />,
}));

jest.mock('@untitledui/icons', () => ({
  Settings02: () => <span data-testid="settings-icon" />,
}));

jest.mock('../../../../../../context/PermissionProvider/PermissionProvider', () => ({
  usePermissionProvider: jest.fn().mockReturnValue({ permissions: {} }),
}));

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

jest.mock('./CustomPropertiesPanel.utils', () => ({
  getBreadcrumbItems: jest.fn().mockReturnValue([
    { id: 'workspace', label: 'label.workspace' },
    { id: 'landing', label: 'label.custom-property-plural' },
  ]),
  getPageTitle: jest.fn().mockReturnValue('label.custom-property-plural'),
}));

describe('CustomPropertiesPanel', () => {

  const mockOnHeaderChange = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders the landing page by default', () => {
    render(<CustomPropertiesPanel onHeaderChange={mockOnHeaderChange} />);

    expect(screen.getByTestId('landing-page')).toBeInTheDocument();
    expect(screen.queryByTestId('detail-page')).not.toBeInTheDocument();
  });

  it('calls onHeaderChange when component mounts', () => {
    render(<CustomPropertiesPanel onHeaderChange={mockOnHeaderChange} />);

    expect(mockOnHeaderChange).toHaveBeenCalled();
  });

  it('transitions to detail page when an entity type is selected', () => {
    render(<CustomPropertiesPanel onHeaderChange={mockOnHeaderChange} />);

    fireEvent.click(screen.getByTestId('select-entity-btn'));

    expect(screen.queryByTestId('landing-page')).not.toBeInTheDocument();
    expect(screen.getByTestId('detail-page')).toBeInTheDocument();
  });

  it('calls onHeaderChange again after transitioning to detail', () => {
    render(<CustomPropertiesPanel onHeaderChange={mockOnHeaderChange} />);
    const callCountAfterMount = mockOnHeaderChange.mock.calls.length;

    fireEvent.click(screen.getByTestId('select-entity-btn'));

    expect(mockOnHeaderChange.mock.calls.length).toBeGreaterThan(callCountAfterMount);
  });

  it('transitions to add page when onAddProperty is triggered from detail', () => {
    render(<CustomPropertiesPanel onHeaderChange={mockOnHeaderChange} />);
    fireEvent.click(screen.getByTestId('select-entity-btn'));

    fireEvent.click(screen.getByTestId('add-prop-btn'));

    expect(screen.queryByTestId('detail-page')).not.toBeInTheDocument();
    expect(screen.getByTestId('add-page')).toBeInTheDocument();
  });

  it('transitions to edit page when onEditProperty is triggered from detail', () => {
    render(<CustomPropertiesPanel onHeaderChange={mockOnHeaderChange} />);
    fireEvent.click(screen.getByTestId('select-entity-btn'));

    fireEvent.click(screen.getByTestId('edit-prop-btn'));

    expect(screen.queryByTestId('detail-page')).not.toBeInTheDocument();
    expect(screen.getByTestId('edit-page')).toBeInTheDocument();
  });

  it('returns to detail page when onSuccess is called from add page', () => {
    render(<CustomPropertiesPanel onHeaderChange={mockOnHeaderChange} />);
    fireEvent.click(screen.getByTestId('select-entity-btn'));
    fireEvent.click(screen.getByTestId('add-prop-btn'));

    fireEvent.click(screen.getByTestId('add-success-btn'));

    expect(screen.queryByTestId('add-page')).not.toBeInTheDocument();
    expect(screen.getByTestId('detail-page')).toBeInTheDocument();
  });

  it('returns to detail page when onCancel is called from add page', () => {
    render(<CustomPropertiesPanel onHeaderChange={mockOnHeaderChange} />);
    fireEvent.click(screen.getByTestId('select-entity-btn'));
    fireEvent.click(screen.getByTestId('add-prop-btn'));

    fireEvent.click(screen.getByTestId('add-cancel-btn'));

    expect(screen.queryByTestId('add-page')).not.toBeInTheDocument();
    expect(screen.getByTestId('detail-page')).toBeInTheDocument();
  });

  it('returns to detail page when onSuccess is called from edit page', () => {
    render(<CustomPropertiesPanel onHeaderChange={mockOnHeaderChange} />);
    fireEvent.click(screen.getByTestId('select-entity-btn'));
    fireEvent.click(screen.getByTestId('edit-prop-btn'));

    fireEvent.click(screen.getByTestId('edit-success-btn'));

    expect(screen.queryByTestId('edit-page')).not.toBeInTheDocument();
    expect(screen.getByTestId('detail-page')).toBeInTheDocument();
  });

  it('returns to detail page when onCancel is called from edit page', () => {
    render(<CustomPropertiesPanel onHeaderChange={mockOnHeaderChange} />);
    fireEvent.click(screen.getByTestId('select-entity-btn'));
    fireEvent.click(screen.getByTestId('edit-prop-btn'));

    fireEvent.click(screen.getByTestId('edit-cancel-btn'));

    expect(screen.queryByTestId('edit-page')).not.toBeInTheDocument();
    expect(screen.getByTestId('detail-page')).toBeInTheDocument();
  });

  it('shows hint toggle on add page', () => {
    render(<CustomPropertiesPanel onHeaderChange={mockOnHeaderChange} />);
    fireEvent.click(screen.getByTestId('select-entity-btn'));
    fireEvent.click(screen.getByTestId('add-prop-btn'));

    // The actions area with toggle is passed to the header; verify onHeaderChange was
    // called with a non-undefined actions argument
    const lastCall = mockOnHeaderChange.mock.calls.at(-1)?.[0];

    expect(lastCall?.actions).toBeDefined();
  });

  it('does not show hint toggle on landing page', () => {
    render(<CustomPropertiesPanel onHeaderChange={mockOnHeaderChange} />);

    const lastCall = mockOnHeaderChange.mock.calls.at(-1)?.[0];

    expect(lastCall?.actions).toBeUndefined();
  });

  it('passes breadcrumbs and title to onHeaderChange', () => {
    render(<CustomPropertiesPanel onHeaderChange={mockOnHeaderChange} />);

    const lastCall = mockOnHeaderChange.mock.calls.at(-1)?.[0];

    expect(lastCall).toMatchObject({
      breadcrumbs: expect.any(Array),
      title: expect.any(String),
    });
  });

  it('calls onHeaderChange multiple times as state changes', () => {
    render(<CustomPropertiesPanel onHeaderChange={mockOnHeaderChange} />);
    const mountCallCount = mockOnHeaderChange.mock.calls.length;

    fireEvent.click(screen.getByTestId('select-entity-btn'));
    fireEvent.click(screen.getByTestId('add-prop-btn'));

    expect(mockOnHeaderChange.mock.calls.length).toBeGreaterThan(mountCallCount);
  });

});
