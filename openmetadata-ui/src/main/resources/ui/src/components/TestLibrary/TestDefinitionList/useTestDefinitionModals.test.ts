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
import { renderHook } from '@testing-library/react';
import { act } from 'react';
import { TestDefinition } from '../../../generated/tests/testDefinition';
import { deleteTestDefinitionByFqn } from '../../../rest/testAPI';
import { showErrorToast, showSuccessToast } from '../../../utils/ToastUtils';
import { useTestDefinitionModals } from './useTestDefinitionModals';

const MOCK_TEST_DEFINITIONS = [
  {
    id: 'id-1',
    name: 'columnValuesToBeUnique',
    fullyQualifiedName: 'columnValuesToBeUnique',
  },
  {
    id: 'id-2',
    name: 'tableRowCountToEqual',
    fullyQualifiedName: 'tableRowCountToEqual',
  },
] as unknown as TestDefinition[];

const mockSetTestDefinitions = jest.fn();
const mockResetPagingAndRefetch = jest.fn();

jest.mock('../../../rest/testAPI', () => ({
  deleteTestDefinitionByFqn: jest.fn(),
}));

// The global setupTests mock for ToastUtils only exports showErrorToast; the
// modals hook also calls showSuccessToast, so override the module here.
jest.mock('../../../utils/ToastUtils', () => ({
  showErrorToast: jest.fn(),
  showSuccessToast: jest.fn(),
}));

const renderModals = () =>
  renderHook(() =>
    useTestDefinitionModals({
      setTestDefinitions: mockSetTestDefinitions,
      resetPagingAndRefetch: mockResetPagingAndRefetch,
    })
  );

describe('useTestDefinitionModals', () => {
  beforeEach(() => {
    mockSetTestDefinitions.mockReset();
    mockResetPagingAndRefetch.mockReset();
    (showSuccessToast as jest.Mock).mockClear();
    (showErrorToast as jest.Mock).mockClear();
    (deleteTestDefinitionByFqn as jest.Mock)
      .mockReset()
      .mockResolvedValue(undefined);
  });

  describe('return shape', () => {
    it('should start with both modals closed and no selection or delete target', () => {
      const { result } = renderModals();

      const value = result.current;

      expect(value.isFormVisible).toBe(false);
      expect(value.isDeleteModalVisible).toBe(false);
      expect(value.selectedDefinition).toBeUndefined();
      expect(value.definitionToDelete).toBeUndefined();
      expect(typeof value.openCreateForm).toBe('function');
      expect(typeof value.handleEdit).toBe('function');
      expect(typeof value.handleDeleteClick).toBe('function');
      expect(typeof value.handleDeleteConfirm).toBe('function');
      expect(typeof value.handleDeleteCancel).toBe('function');
      expect(typeof value.handleFormSuccess).toBe('function');
      expect(typeof value.handleFormCancel).toBe('function');
    });
  });

  describe('create/edit form', () => {
    it('should open the form with no selection on openCreateForm without touching injected deps', () => {
      const { result } = renderModals();

      act(() => {
        result.current.openCreateForm();
      });

      expect(result.current.isFormVisible).toBe(true);
      expect(result.current.selectedDefinition).toBeUndefined();
      expect(mockResetPagingAndRefetch).not.toHaveBeenCalled();
      expect(mockSetTestDefinitions).not.toHaveBeenCalled();
    });

    it('should open the form with the given record on handleEdit', () => {
      const { result } = renderModals();

      act(() => {
        result.current.handleEdit(MOCK_TEST_DEFINITIONS[1]);
      });

      expect(result.current.isFormVisible).toBe(true);
      expect(result.current.selectedDefinition).toEqual(
        MOCK_TEST_DEFINITIONS[1]
      );
    });

    it('should close the form and clear the selection on handleFormCancel', () => {
      const { result } = renderModals();

      act(() => {
        result.current.handleEdit(MOCK_TEST_DEFINITIONS[1]);
      });

      act(() => {
        result.current.handleFormCancel();
      });

      expect(result.current.isFormVisible).toBe(false);
      expect(result.current.selectedDefinition).toBeUndefined();
      expect(mockResetPagingAndRefetch).not.toHaveBeenCalled();
    });

    it('should reset paging and refetch on a create success without patching rows', () => {
      const { result } = renderModals();

      act(() => {
        result.current.openCreateForm();
      });

      act(() => {
        result.current.handleFormSuccess();
      });

      expect(result.current.isFormVisible).toBe(false);
      expect(result.current.selectedDefinition).toBeUndefined();
      expect(mockResetPagingAndRefetch).toHaveBeenCalledTimes(1);
      expect(mockSetTestDefinitions).not.toHaveBeenCalled();
    });

    it('should patch the edited row in place on an edit success without refetching', () => {
      const { result } = renderModals();

      act(() => {
        result.current.handleEdit(MOCK_TEST_DEFINITIONS[1]);
      });

      const editedRow = {
        ...MOCK_TEST_DEFINITIONS[1],
        displayName: 'Edited Row',
      } as TestDefinition;

      act(() => {
        result.current.handleFormSuccess(editedRow);
      });

      expect(result.current.isFormVisible).toBe(false);
      expect(result.current.selectedDefinition).toBeUndefined();
      expect(mockResetPagingAndRefetch).not.toHaveBeenCalled();
      expect(mockSetTestDefinitions).toHaveBeenCalledTimes(1);

      const updater = mockSetTestDefinitions.mock.calls[0][0];
      const nextRows = updater(MOCK_TEST_DEFINITIONS);

      expect(nextRows).toEqual([MOCK_TEST_DEFINITIONS[0], editedRow]);
    });
  });

  describe('delete flow', () => {
    it('should open the delete modal with the target on handleDeleteClick without calling the api', () => {
      const { result } = renderModals();

      act(() => {
        result.current.handleDeleteClick(MOCK_TEST_DEFINITIONS[0]);
      });

      expect(result.current.isDeleteModalVisible).toBe(true);
      expect(result.current.definitionToDelete).toEqual(
        MOCK_TEST_DEFINITIONS[0]
      );
      expect(deleteTestDefinitionByFqn).not.toHaveBeenCalled();
    });

    it('should delete, toast, close the modal, clear the target and reset+refetch on confirm', async () => {
      const { result } = renderModals();

      act(() => {
        result.current.handleDeleteClick(MOCK_TEST_DEFINITIONS[0]);
      });

      await act(async () => {
        await result.current.handleDeleteConfirm();
      });

      expect(deleteTestDefinitionByFqn).toHaveBeenCalledWith(
        'columnValuesToBeUnique'
      );
      expect(showSuccessToast).toHaveBeenCalledWith(
        'server.entity-deleted-success'
      );
      expect(result.current.isDeleteModalVisible).toBe(false);
      expect(result.current.definitionToDelete).toBeUndefined();
      expect(mockResetPagingAndRefetch).toHaveBeenCalledTimes(1);
    });

    it('should be a no-op when confirm runs without a delete target', async () => {
      const { result } = renderModals();

      await act(async () => {
        await result.current.handleDeleteConfirm();
      });

      expect(deleteTestDefinitionByFqn).not.toHaveBeenCalled();
      expect(mockResetPagingAndRefetch).not.toHaveBeenCalled();
    });

    it('should keep the modal open and skip reset when the delete api fails', async () => {
      (deleteTestDefinitionByFqn as jest.Mock).mockRejectedValueOnce(
        new Error('delete failed')
      );

      const { result } = renderModals();

      act(() => {
        result.current.handleDeleteClick(MOCK_TEST_DEFINITIONS[0]);
      });

      await act(async () => {
        await result.current.handleDeleteConfirm();
      });

      expect(showErrorToast).toHaveBeenCalledTimes(1);
      expect(showSuccessToast).not.toHaveBeenCalled();
      expect(result.current.isDeleteModalVisible).toBe(true);
      expect(result.current.definitionToDelete).toEqual(
        MOCK_TEST_DEFINITIONS[0]
      );
      expect(mockResetPagingAndRefetch).not.toHaveBeenCalled();
    });

    it('should close the modal and clear the target without an api call on cancel', () => {
      const { result } = renderModals();

      act(() => {
        result.current.handleDeleteClick(MOCK_TEST_DEFINITIONS[0]);
      });

      act(() => {
        result.current.handleDeleteCancel();
      });

      expect(result.current.isDeleteModalVisible).toBe(false);
      expect(result.current.definitionToDelete).toBeUndefined();
      expect(deleteTestDefinitionByFqn).not.toHaveBeenCalled();
      expect(mockResetPagingAndRefetch).not.toHaveBeenCalled();
    });
  });
});
