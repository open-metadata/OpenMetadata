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

import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

const NO_PENDING_PATH = null;

const isInternalLink = (
  href: string | null,
  currentPath: string
): href is string => Boolean(href?.startsWith('/') && href !== currentPath);

const blockAndShowModal = (
  pendingPath: string,
  pendingRef: React.MutableRefObject<string | null>,
  setShowModal: React.Dispatch<React.SetStateAction<boolean>>
) => {
  pendingRef.current = pendingPath;
  setShowModal(true);
};

const proceedToPendingPath = (
  pendingRef: React.MutableRefObject<string | null>,
  navigate: (path: string) => void
) => {
  const path = pendingRef.current;
  pendingRef.current = NO_PENDING_PATH;
  if (path) {
    navigate(path);
  }
};

const preventUnload = (e: BeforeUnloadEvent) => {
  e.preventDefault();
};

export interface UseWorkflowNavigationBlockOptions {
  enabled: boolean;
  onSaveWorkflow: () => Promise<boolean>;
}

export const useWorkflowNavigationBlock = ({
  enabled,
  onSaveWorkflow,
}: UseWorkflowNavigationBlockOptions) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [showModal, setShowModal] = useState(false);
  const [isSaveLoading, setIsSaveLoading] = useState(false);
  const pendingPathRef = useRef<string | null>(NO_PENDING_PATH);

  const handlePopState = useCallback(() => {
    const nextPath = globalThis.location.pathname;
    if (nextPath === location.pathname) {
      return;
    }

    globalThis.history.replaceState(
      null,
      '',
      `${location.pathname}${location.search}${location.hash}`
    );
    blockAndShowModal(nextPath, pendingPathRef, setShowModal);
  }, [location]);

  const handleLinkClick = useCallback(
    (e: MouseEvent) => {
      const anchor = (e.target as HTMLElement).closest('a');
      const href = anchor?.getAttribute('href') ?? null;

      if (!isInternalLink(href, location.pathname)) {
        return;
      }

      e.preventDefault();
      e.stopPropagation();
      blockAndShowModal(href, pendingPathRef, setShowModal);
    },
    [location.pathname]
  );

  useEffect(() => {
    if (!enabled) {
      return;
    }

    globalThis.addEventListener('beforeunload', preventUnload);
    globalThis.addEventListener('popstate', handlePopState);
    document.addEventListener('click', handleLinkClick, true);

    return () => {
      globalThis.removeEventListener('beforeunload', preventUnload);
      globalThis.removeEventListener('popstate', handlePopState);
      document.removeEventListener('click', handleLinkClick, true);
    };
  }, [enabled, handlePopState, handleLinkClick]);

  const closeModal = useCallback(() => {
    setShowModal(false);
    pendingPathRef.current = NO_PENDING_PATH;
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
      proceedToPendingPath(pendingPathRef, navigate);
    } else {
      pendingPathRef.current = NO_PENDING_PATH;
    }
  }, [onSaveWorkflow, navigate]);

  const onDiscard = useCallback(() => {
    setShowModal(false);
    proceedToPendingPath(pendingPathRef, navigate);
  }, [navigate]);

  return {
    showModal,
    isSaveLoading,
    onSave,
    onDiscard,
    onCancel: closeModal,
  };
};
