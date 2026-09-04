/*
 *  Copyright 2025 Collate.
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
import React, { act } from 'react';
import { ALL_SERVICES_CATEGORY } from '../../../constants/Services.constant';
import { ServiceCategory } from '../../../enums/service.enum';
import { EXTENSION_POINTS } from '../../../utils/ExtensionPointTypes';
import ConnectionsPage from './ConnectionsPage';

const mockNavigate = jest.fn();
const mockGetAddServicePath = jest.fn().mockReturnValue('/settings/services');
const mockSetSearchParams = jest.fn();
const mockSetViewMode = jest.fn();
const mockConnectionsListView = jest.fn();
const mockCheckPermission = jest.fn().mockReturnValue(true);
const mockGetContributions = jest.fn().mockReturnValue([]);
let mockViewMode: 'grid' | 'list' = 'grid';
let mockSearchParams = new URLSearchParams();
let mockPermissions: Record<string, unknown> = { all: { Create: true } };

jest.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
  useSearchParams: () => [mockSearchParams, mockSetSearchParams],
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: Record<string, string>) =>
      options?.entity ? `${key}-${options.entity}` : key,
  }),
}));

jest.mock('../../common/HeaderShell/HeaderShell.component', () => ({
  __esModule: true,
  default: ({
    actions,
    subtitle,
    title,
  }: {
    actions?: React.ReactNode;
    subtitle?: React.ReactNode;
    title?: React.ReactNode;
  }) => (
    <header>
      <span>{title}</span>
      <span>{subtitle}</span>
      {actions}
    </header>
  ),
}));

jest.mock('@openmetadata/ui-core-components', () => ({
  Button: ({
    children,
    onPress,
  }: {
    children?: React.ReactNode;
    onPress?: () => void;
  }) => (
    <button data-testid="header-add-service" type="button" onClick={onPress}>
      {children}
    </button>
  ),
  ButtonGroup: ({
    children,
    onSelectionChange,
  }: {
    children: React.ReactNode;
    onSelectionChange?: (keys: Set<string>) => void;
  }) => (
    <div>
      {React.Children.map(children, (child) =>
        React.isValidElement(child)
          ? React.cloneElement(child, {
              onSelect: (id: string) => onSelectionChange?.(new Set([id])),
            } as { onSelect: (id: string) => void })
          : child
      )}
    </div>
  ),
  ButtonGroupItem: ({
    'data-testid': testId,
    id,
    onSelect,
  }: {
    'data-testid'?: string;
    id: string;
    onSelect?: (id: string) => void;
  }) => (
    <button data-testid={testId} type="button" onClick={() => onSelect?.(id)}>
      {id}
    </button>
  ),
  // Renders value so the input's contents are observable.
  Input: ({
    onChange,
    placeholder,
    value,
  }: {
    onChange?: (value: string) => void;
    placeholder?: string;
    value?: string;
  }) => (
    <input
      aria-label={placeholder}
      data-testid="search-connections-input"
      value={value ?? ''}
      onChange={(event) => onChange?.(event.target.value)}
    />
  ),
}));

jest.mock('./useConnectionsViewMode', () => ({
  useConnectionsViewMode: () => ({
    setViewMode: mockSetViewMode,
    viewMode: mockViewMode,
  }),
}));

jest.mock('./ConnectionsListView', () => ({
  __esModule: true,
  default: (props: Record<string, unknown>) => {
    mockConnectionsListView(props);

    return (
      <div data-testid="connections-browse-view">
        {props.viewToggle as React.ReactNode}
      </div>
    );
  },
}));

jest.mock('../../../utils/ConnectionsRouterClassBase', () => ({
  __esModule: true,
  default: {
    getAddServicePath: (...args: unknown[]) => mockGetAddServicePath(...args),
  },
}));

jest.mock('../../../context/PermissionProvider/PermissionProvider', () => ({
  usePermissionProvider: () => ({ permissions: mockPermissions }),
}));

jest.mock('../../../utils/PermissionsUtils', () => ({
  checkPermission: (...args: unknown[]) => mockCheckPermission(...args),
}));

// Identity mapping keeps the assertions about which resource was checked readable.
// `canCreateAnyServiceCategory` mirrors the real implementation (any category is enough) so the
// default-tab permission cases exercise the same rule through the mocked checkPermission.
jest.mock('../../../utils/ServicePureUtils', () => ({
  getResourceEntityFromServiceCategory: (category: string) => category,
  canCreateAnyServiceCategory: (permissions: unknown) =>
    Object.values(
      jest.requireActual('../../../enums/service.enum').ServiceCategory
    ).some((category) => mockCheckPermission('Create', category, permissions)),
}));

jest.mock('../../../hoc/LimitWrapper', () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

jest.mock(
  '../../Settings/Applications/ApplicationsProvider/ApplicationsProvider',
  () => ({
    useApplicationsProvider: () => ({
      extensionRegistry: { getContributions: mockGetContributions },
    }),
  })
);

describe('ConnectionsPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    mockSearchParams = new URLSearchParams();
    mockViewMode = 'grid';
    mockPermissions = { all: { Create: true } };
    mockCheckPermission.mockReturnValue(true);
    mockGetContributions.mockReturnValue([]);
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  describe('search', () => {
    const type = (value: string) => {
      fireEvent.change(screen.getByTestId('search-connections-input'), {
        target: { value },
      });
      act(() => {
        jest.advanceTimersByTime(600);
      });
    };

    it('writes the term to the URL so a filtered view is shareable', () => {
      render(<ConnectionsPage />);

      type('snow');

      const update = mockSetSearchParams.mock.calls.at(-1)?.[0] as (
        current: URLSearchParams
      ) => URLSearchParams;

      expect(update(new URLSearchParams()).get('search')).toBe('snow');
      expect(mockSetSearchParams.mock.calls.at(-1)?.[1]).toEqual({
        replace: true,
      });
    });

    it('seeds the input from the URL on load', () => {
      mockSearchParams = new URLSearchParams('search=snow');

      render(<ConnectionsPage />);

      expect(screen.getByTestId('search-connections-input')).toHaveValue(
        'snow'
      );
      expect(mockConnectionsListView).toHaveBeenLastCalledWith(
        expect.objectContaining({ searchTerm: 'snow' })
      );
    });
  });

  it('renders the shared browse shell in grid mode', () => {
    render(<ConnectionsPage />);

    expect(screen.getByTestId('connections-browse-view')).toBeInTheDocument();
    expect(mockConnectionsListView).toHaveBeenLastCalledWith(
      expect.objectContaining({ viewMode: 'grid' })
    );
  });

  it('keeps both view controls in the shared content toolbar', () => {
    render(<ConnectionsPage />);

    fireEvent.click(screen.getByTestId('list-view-toggle'));

    expect(screen.getByTestId('grid-view-toggle')).toBeInTheDocument();
    expect(mockSetViewMode).toHaveBeenCalledWith('list');
  });

  it('passes the typed term straight to the list view', () => {
    render(<ConnectionsPage />);

    fireEvent.change(screen.getByTestId('search-connections-input'), {
      target: { value: 'mysql' },
    });

    // Undebounced on purpose: the list filters in memory below the estate limit, so a delay here
    // only puts a lag between typing and results. What is debounced is the URL write and, in the
    // hook, the server query — the two things that actually cost something.
    expect(mockConnectionsListView).toHaveBeenLastCalledWith(
      expect.objectContaining({ searchTerm: 'mysql' })
    );
  });

  it('still waits before writing the term to the URL', () => {
    render(<ConnectionsPage />);

    fireEvent.change(screen.getByTestId('search-connections-input'), {
      target: { value: 'mysql' },
    });

    expect(mockSetSearchParams).not.toHaveBeenCalled();

    act(() => jest.advanceTimersByTime(600));

    expect(mockSetSearchParams).toHaveBeenCalled();
  });

  it('writes secondary-navigation category changes to the URL', () => {
    render(<ConnectionsPage />);

    const lastProps = mockConnectionsListView.mock.calls.at(-1)?.[0] as {
      onCategoryChange: (category: string) => void;
    };
    lastProps.onCategoryChange(ServiceCategory.DATABASE_SERVICES);

    const update = mockSetSearchParams.mock.calls[0][0] as (
      previous: URLSearchParams
    ) => URLSearchParams;

    expect(update(new URLSearchParams()).get('category')).toBe(
      ServiceCategory.DATABASE_SERVICES
    );
    expect(mockSetSearchParams.mock.calls[0][1]).toEqual({ replace: true });
  });

  it('opens Add New Service from the single header action', () => {
    render(<ConnectionsPage />);

    fireEvent.click(screen.getByTestId('header-add-service'));

    // No category in the URL means the All tab, which opens the wizard on the `all` sentinel —
    // every category's connectors, none pre-selected — rather than defaulting to databases.
    expect(mockGetAddServicePath).toHaveBeenCalledWith(ALL_SERVICES_CATEGORY);
    expect(mockNavigate).toHaveBeenCalledTimes(1);
    expect(mockConnectionsListView.mock.calls.at(-1)?.[0]).not.toHaveProperty(
      'onAddService'
    );
  });

  it('sends the header action to the add-service page of the selected category', () => {
    mockSearchParams = new URLSearchParams(
      `category=${ServiceCategory.DRIVE_SERVICES}`
    );

    render(<ConnectionsPage />);

    fireEvent.click(screen.getByTestId('header-add-service'));

    expect(mockCheckPermission).toHaveBeenCalledWith(
      'Create',
      ServiceCategory.DRIVE_SERVICES,
      mockPermissions
    );
    expect(mockGetAddServicePath).toHaveBeenCalledWith(
      ServiceCategory.DRIVE_SERVICES
    );
  });

  it('hides the header action without permission to create that kind of service', () => {
    mockCheckPermission.mockReturnValue(false);

    render(<ConnectionsPage />);

    expect(screen.queryByTestId('header-add-service')).not.toBeInTheDocument();
  });

  it('gates the default All tab on being able to create any category', () => {
    // A user who can create only API services must still get the header button on the All tab —
    // the old check asked about databases specifically and wrongly hid it.
    mockCheckPermission.mockImplementation(
      (_operation: unknown, resource: unknown) =>
        resource === ServiceCategory.API_SERVICES
    );

    render(<ConnectionsPage />);

    expect(screen.getByTestId('header-add-service')).toBeInTheDocument();
  });

  it('hides the header action until permissions have loaded', () => {
    mockPermissions = {};

    render(<ConnectionsPage />);

    expect(screen.queryByTestId('header-add-service')).not.toBeInTheDocument();
    expect(mockCheckPermission).not.toHaveBeenCalled();
  });

  describe('footer extension point', () => {
    it('renders nothing in the footer region when no plugin contributes one', () => {
      mockGetContributions.mockReturnValue([]);

      const { container } = render(<ConnectionsPage />);

      expect(mockGetContributions).toHaveBeenCalledWith(
        EXTENSION_POINTS.CONNECTIONS_PAGE_FOOTER
      );
      expect(
        container.querySelector('[data-testid="connections-footer-slot"]')
      ).not.toBeInTheDocument();
    });

    it('renders a plugin-contributed footer (e.g. an AI composer) in the reserved region', () => {
      mockGetContributions.mockImplementation((extensionPointId: string) =>
        extensionPointId === EXTENSION_POINTS.CONNECTIONS_PAGE_FOOTER
          ? [
              {
                key: 'ai-composer',
                component: () => (
                  <div data-testid="connections-footer-slot">composer</div>
                ),
              },
            ]
          : []
      );

      render(<ConnectionsPage />);

      expect(screen.getByTestId('connections-footer-slot')).toBeInTheDocument();
    });
  });
});
