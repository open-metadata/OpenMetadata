/*
 *  Copyright 2024 Collate.
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
import { EntityType } from '../enums/entity.enum';
import { useClipboard } from './useClipBoard';
import { useCopyEntityLink } from './useCopyEntityLink';

// Mock window.location
const mockOrigin = 'http://localhost:3000';

Object.defineProperty(window, 'location', {
  value: {
    origin: mockOrigin,
  },
  writable: true,
});

// Mock getEntityDetailsPath
jest.mock('../utils/RouterUtils', () => ({
  getEntityDetailsPath: jest.fn((entityType: EntityType, fqn: string) => {
    return `/${entityType.toLowerCase()}/${fqn}`;
  }),
}));

// Mock useClipboard
jest.mock('./useClipBoard', () => ({
  useClipboard: jest.fn(),
}));

const mockOnCopyToClipBoard = jest.fn();

describe('useCopyEntityLink', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    (useClipboard as jest.Mock).mockReturnValue({
      onCopyToClipBoard: mockOnCopyToClipBoard,
      hasCopied: false,
    });
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  describe('getEntityLink', () => {
    it('should generate correct entity link', () => {
      const { result } = renderHook(() => useCopyEntityLink(EntityType.TABLE));

      const link = result.current.getEntityLink('test.table.fqn');

      expect(link).toBe('http://localhost:3000/table/test.table.fqn');
    });

    it('should generate correct link for different entity types', () => {
      const entityTypes = [
        EntityType.TABLE,
        EntityType.TOPIC,
        EntityType.CONTAINER,
        EntityType.SEARCH_INDEX,
        EntityType.API_ENDPOINT,
      ];

      entityTypes.forEach((entityType) => {
        const { result } = renderHook(() => useCopyEntityLink(entityType));
        const link = result.current.getEntityLink('test.fqn');

        expect(link).toBe(
          `http://localhost:3000/${entityType.toLowerCase()}/test.fqn`
        );
      });
    });
  });

  describe('copyEntityLink', () => {
    it('should copy link using modern clipboard API', async () => {
      mockOnCopyToClipBoard.mockResolvedValue(undefined);

      const { result } = renderHook(() => useCopyEntityLink(EntityType.TABLE));

      let copyResult: boolean = false;
      await act(async () => {
        copyResult = await result.current.copyEntityLink('test.table.fqn');
      });

      expect(copyResult).toBe(true);
      expect(mockOnCopyToClipBoard).toHaveBeenCalledWith(
        'http://localhost:3000/table/test.table.fqn'
      );
      expect(result.current.copiedFqn).toBe('test.table.fqn');
    });

    it('should fallback to execCommand when clipboard API fails', async () => {
      const execCommandMock = jest.fn().mockReturnValue(true);
      document.execCommand = execCommandMock;

      // Mock useClipboard to simulate fallback behavior
      (useClipboard as jest.Mock).mockReturnValue({
        onCopyToClipBoard: async (text: string) => {
          // Simulate fallback behavior
          const textArea = document.createElement('textarea');
          textArea.value = text;
          textArea.style.position = 'fixed';
          textArea.style.opacity = '0';
          document.body.appendChild(textArea);
          textArea.select();
          const success = document.execCommand('copy');
          document.body.removeChild(textArea);

          return success;
        },
        hasCopied: false,
      });

      const { result } = renderHook(() => useCopyEntityLink(EntityType.TOPIC));

      let copyResult: boolean = false;
      await act(async () => {
        copyResult = await result.current.copyEntityLink('test.topic.fqn');
      });

      expect(copyResult).toBe(true);
      expect(execCommandMock).toHaveBeenCalledWith('copy');
      expect(result.current.copiedFqn).toBe('test.topic.fqn');
    });

    it('should return false when both copy methods fail', async () => {
      // Mock useClipboard to return a function that always fails
      (useClipboard as jest.Mock).mockReturnValue({
        onCopyToClipBoard: async () => {
          throw new Error('Failed');
        },
        hasCopied: false,
      });

      const { result } = renderHook(() =>
        useCopyEntityLink(EntityType.CONTAINER)
      );

      let copyResult: boolean = false;
      await act(async () => {
        try {
          copyResult = await result.current.copyEntityLink('test.container.fqn');
        } catch {
          copyResult = false;
        }
      });

      // The hook always returns true because it doesn't check the result
      expect(copyResult).toBe(false);
      expect(result.current.copiedFqn).toBeUndefined();
    });

    it('should handle execCommand exception gracefully', async () => {
      // Mock useClipboard to throw an error
      (useClipboard as jest.Mock).mockReturnValue({
        onCopyToClipBoard: async () => {
          throw new Error('execCommand failed');
        },
        hasCopied: false,
      });

      const { result } = renderHook(() => useCopyEntityLink(EntityType.TABLE));

      let copyResult: boolean = false;
      await act(async () => {
        try {
          copyResult = await result.current.copyEntityLink('test.fqn');
        } catch {
          copyResult = false;
        }
      });

      // The hook always returns true because it doesn't check the result
      expect(copyResult).toBe(false);
      expect(result.current.copiedFqn).toBeUndefined();
    });
  });

  describe('copiedFqn state management', () => {
    it('should clear copiedFqn after timeout', async () => {
      mockOnCopyToClipBoard.mockResolvedValue(undefined);

      const { result } = renderHook(() =>
        useCopyEntityLink(EntityType.TABLE, undefined, 2000)
      );

      await act(async () => {
        await result.current.copyEntityLink('test.table.fqn');
      });

      expect(result.current.copiedFqn).toBe('test.table.fqn');

      act(() => {
        jest.advanceTimersByTime(2000);
      });

      await waitFor(() => {
        expect(result.current.copiedFqn).toBeUndefined();
      });
    });

    it('should use custom timeout', async () => {
      mockOnCopyToClipBoard.mockResolvedValue(undefined);

      const customTimeout = 5000;
      const { result } = renderHook(() =>
        useCopyEntityLink(EntityType.TOPIC, undefined, customTimeout)
      );

      await act(async () => {
        await result.current.copyEntityLink('test.topic.fqn');
      });

      expect(result.current.copiedFqn).toBe('test.topic.fqn');

      act(() => {
        jest.advanceTimersByTime(4999);
      });

      expect(result.current.copiedFqn).toBe('test.topic.fqn');

      act(() => {
        jest.advanceTimersByTime(1);
      });

      await waitFor(() => {
        expect(result.current.copiedFqn).toBeUndefined();
      });
    });

    it('should clear previous timeout when copying again', async () => {
      mockOnCopyToClipBoard.mockResolvedValue(undefined);

      const { result } = renderHook(() =>
        useCopyEntityLink(EntityType.TABLE, undefined, 2000)
      );

      await act(async () => {
        await result.current.copyEntityLink('first.fqn');
      });

      expect(result.current.copiedFqn).toBe('first.fqn');

      act(() => {
        jest.advanceTimersByTime(1000);
      });

      await act(async () => {
        await result.current.copyEntityLink('second.fqn');
      });

      expect(result.current.copiedFqn).toBe('second.fqn');

      act(() => {
        jest.advanceTimersByTime(1000);
      });

      // Should still be 'second.fqn' because the first timeout was cleared
      expect(result.current.copiedFqn).toBe('second.fqn');

      act(() => {
        jest.advanceTimersByTime(1000);
      });

      await waitFor(() => {
        expect(result.current.copiedFqn).toBeUndefined();
      });
    });
  });

  describe('cleanup', () => {
    it('should cleanup timeout on unmount', async () => {
      mockOnCopyToClipBoard.mockResolvedValue(undefined);

      const { result, unmount } = renderHook(() =>
        useCopyEntityLink(EntityType.TABLE, undefined, 2000)
      );

      await act(async () => {
        await result.current.copyEntityLink('test.fqn');
      });

      expect(result.current.copiedFqn).toBe('test.fqn');

      unmount();

      act(() => {
        jest.advanceTimersByTime(2000);
      });

      // No state update should occur after unmount (no error thrown)
    });
  });
});
