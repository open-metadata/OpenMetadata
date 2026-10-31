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
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import OntologyNativeImportPanel from '../OntologyReleaseExportModal/OntologyNativeImportPanel';

interface OntologyNativeImportDialogProps {
  readonly onClose: () => void;
}

const OntologyNativeImportDialog = ({
  onClose,
}: OntologyNativeImportDialogProps) => {
  const { t } = useTranslation();
  const [isBusy, setIsBusy] = useState(false);
  const handleClose = () => {
    if (!isBusy) {
      onClose();
    }
  };

  return (
    <ModalOverlay
      isOpen
      isDismissable={!isBusy}
      isKeyboardDismissDisabled={isBusy}
      onOpenChange={(isOpen) => {
        if (!isOpen) {
          handleClose();
        }
      }}>
      <Modal>
        <Dialog
          showCloseButton
          dividers="scroll"
          title={t('label.import-entity', { entity: t('label.ontology') })}
          width={820}
          onClose={handleClose}>
          <Dialog.Content>
            <OntologyNativeImportPanel
              canImport={false}
              onApplied={onClose}
              onBusyChange={setIsBusy}
            />
          </Dialog.Content>
        </Dialog>
      </Modal>
    </ModalOverlay>
  );
};

export default OntologyNativeImportDialog;
