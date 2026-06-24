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

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { UnsavedChangesModal } from '../../Modals/UnsavedChangesModal/UnsavedChangesModal.component';
import { NavigationBlockerProps } from './NavigationBlocker.interface';

export const NavigationBlocker: React.FC<NavigationBlockerProps> = ({
  children,
  enabled = false,
  onConfirm,
  onCancel,
  renderModal,
}) => {
  const navigate = useNavigate();
  const [isBlocking, setIsBlocking] = useState(enabled);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [loading, setLoading] = useState(false);
  const pendingNavigationRef = useRef<string | null>(null);
  const isNavigatingRef = useRef(false);

  useEffect(() => {
    setIsBlocking(enabled);
  }, [enabled]);

  useEffect(() => {
    if (!isBlocking || isNavigatingRef.current) {
      return;
    }

    const originalPushState = globalThis.history.pushState.bind(
      globalThis.history
    );
    const originalReplaceState = globalThis.history.replaceState.bind(
      globalThis.history
    );

    // Push a guard entry with the same URL. When the user presses browser back
    // (or navigate(-1) is called), the browser moves to this guard entry, which
    // has the identical URL. React Router sees no location change and does NOT
    // unmount the current page, so our popstate handler fires while the page is
    // still alive and can show the modal.
    originalPushState(null, '', globalThis.location.href);

    // Intercept programmatic React Router navigate(path) calls.
    globalThis.history.pushState = function (
      state: unknown,
      title: string,
      url?: string | URL | null
    ) {
      if (
        !isNavigatingRef.current &&
        url &&
        url !== globalThis.location.pathname
      ) {
        setIsModalVisible(true);
        pendingNavigationRef.current = url.toString();

        return;
      }

      return originalPushState(state, title, url);
    };

    globalThis.history.replaceState = function (
      state: unknown,
      title: string,
      url?: string | URL | null
    ) {
      if (
        !isNavigatingRef.current &&
        url &&
        url !== globalThis.location.pathname
      ) {
        setIsModalVisible(true);
        pendingNavigationRef.current = url.toString();

        return;
      }

      return originalReplaceState(state, title, url);
    };

    const handlePopState = () => {
      if (isNavigatingRef.current) {
        return;
      }

      // Re-push a guard entry so that repeated back presses are also intercepted.
      originalPushState(null, '', globalThis.location.href);
      setIsModalVisible(true);
      pendingNavigationRef.current = 'back';
    };

    // Intercept anchor link clicks (sidebar nav, external links rendered as <a>).
    const handleClick = (event: Event) => {
      if (isNavigatingRef.current) {
        return;
      }

      const target = event.target as HTMLElement;
      const link = target.closest('a[href]') as HTMLAnchorElement;

      if (link) {
        const href = link.getAttribute('href');
        const linkTarget = link.getAttribute('target');
        const download = link.getAttribute('download');

        const shouldBlock =
          href &&
          (href.startsWith('/') || href.startsWith('http')) &&
          !download &&
          (!linkTarget || linkTarget === '_self');

        if (shouldBlock) {
          event.preventDefault();
          event.stopPropagation();
          setIsModalVisible(true);
          pendingNavigationRef.current = href;
        }
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (
        !isNavigatingRef.current &&
        (event.key === 'F5' ||
          (event.ctrlKey && event.key === 'r') ||
          (event.metaKey && event.key === 'r'))
      ) {
        event.preventDefault();
        setIsModalVisible(true);
        pendingNavigationRef.current = 'reload';
      }
    };

    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!isNavigatingRef.current) {
        event.preventDefault();
        event.returnValue = '';

        return '';
      }

      return undefined;
    };

    globalThis.addEventListener('beforeunload', handleBeforeUnload);
    globalThis.addEventListener('popstate', handlePopState);
    document.addEventListener('click', handleClick, true);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      globalThis.removeEventListener('beforeunload', handleBeforeUnload);
      globalThis.removeEventListener('popstate', handlePopState);
      document.removeEventListener('click', handleClick, true);
      document.removeEventListener('keydown', handleKeyDown);
      globalThis.history.pushState = originalPushState;
      globalThis.history.replaceState = originalReplaceState;
    };
  }, [isBlocking]);

  const handleLeave = useCallback(async () => {
    setIsModalVisible(false);
    isNavigatingRef.current = true;
    setIsBlocking(false);

    const pendingUrl = pendingNavigationRef.current;
    pendingNavigationRef.current = null;

    setTimeout(() => {
      if (pendingUrl === 'back') {
        // go(-2): past the re-pushed guard entry AND past the original page entry.
        globalThis.history.go(-2);
      } else if (pendingUrl === 'reload') {
        globalThis.location.reload();
      } else if (pendingUrl?.startsWith('http')) {
        try {
          const parsed = new URL(pendingUrl);
          if (parsed.origin === globalThis.location.origin) {
            navigate(parsed.pathname + parsed.search + parsed.hash);
          } else {
            globalThis.location.href = pendingUrl;
          }
        } catch {
          globalThis.location.href = pendingUrl;
        }
      } else if (pendingUrl) {
        navigate(pendingUrl);
      }
    }, 50);
  }, [navigate]);

  const handleSaveAndLeave = useCallback(async () => {
    setLoading(true);
    try {
      await onConfirm?.();

      setIsModalVisible(false);
      isNavigatingRef.current = true;
      setIsBlocking(false);

      const pendingUrl = pendingNavigationRef.current;
      pendingNavigationRef.current = null;

      setTimeout(() => {
        if (pendingUrl === 'back') {
          globalThis.history.go(-2);
        } else if (pendingUrl === 'reload') {
          globalThis.location.reload();
        } else if (pendingUrl?.startsWith('http')) {
          try {
            const parsed = new URL(pendingUrl);
            if (parsed.origin === globalThis.location.origin) {
              navigate(parsed.pathname + parsed.search + parsed.hash);
            } else {
              globalThis.location.href = pendingUrl;
            }
          } catch {
            globalThis.location.href = pendingUrl;
          }
        } else if (pendingUrl) {
          navigate(pendingUrl);
        }
      }, 50);
    } catch {
      setLoading(false);
    }
  }, [navigate, onConfirm]);

  const handleModalClose = useCallback(() => {
    setIsModalVisible(false);
    pendingNavigationRef.current = null;
    onCancel?.();
  }, [onCancel]);

  return (
    <>
      {children}
      {renderModal ? (
        renderModal({
          isOpen: isModalVisible,
          onLeave: handleLeave,
          onStay: handleModalClose,
        })
      ) : (
        <UnsavedChangesModal
          loading={loading}
          open={isModalVisible}
          onCancel={handleModalClose}
          onDiscard={handleLeave}
          onSave={handleSaveAndLeave}
        />
      )}
    </>
  );
};
