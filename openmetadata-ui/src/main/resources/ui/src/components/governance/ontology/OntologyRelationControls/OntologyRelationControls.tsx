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
  ButtonUtility,
  Dialog,
  Modal,
  ModalOverlay,
} from '@openmetadata/ui-core-components';
import { Edit01 } from '@openmetadata/ui-core-components/icons';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { getEntityName } from '../../../../utils/EntityNameUtils';
import { OntologyModelRelation } from '../../../../utils/governance/ontology/OntologyStudioModel.utils';
import { InspectorRemoveButton } from '../../../OntologyExplorer/OntologyInspectorSection';
import RelationshipTypePicker from '../../../OntologyExplorer/RelationshipTypePicker.component';
import { RelationTypeOptionGroup } from '../../../OntologyExplorer/RelationshipTypePicker.interface';
import { useRelationWarning } from '../../../OntologyExplorer/RelationWarning.context';

interface OntologyRelationControlsProps {
  readonly relation: OntologyModelRelation;
  readonly groups: RelationTypeOptionGroup[];
  readonly canCreateRelationType: boolean;
  /** The reason the relation cannot take this type, or undefined. */
  readonly checkType: (typeId: string) => string | undefined;
  readonly onEdit: (typeId: string) => Promise<boolean>;
  readonly onDelete: () => Promise<boolean>;
}

/** Edit and delete for one relationship, shared by the concept inspector and the edge detail. */
const OntologyRelationControls = ({
  relation,
  groups,
  canCreateRelationType,
  checkType,
  onEdit,
  onDelete,
}: OntologyRelationControlsProps) => {
  const { t } = useTranslation();
  const [isPicking, setIsPicking] = useState(false);
  const [isBusy, setIsBusy] = useState(false);
  const warnRelation = useRelationWarning();

  const change = async (typeId: string) => {
    setIsBusy(true);
    const isChanged = await onEdit(typeId);
    setIsBusy(false);
    if (isChanged) {
      setIsPicking(false);
    }
  };
  const remove = async () => {
    setIsBusy(true);
    await onDelete();
    setIsBusy(false);
  };

  return (
    <>
      <ButtonUtility
        data-testid="ontology-relation-edit"
        icon={Edit01}
        isDisabled={isBusy}
        size="sm"
        tooltip={t('label.edit-entity', { entity: t('label.relationship') })}
        onClick={() => setIsPicking(true)}
      />
      <InspectorRemoveButton
        isDisabled={isBusy}
        label={t('label.delete-entity', { entity: t('label.relationship') })}
        testId="ontology-relation-delete"
        onRemove={() => void remove()}
      />
      <ModalOverlay
        isDismissable
        isOpen={isPicking}
        onOpenChange={(isOpen) => {
          if (!isOpen) {
            setIsPicking(false);
          }
        }}>
        <Modal>
          <Dialog
            aria-label={t('label.edit-entity', {
              entity: t('label.relationship'),
            })}
            width={320}
            onClose={() => setIsPicking(false)}>
            <RelationshipTypePicker
              canCreateType={canCreateRelationType}
              checkRelation={checkType}
              groups={groups}
              sourceLabel={getEntityName(relation.from)}
              targetLabel={getEntityName(relation.to)}
              warnRelation={(typeId) =>
                warnRelation?.(relation.from.id, relation.to.id, typeId) ??
                Promise.resolve(undefined)
              }
              onCancel={() => setIsPicking(false)}
              onSelect={(typeId) => void change(typeId)}
            />
          </Dialog>
        </Modal>
      </ModalOverlay>
    </>
  );
};

export default OntologyRelationControls;
