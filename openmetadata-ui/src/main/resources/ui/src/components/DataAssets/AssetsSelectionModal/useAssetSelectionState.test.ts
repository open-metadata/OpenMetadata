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
import { act, renderHook, waitFor } from '@testing-library/react';
import { useWebSocketConnector } from '../../../context/WebSocketProvider/WebSocketProvider';
import { SearchIndex } from '../../../enums/search.enum';
import { Status } from '../../../generated/type/bulkOperationResult';
import {
  addAssetsToDataProduct,
  addInputPortsToDataProduct,
  addOutputPortsToDataProduct,
  getDataProductByName,
} from '../../../rest/dataProductAPI';
import { addAssetsToDomain, getDomainByName } from '../../../rest/domainAPI';
import {
  addAssetsToGlossaryTerm,
  getGlossaryTermByFQN,
} from '../../../rest/glossaryAPI';
import { searchQuery } from '../../../rest/searchAPI';
import { addAssetsToTags, getTagByFqn } from '../../../rest/tagAPI';
import { getAssetsPageQuickFilters } from '../../../utils/AdvancedSearchPureUtils';
import { getDomainDryRunImpacts } from '../../../utils/Domain/DomainDryRunUtils';
import { showErrorToast } from '../../../utils/ToastUtils';
import { AssetsOfEntity } from '../../Glossary/GlossaryTerms/tabs/AssetsTabs.interface';
import { useAssetSelectionState } from './useAssetSelectionState';

jest.mock('../../../rest/searchAPI', () => ({
  searchQuery: jest.fn(),
}));

jest.mock('../../../rest/domainAPI', () => ({
  getDomainByName: jest.fn(),
  addAssetsToDomain: jest.fn(),
}));

jest.mock('../../../rest/dataProductAPI', () => ({
  getDataProductByName: jest.fn(),
  addAssetsToDataProduct: jest.fn(),
  addInputPortsToDataProduct: jest.fn(),
  addOutputPortsToDataProduct: jest.fn(),
}));

jest.mock('../../../rest/glossaryAPI', () => ({
  getGlossaryTermByFQN: jest.fn(),
  addAssetsToGlossaryTerm: jest.fn(),
}));

jest.mock('../../../rest/tagAPI', () => ({
  getTagByFqn: jest.fn(),
  addAssetsToTags: jest.fn(),
}));

jest.mock('../../../utils/ToastUtils', () => ({
  showErrorToast: jest.fn(),
}));

jest.mock('../../../utils/AdvancedSearchPureUtils', () => ({
  getAssetsPageQuickFilters: jest.fn().mockReturnValue([]),
}));

jest.mock('../../../utils/Domain/DomainDryRunUtils', () => ({
  getDomainDryRunImpacts: jest.fn().mockReturnValue([]),
}));

const mockSocket = {
  on: jest.fn(),
  off: jest.fn(),
};

jest.mock('../../../context/WebSocketProvider/WebSocketProvider', () => ({
  useWebSocketConnector: jest.fn(),
}));

const buildHit = (id: string) => ({
  _id: id,
  _index: 'index',
  _source: { id, name: id, entityType: 'table' },
});

const buildSearchResponse = (hits: unknown[], total = hits.length) => ({
  hits: { hits, total: { value: total } },
  aggregations: {},
});

describe('useAssetSelectionState', () => {
  const mockOnSave = jest.fn();
  const mockOnCancel = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    (useWebSocketConnector as jest.Mock).mockReturnValue({
      socket: mockSocket,
    });
    (searchQuery as jest.Mock).mockResolvedValue(buildSearchResponse([]));
    (getGlossaryTermByFQN as jest.Mock).mockResolvedValue({
      id: 'glossary-term-id',
      fullyQualifiedName: 'glossary.term',
    });
    (getDomainByName as jest.Mock).mockResolvedValue({
      id: 'domain-id',
      fullyQualifiedName: 'domain.name',
    });
    (getDataProductByName as jest.Mock).mockResolvedValue({
      id: 'data-product-id',
      fullyQualifiedName: 'data.product',
    });
    (getTagByFqn as jest.Mock).mockResolvedValue({
      id: 'tag-id',
      fullyQualifiedName: 'tag.name',
    });
  });

  const renderAssetSelectionState = (
    overrides: Partial<Parameters<typeof useAssetSelectionState>[0]> = {}
  ) =>
    renderHook(() =>
      useAssetSelectionState({
        entityFqn: 'glossary.term',
        open: true,
        type: AssetsOfEntity.GLOSSARY,
        variant: 'modal',
        onSave: mockOnSave,
        onCancel: mockOnCancel,
        ...overrides,
      })
    );

  it('should fetch entities on mount when open is true', async () => {
    (searchQuery as jest.Mock).mockResolvedValue(
      buildSearchResponse([buildHit('1'), buildHit('2')], 2)
    );

    const { result } = renderAssetSelectionState();

    await waitFor(() => {
      expect(result.current.items).toHaveLength(2);
    });

    expect(searchQuery).toHaveBeenCalledWith(
      expect.objectContaining({
        pageNumber: 1,
        pageSize: 25,
        query: '',
        includeDeleted: false,
      })
    );
    expect(result.current.totalCount).toBe(2);
  });

  it('should not fetch entities when open is false', async () => {
    renderAssetSelectionState({ open: false });

    await waitFor(() => {
      expect(searchQuery).not.toHaveBeenCalled();
    });
  });

  it('should use DATA_ASSET search index for glossary type', async () => {
    renderAssetSelectionState({ type: AssetsOfEntity.GLOSSARY });

    await waitFor(() => {
      expect(searchQuery).toHaveBeenCalledWith(
        expect.objectContaining({ searchIndex: SearchIndex.DATA_ASSET })
      );
    });
  });

  it('should use ALL search index for domain type', async () => {
    renderAssetSelectionState({ type: AssetsOfEntity.DOMAIN });

    await waitFor(() => {
      expect(searchQuery).toHaveBeenCalledWith(
        expect.objectContaining({ searchIndex: SearchIndex.ALL })
      );
    });
  });

  it('should fetch the current glossary term for GLOSSARY type', async () => {
    renderAssetSelectionState({ type: AssetsOfEntity.GLOSSARY });

    await waitFor(() => {
      expect(getGlossaryTermByFQN).toHaveBeenCalledWith(
        'glossary.term',
        expect.anything()
      );
    });
  });

  it('should fetch the current domain for DOMAIN type', async () => {
    renderAssetSelectionState({ type: AssetsOfEntity.DOMAIN });

    await waitFor(() => {
      expect(getDomainByName).toHaveBeenCalledWith('glossary.term');
    });
  });

  it('should fetch the current data product for DATA_PRODUCT type', async () => {
    renderAssetSelectionState({ type: AssetsOfEntity.DATA_PRODUCT });

    await waitFor(() => {
      expect(getDataProductByName).toHaveBeenCalledWith(
        'glossary.term',
        expect.anything()
      );
    });
  });

  it('should fetch the current tag for TAG type', async () => {
    renderAssetSelectionState({ type: AssetsOfEntity.TAG });

    await waitFor(() => {
      expect(getTagByFqn).toHaveBeenCalledWith('glossary.term');
    });
  });

  it('should toggle item selection on handleCardClick', async () => {
    (searchQuery as jest.Mock).mockResolvedValue(
      buildSearchResponse([buildHit('1')], 1)
    );

    const { result } = renderAssetSelectionState();

    await waitFor(() => {
      expect(result.current.items).toHaveLength(1);
    });

    act(() => {
      result.current.handleCardClick({ id: '1', entityType: 'table' } as never);
    });

    expect(result.current.selectedItems?.has('1')).toBe(true);

    act(() => {
      result.current.handleCardClick({ id: '1', entityType: 'table' } as never);
    });

    expect(result.current.selectedItems?.has('1')).toBe(false);
  });

  it('should select all loaded items when onSelectAll(true) is called', async () => {
    (searchQuery as jest.Mock).mockResolvedValue(
      buildSearchResponse([buildHit('1'), buildHit('2')], 2)
    );

    const { result } = renderAssetSelectionState();

    await waitFor(() => {
      expect(result.current.items).toHaveLength(2);
    });

    act(() => {
      result.current.onSelectAll(true);
    });

    expect(result.current.selectedItems?.size).toBe(2);
  });

  it('should clear selection when onSelectAll(false) is called', async () => {
    (searchQuery as jest.Mock).mockResolvedValue(
      buildSearchResponse([buildHit('1')], 1)
    );

    const { result } = renderAssetSelectionState();

    await waitFor(() => {
      expect(result.current.items).toHaveLength(1);
    });

    act(() => {
      result.current.onSelectAll(true);
    });

    expect(result.current.selectedItems?.size).toBe(1);

    act(() => {
      result.current.onSelectAll(false);
    });

    expect(result.current.selectedItems?.size).toBe(0);
  });

  it('should fetch the next page on scroll near the bottom when more items remain', async () => {
    (searchQuery as jest.Mock).mockResolvedValue(
      buildSearchResponse([buildHit('1')], 5)
    );

    const { result } = renderAssetSelectionState();

    await waitFor(() => {
      expect(result.current.items).toHaveLength(1);
    });

    (searchQuery as jest.Mock).mockClear();

    act(() => {
      result.current.onScroll({
        currentTarget: {
          scrollHeight: 500,
          scrollTop: 470,
          clientHeight: 100,
        },
      } as never);
    });

    await waitFor(() => {
      expect(searchQuery).toHaveBeenCalledWith(
        expect.objectContaining({ pageNumber: 2 })
      );
    });
  });

  it('should not fetch more when all items are already loaded', async () => {
    (searchQuery as jest.Mock).mockResolvedValue(
      buildSearchResponse([buildHit('1')], 1)
    );

    const { result } = renderAssetSelectionState();

    await waitFor(() => {
      expect(result.current.items).toHaveLength(1);
    });

    (searchQuery as jest.Mock).mockClear();

    act(() => {
      result.current.onScroll({
        currentTarget: {
          scrollHeight: 500,
          scrollTop: 470,
          clientHeight: 100,
        },
      } as never);
    });

    expect(searchQuery).not.toHaveBeenCalled();
  });

  it('should update filters and derive quickFilterQuery on handleQuickFiltersValueSelect', async () => {
    (getAssetsPageQuickFilters as jest.Mock).mockReturnValue([
      { key: 'entityType', value: [] },
    ]);

    const { result } = renderAssetSelectionState();

    await waitFor(() => {
      expect(result.current.filters).toHaveLength(1);
    });

    act(() => {
      result.current.handleQuickFiltersValueSelect({
        key: 'entityType',
        value: [{ key: 'table', label: 'Table' }],
      } as never);
    });

    expect(
      result.current.filters.find((f) => f.key === 'entityType')?.value
    ).toHaveLength(1);
  });

  it('should clear all filter values and quickFilterQuery on clearFilters', async () => {
    (getAssetsPageQuickFilters as jest.Mock).mockReturnValue([
      { key: 'entityType', value: [] },
    ]);

    const { result } = renderAssetSelectionState();

    await waitFor(() => {
      expect(result.current.filters).toHaveLength(1);
    });

    act(() => {
      result.current.handleQuickFiltersValueSelect({
        key: 'entityType',
        value: [{ key: 'table', label: 'Table' }],
      } as never);
    });

    act(() => {
      result.current.clearFilters();
    });

    expect(result.current.quickFilterQuery).toBeUndefined();
    expect(result.current.filters.every((f) => f?.value?.length === 0)).toBe(
      true
    );
  });

  describe('save flow', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    const selectOneItem = async (
      result: ReturnType<typeof renderAssetSelectionState>['result']
    ) => {
      await waitFor(() => {
        expect(result.current.items).toHaveLength(1);
      });

      act(() => {
        result.current.handleCardClick({
          id: '1',
          entityType: 'table',
        } as never);
      });
    };

    it('should save glossary assets and call onSave/onCancel after success', async () => {
      (searchQuery as jest.Mock).mockResolvedValue(
        buildSearchResponse([buildHit('1')], 1)
      );
      (addAssetsToGlossaryTerm as jest.Mock).mockResolvedValue({
        status: Status.Success,
      });

      const { result } = renderAssetSelectionState({
        type: AssetsOfEntity.GLOSSARY,
      });

      await selectOneItem(result);

      await act(async () => {
        result.current.onSaveAction();
      });

      expect(addAssetsToGlossaryTerm).toHaveBeenCalled();

      await act(async () => {
        jest.advanceTimersByTime(500);
      });

      await waitFor(() => {
        expect(mockOnSave).toHaveBeenCalled();
        expect(mockOnCancel).toHaveBeenCalled();
      });
    });

    it('should save data product assets via addAssetsToDataProduct', async () => {
      (searchQuery as jest.Mock).mockResolvedValue(
        buildSearchResponse([buildHit('1')], 1)
      );
      (addAssetsToDataProduct as jest.Mock).mockResolvedValue({
        status: Status.Success,
      });

      const { result } = renderAssetSelectionState({
        type: AssetsOfEntity.DATA_PRODUCT,
      });

      await selectOneItem(result);

      await act(async () => {
        result.current.onSaveAction();
      });

      expect(addAssetsToDataProduct).toHaveBeenCalledWith(
        'data.product',
        expect.any(Array)
      );
    });

    it('should save input ports via addInputPortsToDataProduct', async () => {
      (searchQuery as jest.Mock).mockResolvedValue(
        buildSearchResponse([buildHit('1')], 1)
      );
      (addInputPortsToDataProduct as jest.Mock).mockResolvedValue({
        status: Status.Success,
      });

      const { result } = renderAssetSelectionState({
        type: AssetsOfEntity.DATA_PRODUCT_INPUT_PORT,
      });

      await selectOneItem(result);

      await act(async () => {
        result.current.onSaveAction();
      });

      expect(addInputPortsToDataProduct).toHaveBeenCalledWith(
        'data.product',
        expect.any(Array)
      );
    });

    it('should save output ports via addOutputPortsToDataProduct', async () => {
      (searchQuery as jest.Mock).mockResolvedValue(
        buildSearchResponse([buildHit('1')], 1)
      );
      (addOutputPortsToDataProduct as jest.Mock).mockResolvedValue({
        status: Status.Success,
      });

      const { result } = renderAssetSelectionState({
        type: AssetsOfEntity.DATA_PRODUCT_OUTPUT_PORT,
      });

      await selectOneItem(result);

      await act(async () => {
        result.current.onSaveAction();
      });

      expect(addOutputPortsToDataProduct).toHaveBeenCalledWith(
        'data.product',
        expect.any(Array)
      );
    });

    it('should save tag assets via addAssetsToTags', async () => {
      (searchQuery as jest.Mock).mockResolvedValue(
        buildSearchResponse([buildHit('1')], 1)
      );
      (addAssetsToTags as jest.Mock).mockResolvedValue({
        status: Status.Success,
      });

      const { result } = renderAssetSelectionState({
        type: AssetsOfEntity.TAG,
      });

      await selectOneItem(result);

      await act(async () => {
        result.current.onSaveAction();
      });

      expect(addAssetsToTags).toHaveBeenCalledWith('tag-id', expect.any(Array));
    });

    it('should set failedStatus when the save response is not successful', async () => {
      (searchQuery as jest.Mock).mockResolvedValue(
        buildSearchResponse([buildHit('1')], 1)
      );
      const failedResult = {
        status: Status.Failure,
        failedRequest: [{ request: { id: '1' }, message: 'could not save' }],
      };
      (addAssetsToGlossaryTerm as jest.Mock).mockResolvedValue(failedResult);

      const { result } = renderAssetSelectionState({
        type: AssetsOfEntity.GLOSSARY,
      });

      await selectOneItem(result);

      await act(async () => {
        result.current.onSaveAction();
      });

      await waitFor(() => {
        expect(result.current.failedStatus).toEqual(failedResult);
      });

      expect(result.current.getErrorStatusAndMessage('1')).toEqual({
        isError: true,
        errorMessage: 'could not save',
      });
      expect(mockOnSave).not.toHaveBeenCalled();
    });

    it('should set assetJobResponse when the save response is a bulk job', async () => {
      (searchQuery as jest.Mock).mockResolvedValue(
        buildSearchResponse([buildHit('1')], 1)
      );
      (addAssetsToGlossaryTerm as jest.Mock).mockResolvedValue({
        jobId: 'job-1',
        message: 'started',
      });

      const { result } = renderAssetSelectionState({
        type: AssetsOfEntity.GLOSSARY,
      });

      await selectOneItem(result);

      await act(async () => {
        result.current.onSaveAction();
      });

      await waitFor(() => {
        expect(result.current.assetJobResponse).toEqual({
          jobId: 'job-1',
          message: 'started',
        });
      });
    });

    it('should show a drawer-specific toast when save throws in drawer variant', async () => {
      (searchQuery as jest.Mock).mockResolvedValue(
        buildSearchResponse([buildHit('1')], 1)
      );
      (addAssetsToGlossaryTerm as jest.Mock).mockRejectedValue(
        new Error('network error')
      );

      const { result } = renderAssetSelectionState({
        type: AssetsOfEntity.GLOSSARY,
        variant: 'drawer',
      });

      await selectOneItem(result);

      await act(async () => {
        result.current.onSaveAction();
      });

      await waitFor(() => {
        expect(showErrorToast).toHaveBeenCalledWith(
          expect.anything(),
          'server.add-entity-error'
        );
      });
    });

    it('should show a raw error toast when save throws in modal variant', async () => {
      (searchQuery as jest.Mock).mockResolvedValue(
        buildSearchResponse([buildHit('1')], 1)
      );
      const error = new Error('network error');
      (addAssetsToGlossaryTerm as jest.Mock).mockRejectedValue(error);

      const { result } = renderAssetSelectionState({
        type: AssetsOfEntity.GLOSSARY,
        variant: 'modal',
      });

      await selectOneItem(result);

      await act(async () => {
        result.current.onSaveAction();
      });

      await waitFor(() => {
        expect(showErrorToast).toHaveBeenCalledWith(error);
      });
    });

    it('should perform a domain dry run first and stop when there are impacts', async () => {
      (searchQuery as jest.Mock).mockResolvedValue(
        buildSearchResponse([buildHit('1')], 1)
      );
      (addAssetsToDomain as jest.Mock).mockResolvedValue({
        status: Status.Success,
      });
      (getDomainDryRunImpacts as jest.Mock).mockReturnValue([
        { request: { id: '1' } },
      ]);

      const { result } = renderAssetSelectionState({
        type: AssetsOfEntity.DOMAIN,
      });

      await selectOneItem(result);

      await act(async () => {
        result.current.onSaveAction();
      });

      expect(addAssetsToDomain).toHaveBeenCalledWith(
        'domain.name',
        expect.any(Array),
        { dryRun: true }
      );
      expect(addAssetsToDomain).toHaveBeenCalledTimes(1);

      await waitFor(() => {
        expect(result.current.dryRunWarnings).toEqual([
          { request: { id: '1' } },
        ]);
      });
    });

    it('should save directly when the domain dry run has no impacts', async () => {
      (searchQuery as jest.Mock).mockResolvedValue(
        buildSearchResponse([buildHit('1')], 1)
      );
      (addAssetsToDomain as jest.Mock).mockResolvedValue({
        status: Status.Success,
      });
      (getDomainDryRunImpacts as jest.Mock).mockReturnValue([]);

      const { result } = renderAssetSelectionState({
        type: AssetsOfEntity.DOMAIN,
      });

      await selectOneItem(result);

      await act(async () => {
        result.current.onSaveAction();
      });

      expect(addAssetsToDomain).toHaveBeenCalledTimes(2);
      expect(addAssetsToDomain).toHaveBeenLastCalledWith(
        'domain.name',
        expect.any(Array)
      );
    });

    it('should confirm the domain move using pending entities and clear warnings', async () => {
      (searchQuery as jest.Mock).mockResolvedValue(
        buildSearchResponse([buildHit('1')], 1)
      );
      (addAssetsToDomain as jest.Mock).mockResolvedValue({
        status: Status.Success,
      });
      (getDomainDryRunImpacts as jest.Mock).mockReturnValue([
        { request: { id: '1' } },
      ]);

      const { result } = renderAssetSelectionState({
        type: AssetsOfEntity.DOMAIN,
      });

      await selectOneItem(result);

      await act(async () => {
        result.current.onSaveAction();
      });

      await waitFor(() => {
        expect(result.current.dryRunWarnings).toBeDefined();
      });

      (addAssetsToDomain as jest.Mock).mockClear();

      let confirmPromise: Promise<void> | undefined;
      act(() => {
        confirmPromise = result.current.confirmDomainAssetMove();
      });

      await waitFor(() => {
        expect(addAssetsToDomain).toHaveBeenCalledWith(
          'domain.name',
          expect.any(Array)
        );
      });

      await act(async () => {
        jest.advanceTimersByTime(500);
        await confirmPromise;
      });

      expect(result.current.dryRunWarnings).toBeUndefined();
    });

    it('should cancel the domain move without calling the API', async () => {
      (searchQuery as jest.Mock).mockResolvedValue(
        buildSearchResponse([buildHit('1')], 1)
      );
      (addAssetsToDomain as jest.Mock).mockResolvedValue({
        status: Status.Success,
      });
      (getDomainDryRunImpacts as jest.Mock).mockReturnValue([
        { request: { id: '1' } },
      ]);

      const { result } = renderAssetSelectionState({
        type: AssetsOfEntity.DOMAIN,
      });

      await selectOneItem(result);

      await act(async () => {
        result.current.onSaveAction();
      });

      await waitFor(() => {
        expect(result.current.dryRunWarnings).toBeDefined();
      });

      (addAssetsToDomain as jest.Mock).mockClear();

      act(() => {
        result.current.cancelDomainAssetMove();
      });

      expect(addAssetsToDomain).not.toHaveBeenCalled();
      expect(result.current.dryRunWarnings).toBeUndefined();
    });
  });

  describe('websocket bulk assets channel', () => {
    it('should register and unregister the BULK_ASSETS_CHANNEL listener', () => {
      const { unmount } = renderAssetSelectionState();

      expect(mockSocket.on).toHaveBeenCalledWith(
        'bulkAssetsChannel',
        expect.any(Function)
      );

      unmount();

      expect(mockSocket.off).toHaveBeenCalledWith('bulkAssetsChannel');
    });

    it('should call onSave/onCancel when a COMPLETED success activity arrives', async () => {
      const { result } = renderAssetSelectionState();

      const handler = mockSocket.on.mock.calls[0][1];

      act(() => {
        handler(
          JSON.stringify({
            status: 'COMPLETED',
            result: { status: 'success' },
          })
        );
      });

      await waitFor(() => {
        expect(mockOnSave).toHaveBeenCalled();
        expect(mockOnCancel).toHaveBeenCalled();
      });

      expect(result.current.assetJobResponse).toBeUndefined();
    });

    it('should set failedStatus when a COMPLETED failure activity arrives', async () => {
      const { result } = renderAssetSelectionState();

      const handler = mockSocket.on.mock.calls[0][1];
      const failureResult = { status: 'failure', failedRequest: [] };

      act(() => {
        handler(
          JSON.stringify({
            status: 'COMPLETED',
            result: failureResult,
          })
        );
      });

      await waitFor(() => {
        expect(result.current.failedStatus).toEqual(failureResult);
      });
    });

    it('should set exportJob and clear assetJobResponse when a FAILED activity arrives', async () => {
      const { result } = renderAssetSelectionState();

      const handler = mockSocket.on.mock.calls[0][1];

      act(() => {
        handler(
          JSON.stringify({
            status: 'FAILED',
            error: 'job failed',
          })
        );
      });

      await waitFor(() => {
        expect(result.current.exportJob).toEqual(
          expect.objectContaining({ status: 'FAILED' })
        );
      });

      expect(result.current.assetJobResponse).toBeUndefined();
    });
  });
});
