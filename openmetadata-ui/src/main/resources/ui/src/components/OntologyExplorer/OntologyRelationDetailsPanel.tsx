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
  Divider,
  Select,
  SelectItemType,
  Typography,
} from '@openmetadata/ui-core-components';
import { XClose } from '@untitledui/icons';
import { Key, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Provenance as UpdateProvenance,
  Status as UpdateEntityStatus,
  UpdateTermRelation,
} from '../../generated/api/data/updateTermRelation';
import { RelationshipType } from '../../generated/entity/data/relationshipType';
import { EntityStatus, Provenance } from '../../generated/type/termRelation';
import { formatDateTime } from '../../utils/date-time/DateTimeUtils';
import { MergedEdge, OntologyNode } from './OntologyExplorer.interface';
import OntologyInferenceExplanationPanel from './OntologyInferenceExplanationPanel';

interface OntologyRelationDetailsPanelProps {
  readonly edge: MergedEdge | null;
  readonly isEditable: boolean;
  readonly isSaving: boolean;
  readonly nodes: OntologyNode[];
  readonly relationshipTypes: RelationshipType[];
  readonly onClose: () => void;
  readonly onDelete: (edge: MergedEdge) => Promise<void>;
  readonly onUpdate: (
    edge: MergedEdge,
    update: UpdateTermRelation
  ) => Promise<void>;
}

interface RelationFieldProps {
  readonly label: string;
  readonly value: string;
}

const RelationField = ({ label, value }: RelationFieldProps) => (
  <div className="tw:flex tw:flex-col tw:gap-1">
    <Typography className="tw:text-tertiary" size="text-xs" weight="medium">
      {label}
    </Typography>
    <Typography className="tw:text-primary" size="text-sm">
      {value}
    </Typography>
  </div>
);

export const OntologyRelationDetailsPanel = ({
  edge,
  isEditable,
  isSaving,
  nodes,
  relationshipTypes,
  onClose,
  onDelete,
  onUpdate,
}: OntologyRelationDetailsPanelProps) => {
  const { t } = useTranslation();
  const [relationType, setRelationType] = useState('');
  const [provenance, setProvenance] = useState(UpdateProvenance.Manual);
  const [status, setStatus] = useState(UpdateEntityStatus.Draft);
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);

  useEffect(() => {
    setRelationType(edge?.relationType ?? '');
    setProvenance(toUpdateProvenance(edge?.provenance));
    setStatus(toUpdateStatus(edge?.status));
    setIsConfirmingDelete(false);
  }, [edge]);

  const nodeLabels = useMemo(
    () =>
      new Map(nodes.map((node) => [node.id, node.originalLabel ?? node.label])),
    [nodes]
  );
  const relationshipTypeOptions = useMemo<SelectItemType[]>(
    () =>
      relationshipTypes
        .filter((relationshipType) => !relationshipType.deleted)
        .map((relationshipType) => ({
          id: relationshipType.name,
          label: relationshipType.displayName,
        })),
    [relationshipTypes]
  );
  const provenanceOptions = useMemo<SelectItemType[]>(
    () => [
      { id: UpdateProvenance.Manual, label: t('label.manual') },
      { id: UpdateProvenance.Imported, label: t('label.imported') },
      { id: UpdateProvenance.AISuggested, label: t('label.suggestion') },
    ],
    [t]
  );
  const statusOptions = useMemo<SelectItemType[]>(
    () => [
      { id: UpdateEntityStatus.Draft, label: t('label.draft') },
      { id: UpdateEntityStatus.InReview, label: t('label.in-review') },
      { id: UpdateEntityStatus.Approved, label: t('label.approved') },
      { id: UpdateEntityStatus.Archived, label: t('label.archived') },
      { id: UpdateEntityStatus.Deprecated, label: t('label.deprecated') },
      { id: UpdateEntityStatus.Rejected, label: t('label.rejected') },
      { id: UpdateEntityStatus.Unprocessed, label: t('label.unprocessed') },
    ],
    [t]
  );
  const isDirty = Boolean(
    edge &&
      (relationType !== edge.relationType ||
        provenance !== toUpdateProvenance(edge.provenance) ||
        status !== toUpdateStatus(edge.status))
  );

  const save = async () => {
    if (edge) {
      await onUpdate(edge, { provenance, relationType, status });
    }
  };

  const remove = async () => {
    if (edge) {
      await onDelete(edge);
    }
  };

  const source = edge ? nodeLabels.get(edge.from) ?? edge.from : '';
  const target = edge ? nodeLabels.get(edge.to) ?? edge.to : '';
  const provenanceLabel = getProvenanceLabel(edge?.provenance, t);
  const statusLabel = getStatusLabel(edge?.status, t);

  if (!edge) {
    return null;
  }

  return (
    <aside
      aria-label={t('label.relationship')}
      className="tw:z-4 tw:flex tw:h-full tw:w-[300px] tw:shrink-0 tw:flex-col tw:gap-4 tw:overflow-y-auto tw:border-l tw:border-secondary tw:bg-primary tw:p-[18px]"
      data-testid="ontology-relation-details-panel">
      <div className="tw:flex tw:items-center tw:justify-between tw:gap-2">
        <span className="tw:font-body tw:text-[10px] tw:leading-normal tw:font-semibold tw:tracking-[0.08em] tw:text-quaternary tw:uppercase">
          {t('label.relationship')}
        </span>
        <button
          aria-label={t('label.close')}
          className="tw:shrink-0 tw:border-0 tw:bg-transparent tw:p-0 tw:text-fg-quaternary hover:tw:text-fg-secondary"
          type="button"
          onClick={onClose}>
          <XClose aria-hidden="true" className="tw:size-4" />
        </button>
      </div>
      <div className="tw:grid tw:grid-cols-2 tw:gap-x-3 tw:gap-y-4">
        <RelationField label={t('label.source')} value={source} />
        <RelationField label={t('label.target')} value={target} />
        <RelationField label={t('label.provenance')} value={provenanceLabel} />
        <RelationField label={t('label.status')} value={statusLabel} />
        <RelationField
          label={t('label.created-by')}
          value={edge?.createdBy ?? ''}
        />
        <RelationField
          label={t('label.created-at')}
          value={formatDateTime(edge?.createdAt)}
        />
      </div>
      {edge ? (
        <OntologyInferenceExplanationPanel
          edge={edge}
          nodes={nodes}
          relationshipTypes={relationshipTypes}
        />
      ) : null}
      {isEditable ? (
        <div className="tw:flex tw:flex-col tw:gap-5">
          <Divider orientation="horizontal" />
          <Select
            data-testid="relation-type-select"
            items={relationshipTypeOptions}
            label={t('label.relation-type')}
            value={relationType}
            onChange={(key: Key | null) => key && setRelationType(String(key))}>
            {(item) => <Select.Item {...item} />}
          </Select>
          <Select
            data-testid="relation-provenance-select"
            items={provenanceOptions}
            label={t('label.provenance')}
            value={provenance}
            onChange={(key: Key | null) =>
              key && setProvenance(toUpdateProvenanceValue(key))
            }>
            {(item) => <Select.Item {...item} />}
          </Select>
          <Select
            data-testid="relation-status-select"
            items={statusOptions}
            label={t('label.status')}
            value={status}
            onChange={(key: Key | null) =>
              key && setStatus(toUpdateStatusValue(key))
            }>
            {(item) => <Select.Item {...item} />}
          </Select>
          {isConfirmingDelete ? (
            <div className="tw:flex tw:flex-col tw:gap-2">
              <Typography className="tw:text-error-primary" size="text-sm">
                {t('message.are-you-sure-delete-entity', {
                  entity: t('label.relationship'),
                })}
              </Typography>
              <div className="tw:flex tw:justify-end tw:gap-2">
                <Button
                  color="secondary"
                  isDisabled={isSaving}
                  onClick={() => setIsConfirmingDelete(false)}>
                  {t('label.cancel')}
                </Button>
                <Button
                  color="primary-destructive"
                  data-testid="confirm-delete-relation-btn"
                  isLoading={isSaving}
                  onClick={remove}>
                  {t('label.delete')}
                </Button>
              </div>
            </div>
          ) : (
            <div className="tw:flex tw:justify-between tw:gap-2">
              <Button
                color="tertiary-destructive"
                data-testid="delete-relation-btn"
                isDisabled={isSaving}
                onClick={() => setIsConfirmingDelete(true)}>
                {t('label.delete')}
              </Button>
              <div className="tw:flex tw:gap-2">
                <Button color="secondary" onClick={onClose}>
                  {t('label.cancel')}
                </Button>
                <Button
                  color="primary"
                  isDisabled={!isDirty}
                  isLoading={isSaving}
                  onClick={save}>
                  {t('label.save')}
                </Button>
              </div>
            </div>
          )}
        </div>
      ) : null}
    </aside>
  );
};

function toUpdateProvenance(provenance?: Provenance): UpdateProvenance {
  return switchProvenance(provenance ?? Provenance.Manual);
}

function toUpdateProvenanceValue(key: Key): UpdateProvenance {
  let provenance = UpdateProvenance.Manual;
  switch (String(key)) {
    case Provenance.AISuggested:
      provenance = UpdateProvenance.AISuggested;

      break;
    case Provenance.Imported:
      provenance = UpdateProvenance.Imported;

      break;
    case Provenance.Inferred:
      provenance = UpdateProvenance.Inferred;

      break;
    case Provenance.Manual:
      break;
  }

  return provenance;
}

function switchProvenance(provenance: Provenance): UpdateProvenance {
  switch (provenance) {
    case Provenance.AISuggested:
      return UpdateProvenance.AISuggested;
    case Provenance.Imported:
      return UpdateProvenance.Imported;
    case Provenance.Inferred:
      return UpdateProvenance.Inferred;
    case Provenance.Manual:
    default:
      return UpdateProvenance.Manual;
  }
}

function toUpdateStatus(status?: EntityStatus): UpdateEntityStatus {
  return switchStatus(status ?? EntityStatus.Draft);
}

function toUpdateStatusValue(key: Key): UpdateEntityStatus {
  let status = UpdateEntityStatus.Draft;
  switch (String(key)) {
    case EntityStatus.Approved:
      status = UpdateEntityStatus.Approved;

      break;
    case EntityStatus.Archived:
      status = UpdateEntityStatus.Archived;

      break;
    case EntityStatus.Deprecated:
      status = UpdateEntityStatus.Deprecated;

      break;
    case EntityStatus.InReview:
      status = UpdateEntityStatus.InReview;

      break;
    case EntityStatus.Rejected:
      status = UpdateEntityStatus.Rejected;

      break;
    case EntityStatus.Unprocessed:
      status = UpdateEntityStatus.Unprocessed;

      break;
    case EntityStatus.Draft:
      break;
  }

  return status;
}

function switchStatus(status: EntityStatus): UpdateEntityStatus {
  switch (status) {
    case EntityStatus.Approved:
      return UpdateEntityStatus.Approved;
    case EntityStatus.Archived:
      return UpdateEntityStatus.Archived;
    case EntityStatus.Deprecated:
      return UpdateEntityStatus.Deprecated;
    case EntityStatus.InReview:
      return UpdateEntityStatus.InReview;
    case EntityStatus.Rejected:
      return UpdateEntityStatus.Rejected;
    case EntityStatus.Unprocessed:
      return UpdateEntityStatus.Unprocessed;
    case EntityStatus.Draft:
    default:
      return UpdateEntityStatus.Draft;
  }
}

function getProvenanceLabel(
  provenance: Provenance | undefined,
  t: ReturnType<typeof useTranslation>['t']
): string {
  switch (provenance) {
    case Provenance.AISuggested:
      return t('label.suggestion');
    case Provenance.Imported:
      return t('label.imported');
    case Provenance.Inferred:
      return t('label.ontology-inferred');
    case Provenance.Manual:
    default:
      return t('label.manual');
  }
}

function getStatusLabel(
  status: EntityStatus | undefined,
  t: ReturnType<typeof useTranslation>['t']
): string {
  switch (status) {
    case EntityStatus.Approved:
      return t('label.approved');
    case EntityStatus.InReview:
      return t('label.in-review');
    case EntityStatus.Archived:
      return t('label.archived');
    case EntityStatus.Deprecated:
      return t('label.deprecated');
    case EntityStatus.Rejected:
      return t('label.rejected');
    case EntityStatus.Unprocessed:
      return t('label.unprocessed');
    case EntityStatus.Draft:
    default:
      return t('label.draft');
  }
}
