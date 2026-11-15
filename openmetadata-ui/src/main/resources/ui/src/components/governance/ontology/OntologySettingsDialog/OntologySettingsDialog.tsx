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
  Typography,
} from '@openmetadata/ui-core-components';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { ResourceEntity } from '../../../../enums/permissions.enum';
import { Ontology } from '../../../../generated/entity/data/ontology';
import { useEntityPermissions } from '../../../../hooks/useEntityPermissions/useEntityPermissions';
import { getOntology } from '../../../../rest/ontologyAPI';
import { getEntityName } from '../../../../utils/EntityNameUtils';
import Loader from '../../../common/Loader/Loader';
import OntologyCreateForm from '../OntologyCreateForm/OntologyCreateForm';

interface OntologySettingsDialogProps {
  readonly ontology: Ontology;
  readonly onClose: () => void;
  readonly onSaved: (ontology: Ontology) => void;
}

// The fields the form edits; the picker's list entry carries none of the owners or reviewers.
const SETTINGS_FIELDS = 'owners,reviewers,publicationStatus';

/** The ontology's settings from the picker menu, in a dialog over the Studio. */
const OntologySettingsDialog = ({
  ontology,
  onClose,
  onSaved,
}: OntologySettingsDialogProps) => {
  const { t } = useTranslation();
  // A form seeded without owners or reviewers would save them away, so it waits for the full entity.
  const full = useQuery({
    queryKey: ['ontology-settings', ontology.id, ontology.version],
    queryFn: ({ signal }) => getOntology(ontology.id, SETTINGS_FIELDS, signal),
    gcTime: 0,
    retry: false,
  });
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
        <Dialog showCloseButton dividers="scroll" width={520} onClose={onClose}>
          <Dialog.Header
            className="tw:pr-12"
            title={t('label.ontology-settings')}>
            <Typography color="secondary" size="text-sm">
              {t('message.ontology-settings-description', {
                name: getEntityName(ontology),
              })}
            </Typography>
          </Dialog.Header>
          <div data-testid="ontology-settings-dialog">
            {full.data ? (
              <OntologyCreateForm
                canEdit={canEditAll}
                key={`${full.data.id}:${full.data.version}`}
                layout="dialog"
                ontology={full.data}
                onCancel={onClose}
                onSaved={onSaved}
              />
            ) : (
              <>
                <Dialog.Content>
                  {full.isPending ? <Loader /> : null}
                  {full.isError ? (
                    <Typography color="danger" role="alert" size="text-sm">
                      {t('server.entity-fetch-error', {
                        entity: t('label.ontology'),
                      })}
                    </Typography>
                  ) : null}
                </Dialog.Content>
                <Dialog.Footer>
                  <Button color="secondary" onPress={onClose}>
                    {t('label.cancel')}
                  </Button>
                </Dialog.Footer>
              </>
            )}
          </div>
        </Dialog>
      </Modal>
    </ModalOverlay>
  );
};

export default OntologySettingsDialog;
