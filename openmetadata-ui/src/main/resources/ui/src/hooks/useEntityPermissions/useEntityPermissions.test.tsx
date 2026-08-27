import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import { ReactNode } from 'react';
import { ResourceEntity } from '../../context/PermissionProvider/PermissionProvider.interface';
import { Access } from '../../generated/entity/policies/accessControl/resourcePermission';
import { Operation } from '../../generated/entity/policies/policy';
import { getEntityPermissionByFqn } from '../../rest/permissionAPI';
import { useEntityPermissions } from './useEntityPermissions';

jest.mock('../../rest/permissionAPI', () => ({
  getEntityPermissionByFqn: jest.fn(),
  getEntityPermissionById: jest.fn(),
}));

const mockApi = getEntityPermissionByFqn as jest.Mock;

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

const apiResponse = {
  resource: 'table',
  permissions: [
    { operation: Operation.EditAll, access: Access.Allow },
    { operation: Operation.Delete, access: Access.Allow },
  ],
};

describe('useEntityPermissions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockApi.mockResolvedValue(apiResponse);
  });

  it('starts loading with all flags false, resolves to derived flags', async () => {
    const { result } = renderHook(
      () => useEntityPermissions(ResourceEntity.TABLE, 'svc.db.schema.tbl'),
      { wrapper: createWrapper() }
    );
    expect(result.current.isLoading).toBe(true);
    expect(result.current.canEditTags).toBe(false);

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.canEditTags).toBe(true); // EditAll fallback
    expect(result.current.canDelete).toBe(true);
    expect(mockApi).toHaveBeenCalledWith(ResourceEntity.TABLE, 'svc.db.schema.tbl');
  });

  it('entity-level conditionalAllow stays false (strict translation)', async () => {
    mockApi.mockResolvedValue({
      resource: 'table',
      permissions: [
        { operation: Operation.EditAll, access: Access.ConditionalAllow },
      ],
    });
    const { result } = renderHook(
      () => useEntityPermissions(ResourceEntity.TABLE, 'fqn'),
      { wrapper: createWrapper() }
    );
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.canEditAll).toBe(false);
  });

  it('deleted option gates edit flags', async () => {
    const { result } = renderHook(
      () => useEntityPermissions(ResourceEntity.TABLE, 'fqn', { deleted: true }),
      { wrapper: createWrapper() }
    );
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.canEditTags).toBe(false);
    expect(result.current.canDelete).toBe(true);
  });

  it('enabled=false performs no fetch and stays non-loading', () => {
    const { result } = renderHook(
      () => useEntityPermissions(ResourceEntity.TABLE, 'fqn', { enabled: false }),
      { wrapper: createWrapper() }
    );
    expect(mockApi).not.toHaveBeenCalled();
    expect(result.current.isLoading).toBe(false);
  });

  it('empty fqn performs no fetch', () => {
    renderHook(() => useEntityPermissions(ResourceEntity.TABLE, ''), {
      wrapper: createWrapper(),
    });
    expect(mockApi).not.toHaveBeenCalled();
  });

  it('fetch failure resolves with DEFAULT_ENTITY_PERMISSION and sets error', async () => {
    mockApi.mockRejectedValue(new Error('403'));
    const { result } = renderHook(
      () => useEntityPermissions(ResourceEntity.TABLE, 'fqn'),
      { wrapper: createWrapper() }
    );
    await waitFor(() => expect(result.current.error).toBeTruthy());
    expect(result.current.isLoading).toBe(false);
    expect(result.current.canEditTags).toBe(false);
  });

  it('two hook instances for the same entity share one request (dedup)', async () => {
    const wrapper = createWrapper();
    const a = renderHook(() => useEntityPermissions(ResourceEntity.TABLE, 'fqn'), { wrapper });
    const b = renderHook(() => useEntityPermissions(ResourceEntity.TABLE, 'fqn'), { wrapper });
    await waitFor(() => expect(a.result.current.isLoading).toBe(false));
    await waitFor(() => expect(b.result.current.isLoading).toBe(false));
    expect(mockApi).toHaveBeenCalledTimes(1);
  });

  it('flags object is referentially stable across unrelated re-renders', async () => {
    const { result, rerender } = renderHook(
      () => useEntityPermissions(ResourceEntity.TABLE, 'fqn'),
      { wrapper: createWrapper() }
    );
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    const before = result.current.can;
    rerender();
    expect(result.current.can).toBe(before);
  });

  it('fetches by id when passed { id }, under a distinct cache key', async () => {
    const { getEntityPermissionById } = jest.requireMock('../../rest/permissionAPI');
    (getEntityPermissionById as jest.Mock).mockResolvedValue(apiResponse);
    const { result } = renderHook(
      () => useEntityPermissions(ResourceEntity.TABLE, { id: 'uuid-1' }),
      { wrapper: createWrapper() }
    );
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(getEntityPermissionById).toHaveBeenCalledWith(ResourceEntity.TABLE, 'uuid-1');
    expect(mockApi).not.toHaveBeenCalled();
    expect(result.current.canEditTags).toBe(true);
  });

  it('refresh() invalidates and refetches', async () => {
    const { result } = renderHook(
      () => useEntityPermissions(ResourceEntity.TABLE, 'fqn'),
      { wrapper: createWrapper() }
    );
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    await act(() => result.current.refresh());
    expect(mockApi).toHaveBeenCalledTimes(2);
  });
});
