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
import React, { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation } from 'react-router-dom';
import { usePersonalSpaceStore } from '../../../../hooks/usePersonalSpaceStore';
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
  const close = usePersonalSpaceStore((state) => state.close);
  const { pathname } = useLocation();

  // Opening the modal never changes the route, so a pathname change while it is
  // open means a link inside it (e.g. a team/role/domain link in Permissions)
  // navigated away — close the overlay so it doesn't linger over the new page.
  // The first-render guard avoids a spurious close on mount.
  const isFirstRender = useRef(true);
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;

      return;
    }
    close();
  }, [pathname, close]);

  return (
    <ModalOverlay
      isOpen={activePanel !== null}
      onOpenChange={(isOpen) => !isOpen && close()}>
      <Modal>
        <Dialog
          showCloseButton
          className={DIALOG_CLASS}
          // Profile draws its own header; My Data has none of its own.
          title={activePanel === 'my-data' ? t('label.my-data') : undefined}
          width={1600}
          onClose={close}>
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
