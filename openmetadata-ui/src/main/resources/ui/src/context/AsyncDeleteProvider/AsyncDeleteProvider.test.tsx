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
import { act } from '@testing-library/react';
import { renderHook } from '@testing-library/react-hooks';
import React from 'react';
import { DeleteType } from '../../components/common/DeleteWidget/DeleteWidget.interface';
import { deleteAsyncEntity } from '../../rest/miscAPI';
import { showErrorToast, showSuccessToast } from '../../utils/ToastUtils';
import AsyncDeleteProvider, {
  useAsyncDeleteProvider,
} from './AsyncDeleteProvider';
import { AsyncDeleteWebsocketResponse } from './AsyncDeleteProvider.interface';

jest.mock('../../utils/ToastUtils', () => ({
  showErrorToast: jest.fn(),
  showSuccessToast: jest.fn(),
}));

jest.mock('../../rest/miscAPI', () => ({
  deleteAsyncEntity: jest.fn().mockImplementation(() => Promise.resolve()),
}));

const mockAfterDeleteAction = jest.fn();

describe('AsyncDeleteProvider', () => {
  const mockResponse = {
    entityName: 'DELETE',
    hardDelete: false,
    jobId: 'efc87367-01bd-4f9d-8d78-fea93bcb412f',
    message: 'Delete operation initiated for DELETE',
    recursive: true,
  };

  const mockDeleteParams = {
    entityName: 'TestEntity',
    entityId: 'test-id',
    entityType: 'test-type',
    deleteType: DeleteType.SOFT_DELETE,
    prepareType: false,
    isRecursiveDelete: false,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <AsyncDeleteProvider>{children}</AsyncDeleteProvider>
  );

  it('should initialize with empty asyncDeleteJob', () => {
    const { result } = renderHook(() => useAsyncDeleteProvider(), { wrapper });

    expect(result.current.asyncDeleteJob).toBeUndefined();
  });

  it('should handle successful entity deletion', async () => {
    (deleteAsyncEntity as jest.Mock).mockResolvedValueOnce(mockResponse);

    const { result } = renderHook(() => useAsyncDeleteProvider(), { wrapper });

    await act(async () => {
      await result.current.handleOnAsyncEntityDeleteConfirm(mockDeleteParams);
    });

    expect(deleteAsyncEntity).toHaveBeenCalledWith(
      'test-type',
      'test-id',
      false,
      false
    );
    expect(showSuccessToast).toHaveBeenCalledWith(mockResponse.message);
    expect(result.current.asyncDeleteJob).toEqual(mockResponse);
  });

  it('should handle failed entity deletion', async () => {
    const mockError = new Error('Delete failed');
    (deleteAsyncEntity as jest.Mock).mockRejectedValueOnce(mockError);

    const { result } = renderHook(() => useAsyncDeleteProvider(), { wrapper });

    await act(async () => {
      await result.current.handleOnAsyncEntityDeleteConfirm(mockDeleteParams);
    });

    expect(showErrorToast).toHaveBeenCalledWith(
      mockError,
      'server.delete-entity-error'
    );
    expect(mockAfterDeleteAction).not.toHaveBeenCalled();
  });

  it('should handle websocket response', async () => {
    const mockWebsocketResponse: AsyncDeleteWebsocketResponse = {
      status: 'COMPLETED',
      jobId: '123',
      entityName: 'TestEntity',
      error: null,
    };

    const { result } = renderHook(() => useAsyncDeleteProvider(), { wrapper });

    act(() => {
      result.current.handleDeleteEntityWebsocketResponse(mockWebsocketResponse);
    });

    expect(result.current.asyncDeleteJob).toEqual(
      expect.objectContaining(mockWebsocketResponse)
    );
  });

  it('should handle failed status from ref', async () => {
    const mockFailedResponse: AsyncDeleteWebsocketResponse = {
      status: 'FAILED',
      error: 'Delete operation failed',
      jobId: '123',
      entityName: 'TestEntity',
    };

    (deleteAsyncEntity as jest.Mock).mockResolvedValueOnce(mockFailedResponse);

    const { result } = renderHook(() => useAsyncDeleteProvider(), { wrapper });

    await act(async () => {
      result.current.handleDeleteEntityWebsocketResponse(mockFailedResponse);
    });

    await act(async () => {
      await result.current.handleOnAsyncEntityDeleteConfirm(mockDeleteParams);
    });

    expect(showErrorToast).toHaveBeenCalledWith('Delete operation failed');
  });

  it('should handle prepared entity type', async () => {
    (deleteAsyncEntity as jest.Mock).mockResolvedValueOnce(mockResponse);

    const { result } = renderHook(() => useAsyncDeleteProvider(), { wrapper });

    await act(async () => {
      await result.current.handleOnAsyncEntityDeleteConfirm({
        ...mockDeleteParams,
        prepareType: true,
      });
    });

    expect(deleteAsyncEntity).toHaveBeenCalledWith(
      expect.any(String),
      'test-id',
      false,
      false
    );
  });

  it('should execute afterDeleteAction if present', async () => {
    (deleteAsyncEntity as jest.Mock).mockResolvedValueOnce(mockResponse);
    const { result } = renderHook(() => useAsyncDeleteProvider(), { wrapper });

    await act(async () => {
      await result.current.handleOnAsyncEntityDeleteConfirm({
        ...mockDeleteParams,
        afterDeleteAction: mockAfterDeleteAction,
      });
    });

    expect(mockAfterDeleteAction).toHaveBeenCalledWith(true);
  });

  it('should execute onDeleteFailure when websocket returns FAILED status', async () => {
    const mockOnDeleteFailure = jest.fn();
    (deleteAsyncEntity as jest.Mock).mockResolvedValueOnce(mockResponse);

    const { result } = renderHook(() => useAsyncDeleteProvider(), { wrapper });

    // First, initiate delete with onDeleteFailure callback
    await act(async () => {
      await result.current.handleOnAsyncEntityDeleteConfirm({
        ...mockDeleteParams,
        onDeleteFailure: mockOnDeleteFailure,
      });
    });

    // Then simulate websocket FAILED response
    const mockFailedWebsocketResponse: AsyncDeleteWebsocketResponse = {
      status: 'FAILED',
      jobId: mockResponse.jobId,
      entityName: 'TestEntity',
      error: 'Delete operation failed',
    };

    act(() => {
      result.current.handleDeleteEntityWebsocketResponse(
        mockFailedWebsocketResponse
      );
    });

    expect(mockOnDeleteFailure).toHaveBeenCalled();
    expect(showErrorToast).toHaveBeenCalledWith('Delete operation failed');
  });

  it('should not execute onDeleteFailure when websocket returns COMPLETED status', async () => {
    const mockOnDeleteFailure = jest.fn();
    (deleteAsyncEntity as jest.Mock).mockResolvedValueOnce(mockResponse);

    const { result } = renderHook(() => useAsyncDeleteProvider(), { wrapper });

    // First, initiate delete with onDeleteFailure callback
    await act(async () => {
      await result.current.handleOnAsyncEntityDeleteConfirm({
        ...mockDeleteParams,
        onDeleteFailure: mockOnDeleteFailure,
      });
    });

    // Then simulate websocket COMPLETED response
    const mockCompletedWebsocketResponse: AsyncDeleteWebsocketResponse = {
      status: 'COMPLETED',
      jobId: mockResponse.jobId,
      entityName: 'TestEntity',
      error: null,
    };

    act(() => {
      result.current.handleDeleteEntityWebsocketResponse(
        mockCompletedWebsocketResponse
      );
    });

    expect(mockOnDeleteFailure).not.toHaveBeenCalled();
    expect(showSuccessToast).toHaveBeenCalledWith(
      'server.entity-deleted-successfully'
    );
  });

  it('should cleanup callback from pending map after websocket response', async () => {
    const mockOnDeleteFailure = jest.fn();
    (deleteAsyncEntity as jest.Mock).mockResolvedValueOnce(mockResponse);

    const { result } = renderHook(() => useAsyncDeleteProvider(), { wrapper });

    // Initiate delete
    await act(async () => {
      await result.current.handleOnAsyncEntityDeleteConfirm({
        ...mockDeleteParams,
        onDeleteFailure: mockOnDeleteFailure,
      });
    });

    // First websocket response
    act(() => {
      result.current.handleDeleteEntityWebsocketResponse({
        status: 'FAILED',
        jobId: mockResponse.jobId,
        entityName: 'TestEntity',
        error: 'Delete failed',
      });
    });

    expect(mockOnDeleteFailure).toHaveBeenCalledTimes(1);

    // Second websocket response with same jobId should not trigger callback again
    act(() => {
      result.current.handleDeleteEntityWebsocketResponse({
        status: 'FAILED',
        jobId: mockResponse.jobId,
        entityName: 'TestEntity',
        error: 'Delete failed again',
      });
    });

    // Callback should still only be called once (cleanup worked)
    expect(mockOnDeleteFailure).toHaveBeenCalledTimes(1);
  });
});
