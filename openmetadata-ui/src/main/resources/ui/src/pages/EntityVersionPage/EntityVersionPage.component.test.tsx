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
import { act, render, screen } from '@testing-library/react';
import {
  OperationPermission,
  ResourceEntity,
} from '../../context/PermissionProvider/PermissionProvider.interface';
import { EntityType } from '../../enums/entity.enum';
import { Operation } from '../../generated/entity/policies/policy';
import { getDerivedPermissionFlags } from '../../utils/PermissionDerivation';
import EntityVersionPage from './EntityVersionPage.component';

const mockNavigate = jest.fn();
let mockEntityType: EntityType = EntityType.TABLE;

jest.mock('react-router-dom', () => ({
  useNavigate: jest.fn().mockImplementation(() => mockNavigate),
}));

jest.mock('../../utils/useRequiredParams', () => ({
  useRequiredParams: jest.fn().mockImplementation(() => ({
    entityType: mockEntityType,
    version: '0.2',
    tab: undefined,
  })),
}));

jest.mock('../../hooks/useFqn', () => ({
  useFqn: jest.fn().mockImplementation(() => ({ fqn: 'test.table.fqn' })),
}));

jest.mock('../../components/common/Loader/Loader', () =>
  jest.fn().mockImplementation(() => <div>Loader</div>)
);

jest.mock('../../components/common/ErrorWithPlaceholder/ErrorPlaceHolder', () =>
  jest.fn().mockImplementation(() => <div>ErrorPlaceHolder</div>)
);

jest.mock('../../components/PageLayoutV1/PageLayoutV1', () =>
  jest.fn().mockImplementation(({ children }) => <div>{children}</div>)
);

// EntityVersionPage dispatches to a per-entityType Version component via
// entityVersionClassBase.getEntityVersionComponent — mock the whole class so the TABLE case
// resolves to an inline component that surfaces the `entityPermissions` prop it was passed
// (rule 2: this raw OperationPermission passthrough is the child's contract, unconverted).
jest.mock('../../utils/EntityVersionClassBase', () => ({
  __esModule: true,
  default: {
    getEntityVersionComponent: jest.fn().mockImplementation((entityType) => {
      if (entityType !== 'table') {
        return null;
      }

      return function MockTableVersion({
        entityPermissions,
      }: {
        entityPermissions: OperationPermission;
      }) {
        return (
          <div data-testid="table-version">
            <div data-testid="edit-all">
              {String(Boolean(entityPermissions?.[Operation.EditAll]))}
            </div>
          </div>
        );
      };
    }),
    getEntityDetailComponent: jest.fn().mockReturnValue(null),
  },
}));

const mockGetTableDetailsByFQN = jest
  .fn()
  .mockResolvedValue({ id: 'table-id-1' });
const mockGetTableVersions = jest
  .fn()
  .mockResolvedValue({ entityType: 'table', versions: [] });
const mockGetTableVersion = jest.fn().mockResolvedValue({});

jest.mock('../../rest/tableAPI', () => ({
  getTableDetailsByFQN: jest.fn((...args) => mockGetTableDetailsByFQN(...args)),
  getTableVersions: jest.fn((...args) => mockGetTableVersions(...args)),
  getTableVersion: jest.fn((...args) => mockGetTableVersion(...args)),
}));

// EntityVersionPage now fetches its own permissions via useEntityPermissions (Task 8
// batch-final) rather than an imperative usePermissionProvider().getEntityPermissionByFqn
// call — mock the hook directly, mirroring ServiceVersionPage.test.tsx's setMockPermissions
// helper.
const mockUseEntityPermissions = jest.fn();

const setMockPermissions = (
  overrides: Partial<OperationPermission> = { ViewAll: true, EditAll: true },
  { isLoading = false, error = null as unknown } = {}
) => {
  const permissions = overrides as OperationPermission;
  mockUseEntityPermissions.mockReturnValue({
    permissions,
    isLoading,
    error,
    refresh: jest.fn(),
    ...getDerivedPermissionFlags(permissions, false),
  });
};

jest.mock('../../hooks/useEntityPermissions/useEntityPermissions', () => ({
  useEntityPermissions: (...args: unknown[]) =>
    mockUseEntityPermissions(...args),
}));

jest.mock('../../utils/ToastUtils', () => ({
  showErrorToast: jest.fn(),
}));

describe('EntityVersionPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockEntityType = EntityType.TABLE;
    setMockPermissions();
  });

  it('calls useEntityPermissions with the resource derived from entityType and the current fqn', async () => {
    await act(async () => {
      render(<EntityVersionPage />);
    });

    expect(mockUseEntityPermissions).toHaveBeenCalledWith(
      ResourceEntity.TABLE,
      'test.table.fqn',
      expect.objectContaining({ enabled: true })
    );
  });

  it('shows the permission-denied placeholder and skips the entity-versions fetch when view access is denied', async () => {
    setMockPermissions({});

    await act(async () => {
      render(<EntityVersionPage />);
    });

    expect(screen.getByText('ErrorPlaceHolder')).toBeInTheDocument();
    expect(mockGetTableDetailsByFQN).not.toHaveBeenCalled();
  });

  it('renders the dispatched Version component and forwards the raw permissions object once view access is granted', async () => {
    await act(async () => {
      render(<EntityVersionPage />);
    });

    expect(mockGetTableDetailsByFQN).toHaveBeenCalledWith('test.table.fqn', {
      include: 'all',
    });
    expect(screen.getByTestId('table-version')).toBeInTheDocument();
    expect(screen.getByTestId('edit-all')).toHaveTextContent('true');
  });

  it('passes entityPermissions through with EditAll false when the hook resolves without edit access', async () => {
    setMockPermissions({ ViewAll: true, EditAll: false });

    await act(async () => {
      render(<EntityVersionPage />);
    });

    expect(screen.getByTestId('edit-all')).toHaveTextContent('false');
  });
});
