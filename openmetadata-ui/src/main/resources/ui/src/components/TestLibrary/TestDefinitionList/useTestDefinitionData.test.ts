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
import { renderHook, waitFor } from '@testing-library/react';
import { act } from 'react';
import { CursorType } from '../../../enums/pagination.enum';
import { TestDefinition } from '../../../generated/tests/testDefinition';
import {
  getListTestDefinitions,
  patchTestDefinition,
} from '../../../rest/testAPI';
import { showErrorToast, showSuccessToast } from '../../../utils/ToastUtils';
import {
  useTestDefinitionData,
  UseTestDefinitionDataProps,
} from './useTestDefinitionData';

const MOCK_TEST_DEFINITIONS = [
  {
    id: 'id-1',
    name: 'columnValuesToBeUnique',
    fullyQualifiedName: 'columnValuesToBeUnique',
    enabled: false,
  },
  {
    id: 'id-2',
    name: 'tableRowCountToEqual',
    fullyQualifiedName: 'tableRowCountToEqual',
    enabled: true,
  },
] as unknown as TestDefinition[];

const MOCK_PAGING = { after: 'after-cursor', before: undefined, total: 2 };

const mockHandlePagingChange = jest.fn();
const mockFetchPermissions = jest.fn();

jest.mock('../../../rest/testAPI', () => ({
  getListTestDefinitions: jest.fn(),
  patchTestDefinition: jest.fn(),
}));

// The global setupTests mock for ToastUtils only exports showErrorToast; the
// data hook also calls showSuccessToast, so override the module here to provide
// both.
jest.mock('../../../utils/ToastUtils', () => ({
  showErrorToast: jest.fn(),
  showSuccessToast: jest.fn(),
}));

const makeProps = (
  overrides: Partial<UseTestDefinitionDataProps> = {}
): UseTestDefinitionDataProps => ({
  pageSize: 15,
  handlePagingChange: mockHandlePagingChange,
  pagingCursor: {},
  urlFilters: {},
  urlParams: {},
  fetchTestDefinitionPermissions: mockFetchPermissions,
  ...overrides,
});

const renderData = (props: UseTestDefinitionDataProps = makeProps()) =>
  renderHook(
    (hookProps: UseTestDefinitionDataProps) => useTestDefinitionData(hookProps),
    {
      initialProps: props,
    }
  );

const renderAndSettle = async (props?: UseTestDefinitionDataProps) => {
  const rendered = renderData(props);

  await waitFor(() => {
    expect(getListTestDefinitions).toHaveBeenCalled();
  });

  await waitFor(() => {
    expect(rendered.result.current.isLoading).toBe(false);
  });

  return rendered;
};

describe('useTestDefinitionData', () => {
  beforeEach(() => {
    mockHandlePagingChange.mockReset();
    mockFetchPermissions.mockReset().mockResolvedValue(undefined);
    (showSuccessToast as jest.Mock).mockClear();
    (showErrorToast as jest.Mock).mockClear();
    (getListTestDefinitions as jest.Mock)
      .mockReset()
      .mockResolvedValue({ data: MOCK_TEST_DEFINITIONS, paging: MOCK_PAGING });
    (patchTestDefinition as jest.Mock)
      .mockReset()
      .mockResolvedValue(MOCK_TEST_DEFINITIONS[0]);
  });

  describe('return shape', () => {
    it('should expose the rows, loading flag, setter, fetcher and toggle handler', async () => {
      const { result } = await renderAndSettle();

      const value = result.current;

      expect(value.testDefinitions).toEqual(MOCK_TEST_DEFINITIONS);
      expect(typeof value.isLoading).toBe('boolean');
      expect(typeof value.setTestDefinitions).toBe('function');
      expect(typeof value.fetchTestDefinitions).toBe('function');
      expect(typeof value.handleEnableToggle).toBe('function');
    });
  });

  describe('fetchTestDefinitions', () => {
    it('should load the list on mount with the page size, no cursor and no filters', async () => {
      const { result } = await renderAndSettle();

      expect(getListTestDefinitions).toHaveBeenCalledWith({
        after: undefined,
        before: undefined,
        limit: 15,
        entityType: undefined,
        testPlatform: undefined,
      });
      expect(result.current.testDefinitions).toEqual(MOCK_TEST_DEFINITIONS);
      expect(mockHandlePagingChange).toHaveBeenCalledWith(MOCK_PAGING);
    });

    it('should drive the injected row-permission fetch with the loaded rows', async () => {
      await renderAndSettle();

      expect(mockFetchPermissions).toHaveBeenCalledTimes(1);
      expect(mockFetchPermissions).toHaveBeenCalledWith(MOCK_TEST_DEFINITIONS);
    });

    it('should forward the first entityType and testPlatform url filter to the list call', async () => {
      await renderAndSettle(
        makeProps({
          urlFilters: {
            entityType: ['table'],
            testPlatforms: ['OpenMetadata'],
          },
        })
      );

      expect(getListTestDefinitions).toHaveBeenCalledWith({
        after: undefined,
        before: undefined,
        limit: 15,
        entityType: 'table',
        testPlatform: 'OpenMetadata',
      });
    });

    it('should surface a list failure through showErrorToast and stop loading', async () => {
      (getListTestDefinitions as jest.Mock).mockRejectedValueOnce(
        new Error('list failed')
      );

      const { result } = renderData();

      await waitFor(() => {
        expect(showErrorToast).toHaveBeenCalledTimes(1);
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(mockFetchPermissions).not.toHaveBeenCalled();
    });
  });

  describe('driving effect', () => {
    it('should refetch with an after cursor when the cursor carries an after value', async () => {
      const { rerender } = await renderAndSettle();

      (getListTestDefinitions as jest.Mock).mockClear();

      rerender(
        makeProps({
          pagingCursor: {
            cursorType: CursorType.AFTER,
            cursorValue: 'next-after',
          },
        })
      );

      await waitFor(() => {
        expect(getListTestDefinitions).toHaveBeenCalledWith({
          after: 'next-after',
          before: undefined,
          limit: 15,
          entityType: undefined,
          testPlatform: undefined,
        });
      });
    });

    it('should refetch with a before cursor when the cursor carries a before value', async () => {
      const { rerender } = await renderAndSettle();

      (getListTestDefinitions as jest.Mock).mockClear();

      rerender(
        makeProps({
          pagingCursor: {
            cursorType: CursorType.BEFORE,
            cursorValue: 'prev-before',
          },
        })
      );

      await waitFor(() => {
        expect(getListTestDefinitions).toHaveBeenCalledWith({
          after: undefined,
          before: 'prev-before',
          limit: 15,
          entityType: undefined,
          testPlatform: undefined,
        });
      });
    });

    it('should refetch without a cursor when a cursorType has no cursorValue', async () => {
      const { rerender } = await renderAndSettle();

      (getListTestDefinitions as jest.Mock).mockClear();

      rerender(
        makeProps({
          pagingCursor: {
            cursorType: CursorType.AFTER,
            cursorValue: undefined,
          },
        })
      );

      await waitFor(() => {
        expect(getListTestDefinitions).toHaveBeenCalledWith(
          expect.objectContaining({ after: undefined, before: undefined })
        );
      });
    });

    it('should refetch with the new limit when the page size changes', async () => {
      const { rerender } = await renderAndSettle();

      (getListTestDefinitions as jest.Mock).mockClear();

      rerender(makeProps({ pageSize: 25 }));

      await waitFor(() => {
        expect(getListTestDefinitions).toHaveBeenCalledWith(
          expect.objectContaining({ limit: 25 })
        );
      });
    });
  });

  describe('handleEnableToggle', () => {
    it('should patch a replace diff, toast success and optimistically flip the row', async () => {
      const { result } = await renderAndSettle();

      await act(async () => {
        await result.current.handleEnableToggle(MOCK_TEST_DEFINITIONS[0], true);
      });

      expect(patchTestDefinition).toHaveBeenCalledWith('id-1', [
        { op: 'replace', path: '/enabled', value: true },
      ]);
      expect(showSuccessToast).toHaveBeenCalledWith(
        'server.entity-updated-success'
      );

      const toggledRow = result.current.testDefinitions.find(
        (item) => item.id === 'id-1'
      );
      const untouchedRow = result.current.testDefinitions.find(
        (item) => item.id === 'id-2'
      );

      expect(toggledRow?.enabled).toBe(true);
      expect(untouchedRow?.enabled).toBe(true);
    });

    it('should flip only the toggled row, not same-valued siblings', async () => {
      const rows = [
        {
          ...MOCK_TEST_DEFINITIONS[0],
          id: 'row-a',
          name: 'row-a',
          enabled: false,
        },
        {
          ...MOCK_TEST_DEFINITIONS[0],
          id: 'row-b',
          name: 'row-b',
          enabled: false,
        },
      ];
      (getListTestDefinitions as jest.Mock).mockResolvedValueOnce({
        data: rows,
        paging: MOCK_PAGING,
      });

      const { result } = await renderAndSettle();

      await act(async () => {
        await result.current.handleEnableToggle(rows[0], true);
      });

      const toggled = result.current.testDefinitions.find(
        (item) => item.id === 'row-a'
      );
      const control = result.current.testDefinitions.find(
        (item) => item.id === 'row-b'
      );

      expect(toggled?.enabled).toBe(true);
      // A regression flipping every row would turn this same-valued sibling true.
      expect(control?.enabled).toBe(false);
    });

    it('should not toast success or mutate the row when the patch fails', async () => {
      (patchTestDefinition as jest.Mock).mockRejectedValueOnce(
        new Error('patch failed')
      );

      const { result } = await renderAndSettle();

      await act(async () => {
        await result.current.handleEnableToggle(MOCK_TEST_DEFINITIONS[0], true);
      });

      expect(showErrorToast).toHaveBeenCalledTimes(1);
      expect(showSuccessToast).not.toHaveBeenCalled();

      const row = result.current.testDefinitions.find(
        (item) => item.id === 'id-1'
      );

      expect(row?.enabled).toBe(false);
    });
  });
});
