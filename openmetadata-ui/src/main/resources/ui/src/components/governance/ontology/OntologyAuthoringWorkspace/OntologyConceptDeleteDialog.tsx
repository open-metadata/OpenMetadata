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
  Alert,
  Button,
  Checkbox,
  Dialog,
  Modal,
  ModalOverlay,
  Typography,
} from '@openmetadata/ui-core-components';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { OntologyConceptDeleteImpact } from '../../../../generated/api/data/ontologyConceptDeleteImpact';
import { EntityReference } from '../../../../generated/type/entityReference';
import {
  getOntologyConceptBindings,
  getOntologyConceptDeleteImpact,
  restoreOntologyDefinition,
  softDeleteOntologyDefinition,
} from '../../../../rest/ontologyAPI';
import { getEntityName } from '../../../../utils/EntityNameUtils';
import Loader from '../../../common/Loader/Loader';

interface DeletedConcept {
  /** Puts the concept back, then the references that went with it. */
  readonly restore: () => Promise<void>;
}

interface OntologyConceptDeleteDialogProps {
  readonly concept: Pick<EntityReference, 'id' | 'name' | 'displayName'>;
  readonly onCancel: () => void;
  readonly onDeleted: (deleted: DeletedConcept) => void;
}

const names = (references: readonly EntityReference[]) =>
  references.map((reference) => getEntityName(reference)).join(', ');

const summarizeImpact = (
  impact: OntologyConceptDeleteImpact | undefined,
  bindings: {
    isPending: boolean;
    data?: { assets: { asset: EntityReference }[] };
  },
  removeReferences: boolean
) => {
  const references = [
    ...(impact?.relationships ?? []),
    ...(impact?.rules ?? []),
  ];
  const blockers = impact?.blockers ?? [];
  const boundAssets = bindings.data?.assets.map(({ asset }) => asset) ?? [];
  const hasEffects =
    references.length + boundAssets.length + (impact?.children.length ?? 0) > 0;
  const referencesCleared = references.length === 0 || removeReferences;
  const canDelete =
    Boolean(impact) &&
    !bindings.isPending &&
    blockers.length === 0 &&
    referencesCleared;

  return { references, blockers, boundAssets, hasEffects, canDelete };
};

// Axioms go first because the server rejects deleting a concept that other
// definitions still name; a failure part-way puts back what was removed.
const cascadeDelete = async (
  conceptId: string,
  references: readonly EntityReference[]
) => {
  const removed: string[] = [];
  try {
    for (const reference of references) {
      await softDeleteOntologyDefinition('axiom', reference.id);
      removed.push(reference.id);
    }
    await softDeleteOntologyDefinition('concept', conceptId);
  } catch (error) {
    await Promise.allSettled(
      removed.map((id) => restoreOntologyDefinition('axiom', id))
    );

    throw error;
  }

  return async () => {
    await restoreOntologyDefinition('concept', conceptId);
    for (const id of removed) {
      await restoreOntologyDefinition('axiom', id);
    }
  };
};

const OntologyConceptDeleteDialog = ({
  concept,
  onCancel,
  onDeleted,
}: OntologyConceptDeleteDialogProps) => {
  const { t } = useTranslation();
  const name = getEntityName(concept);
  const [removeReferences, setRemoveReferences] = useState(true);
  const [isDeleting, setIsDeleting] = useState(false);
  const [failed, setFailed] = useState(false);
  const impact = useQuery({
    queryKey: ['ontology-concept-delete-impact', concept.id],
    queryFn: ({ signal }) => getOntologyConceptDeleteImpact(concept.id, signal),
    retry: false,
    gcTime: 0,
  });
  const bindings = useQuery({
    queryKey: ['ontology-concept-delete-bindings', concept.id],
    queryFn: ({ signal }) => getOntologyConceptBindings(concept.id, signal),
    retry: false,
    gcTime: 0,
  });

  const { references, blockers, boundAssets, hasEffects, canDelete } =
    summarizeImpact(impact.data, bindings, removeReferences);

  const remove = async () => {
    setIsDeleting(true);
    setFailed(false);
    try {
      onDeleted({ restore: await cascadeDelete(concept.id, references) });
    } catch {
      setFailed(true);
      setIsDeleting(false);
    }
  };

  const renderEffects = () => (
    <ul
      className="tw:m-0 tw:flex tw:list-disc tw:flex-col tw:gap-1 tw:pl-5"
      data-testid="ontology-concept-delete-impact">
      {impact.data && impact.data.children.length > 0 ? (
        <li data-testid="ontology-delete-children">
          {t('message.ontology-delete-children', {
            count: impact.data.children.length,
            names: names(impact.data.children),
          })}
        </li>
      ) : null}
      {impact.data && impact.data.relationships.length > 0 ? (
        <li data-testid="ontology-delete-relationships">
          {t('message.ontology-delete-relationships', {
            count: impact.data.relationships.length,
          })}
        </li>
      ) : null}
      {impact.data && impact.data.rules.length > 0 ? (
        <li data-testid="ontology-delete-rules">
          {t('message.ontology-delete-rules', {
            count: impact.data.rules.length,
          })}
        </li>
      ) : null}
      {boundAssets.length > 0 ? (
        <li data-testid="ontology-delete-bindings">
          {t('message.ontology-delete-bindings', {
            count: boundAssets.length,
            names: names(boundAssets),
          })}
        </li>
      ) : null}
    </ul>
  );

  const renderBody = () => {
    if (impact.isError) {
      return (
        <Alert variant="error">
          {t('server.entity-fetch-error', { entity: t('label.impact') })}
        </Alert>
      );
    }
    if (impact.isPending || bindings.isPending) {
      return <Loader size="small" />;
    }

    return (
      <div className="tw:flex tw:flex-col tw:gap-3">
        <Typography size="text-sm" weight="medium">
          {hasEffects
            ? t('message.ontology-delete-affects', { name })
            : t('message.ontology-delete-nothing-else', { name })}
        </Typography>
        {hasEffects ? renderEffects() : null}
        {references.length > 0 ? (
          <Checkbox
            data-testid="ontology-delete-remove-references"
            isSelected={removeReferences}
            label={t('message.ontology-delete-remove-references', { name })}
            onChange={setRemoveReferences}
          />
        ) : null}
        {blockers.length > 0 ? (
          <Alert data-testid="ontology-delete-blockers" variant="warning">
            {t('message.ontology-delete-blockers', {
              name,
              names: names(blockers),
            })}
          </Alert>
        ) : null}
        {failed ? (
          <Alert data-testid="ontology-delete-failed" variant="error">
            {t('message.ontology-concept-delete-failed', { name })}
          </Alert>
        ) : null}
      </div>
    );
  };

  return (
    <ModalOverlay
      isOpen
      isDismissable={!isDeleting}
      onOpenChange={(isOpen) => {
        if (!isOpen) {
          onCancel();
        }
      }}>
      <Modal>
        <Dialog
          data-testid="ontology-concept-delete-dialog"
          title={t('label.delete-entity', { entity: name })}
          width={520}
          onClose={onCancel}>
          <Dialog.Content>{renderBody()}</Dialog.Content>
          <Dialog.Footer>
            <Button
              color="secondary"
              data-testid="ontology-concept-delete-cancel"
              isDisabled={isDeleting}
              onPress={onCancel}>
              {t('label.cancel')}
            </Button>
            <Button
              color="primary-destructive"
              data-testid="ontology-concept-delete-confirm"
              isDisabled={!canDelete}
              isLoading={isDeleting}
              onPress={() => void remove()}>
              {t('label.delete')}
            </Button>
          </Dialog.Footer>
        </Dialog>
      </Modal>
    </ModalOverlay>
  );
};

export default OntologyConceptDeleteDialog;
