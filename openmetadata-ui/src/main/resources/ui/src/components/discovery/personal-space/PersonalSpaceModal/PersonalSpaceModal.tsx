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

import { Dialog, Modal, ModalOverlay } from '@openmetadata/ui-core-components';
import React, { useCallback, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation } from 'react-router-dom';
import { usePersonalSpaceStore } from '../../../../hooks/usePersonalSpaceStore';
import {
  useSettingsHash,
  useSettingsHashSync,
} from '../../../../hooks/useSettingsHash';
import withSuspenseFallback from '../../../AppRouter/withSuspenseFallback';
import PersonalSpaceGate from '../PersonalSpaceGate/PersonalSpaceGate';
import ProfilePage from '../Profile/ProfilePage';
import './personal-space-modal.less';

// The modal is mounted with the app shell, so My Data loads only when opened.
const MyData = withSuspenseFallback(
  React.lazy(() => import('../MyData/MyData'))
);

// Near-fullscreen sizing lives in `personal-space-modal.less` — it overrides
// the Dialog's content box (which otherwise sizes to content) into a full-height
// flex column so each page's header sits flush at the top and the body scrolls.
const DIALOG_CLASS = 'ai-personal-space__dialog';

/**
 * Single always-mounted overlay that hosts the personal-space Profile and My
 * Data surfaces. Which panel shows is driven by {@link usePersonalSpaceStore};
 * the user-menu items set it. Rendering the page inside the modal keeps the
 * current app-mode page untouched behind it (no route change). The Inbox is a
 * routed page, so it is not hosted here.
 */
const PersonalSpaceModal: React.FC = () => {
  const { t } = useTranslation();
  const activePanel = usePersonalSpaceStore((state) => state.activePanel);
  const suppressHashClear = usePersonalSpaceStore(
    (state) => state.suppressHashClear
  );
  const open = usePersonalSpaceStore((state) => state.open);
  const close = usePersonalSpaceStore((state) => state.close);
  const exitGuard = usePersonalSpaceStore((state) => state.exitGuard);
  const requestClose = useCallback(() => {
    if (!exitGuard?.(close)) {
      close();
    }
  }, [close, exitGuard]);
  const clearSuppressHashClear = usePersonalSpaceStore(
    (state) => state.clearSuppressHashClear
  );
  const { pathname } = useLocation();

  const isOpen = activePanel !== null;

  const openProfile = useCallback((panel: 'profile') => open(panel), [open]);

  const { state: hashState } = useSettingsHash();

  useSettingsHashSync(
    openProfile,
    isOpen,
    suppressHashClear,
    clearSuppressHashClear
  );

  // A pathname change while the modal is open means a link inside it navigated
  // away — close the overlay so it doesn't linger over the new page.
  // Skip if a settings hash is driving the modal — pathname changes during
  // initial routing or SPA navigation should not kill the hash-driven overlay.
  const isFirstRender = useRef(true);
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;

      return;
    }
    if (hashState.tab) {
      return;
    }
    close();
  }, [pathname, close, hashState.tab]);

  return (
    <ModalOverlay
      // The dialog is viewport-capped (see personal-space-modal.less) and scrolls
      // its own body, so the overlay must not add a second scrollbar — without
      // this it scrolls the whole dialog whenever an inner page (e.g. a long team
      // table) is tall. `!` beats the core overlay's base `overflow-y-auto`.
      isKeyboardDismissDisabled
      className="tw:overflow-hidden!"
      isOpen={isOpen}
      onOpenChange={(isOpen) => !isOpen && requestClose()}>
      <Modal>
        <Dialog
          showCloseButton
          className={DIALOG_CLASS}
          // Profile draws its own header; My Data has none of its own.
          title={activePanel === 'my-data' ? t('label.my-data') : undefined}
          width={1600}
          onClose={requestClose}>
          <PersonalSpaceGate>
            {activePanel === 'profile' && <ProfilePage />}
            {activePanel === 'my-data' && (
              <div className="tw:flex tw:min-h-0 tw:flex-1 tw:flex-col tw:p-4">
                <MyData />
              </div>
            )}
          </PersonalSpaceGate>
        </Dialog>
      </Modal>
    </ModalOverlay>
  );
};

export default PersonalSpaceModal;
