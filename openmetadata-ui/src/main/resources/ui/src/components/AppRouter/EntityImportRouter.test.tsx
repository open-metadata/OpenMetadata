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
import { act, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ROUTES } from '../../constants/constants';
import { ResourceEntity } from '../../context/PermissionProvider/PermissionProvider.interface';
import { DEFAULT_ENTITY_PERMISSION } from '../../utils/PermissionsUtils';
import EntityImportRouter from './EntityImportRouter';

const mockNavigate = jest.fn();

jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate,
  Navigate: jest.fn(({ to }) => (
    <div data-testid="navigate">Redirected to {to}</div>
  )),
}));

jest.mock(
  '../../pages/EntityImport/BulkEntityImportPage/BulkEntityImportPage',
  () => {
    return jest.fn(() => (
      <div data-testid="bulk-entity-import-page">BulkEntityImportPage</div>
    ));
  }
);

const mockGetEntityPermissionByFqn = jest.fn();
const mockPermissions = {
  testCase: { ...DEFAULT_ENTITY_PERMISSION, EditAll: true },
};

jest.mock('../../context/PermissionProvider/PermissionProvider', () => ({
  usePermissionProvider: jest.fn(() => ({
    getEntityPermissionByFqn: mockGetEntityPermissionByFqn,
    permissions: mockPermissions,
  })),
}));

let mockFqn = 'test.entity.fqn';
jest.mock('../../hooks/useFqn', () => ({
  useFqn: jest.fn(() => ({
    fqn: mockFqn,
  })),
}));

let mockEntityType: ResourceEntity | string = ResourceEntity.TABLE;
jest.mock('../../utils/useRequiredParams', () => ({
  useRequiredParams: jest.fn(() => ({
    entityType: mockEntityType,
  })),
}));

const { usePermissionProvider } = jest.requireMock(
  '../../context/PermissionProvider/PermissionProvider'
);

describe('EntityImportRouter', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFqn = 'test.entity.fqn';
    mockEntityType = ResourceEntity.TABLE;
    mockGetEntityPermissionByFqn.mockResolvedValue({
      ...DEFAULT_ENTITY_PERMISSION,
      EditAll: true,
    });
    usePermissionProvider.mockReturnValue({
      getEntityPermissionByFqn: mockGetEntityPermissionByFqn,
      permissions: mockPermissions,
    });
  });

  describe('Render & Initial State', () => {
    it('should render null while loading permissions', async () => {
      let resolvePermission: (value: unknown) => void = () => {};
      mockGetEntityPermissionByFqn.mockImplementation(
        () =>
          new Promise((resolve) => {
            resolvePermission = resolve;
          })
      );

      const { container } = render(
        <MemoryRouter initialEntries={['/table/test.entity.fqn/import']}>
          <EntityImportRouter />
        </MemoryRouter>
      );

      expect(container.firstChild).toBeNull();

      await act(async () => {
        resolvePermission({ ...DEFAULT_ENTITY_PERMISSION, EditAll: true });
      });
    });

    it('should render BulkEntityImportPage when user has EditAll permission', async () => {
      render(
        <MemoryRouter initialEntries={['/table/test.entity.fqn/import']}>
          <EntityImportRouter />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(
          screen.getByTestId('bulk-entity-import-page')
        ).toBeInTheDocument();
      });
    });

    it('should redirect to NOT_FOUND when user does not have EditAll permission', async () => {
      mockGetEntityPermissionByFqn.mockResolvedValue({
        ...DEFAULT_ENTITY_PERMISSION,
        EditAll: false,
      });

      render(
        <MemoryRouter initialEntries={['/table/test.entity.fqn/import']}>
          <EntityImportRouter />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByTestId('navigate')).toBeInTheDocument();
        expect(
          screen.getByText(`Redirected to ${ROUTES.NOT_FOUND}`)
        ).toBeInTheDocument();
      });
    });
  });

  describe('Entity Type Validation', () => {
    it.each([
      ResourceEntity.TABLE,
      ResourceEntity.DATABASE_SERVICE,
      ResourceEntity.DATABASE,
      ResourceEntity.DATABASE_SCHEMA,
      ResourceEntity.GLOSSARY_TERM,
      ResourceEntity.GLOSSARY,
    ])(
      'should allow bulk import for supported entity type: %s',
      async (entityType) => {
        mockEntityType = entityType;

        render(
          <MemoryRouter initialEntries={[`/${entityType}/test.fqn/import`]}>
            <EntityImportRouter />
          </MemoryRouter>
        );

        await waitFor(() => {
          expect(
            screen.getByTestId('bulk-entity-import-page')
          ).toBeInTheDocument();
        });
      }
    );

    it('should allow bulk import for TEST_CASE entity type', async () => {
      mockEntityType = ResourceEntity.TEST_CASE;
      usePermissionProvider.mockReturnValue({
        getEntityPermissionByFqn: mockGetEntityPermissionByFqn,
        permissions: {
          testCase: { ...DEFAULT_ENTITY_PERMISSION, EditAll: true },
        },
      });

      render(
        <MemoryRouter initialEntries={['/testCase/test.fqn/import']}>
          <EntityImportRouter />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(
          screen.getByTestId('bulk-entity-import-page')
        ).toBeInTheDocument();
      });
    });

    it('should navigate to NOT_FOUND for unsupported entity type', async () => {
      mockEntityType = ResourceEntity.BOT;

      render(
        <MemoryRouter initialEntries={['/bot/test.fqn/import']}>
          <EntityImportRouter />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith(ROUTES.NOT_FOUND);
      });
    });

    it('should navigate to NOT_FOUND for unknown entity type', async () => {
      mockEntityType = 'unknownEntity';

      render(
        <MemoryRouter initialEntries={['/unknownEntity/test.fqn/import']}>
          <EntityImportRouter />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith(ROUTES.NOT_FOUND);
      });
    });
  });

  describe('FQN Validation', () => {
    it('should navigate to NOT_FOUND when fqn is empty', async () => {
      mockFqn = '';

      render(
        <MemoryRouter initialEntries={['/table/import']}>
          <EntityImportRouter />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith(ROUTES.NOT_FOUND);
      });
    });

    it('should fetch permissions when fqn is provided', async () => {
      mockFqn = 'valid.fqn';
      mockEntityType = ResourceEntity.TABLE;

      render(
        <MemoryRouter initialEntries={['/table/valid.fqn/import']}>
          <EntityImportRouter />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(mockGetEntityPermissionByFqn).toHaveBeenCalledWith(
          ResourceEntity.TABLE,
          'valid.fqn'
        );
      });
    });
  });

  describe('Permission Handling for TEST_CASE entity type', () => {
    it('should use testCase permission from global permissions for TEST_CASE entity type', async () => {
      mockEntityType = ResourceEntity.TEST_CASE;
      mockFqn = 'test.case.fqn';
      usePermissionProvider.mockReturnValue({
        getEntityPermissionByFqn: mockGetEntityPermissionByFqn,
        permissions: {
          testCase: { ...DEFAULT_ENTITY_PERMISSION, EditAll: true },
        },
      });

      render(
        <MemoryRouter initialEntries={['/testCase/test.case.fqn/import']}>
          <EntityImportRouter />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(
          screen.getByTestId('bulk-entity-import-page')
        ).toBeInTheDocument();
      });

      expect(mockGetEntityPermissionByFqn).not.toHaveBeenCalled();
    });

    it('should redirect to NOT_FOUND when TEST_CASE permission does not have EditAll', async () => {
      mockEntityType = ResourceEntity.TEST_CASE;
      mockFqn = 'test.case.fqn';
      usePermissionProvider.mockReturnValue({
        getEntityPermissionByFqn: mockGetEntityPermissionByFqn,
        permissions: {
          testCase: { ...DEFAULT_ENTITY_PERMISSION, EditAll: false },
        },
      });

      render(
        <MemoryRouter initialEntries={['/testCase/test.case.fqn/import']}>
          <EntityImportRouter />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByTestId('navigate')).toBeInTheDocument();
        expect(
          screen.getByText(`Redirected to ${ROUTES.NOT_FOUND}`)
        ).toBeInTheDocument();
      });
    });

    it('should use DEFAULT_ENTITY_PERMISSION when testCase permission is undefined', async () => {
      mockEntityType = ResourceEntity.TEST_CASE;
      mockFqn = 'test.case.fqn';
      usePermissionProvider.mockReturnValue({
        getEntityPermissionByFqn: mockGetEntityPermissionByFqn,
        permissions: {
          testCase: undefined,
        },
      });

      render(
        <MemoryRouter initialEntries={['/testCase/test.case.fqn/import']}>
          <EntityImportRouter />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByTestId('navigate')).toBeInTheDocument();
        expect(
          screen.getByText(`Redirected to ${ROUTES.NOT_FOUND}`)
        ).toBeInTheDocument();
      });
    });
  });

  describe('Async Permission Fetching', () => {
    it('should set loading to false after permission fetch completes successfully', async () => {
      let resolvePermission: (value: unknown) => void = () => {};
      mockGetEntityPermissionByFqn.mockImplementation(
        () =>
          new Promise((resolve) => {
            resolvePermission = resolve;
          })
      );

      mockEntityType = ResourceEntity.TABLE;
      mockFqn = 'test.fqn';

      const { container } = render(
        <MemoryRouter initialEntries={['/table/test.fqn/import']}>
          <EntityImportRouter />
        </MemoryRouter>
      );

      expect(container.firstChild).toBeNull();

      await act(async () => {
        resolvePermission({ ...DEFAULT_ENTITY_PERMISSION, EditAll: true });
      });

      await waitFor(() => {
        expect(
          screen.getByTestId('bulk-entity-import-page')
        ).toBeInTheDocument();
      });
    });

    it('should call getEntityPermissionByFqn with correct arguments', async () => {
      mockEntityType = ResourceEntity.DATABASE;
      mockFqn = 'my.database.fqn';
      mockGetEntityPermissionByFqn.mockResolvedValue({
        ...DEFAULT_ENTITY_PERMISSION,
        EditAll: true,
      });

      render(
        <MemoryRouter initialEntries={['/database/my.database.fqn/import']}>
          <EntityImportRouter />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(mockGetEntityPermissionByFqn).toHaveBeenCalledWith(
          ResourceEntity.DATABASE,
          'my.database.fqn'
        );
      });
    });

    it('should not call getEntityPermissionByFqn for TEST_CASE type', async () => {
      mockEntityType = ResourceEntity.TEST_CASE;
      mockFqn = 'test.case.fqn';
      usePermissionProvider.mockReturnValue({
        getEntityPermissionByFqn: mockGetEntityPermissionByFqn,
        permissions: {
          testCase: { ...DEFAULT_ENTITY_PERMISSION, EditAll: true },
        },
      });

      render(
        <MemoryRouter initialEntries={['/testCase/test.case.fqn/import']}>
          <EntityImportRouter />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(
          screen.getByTestId('bulk-entity-import-page')
        ).toBeInTheDocument();
      });

      expect(mockGetEntityPermissionByFqn).not.toHaveBeenCalled();
    });
  });

  describe('Route Rendering', () => {
    it('should render BulkEntityImportPage for wildcard path when permission granted', async () => {
      mockEntityType = ResourceEntity.TABLE;
      mockFqn = 'test.fqn';
      mockGetEntityPermissionByFqn.mockResolvedValue({
        ...DEFAULT_ENTITY_PERMISSION,
        EditAll: true,
      });

      render(
        <MemoryRouter initialEntries={['/table/test.fqn/import/any/sub/path']}>
          <EntityImportRouter />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(
          screen.getByTestId('bulk-entity-import-page')
        ).toBeInTheDocument();
      });
    });

    it('should redirect to NOT_FOUND for any path when permission denied', async () => {
      mockEntityType = ResourceEntity.TABLE;
      mockFqn = 'test.fqn';
      mockGetEntityPermissionByFqn.mockResolvedValue({
        ...DEFAULT_ENTITY_PERMISSION,
        EditAll: false,
      });

      render(
        <MemoryRouter initialEntries={['/table/test.fqn/import/sub/path']}>
          <EntityImportRouter />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByTestId('navigate')).toBeInTheDocument();
        expect(
          screen.getByText(`Redirected to ${ROUTES.NOT_FOUND}`)
        ).toBeInTheDocument();
      });
    });
  });

  describe('Conditional Route Rendering Based on Permissions', () => {
    it('should only render BulkEntityImportPage route when EditAll is true', async () => {
      mockEntityType = ResourceEntity.TABLE;
      mockFqn = 'test.fqn';
      mockGetEntityPermissionByFqn.mockResolvedValue({
        ...DEFAULT_ENTITY_PERMISSION,
        EditAll: true,
        ViewAll: true,
        Create: true,
      });

      render(
        <MemoryRouter initialEntries={['/table/test.fqn/import']}>
          <EntityImportRouter />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(
          screen.getByTestId('bulk-entity-import-page')
        ).toBeInTheDocument();
      });

      expect(screen.queryByTestId('navigate')).not.toBeInTheDocument();
    });

    it('should redirect when only other permissions are true but EditAll is false', async () => {
      mockEntityType = ResourceEntity.TABLE;
      mockFqn = 'test.fqn';
      mockGetEntityPermissionByFqn.mockResolvedValue({
        ...DEFAULT_ENTITY_PERMISSION,
        EditAll: false,
        ViewAll: true,
        Create: true,
        Delete: true,
      });

      render(
        <MemoryRouter initialEntries={['/table/test.fqn/import']}>
          <EntityImportRouter />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByTestId('navigate')).toBeInTheDocument();
        expect(
          screen.getByText(`Redirected to ${ROUTES.NOT_FOUND}`)
        ).toBeInTheDocument();
      });
    });
  });

  describe('Edge Cases', () => {
    it('should handle special characters in fqn', async () => {
      const specialFqn = 'test.entity.with-special_chars.fqn';
      mockFqn = specialFqn;
      mockEntityType = ResourceEntity.TABLE;
      mockGetEntityPermissionByFqn.mockResolvedValue({
        ...DEFAULT_ENTITY_PERMISSION,
        EditAll: true,
      });

      render(
        <MemoryRouter
          initialEntries={[`/table/${encodeURIComponent(specialFqn)}/import`]}>
          <EntityImportRouter />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(mockGetEntityPermissionByFqn).toHaveBeenCalledWith(
          ResourceEntity.TABLE,
          specialFqn
        );
      });

      await waitFor(() => {
        expect(
          screen.getByTestId('bulk-entity-import-page')
        ).toBeInTheDocument();
      });
    });

    it('should return early from fetchResourcePermission when entityType is falsy', async () => {
      mockEntityType = '' as ResourceEntity;
      mockFqn = 'test.fqn';

      render(
        <MemoryRouter initialEntries={['/import']}>
          <EntityImportRouter />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith(ROUTES.NOT_FOUND);
      });
    });
  });
});
