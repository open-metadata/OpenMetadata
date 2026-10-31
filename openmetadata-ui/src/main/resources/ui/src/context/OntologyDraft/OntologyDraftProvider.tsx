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
import {
  Button,
  Dialog,
  Modal,
  ModalOverlay,
} from '@openmetadata/ui-core-components';
import { ReactNode, useCallback, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useWorkflowNavigationBlock } from '../../hooks/useWorkflowNavigationBlock';
import { OntologyDraftContext } from './OntologyDraftContext';

const OntologyDraftProvider = ({ children }: { children: ReactNode }) => {
  const { t } = useTranslation();
  const dirtyForms = useRef(new Set<string>());
  const [dirty, updateDirty] = useState(false);
  const [pending, setPending] = useState<() => void>();
  const setDirty = useCallback((id: string, next: boolean) => {
    if (next) {
      dirtyForms.current.add(id);
    } else {
      dirtyForms.current.delete(id);
    }
    updateDirty(dirtyForms.current.size > 0);
  }, []);
  const guard = useCallback((action: () => void) => {
    if (dirtyForms.current.size) {
      setPending(() => action);
    } else {
      action();
    }
  }, []);
  const routing = useWorkflowNavigationBlock({
    enabled: dirty,
    onSaveWorkflow: async () => false,
  });
  const value = useMemo(() => ({ setDirty, guard }), [setDirty, guard]);
  const cancel = () => {
    setPending(undefined);
    routing.onCancel();
  };
  const discard = () => {
    setPending(undefined);
    if (pending) {
      pending();
    } else {
      routing.onDiscard();
    }
  };

  return (
    <OntologyDraftContext.Provider value={value}>
      {children}
      <ModalOverlay
        isDismissable
        isOpen={Boolean(pending) || routing.showModal}
        onOpenChange={(open) => {
          if (!open) {
            cancel();
          }
        }}>
        <Modal>
          <Dialog
            dividers="scroll"
            title={t('message.discard-your-changes')}
            onClose={cancel}>
            <Dialog.Content>
              {t('message.unsaved-change-in-page')}
            </Dialog.Content>
            <Dialog.Footer>
              <Button color="secondary" onPress={cancel}>
                {t('label.cancel')}
              </Button>
              <Button color="primary-destructive" onPress={discard}>
                {t('label.discard')}
              </Button>
            </Dialog.Footer>
          </Dialog>
        </Modal>
      </ModalOverlay>
    </OntologyDraftContext.Provider>
  );
};

export default OntologyDraftProvider;
