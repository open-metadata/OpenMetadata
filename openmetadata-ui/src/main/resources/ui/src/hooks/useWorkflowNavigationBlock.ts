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

import { useCallback, useContext, useEffect, useRef, useState } from 'react';
import {
  UNSAFE_NavigationContext,
  useLocation,
  useNavigate,
} from 'react-router-dom';

const NO_PENDING_PATH = null;

const isInternalLink = (
  href: string | null,
  currentPath: string
): href is string =>
  Boolean(
    href?.startsWith('/') && !href.startsWith('//') && href !== currentPath
  );

const blockAndShowModal = (
  pendingPath: string,
  pendingRef: React.MutableRefObject<string | null>,
  setShowModal: React.Dispatch<React.SetStateAction<boolean>>
) => {
  pendingRef.current = pendingPath;
  setShowModal(true);
};

const preventUnload = (e: BeforeUnloadEvent) => {
  e.preventDefault();
  e.returnValue = '';
};

export interface UseWorkflowNavigationBlockOptions {
  enabled: boolean;
  blockProgrammaticNavigation?: boolean;
  isBlocked?: () => boolean;
  onSaveWorkflow: () => Promise<boolean>;
}

export const useWorkflowNavigationBlock = ({
  enabled,
  blockProgrammaticNavigation = false,
  isBlocked,
  onSaveWorkflow,
}: UseWorkflowNavigationBlockOptions) => {
  const navigate = useNavigate();
  const navigator = useContext(UNSAFE_NavigationContext)?.navigator;
  const location = useLocation();
  const [showModal, setShowModal] = useState(false);
  const [isSaveLoading, setIsSaveLoading] = useState(false);
  const pendingPathRef = useRef<string | null>(NO_PENDING_PATH);
  const pendingNavigation = useRef<() => void>();
  const bypass = useRef(false);
  const blockCheck = useRef(isBlocked);
  blockCheck.current = isBlocked;

  const currentEntry = useRef(globalThis.history.state);
  const pendingPop = useRef<{
    delta: number;
    sourceIndex: number;
    state: unknown;
  }>();
  const restoring = useRef(false);
  const allowPop = useRef(false);
  const currentPath = `${location.pathname}${location.search}${location.hash}`;

  const runWithoutBlocking = useCallback((action: () => void) => {
    const previous = bypass.current;
    bypass.current = true;
    try {
      action();
    } finally {
      bypass.current = previous;
    }
  }, []);

  const proceed = useCallback(() => {
    const path = pendingPathRef.current;
    const pop = pendingPop.current;
    const navigation = pendingNavigation.current;
    pendingNavigation.current = undefined;
    pendingPathRef.current = NO_PENDING_PATH;
    pendingPop.current = undefined;
    if (navigation) {
      runWithoutBlocking(navigation);
    } else if (pop && path) {
      const currentIndex = globalThis.history.state?.idx;
      const targetIndex = pop.sourceIndex + pop.delta;
      // A save can push View mode, replacing the original forward entry.
      const targetSurvives =
        typeof currentIndex === 'number' &&
        (currentIndex === pop.sourceIndex || pop.delta < 0);
      if (targetSurvives && targetIndex !== currentIndex) {
        allowPop.current = true;
        globalThis.history.go(targetIndex - currentIndex);
      } else {
        runWithoutBlocking(() =>
          navigate(path, { replace: true, state: pop.state })
        );
      }
    } else if (path) {
      runWithoutBlocking(() => navigate(path));
    }
  }, [navigate, runWithoutBlocking]);

  useEffect(() => {
    if (!enabled || !blockProgrammaticNavigation || !navigator) {
      return;
    }
    const { push, replace } = navigator;
    const intercept =
      (method: typeof push): typeof push =>
      (...args) => {
        if (bypass.current || blockCheck.current?.() === false) {
          method(...args);
        } else {
          pendingNavigation.current = () => method(...args);
          pendingPathRef.current = NO_PENDING_PATH;
          pendingPop.current = undefined;
          setShowModal(true);
        }
      };
    // BrowserRouter shares this navigator with sidebar buttons outside the editor subtree.
    navigator.push = intercept(push);
    navigator.replace = intercept(replace);

    return () => {
      navigator.push = push;
      navigator.replace = replace;
    };
  }, [enabled, blockProgrammaticNavigation, navigator]);

  const handlePopState = useCallback(
    (event: PopStateEvent) => {
      if (allowPop.current) {
        allowPop.current = false;

        return;
      }
      if (restoring.current) {
        event.stopImmediatePropagation();
        restoring.current = false;
        setShowModal(true);

        return;
      }
      const nextPath =
        globalThis.location.pathname +
        globalThis.location.search +
        globalThis.location.hash;
      if (nextPath === currentPath) {
        return;
      }
      // Restore the existing entry before React Router can unmount the dirty editor.
      event.stopImmediatePropagation();
      pendingNavigation.current = undefined;
      pendingPathRef.current = nextPath;
      const previousIndex = currentEntry.current?.idx;
      const nextIndex = event.state?.idx;
      if (
        typeof previousIndex === 'number' &&
        typeof nextIndex === 'number' &&
        previousIndex !== nextIndex
      ) {
        pendingPop.current = {
          delta: nextIndex - previousIndex,
          sourceIndex: previousIndex,
          state: event.state?.usr,
        };
        restoring.current = true;
        globalThis.history.go(-pendingPop.current.delta);
      } else {
        globalThis.history.replaceState(currentEntry.current, '', currentPath);
        setShowModal(true);
      }
    },
    [currentPath]
  );

  const handleLinkClick = useCallback(
    (e: MouseEvent) => {
      const anchor = (e.target as HTMLElement).closest('a');
      const href = anchor?.getAttribute('href') ?? null;

      const opensElsewhere = [
        e.defaultPrevented,
        e.button !== 0,
        e.ctrlKey,
        e.metaKey,
        e.shiftKey,
        e.altKey,
        anchor?.hasAttribute('download'),
        anchor?.target && anchor.target !== '_self',
      ].some(Boolean);
      if (opensElsewhere || !isInternalLink(href, currentPath)) {
        return;
      }

      e.preventDefault();
      e.stopPropagation();
      pendingNavigation.current = undefined;
      pendingPop.current = undefined;
      blockAndShowModal(href, pendingPathRef, setShowModal);
    },
    [currentPath]
  );

  useEffect(() => {
    if (!enabled) {
      return;
    }

    allowPop.current = false;
    currentEntry.current = globalThis.history.state;
    globalThis.addEventListener('beforeunload', preventUnload);
    globalThis.addEventListener('popstate', handlePopState, true);
    document.addEventListener('click', handleLinkClick, true);

    return () => {
      globalThis.removeEventListener('beforeunload', preventUnload);
      globalThis.removeEventListener('popstate', handlePopState, true);
      document.removeEventListener('click', handleLinkClick, true);
    };
  }, [enabled, handlePopState, handleLinkClick]);

  const closeModal = useCallback(() => {
    setShowModal(false);
    pendingPathRef.current = NO_PENDING_PATH;
    pendingPop.current = undefined;
    pendingNavigation.current = undefined;
  }, []);

  const onSave = useCallback(async () => {
    setIsSaveLoading(true);
    let saved = false;
    try {
      saved = await onSaveWorkflow();
    } finally {
      setIsSaveLoading(false);
    }

    setShowModal(false);
    if (saved) {
      proceed();
    } else {
      pendingPathRef.current = NO_PENDING_PATH;
      pendingPop.current = undefined;
      pendingNavigation.current = undefined;
    }
  }, [onSaveWorkflow, proceed]);

  const onDiscard = useCallback(() => {
    setShowModal(false);
    proceed();
  }, [proceed]);

  return {
    showModal,
    isSaveLoading,
    onSave,
    onDiscard,
    onCancel: closeModal,
    runWithoutBlocking,
  };
};
