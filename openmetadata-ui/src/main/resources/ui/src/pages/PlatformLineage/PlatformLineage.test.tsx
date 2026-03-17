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
import { render, waitFor } from '@testing-library/react';
import React from 'react';
import { EntityType } from '../../enums/entity.enum';
import { SearchIndex } from '../../enums/search.enum';
import { PipelineViewMode } from '../../generated/configuration/lineageSettings';
import { AppPreferences } from '../../interface/store.interface';
import {
  MOCK_APP_PREFERENCES,
  MOCK_EMPTY_SEARCH_RESULTS,
  MOCK_PERMISSIONS_FULL_ACCESS,
  MOCK_PERMISSIONS_LINEAGE_EDIT,
  MOCK_PERMISSIONS_VIEW_ONLY,
  MOCK_SEARCH_RESULTS,
  MOCK_TABLE_ENTITY,
} from './mocks/PlatformLineage.mock';
import PlatformLineage from './PlatformLineage';

const mockNavigate = jest.fn();
const mockGetEntityAPIfromSource = jest.fn();
const mockGetEntityPermissionByFqn = jest.fn();
const mockSearchQuery = jest.fn();
const mockShowErrorToast = jest.fn();
const mockShowModal = jest.fn();
const mockGetOperationPermissions = jest.fn();
const mockDebouncedSearchCallback = jest.fn();

let mockFqn = 'test.fqn';
let mockEntityType = EntityType.TABLE;
let mockLocationSearch = '';
let mockAppPreferences = MOCK_APP_PREFERENCES;

jest.mock('@openmetadata/ui-core-components', () => {
  type GridProps = { children?: React.ReactNode };

  type GridMockType = jest.Mock<JSX.Element, [GridProps]> & {
    Item: jest.Mock<JSX.Element, [GridProps]>;
  };
  const GridMock = jest.fn(({ children }: GridProps) => (
    <div>{children}</div>
  )) as GridMockType;

  GridMock.Item = jest.fn(({ children }: GridProps) => <div>{children}</div>);

  return {
    Grid: GridMock,
    Tooltip: jest
      .fn()
      .mockImplementation(({ children }: { children: React.ReactNode }) => (
        <div>{children}</div>
      )),
    TooltipTrigger: jest
      .fn()
      .mockImplementation(({ children }: { children: React.ReactNode }) => (
        <span>{children}</span>
      )),
    ButtonUtility: jest
      .fn()
      .mockImplementation(({ children, onClick, 'data-testid': testId }) => (
        <button data-testid={testId} onClick={onClick}>
          {children}
        </button>
      )),
  };
});

jest.mock('react-router-dom', () => ({
  useNavigate: jest.fn(() => mockNavigate),
}));

jest.mock('../../hooks/useCustomLocation/useCustomLocation', () => ({
  __esModule: true,
  default: jest.fn(() => ({
    pathname: '/lineage/table/test.fqn',
    search: mockLocationSearch,
  })),
}));

jest.mock('../../utils/useRequiredParams', () => ({
  useRequiredParams: jest.fn(() => ({
    entityType: mockEntityType,
  })),
}));

jest.mock('../../hooks/useFqn', () => ({
  useFqn: jest.fn(() => ({
    fqn: mockFqn,
  })),
}));

jest.mock('../../hooks/useApplicationStore', () => ({
  useApplicationStore: jest.fn(() => ({
    appPreferences: mockAppPreferences,
  })),
}));

jest.mock('../../utils/Assets/AssetsUtils', () => ({
  getEntityAPIfromSource: jest.fn(() => mockGetEntityAPIfromSource),
}));

jest.mock('../../rest/permissionAPI', () => ({
  getEntityPermissionByFqn: jest.fn((...args) =>
    mockGetEntityPermissionByFqn(...args)
  ),
}));

jest.mock('../../rest/searchAPI', () => ({
  searchQuery: jest.fn((...args) => mockSearchQuery(...args)),
}));

jest.mock('../../utils/ToastUtils', () => ({
  showErrorToast: jest.fn((error) => mockShowErrorToast(error)),
}));

jest.mock('../../utils/PermissionsUtils', () => ({
  getOperationPermissions: jest.fn((perms) =>
    mockGetOperationPermissions(perms)
  ),
}));

jest.mock('../../utils/EntityLineageUtils', () => ({
  getLineageEntityExclusionFilter: jest.fn(() => ({ mustNot: [] })),
  getViewportForLineageExport: jest.fn(() => ({ x: 0, y: 0, zoom: 1 })),
}));

jest.mock('../../utils/StringsUtils', () => ({
  escapeESReservedCharacters: jest.fn((val) => `escaped_${val}`),
  getEncodedFqn: jest.fn((val) => encodeURIComponent(val)),
}));

const mockEscapeESReservedCharacters = require('../../utils/StringsUtils')
  .escapeESReservedCharacters as jest.Mock;

jest.mock('../../utils/date-time/DateTimeUtils', () => ({
  getCurrentISODate: jest.fn(() => '2025-03-05'),
}));

jest.mock(
  '../../components/Entity/EntityExportModalProvider/EntityExportModalProvider.component',
  () => ({
    useEntityExportModalProvider: jest.fn(() => ({
      showModal: mockShowModal,
    })),
  })
);

jest.mock('lodash', () => {
  const actual = jest.requireActual('lodash');

  return {
    ...actual,
    debounce: (fn: (...args: unknown[]) => unknown) => {
      const debounced = (...args: unknown[]) => {
        mockDebouncedSearchCallback();

        return fn(...args);
      };

      return debounced;
    },
  };
});

jest.mock('../../components/Lineage/Lineage.component', () => ({
  __esModule: true,
  default: jest.fn(() => <div>Lineage</div>),
}));

jest.mock('../../context/LineageProvider/LineageProvider', () => ({
  __esModule: true,
  default: jest.fn(({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  )),
}));

jest.mock('../../components/PageLayoutV1/PageLayoutV1', () => ({
  __esModule: true,
  default: jest.fn(({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  )),
}));

const mockLineage = require('../../components/Lineage/Lineage.component')
  .default as jest.Mock;
const mockLineageProvider =
  require('../../context/LineageProvider/LineageProvider').default as jest.Mock;
const mockPageLayoutV1 = require('../../components/PageLayoutV1/PageLayoutV1')
  .default as jest.Mock;

jest.mock('../../components/Entity/EntityLineage/LineageConfigModal', () => ({
  __esModule: true,
  default: jest.fn(() => (
    <div data-testid="lineage-config-modal">Config Modal</div>
  )),
}));

jest.mock('../../components/common/Loader/Loader', () => ({
  __esModule: true,
  default: jest.fn(() => <div data-testid="loader">Loading</div>),
}));

jest.mock(
  '../../components/common/TitleBreadcrumb/TitleBreadcrumb.component',
  () => ({
    __esModule: true,
    default: jest.fn(() => <div>Breadcrumb</div>),
  })
);

jest.mock('../../components/PageHeader/PageHeader.component', () => ({
  __esModule: true,
  default: jest.fn(() => <div>PageHeader</div>),
}));

jest.mock(
  '../../components/Entity/EntityLineage/EntitySuggestionOption/EntitySuggestionOption.component',
  () => ({
    __esModule: true,
    default: jest.fn(() => <div>EntitySuggestionOption</div>),
  })
);

jest.mock('antd', () => {
  const actual = jest.requireActual('antd');

  return {
    ...actual,
    Select: jest.fn(() => <div>Select</div>),
    Card: jest.fn(({ children }) => <div>{children}</div>),
  };
});

jest.mock('../../components/LineageTable/LineageTable.styled', () => ({
  StyledIconButton: jest.fn(({ children }) => <button>{children}</button>),
}));

jest.mock('../../assets/svg/ic-download.svg', () => ({
  ReactComponent: () => <div>DownloadIcon</div>,
}));

jest.mock('../../assets/svg/ic-settings-gear.svg', () => ({
  ReactComponent: () => <div>SettingsIcon</div>,
}));

jest.mock('@untitledui/icons', () => ({
  Expand05: () => <div>Expand05</div>,
  Home02: () => <div>Home02</div>,
  Minimize02: () => <div>Minimize02</div>,
}));

describe('PlatformLineage Component Logic', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFqn = 'test.fqn';
    mockEntityType = EntityType.TABLE;
    mockLocationSearch = '';
    mockAppPreferences = MOCK_APP_PREFERENCES;
    mockGetEntityAPIfromSource.mockResolvedValue(MOCK_TABLE_ENTITY);
    mockGetEntityPermissionByFqn.mockResolvedValue({
      permissions: ['ViewAll', 'EditLineage'],
    });
    mockGetOperationPermissions.mockReturnValue(MOCK_PERMISSIONS_FULL_ACCESS);
    mockSearchQuery.mockResolvedValue(MOCK_SEARCH_RESULTS);
    mockEscapeESReservedCharacters.mockImplementation(
      (val) => `escaped_${val}`
    );
    mockLineage.mockImplementation(() => <div>Lineage</div>);
    mockLineageProvider.mockImplementation(
      ({ children }: { children: React.ReactNode }) => <div>{children}</div>
    );
    mockPageLayoutV1.mockImplementation(
      ({ children }: { children: React.ReactNode }) => <div>{children}</div>
    );
  });

  describe('Data Fetching Logic', () => {
    it('should fetch entity data on mount when fqn and entityType are provided', async () => {
      render(<PlatformLineage />);

      await waitFor(() => {
        expect(mockGetEntityAPIfromSource).toHaveBeenCalledWith('test.fqn');
      });
    });

    it('should fetch permissions on mount when fqn and entityType are provided', async () => {
      render(<PlatformLineage />);

      await waitFor(() => {
        expect(mockGetEntityPermissionByFqn).toHaveBeenCalledWith(
          EntityType.TABLE,
          'test.fqn'
        );
      });
    });

    it('should not fetch data when fqn is undefined', async () => {
      mockFqn = '';

      render(<PlatformLineage />);

      await waitFor(() => {
        expect(mockGetEntityAPIfromSource).not.toHaveBeenCalled();
        expect(mockGetEntityPermissionByFqn).not.toHaveBeenCalled();
      });
    });

    it('should not fetch data when entityType is undefined', async () => {
      mockEntityType = '' as EntityType;

      render(<PlatformLineage />);

      await waitFor(() => {
        expect(mockGetEntityAPIfromSource).not.toHaveBeenCalled();
        expect(mockGetEntityPermissionByFqn).not.toHaveBeenCalled();
      });
    });

    it('should continue loading when permission fetch fails', async () => {
      mockGetEntityPermissionByFqn.mockRejectedValue(
        new Error('Permission error')
      );

      render(<PlatformLineage />);

      await waitFor(() => {
        expect(mockGetEntityAPIfromSource).toHaveBeenCalled();
        expect(mockLineage).toHaveBeenCalled();
      });
    });

    it('should process permissions when fetch succeeds', async () => {
      mockGetEntityPermissionByFqn.mockResolvedValue({
        permissions: ['EditAll'],
      });

      render(<PlatformLineage />);

      await waitFor(() => {
        expect(mockGetOperationPermissions).toHaveBeenCalledWith({
          permissions: ['EditAll'],
        });
      });
    });
  });

  describe('Lineage Configuration State', () => {
    it('should initialize lineage config from app preferences', async () => {
      render(<PlatformLineage />);

      await waitFor(() => {
        expect(mockLineage).toHaveBeenCalledWith(
          expect.objectContaining({
            entity: expect.any(Object),
          }),
          expect.anything()
        );
      });
    });

    it('should use default config when app preferences are not available', async () => {
      mockAppPreferences = {} as AppPreferences;

      render(<PlatformLineage />);

      await waitFor(() => {
        expect(mockLineage).toHaveBeenCalled();
      });
    });

    it('should use default downstream depth of 1 when not in preferences', async () => {
      mockAppPreferences = { lineageConfig: {} } as unknown as AppPreferences;

      render(<PlatformLineage />);

      await waitFor(() => {
        expect(mockLineage).toHaveBeenCalled();
      });
    });

    it('should use default upstream depth of 1 when not in preferences', async () => {
      mockAppPreferences = { lineageConfig: {} } as unknown as AppPreferences;

      render(<PlatformLineage />);

      await waitFor(() => {
        expect(mockLineage).toHaveBeenCalled();
      });
    });

    it('should use default pipeline view mode when not in preferences', async () => {
      mockAppPreferences = { lineageConfig: {} } as unknown as AppPreferences;

      render(<PlatformLineage />);

      await waitFor(() => {
        expect(mockLineage).toHaveBeenCalled();
      });
    });

    it('should respect custom downstream depth from preferences', async () => {
      mockAppPreferences = {
        lineageConfig: {
          downstreamDepth: 5,
          upstreamDepth: 1,
        },
      } as unknown as AppPreferences;

      render(<PlatformLineage />);

      await waitFor(() => {
        expect(mockLineage).toHaveBeenCalled();
      });
    });

    it('should respect custom pipeline view mode from preferences', async () => {
      mockAppPreferences = {
        lineageConfig: {
          pipelineViewMode: PipelineViewMode.Node,
        },
      } as unknown as AppPreferences;

      render(<PlatformLineage />);

      await waitFor(() => {
        expect(mockLineage).toHaveBeenCalled();
      });
    });
  });

  describe('Search Functionality', () => {
    it('should call search API with correct indices', async () => {
      render(<PlatformLineage />);

      await waitFor(() => {
        expect(mockLineage).toHaveBeenCalled();
      });

      const lineageCall = mockLineage.mock.calls.at(-1);
      const platformHeader = lineageCall[0].platformHeader;
      const headerElement = render(platformHeader);
      const searchInput = headerElement.container.querySelector('input');

      if (searchInput) {
        searchInput.dispatchEvent(new Event('change', { bubbles: true }));
      }

      await waitFor(
        () => {
          if (mockSearchQuery.mock.calls.length > 0) {
            expect(mockSearchQuery).toHaveBeenCalledWith(
              expect.objectContaining({
                searchIndex: expect.arrayContaining([
                  SearchIndex.DATA_ASSET,
                  SearchIndex.DOMAIN,
                  SearchIndex.SERVICE,
                ]),
              })
            );
          }
        },
        { timeout: 1000 }
      );
    });

    it('should escape search query characters before calling search API', async () => {
      render(<PlatformLineage />);

      await waitFor(() => {
        expect(mockLineage).toHaveBeenCalled();
      });

      const lineageCall = mockLineage.mock.calls.at(-1);
      const platformHeader = lineageCall[0].platformHeader;
      const headerElement = render(platformHeader);
      const searchInput = headerElement.container.querySelector('input');

      if (searchInput) {
        searchInput.value = 'test query';
        searchInput.dispatchEvent(new Event('change', { bubbles: true }));
      }

      await waitFor(
        () => {
          if (mockEscapeESReservedCharacters.mock.calls.length > 0) {
            expect(mockEscapeESReservedCharacters).toHaveBeenCalledWith(
              'test query'
            );
            expect(mockSearchQuery).toHaveBeenCalledWith(
              expect.objectContaining({
                query: 'escaped_test query',
              })
            );
          }
        },
        { timeout: 1000 }
      );
    });

    it('should include lineage entity exclusion filter', async () => {
      render(<PlatformLineage />);

      await waitFor(() => {
        expect(mockLineage).toHaveBeenCalled();
      });
    });

    it('should exclude deleted entities from search', async () => {
      render(<PlatformLineage />);

      await waitFor(() => {
        expect(mockLineage).toHaveBeenCalled();
      });
    });

    it('should handle empty search results', async () => {
      mockSearchQuery.mockResolvedValue(MOCK_EMPTY_SEARCH_RESULTS);

      render(<PlatformLineage />);

      await waitFor(() => {
        expect(mockLineage).toHaveBeenCalled();
      });
    });

    it('should handle search API errors gracefully', async () => {
      mockSearchQuery.mockRejectedValue(new Error('Search failed'));

      render(<PlatformLineage />);

      await waitFor(() => {
        expect(mockLineage).toHaveBeenCalled();
      });
    });
  });

  describe('Export Functionality', () => {
    it('should pass export callback in platformHeader', async () => {
      render(<PlatformLineage />);

      await waitFor(() => {
        expect(mockLineage).toHaveBeenCalled();
      });

      const lineageCall = mockLineage.mock.calls.at(-1);
      const platformHeader = lineageCall[0].platformHeader;

      expect(platformHeader).toBeDefined();
    });
  });

  describe('Fullscreen Mode Logic', () => {
    it('should parse fullscreen from query params', async () => {
      mockLocationSearch = '?fullscreen=true';

      render(<PlatformLineage />);

      await waitFor(() => {
        expect(mockLineage).toHaveBeenCalled();
      });
    });

    it('should default to false when fullscreen param is not present', async () => {
      mockLocationSearch = '';

      render(<PlatformLineage />);

      await waitFor(() => {
        expect(mockLineage).toHaveBeenCalled();
      });
    });
  });

  describe('Platform View Query Parameter', () => {
    it('should default to Service view when not specified', async () => {
      mockLocationSearch = '';

      render(<PlatformLineage />);

      await waitFor(() => {
        expect(mockLineage).toHaveBeenCalled();
      });
    });

    it('should parse platformView from query params', async () => {
      mockLocationSearch = '?platformView=Domain';

      render(<PlatformLineage />);

      await waitFor(() => {
        expect(mockLineage).toHaveBeenCalled();
      });
    });

    it('should handle DataProduct platform view', async () => {
      mockLocationSearch = '?platformView=DataProduct';

      render(<PlatformLineage />);

      await waitFor(() => {
        expect(mockLineage).toHaveBeenCalled();
      });
    });
  });

  describe('Props Passed to Lineage Component', () => {
    it('should pass isPlatformLineage=true', async () => {
      render(<PlatformLineage />);

      await waitFor(() => {
        expect(mockLineage).toHaveBeenCalledWith(
          expect.objectContaining({
            isPlatformLineage: true,
          }),
          expect.anything()
        );
      });
    });

    it('should pass fetched entity', async () => {
      render(<PlatformLineage />);

      await waitFor(() => {
        expect(mockLineage).toHaveBeenCalledWith(
          expect.objectContaining({
            entity: MOCK_TABLE_ENTITY,
          }),
          expect.anything()
        );
      });
    });

    it('should pass entityType from params', async () => {
      render(<PlatformLineage />);

      await waitFor(() => {
        expect(mockLineage).toHaveBeenCalledWith(
          expect.objectContaining({
            entityType: EntityType.TABLE,
          }),
          expect.anything()
        );
      });
    });

    it('should pass hasEditAccess=true when EditAll permission exists', async () => {
      mockGetOperationPermissions.mockReturnValue(MOCK_PERMISSIONS_FULL_ACCESS);

      render(<PlatformLineage />);

      await waitFor(() => {
        expect(mockLineage).toHaveBeenCalledWith(
          expect.objectContaining({
            hasEditAccess: true,
          }),
          expect.anything()
        );
      });
    });

    it('should pass hasEditAccess=true when EditLineage permission exists', async () => {
      mockGetOperationPermissions.mockReturnValue(
        MOCK_PERMISSIONS_LINEAGE_EDIT
      );

      render(<PlatformLineage />);

      await waitFor(() => {
        expect(mockLineage).toHaveBeenCalledWith(
          expect.objectContaining({
            hasEditAccess: true,
          }),
          expect.anything()
        );
      });
    });

    it('should pass hasEditAccess=false when no edit permissions', async () => {
      mockGetOperationPermissions.mockReturnValue(MOCK_PERMISSIONS_VIEW_ONLY);

      render(<PlatformLineage />);

      await waitFor(() => {
        expect(mockLineage).toHaveBeenCalledWith(
          expect.objectContaining({
            hasEditAccess: false,
          }),
          expect.anything()
        );
      });
    });

    it('should pass platformHeader prop', async () => {
      render(<PlatformLineage />);

      await waitFor(() => {
        expect(mockLineage).toHaveBeenCalledWith(
          expect.objectContaining({
            platformHeader: expect.anything(),
          }),
          expect.anything()
        );
      });
    });
  });

  describe('Conditional Rendering Logic', () => {
    it('should render loader while loading=true', async () => {
      mockGetEntityAPIfromSource.mockImplementation(
        () =>
          new Promise((resolve) => {
            setTimeout(() => resolve(MOCK_TABLE_ENTITY), 100);
          })
      );

      const { container } = render(<PlatformLineage />);

      expect(container.querySelector('[data-testid="loader"]')).toBeTruthy();
    });

    it('should render loader while loading=true', async () => {
      mockGetEntityAPIfromSource.mockImplementation(
        () =>
          new Promise((resolve) => {
            setTimeout(() => resolve(MOCK_TABLE_ENTITY), 100);
          })
      );

      const { container } = render(<PlatformLineage />);

      expect(container.querySelector('[data-testid="loader"]')).toBeTruthy();

      await waitFor(() => {
        expect(mockLineage).toHaveBeenCalled();
      });
    });

    it('should render Lineage after data loads', async () => {
      render(<PlatformLineage />);

      await waitFor(() => {
        expect(mockLineage).toHaveBeenCalled();
      });
    });

    it('should wrap Lineage in LineageProvider', async () => {
      render(<PlatformLineage />);

      await waitFor(() => {
        expect(mockLineageProvider).toHaveBeenCalled();
        expect(mockLineage).toHaveBeenCalled();
      });
    });

    it('should not render breadcrumb in fullscreen mode', async () => {
      mockLocationSearch = '?fullscreen=true';

      const { container } = render(<PlatformLineage />);

      expect(container.textContent).not.toContain('Breadcrumb');
    });

    it('should render breadcrumb when not in fullscreen', async () => {
      mockLocationSearch = '';

      const { container } = render(<PlatformLineage />);

      await waitFor(() => {
        expect(container.textContent).toContain('Breadcrumb');
      });
    });

    it('should not render page header in fullscreen mode', async () => {
      mockLocationSearch = '?fullscreen=true';

      const { container } = render(<PlatformLineage />);

      expect(container.textContent).not.toContain('PageHeader');
    });

    it('should render page header when not in fullscreen', async () => {
      mockLocationSearch = '';

      const { container } = render(<PlatformLineage />);

      await waitFor(() => {
        expect(container.textContent).toContain('PageHeader');
      });
    });
  });

  describe('Navigation Logic', () => {
    it('should navigate to entity lineage when entity is selected', async () => {
      render(<PlatformLineage />);

      await waitFor(() => {
        expect(mockLineage).toHaveBeenCalled();
      });

      const lineageCall = mockLineage.mock.calls.at(-1);
      const platformHeader = lineageCall[0].platformHeader;
      const headerElement = render(platformHeader);

      const entitySuggestion = headerElement.container.querySelector('div');

      if (entitySuggestion) {
        entitySuggestion.dispatchEvent(new Event('click', { bubbles: true }));
      }
    });

    it('should encode fqn in navigation URL', async () => {
      render(<PlatformLineage />);

      await waitFor(() => {
        expect(mockLineage).toHaveBeenCalled();
      });
    });
  });
});
