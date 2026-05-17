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

import { act, renderHook } from '@testing-library/react-hooks';
import { useWorkflowNavigationBlock } from './useWorkflowNavigationBlock';

const mockNavigate = jest.fn();
const mockLocation = {
  pathname: '/workflows/test-workflow',
  search: '',
  hash: '',
};

jest.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
  useLocation: () => mockLocation,
}));

const INTERNAL_HREF = '/workflows';

const clickAnchor = (href: string) => {
  const anchor = document.createElement('a');
  anchor.setAttribute('href', href);
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
};

describe('useWorkflowNavigationBlock', () => {
  const onSaveWorkflow = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('event listener registration', () => {
    it('registers beforeunload, popstate and click listeners when enabled', () => {
      const globalSpy = jest.spyOn(globalThis, 'addEventListener');
      const docSpy = jest.spyOn(document, 'addEventListener');

      renderHook(() =>
        useWorkflowNavigationBlock({ enabled: true, onSaveWorkflow })
      );

      expect(globalSpy).toHaveBeenCalledWith(
        'beforeunload',
        expect.any(Function)
      );
      expect(globalSpy).toHaveBeenCalledWith('popstate', expect.any(Function));
      expect(docSpy).toHaveBeenCalledWith('click', expect.any(Function), true);
    });

    it('does not register listeners when disabled', () => {
      const globalSpy = jest.spyOn(globalThis, 'addEventListener');
      const docSpy = jest.spyOn(document, 'addEventListener');

      renderHook(() =>
        useWorkflowNavigationBlock({ enabled: false, onSaveWorkflow })
      );

      expect(globalSpy).not.toHaveBeenCalledWith(
        'beforeunload',
        expect.any(Function)
      );
      expect(globalSpy).not.toHaveBeenCalledWith(
        'popstate',
        expect.any(Function)
      );
      expect(docSpy).not.toHaveBeenCalledWith(
        'click',
        expect.any(Function),
        true
      );
    });

    it('removes all listeners on unmount', () => {
      const globalRemoveSpy = jest.spyOn(globalThis, 'removeEventListener');
      const docRemoveSpy = jest.spyOn(document, 'removeEventListener');

      const { unmount } = renderHook(() =>
        useWorkflowNavigationBlock({ enabled: true, onSaveWorkflow })
      );

      unmount();

      expect(globalRemoveSpy).toHaveBeenCalledWith(
        'beforeunload',
        expect.any(Function)
      );
      expect(globalRemoveSpy).toHaveBeenCalledWith(
        'popstate',
        expect.any(Function)
      );
      expect(docRemoveSpy).toHaveBeenCalledWith(
        'click',
        expect.any(Function),
        true
      );
    });
  });

  describe('link click interception', () => {
    it('shows modal and prevents navigation for an internal link', () => {
      const { result } = renderHook(() =>
        useWorkflowNavigationBlock({ enabled: true, onSaveWorkflow })
      );

      act(() => {
        clickAnchor(INTERNAL_HREF);
      });

      expect(result.current.showModal).toBe(true);
    });

    it('does not show modal for an external link', () => {
      const { result } = renderHook(() =>
        useWorkflowNavigationBlock({ enabled: true, onSaveWorkflow })
      );

      act(() => {
        clickAnchor('https://external.com/page');
      });

      expect(result.current.showModal).toBe(false);
    });

    it('does not show modal when clicking a link to the current path', () => {
      const { result } = renderHook(() =>
        useWorkflowNavigationBlock({ enabled: true, onSaveWorkflow })
      );

      act(() => {
        clickAnchor(mockLocation.pathname);
      });

      expect(result.current.showModal).toBe(false);
    });
  });

  describe('popstate interception', () => {
    it('shows modal and restores the URL when the browser navigates back', () => {
      const replaceStateSpy = jest.spyOn(globalThis.history, 'replaceState');

      const { result } = renderHook(() =>
        useWorkflowNavigationBlock({ enabled: true, onSaveWorkflow })
      );

      // jsdom's location.pathname is '/', which differs from mockLocation.pathname
      act(() => {
        globalThis.dispatchEvent(new PopStateEvent('popstate'));
      });

      expect(result.current.showModal).toBe(true);
      expect(replaceStateSpy).toHaveBeenCalledWith(
        null,
        '',
        `${mockLocation.pathname}${mockLocation.search}${mockLocation.hash}`
      );
    });
  });

  describe('modal actions', () => {
    const openModal = (
      result: ReturnType<
        typeof renderHook<
          Parameters<typeof useWorkflowNavigationBlock>[0],
          ReturnType<typeof useWorkflowNavigationBlock>
        >
      >['result']
    ) => {
      act(() => {
        clickAnchor(INTERNAL_HREF);
      });

      expect(result.current.showModal).toBe(true);
    };

    it('onCancel closes the modal without navigating', () => {
      const { result } = renderHook(() =>
        useWorkflowNavigationBlock({ enabled: true, onSaveWorkflow })
      );

      openModal(result);

      act(() => {
        result.current.onCancel();
      });

      expect(result.current.showModal).toBe(false);
      expect(mockNavigate).not.toHaveBeenCalled();
    });

    it('onDiscard closes the modal and navigates to the pending path', () => {
      const { result } = renderHook(() =>
        useWorkflowNavigationBlock({ enabled: true, onSaveWorkflow })
      );

      openModal(result);

      act(() => {
        result.current.onDiscard();
      });

      expect(result.current.showModal).toBe(false);
      expect(mockNavigate).toHaveBeenCalledWith(INTERNAL_HREF);
    });

    it('onSave calls onSaveWorkflow, closes the modal, and navigates on success', async () => {
      onSaveWorkflow.mockResolvedValue(true);
      const { result } = renderHook(() =>
        useWorkflowNavigationBlock({ enabled: true, onSaveWorkflow })
      );

      openModal(result);

      await act(async () => {
        await result.current.onSave();
      });

      expect(onSaveWorkflow).toHaveBeenCalledTimes(1);
      expect(result.current.showModal).toBe(false);
      expect(mockNavigate).toHaveBeenCalledWith(INTERNAL_HREF);
    });

    it('onSave calls onSaveWorkflow, closes the modal, and does not navigate on failure', async () => {
      onSaveWorkflow.mockResolvedValue(false);
      const { result } = renderHook(() =>
        useWorkflowNavigationBlock({ enabled: true, onSaveWorkflow })
      );

      openModal(result);

      await act(async () => {
        await result.current.onSave();
      });

      expect(onSaveWorkflow).toHaveBeenCalledTimes(1);
      expect(result.current.showModal).toBe(false);
      expect(mockNavigate).not.toHaveBeenCalled();
    });

    it('onSave sets isSaveLoading to true while saving and false after', async () => {
      let resolvePromise!: (value: boolean) => void;
      onSaveWorkflow.mockReturnValue(
        new Promise<boolean>((res) => {
          resolvePromise = res;
        })
      );

      const { result, waitForNextUpdate } = renderHook(() =>
        useWorkflowNavigationBlock({ enabled: true, onSaveWorkflow })
      );

      openModal(result);

      act(() => {
        void result.current.onSave();
      });

      expect(result.current.isSaveLoading).toBe(true);

      await act(async () => {
        resolvePromise(true);
        await waitForNextUpdate();
      });

      expect(result.current.isSaveLoading).toBe(false);
    });
  });
});
