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

import { Alert } from '@openmetadata/ui-core-components';
import { useQuery } from '@tanstack/react-query';
import { isAxiosError } from 'axios';
import { useTranslation } from 'react-i18next';
import { ResourceEntity } from '../../../../enums/permissions.enum';
import { Ontology } from '../../../../generated/entity/data/ontology';
import { useOntologyStudioModel } from '../../../../hooks/governance/ontology/useOntologyStudioModel';
import { useEntityPermissions } from '../../../../hooks/useEntityPermissions/useEntityPermissions';
import { getOntology, getOntologyConcept } from '../../../../rest/ontologyAPI';
import OntologyConceptInspector from '../OntologyConceptInspector/OntologyConceptInspector';

interface AggregateConceptInspectorProps {
  readonly conceptId: string;
  readonly onClose: () => void;
  readonly onEditConcept: (ontology: Ontology, conceptId: string) => void;
  readonly onOpenOwner: (ontology: Ontology, conceptId: string) => void;
  readonly onSelectConcept: (conceptId: string) => void;
}

const LINKED_CONCEPT_QUERY_KEY = 'ontology-linked-concept';

const MISSING_STATUSES = [403, 404];

const isMissing = (
  owner: { error: unknown; isSuccess: boolean; data?: Ontology },
  hasModel: boolean
) => {
  if (isAxiosError(owner.error)) {
    return MISSING_STATUSES.includes(owner.error.response?.status ?? 0);
  }

  return hasModel || (owner.isSuccess && !owner.data);
};

/**
 * Shows the inspector for a concept named in the URL when the catalog is too large to load as
 * one aggregate model, by reading the concept and its owner on their own.
 */
const AggregateConceptInspector = ({
  conceptId,
  onClose,
  onEditConcept,
  onOpenOwner,
  onSelectConcept,
}: AggregateConceptInspectorProps) => {
  const { t } = useTranslation();
  const owner = useQuery({
    queryKey: [LINKED_CONCEPT_QUERY_KEY, conceptId],
    staleTime: 30_000,
    retry: false,
    queryFn: async ({ signal }) => {
      const concept = await getOntologyConcept(conceptId, undefined, signal);

      return concept.ontology?.id
        ? getOntology(concept.ontology.id, undefined, signal)
        : undefined;
    },
  });
  const { model, relations } = useOntologyStudioModel(owner.data);
  const concept = model?.concepts.find((item) => item.id === conceptId);
  const { canEditAll } = useEntityPermissions(
    ResourceEntity.ONTOLOGY_CONCEPT,
    { id: concept?.id ?? '' },
    { enabled: Boolean(concept), deleted: concept?.deleted }
  );

  if (concept && model) {
    return (
      <OntologyConceptInspector
        concept={concept}
        model={model}
        relations={relations}
        onClose={onClose}
        onEdit={
          canEditAll
            ? () => onEditConcept(model.ontology, concept.id)
            : undefined
        }
        onOpenData={() => onOpenOwner(model.ontology, concept.id)}
        onSelectConcept={(item) => onSelectConcept(item.id)}
      />
    );
  }

  return isMissing(owner, Boolean(model)) ? (
    <div
      className="tw:w-80 tw:shrink-0 tw:p-4"
      data-testid="ontology-concept-not-found"
      role="alert">
      <Alert variant="warning">
        {t('message.ontology-concept-not-found', {
          version: t('label.draft'),
        })}
      </Alert>
    </div>
  ) : null;
};

export default AggregateConceptInspector;
