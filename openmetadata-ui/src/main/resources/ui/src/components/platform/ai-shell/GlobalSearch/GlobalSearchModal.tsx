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
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useGlobalSearchSources } from '../appModeExtensions';
import GlobalSearchPanel from './GlobalSearchPanel';
import { useGlobalSearchStore } from './useGlobalSearchStore';

/**
 * AI-mode global search. ⌘K opens it across everything, ⌥⌘K opens it on
 * chats; both are ignored while it is already open. Mounted once by the
 * app shell; anything else opens it through `useGlobalSearchStore`.
 */
const GlobalSearchModal = () => {
  const { t } = useTranslation();
  const isOpen = useGlobalSearchStore((state) => state.isOpen);
  const close = useGlobalSearchStore((state) => state.close);
  const openSearch = useGlobalSearchStore((state) => state.openSearch);
  const hasChats = useGlobalSearchSources().some(
    (source) => source.key === 'chats'
  );

  useEffect(() => {
    const handleShortcut = (event: KeyboardEvent) => {
      // `code`, not `key`: with ⌥ held macOS reports `key` as "˚".
      if (!(event.metaKey || event.ctrlKey) || event.code !== 'KeyK') {
        return;
      }
      event.preventDefault();
      if (!useGlobalSearchStore.getState().isOpen) {
        openSearch(event.altKey && hasChats ? 'chats' : 'all');
      }
    };
    window.addEventListener('keydown', handleShortcut);

    return () => window.removeEventListener('keydown', handleShortcut);
  }, [openSearch, hasChats]);

  // The panel owns Escape (clear the query first, then close), so the
  // overlay's own Escape dismissal is turned off.
  return (
    <ModalOverlay
      isDismissable
      isKeyboardDismissDisabled
      isOpen={isOpen}
      onOpenChange={(open) => !open && close()}>
      <Modal>
        <Dialog aria-label={t('label.search')} dividers="scroll" width={960}>
          {isOpen ? <GlobalSearchPanel /> : null}
        </Dialog>
      </Modal>
    </ModalOverlay>
  );
};

export default GlobalSearchModal;
