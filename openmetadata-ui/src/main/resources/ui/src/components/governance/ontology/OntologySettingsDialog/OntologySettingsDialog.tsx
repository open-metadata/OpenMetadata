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
  Box,
  Dialog,
  Modal,
  ModalOverlay,
  Typography,
} from '@openmetadata/ui-core-components';
import { useTranslation } from 'react-i18next';
import { ResourceEntity } from '../../../../enums/permissions.enum';
import { Ontology } from '../../../../generated/entity/data/ontology';
import { useEntityPermissions } from '../../../../hooks/useEntityPermissions/useEntityPermissions';
import { getEntityName } from '../../../../utils/EntityNameUtils';
import OntologyCreateForm from '../OntologyCreateForm/OntologyCreateForm';

interface OntologySettingsDialogProps {
  readonly ontology: Ontology;
  readonly onClose: () => void;
  readonly onSaved: (ontology: Ontology) => void;
}

/** The ontology's settings from the picker menu, in a dialog over the Studio. */
const OntologySettingsDialog = ({
  ontology,
  onClose,
  onSaved,
}: OntologySettingsDialogProps) => {
  const { t } = useTranslation();
  const { canEditAll } = useEntityPermissions(
    ResourceEntity.ONTOLOGY,
    { id: ontology.id },
    { deleted: ontology.deleted }
  );

  return (
    <ModalOverlay
      isDismissable
      isOpen
      onOpenChange={(isOpen) => {
        if (!isOpen) {
          onClose();
        }
      }}>
      <Modal>
        <Dialog
          dividers="scroll"
          title={t('label.ontology-settings')}
          width={560}
          onClose={onClose}>
          <Dialog.Content>
            <Box data-testid="ontology-settings-dialog" direction="col" gap={4}>
              <Typography color="secondary" size="text-sm">
                {t('message.ontology-settings-description', {
                  name: getEntityName(ontology),
                })}
              </Typography>
              <OntologyCreateForm
                canEdit={canEditAll}
                key={`${ontology.id}:${ontology.version}`}
                layout="stacked"
                ontology={ontology}
                onSaved={onSaved}
              />
            </Box>
          </Dialog.Content>
        </Dialog>
      </Modal>
    </ModalOverlay>
  );
};

export default OntologySettingsDialog;
