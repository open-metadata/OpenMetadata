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

import { Modal } from 'antd';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { NavigationBlockerProps } from './NavigationBlocker.interface';

/**
 * NavigationBlocker component that wraps content and blocks navigation when enabled
 *
 * Usage:
 * <NavigationBlocker
 *   enabled={hasUnsavedChanges}
 *   message="You have unsaved changes. Are you sure you want to leave?"
 *   title="Unsaved Changes"
 *   confirmText="Leave"
 *   cancelText="Stay"
 * >
 *   <YourContent />
 * </NavigationBlocker>
 */
export const NavigationBlocker: React.FC<NavigationBlockerProps> = ({
  children,
  enabled = false,
  message = 'You have unsaved changes which will be discarded.',
  title = 'Are you sure you want to leave?',
  confirmText = 'Leave',
  cancelText = 'Stay',
  onConfirm,
  onCancel,
}) => {
  const [isBlocking, setIsBlocking] = useState(enabled);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [blockingMessage, setBlockingMessage] = useState(message);
  const pendingNavigationRef = useRef<string | null>(null);
  const isNavigatingRef = useRef(false);

  // Update blocking state when enabled/message changes
  useEffect(() => {
    setIsBlocking(enabled);
    setBlockingMessage(message);
  }, [enabled, message]);

  useEffect(() => {
    if (!isBlocking || isNavigatingRef.current) {
      return;
    }

    // Handle page refresh/close - only show browser dialog for actual tab close
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      // Only show for actual tab close, not for programmatic navigation
      if (!isNavigatingRef.current) {
        event.preventDefault();
        event.returnValue = blockingMessage;

        return blockingMessage;
      }

      return undefined;
    };

    // Store original navigation methods
    const originalPushState = window.history.pushState;
    const originalReplaceState = window.history.replaceState;

    // Block programmatic navigation (useNavigate, etc.)
    window.history.pushState = function (
      state: unknown,
      title: string,
      url?: string | URL | null
    ) {
      if (!isNavigatingRef.current && url && url !== window.location.pathname) {
        setIsModalVisible(true);
        pendingNavigationRef.current = url.toString();

        return; // Block the navigation
      }

      return originalPushState.call(
        window.history,
        state,
        title,
        url as string
      );
    };

    window.history.replaceState = function (
      state: unknown,
      title: string,
      url?: string | URL | null
    ) {
      if (!isNavigatingRef.current && url && url !== window.location.pathname) {
        setIsModalVisible(true);
        pendingNavigationRef.current = url.toString();

        return; // Block the navigation
      }

      return originalReplaceState.call(
        window.history,
        state,
        title,
        url as string
      );
    };

    // Block browser back/forward
    const handlePopState = () => {
      if (!isNavigatingRef.current) {
        // Restore current state to prevent navigation
        window.history.pushState(null, '', window.location.href);
        setIsModalVisible(true);
        pendingNavigationRef.current = 'back';
      }
    };

    // Block link clicks
    const handleClick = (event: Event) => {
      if (isNavigatingRef.current) {
        return;
      }

      const target = event.target as HTMLElement;
      const link = target.closest('a[href]') as HTMLAnchorElement;

      if (link) {
        const href = link.getAttribute('href');
        if (href && (href.startsWith('/') || href.startsWith('http'))) {
          event.preventDefault();
          event.stopPropagation();
          setIsModalVisible(true);
          pendingNavigationRef.current = href;
        }
      }
    };

    // Block keyboard shortcuts (F5, Ctrl+R)
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

    // Add all event listeners
    window.addEventListener('beforeunload', handleBeforeUnload);
    window.addEventListener('popstate', handlePopState);
    document.addEventListener('click', handleClick, true);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      // Clean up
      window.removeEventListener('beforeunload', handleBeforeUnload);
      window.removeEventListener('popstate', handlePopState);
      document.removeEventListener('click', handleClick, true);
      document.removeEventListener('keydown', handleKeyDown);

      // Restore original methods
      window.history.pushState = originalPushState;
      window.history.replaceState = originalReplaceState;
    };
  }, [isBlocking, blockingMessage]);

  const handleConfirm = useCallback(() => {
    setIsModalVisible(false);
    isNavigatingRef.current = true;

    // Call custom onConfirm if provided
    onConfirm?.();

    // Disable blocking to prevent double modals
    setIsBlocking(false);

    if (pendingNavigationRef.current) {
      const pendingUrl = pendingNavigationRef.current;
      pendingNavigationRef.current = null;

      // Handle different navigation types
      setTimeout(() => {
        if (pendingUrl === 'back') {
          window.history.back();
        } else if (pendingUrl === 'reload') {
          window.location.reload();
        } else if (pendingUrl.startsWith('http')) {
          window.location.href = pendingUrl;
        } else {
          // For internal routes, use full URL to ensure proper loading
          window.location.href = window.location.origin + pendingUrl;
        }
      }, 50);
    }
  }, [onConfirm]);

  const handleCancel = useCallback(() => {
    setIsModalVisible(false);
    pendingNavigationRef.current = null;

    // Call custom onCancel if provided
    onCancel?.();
  }, [onCancel]);

  return (
    <>
      {children}
      <Modal
        cancelText={cancelText}
        okText={confirmText}
        open={isModalVisible}
        title={title}
        onCancel={handleCancel}
        onOk={handleConfirm}>
        <p>{blockingMessage}</p>
      </Modal>
    </>
  );
};
