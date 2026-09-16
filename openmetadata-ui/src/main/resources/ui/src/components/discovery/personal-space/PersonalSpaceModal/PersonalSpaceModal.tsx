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
import { useLocation } from 'react-router-dom';
import { usePersonalSpaceStore } from '../../../../hooks/usePersonalSpaceStore';
import PersonalSpaceGate from '../PersonalSpaceGate/PersonalSpaceGate';
import ProfilePage from '../Profile/ProfilePage';
import './personal-space-modal.less';

// Near-fullscreen sizing lives in `personal-space-modal.less` — it overrides
// the Dialog's content box (which otherwise sizes to content) into a full-height
// flex column so each page's header sits flush at the top and the body scrolls.
const DIALOG_CLASS = 'ai-personal-space__dialog';

/**
 * Single always-mounted overlay that hosts the personal-space Profile surface.
 * Which panel shows is driven by {@link usePersonalSpaceStore}; the sidebar /
 * user-menu triggers set it. Rendering the page inside the modal keeps the
 * current app-mode page untouched behind it (no route change). Inbox and My
 * Data are routed pages now, so `profile` is the only panel this modal hosts.
 */
const PersonalSpaceModal: React.FC = () => {
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
          width={1600}
          onClose={close}>
          <PersonalSpaceGate>
            {activePanel === 'profile' && <ProfilePage />}
          </PersonalSpaceGate>
        </Dialog>
      </Modal>
    </ModalOverlay>
  );
};

export default PersonalSpaceModal;
