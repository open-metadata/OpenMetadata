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
import { useCopyEntityLink } from './useCopyEntityLink';

// Mock window.location
const mockOrigin = 'http://localhost:3000';

delete (window as unknown as { location: unknown }).location;
window.location = { origin: mockOrigin } as Location;

// Mock getEntityDetailsPath
jest.mock('../utils/RouterUtils', () => ({
  getEntityDetailsPath: jest.fn((entityType: EntityType, fqn: string) => {
    return `/${entityType.toLowerCase()}/${fqn}`;
  }),
}));

describe('useCopyEntityLink', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
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
      const writeTextMock = jest.fn().mockResolvedValue(undefined);
      Object.assign(navigator, {
        clipboard: {
          writeText: writeTextMock,
        },
      });

      const { result } = renderHook(() => useCopyEntityLink(EntityType.TABLE));

      let copyResult: boolean = false;
      await act(async () => {
        copyResult = await result.current.copyEntityLink('test.table.fqn');
      });

      expect(copyResult).toBe(true);
      expect(writeTextMock).toHaveBeenCalledWith(
        'http://localhost:3000/table/test.table.fqn'
      );
      expect(result.current.copiedFqn).toBe('test.table.fqn');
    });

    it('should fallback to execCommand when clipboard API fails', async () => {
      const writeTextMock = jest.fn().mockRejectedValue(new Error('Failed'));
      Object.assign(navigator, {
        clipboard: {
          writeText: writeTextMock,
        },
      });

      const execCommandMock = jest.fn().mockReturnValue(true);
      document.execCommand = execCommandMock;

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
      const writeTextMock = jest.fn().mockRejectedValue(new Error('Failed'));
      Object.assign(navigator, {
        clipboard: {
          writeText: writeTextMock,
        },
      });

      const execCommandMock = jest.fn().mockReturnValue(false);
      document.execCommand = execCommandMock;

      const { result } = renderHook(() =>
        useCopyEntityLink(EntityType.CONTAINER)
      );

      let copyResult: boolean = false;
      await act(async () => {
        copyResult = await result.current.copyEntityLink('test.container.fqn');
      });

      expect(copyResult).toBe(false);
      expect(result.current.copiedFqn).toBeUndefined();
    });

    it('should handle execCommand exception gracefully', async () => {
      const writeTextMock = jest.fn().mockRejectedValue(new Error('Failed'));
      Object.assign(navigator, {
        clipboard: {
          writeText: writeTextMock,
        },
      });

      document.execCommand = jest.fn().mockImplementation(() => {
        throw new Error('execCommand failed');
      });

      const { result } = renderHook(() => useCopyEntityLink(EntityType.TABLE));

      let copyResult: boolean = false;
      await act(async () => {
        copyResult = await result.current.copyEntityLink('test.fqn');
      });

      expect(copyResult).toBe(false);
      expect(result.current.copiedFqn).toBeUndefined();
    });
  });

  describe('copiedFqn state management', () => {
    it('should clear copiedFqn after timeout', async () => {
      const writeTextMock = jest.fn().mockResolvedValue(undefined);
      Object.assign(navigator, {
        clipboard: {
          writeText: writeTextMock,
        },
      });

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
      const writeTextMock = jest.fn().mockResolvedValue(undefined);
      Object.assign(navigator, {
        clipboard: {
          writeText: writeTextMock,
        },
      });

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
      const writeTextMock = jest.fn().mockResolvedValue(undefined);
      Object.assign(navigator, {
        clipboard: {
          writeText: writeTextMock,
        },
      });

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
      const writeTextMock = jest.fn().mockResolvedValue(undefined);
      Object.assign(navigator, {
        clipboard: {
          writeText: writeTextMock,
        },
      });

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
