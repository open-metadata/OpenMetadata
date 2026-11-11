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
import { Upload01 } from '@openmetadata/ui-core-components/icons';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Ontology } from '../../../../generated/entity/data/ontology';
import { getEntityName } from '../../../../utils/EntityNameUtils';
import OntologyNativeImportPanel from '../OntologyReleaseExportModal/OntologyNativeImportPanel';
import OntologyTransferDialogHeader from '../OntologyReleaseExportModal/OntologyTransferDialogHeader';

interface OntologyNativeImportDialogProps {
  readonly onClose: () => void;
  /** Without an ontology the file always becomes a new ontology. */
  readonly ontology?: Ontology;
  readonly canImport?: boolean;
  /** Lets the user import into a new ontology instead of `ontology`. */
  readonly isTargetSelectable?: boolean;
  readonly onApplied?: () => void;
}

const OntologyNativeImportDialog = ({
  onClose,
  ontology,
  canImport = false,
  isTargetSelectable,
  onApplied,
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
          data-testid="ontology-native-import-dialog"
          dividers="scroll"
          width={680}
          onClose={handleClose}>
          <OntologyTransferDialogHeader
            icon={Upload01}
            isCloseDisabled={isBusy}
            subtitle={ontology ? getEntityName(ontology) : undefined}
            title={
              ontology
                ? t('label.import-into-ontology')
                : t('label.import-entity', { entity: t('label.ontology') })
            }
            onClose={handleClose}
          />
          <OntologyNativeImportPanel
            canImport={canImport}
            isTargetSelectable={isTargetSelectable}
            ontology={ontology}
            onApplied={() => {
              onApplied?.();
              onClose();
            }}
            onBusyChange={setIsBusy}
            onCancel={handleClose}
          />
        </Dialog>
      </Modal>
    </ModalOverlay>
  );
};

export default OntologyNativeImportDialog;
