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
  Badge,
  Box,
  Button,
  ButtonUtility,
  Dialog,
  Modal,
  ModalOverlay,
  TextArea,
  Typography,
} from '@openmetadata/ui-core-components';
import {
  AlertCircle,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Edit01,
  Trash01,
  XClose,
} from '@openmetadata/ui-core-components/icons';
import { ReactNode, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { getEntityName } from '../../../../utils/EntityNameUtils';
import {
  getModelRelationLabel,
  humanizeName,
  OntologyModelRelation,
} from '../../../../utils/governance/ontology/OntologyStudioModel.utils';
import RelationshipTypePicker from '../../../OntologyExplorer/RelationshipTypePicker.component';
import { RelationTypeOptionGroup } from '../../../OntologyExplorer/RelationshipTypePicker.interface';
import { useRelationWarning } from '../../../OntologyExplorer/RelationWarning.context';
import OntologyStudioDrawer from '../OntologyStudioDrawer/OntologyStudioDrawer';

export type OntologyRelationStatus = 'conflict' | 'clear' | 'unchecked';

interface OntologyRelationDetailProps {
  readonly relation: OntologyModelRelation;
  readonly groups: RelationTypeOptionGroup[];
  readonly canEdit: boolean;
  readonly canCreateRelationType: boolean;
  readonly checkType: (typeId: string) => string | undefined;
  readonly onEdit: (typeId: string) => Promise<boolean>;
  readonly onDelete: () => Promise<boolean>;
  readonly onClose: () => void;
  readonly onOpenConcept: (conceptId: string) => void;
  /** The concept the panel was opened from, which the back link returns to; the source otherwise. */
  readonly backConcept?: OntologyModelRelation['from'];
  readonly status?: OntologyRelationStatus;
  /** Saves the axiom's description; the description is read-only when absent. */
  readonly onSaveDescription?: (description: string) => Promise<boolean>;
}

const KIND_LABELS: Record<OntologyModelRelation['kind'], string> = {
  disjointWith: 'label.disjoint-with',
  equivalentClass: 'label.equivalent-to',
  objectAssertion: 'label.relationship',
  objectProperty: 'label.relationship',
  restriction: 'label.relationship',
  subClassOf: 'label.hierarchy',
};

const STATUS_BADGES: Record<
  OntologyRelationStatus,
  { color: 'error' | 'success' | 'gray'; label: string }
> = {
  clear: { color: 'success', label: 'label.no-issues' },
  conflict: { color: 'error', label: 'label.conflict' },
  unchecked: { color: 'gray', label: 'label.not-checked' },
};

const DetailRow = ({
  label,
  children,
}: {
  readonly label: string;
  readonly children: ReactNode;
}) => (
  <div className="tw:grid tw:grid-cols-[7rem_1fr] tw:items-center tw:gap-3 tw:px-3 tw:py-2.5">
    <dt className="tw:text-sm tw:text-tertiary">{label}</dt>
    <dd className="tw:m-0 tw:min-w-0 tw:text-sm tw:text-primary">{children}</dd>
  </div>
);

const ConflictBar = () => {
  const { t } = useTranslation();

  return (
    <Box
      align="center"
      className="tw:rounded-lg tw:border tw:border-error_subtle tw:bg-error-primary tw:px-3 tw:py-2"
      data-testid="ontology-relation-detail-conflict"
      gap={2}
      role="alert">
      <AlertCircle
        aria-hidden
        className="tw:size-4 tw:shrink-0 tw:text-fg-error-primary"
      />
      <Typography color="danger" size="text-sm" weight="medium">
        {t('message.relationship-has-conflict')}
      </Typography>
    </Box>
  );
};

/** Link type, where the relationship came from, and whether it is in conflict. */
const RelationFacts = ({
  canChange,
  isBusy,
  relation,
  status,
  typeLabel,
  onChangeType,
}: {
  readonly canChange: boolean;
  readonly isBusy: boolean;
  readonly relation: OntologyModelRelation;
  readonly status: OntologyRelationStatus;
  readonly typeLabel: string;
  readonly onChangeType: () => void;
}) => {
  const { t } = useTranslation();
  const statusBadge = STATUS_BADGES[status];

  return (
    <dl className="tw:m-0 tw:divide-y tw:divide-secondary tw:rounded-lg tw:border tw:border-secondary">
      <DetailRow label={t('label.link-type')}>
        <Box align="center" gap={2}>
          <span className="tw:min-w-0 tw:flex-1">
            {t(KIND_LABELS[relation.kind])}: {typeLabel}
          </span>
          {canChange ? (
            <ButtonUtility
              data-testid="ontology-relation-edit"
              icon={Edit01}
              isDisabled={isBusy}
              size="xs"
              tooltip={t('label.edit-entity', {
                entity: t('label.relationship'),
              })}
              onClick={onChangeType}
            />
          ) : null}
        </Box>
      </DetailRow>
      <DetailRow label={t('label.source')}>
        {relation.axiom?.provenance
          ? humanizeName(relation.axiom.provenance)
          : t('label.unavailable')}
      </DetailRow>
      <DetailRow label={t('label.status')}>
        <Badge
          color={statusBadge.color}
          data-testid="ontology-relation-detail-status"
          size="sm"
          type="pill-color">
          {t(statusBadge.label)}
        </Badge>
      </DetailRow>
    </dl>
  );
};

const RelationDescription = ({
  description,
  onSave,
}: {
  readonly description: string;
  readonly onSave?: (description: string) => Promise<boolean>;
}) => {
  const { t } = useTranslation();
  const [value, setValue] = useState(description);
  const [isSaving, setIsSaving] = useState(false);

  if (!onSave) {
    return (
      <Box direction="col" gap={2}>
        <Typography size="text-sm" weight="medium">
          {t('label.description')}
        </Typography>
        <Typography
          color="secondary"
          data-testid="ontology-relation-detail-description"
          size="text-sm">
          {description || t('label.no-description')}
        </Typography>
      </Box>
    );
  }

  const save = async () => {
    setIsSaving(true);
    await onSave(value.trim());
    setIsSaving(false);
  };

  return (
    <Box direction="col" gap={2}>
      <TextArea
        hideRequiredIndicator
        data-testid="ontology-relation-detail-description"
        isDisabled={isSaving}
        label={t('label.description')}
        rows={3}
        value={value}
        onChange={setValue}
      />
      {value.trim() === description.trim() ? null : (
        <Box gap={2} justify="end">
          <Button
            color="secondary"
            isDisabled={isSaving}
            size="sm"
            onPress={() => setValue(description)}>
            {t('label.cancel')}
          </Button>
          <Button
            data-testid="ontology-relation-detail-description-save"
            isLoading={isSaving}
            size="sm"
            onPress={() => void save()}>
            {t('label.save')}
          </Button>
        </Box>
      )}
    </Box>
  );
};

/** What the canvas edge says: who is related to whom, by which type, with the actions that change it. */
const OntologyRelationDetail = ({
  relation,
  groups,
  canEdit,
  canCreateRelationType,
  checkType,
  onEdit,
  onDelete,
  onClose,
  onOpenConcept,
  backConcept = relation.from,
  status = 'unchecked',
  onSaveDescription,
}: OntologyRelationDetailProps) => {
  const { t } = useTranslation();
  const warnRelation = useRelationWarning();
  const [isPicking, setIsPicking] = useState(false);
  const [isBusy, setIsBusy] = useState(false);
  const [isAdvancedOpen, setIsAdvancedOpen] = useState(false);
  const canChange = Boolean(
    canEdit && relation.axiom && relation.kind !== 'objectProperty'
  );
  const typeLabel = humanizeName(getModelRelationLabel(relation));
  const run = async (action: () => Promise<boolean>) => {
    setIsBusy(true);
    const isDone = await action();
    setIsBusy(false);

    return isDone;
  };

  const renderEnd = (
    concept: OntologyModelRelation['from'],
    testId: string
  ) => (
    <Button
      noTextPadding
      color="link-gray"
      data-testid={testId}
      size="lg"
      onPress={() => onOpenConcept(concept.id)}>
      {getEntityName(concept)}
    </Button>
  );

  const renderPicker = () => (
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
            sourceId={relation.from.id}
            sourceLabel={getEntityName(relation.from)}
            targetId={relation.to.id}
            targetLabel={getEntityName(relation.to)}
            warnRelation={(typeId) =>
              warnRelation?.(relation.from.id, relation.to.id, typeId) ??
              Promise.resolve(undefined)
            }
            onCancel={() => setIsPicking(false)}
            onSelect={(typeId) =>
              void run(() => onEdit(typeId)).then(
                (isChanged) => isChanged && setIsPicking(false)
              )
            }
          />
        </Dialog>
      </Modal>
    </ModalOverlay>
  );

  const renderAdvanced = () => (
    <section data-testid="ontology-relation-detail-advanced">
      <Button
        aria-expanded={isAdvancedOpen}
        color="link-gray"
        data-testid="ontology-relation-detail-advanced-toggle"
        iconLeading={isAdvancedOpen ? ChevronDown : ChevronRight}
        size="sm"
        onPress={() => setIsAdvancedOpen((open) => !open)}>
        {t('label.advanced')}
        <span className="tw:ml-1 tw:font-normal tw:text-tertiary">
          {t('label.ids-and-iris')}
        </span>
      </Button>
      {isAdvancedOpen ? (
        <dl className="tw:mt-3 tw:mb-0 tw:grid tw:grid-cols-[auto_1fr] tw:gap-x-4 tw:gap-y-2 tw:text-sm">
          {[
            [t('label.id'), relation.axiom?.id],
            [t('label.name'), relation.axiom?.name],
            [t('label.property-iri'), relation.propertyIri],
            [t('label.source'), relation.from.iri],
            [t('label.target'), relation.to.iri],
          ]
            .filter(([, value]) => value)
            .map(([label, value]) => (
              <div className="tw:contents" key={label}>
                <dt className="tw:text-tertiary">{label}</dt>
                <dd className="tw:m-0 tw:break-all tw:font-mono tw:text-xs">
                  {value}
                </dd>
              </div>
            ))}
        </dl>
      ) : null}
    </section>
  );

  return (
    <OntologyStudioDrawer testId="ontology-relation-detail">
      <Box
        className="tw:shrink-0 tw:border-b tw:border-secondary tw:px-6 tw:pt-4 tw:pb-5"
        direction="col"
        gap={3}>
        <Box align="center" gap={2}>
          <Button
            className="tw:min-w-0"
            color="link-gray"
            data-testid="ontology-relation-detail-back"
            iconLeading={ChevronLeft}
            size="sm"
            onPress={() => onOpenConcept(backConcept.id)}>
            <span className="tw:truncate">{getEntityName(backConcept)}</span>
          </Button>
          <span className="tw:flex-1" />
          <ButtonUtility
            color="tertiary"
            data-testid="ontology-relation-detail-close"
            icon={XClose}
            size="sm"
            tooltip={t('label.close')}
            onClick={onClose}
          />
        </Box>
        <Box direction="col" gap={1}>
          <Box align="center" gap={2} wrap="wrap">
            {renderEnd(relation.from, 'ontology-relation-detail-source')}
            <Badge
              color={relation.kind === 'subClassOf' ? 'gray' : 'brand'}
              data-testid="ontology-relation-detail-type"
              size="sm"
              type="pill-color">
              {typeLabel}
            </Badge>
            {renderEnd(relation.to, 'ontology-relation-detail-target')}
          </Box>
          <Typography color="secondary" size="text-sm">
            {t('label.relationship')}
          </Typography>
        </Box>
        {status === 'conflict' ? <ConflictBar /> : null}
      </Box>
      <Box
        className="tw:min-h-0 tw:flex-1 tw:overflow-auto tw:px-6 tw:py-5"
        direction="col"
        gap={5}>
        <RelationFacts
          canChange={canChange}
          isBusy={isBusy}
          relation={relation}
          status={status}
          typeLabel={typeLabel}
          onChangeType={() => setIsPicking(true)}
        />
        {relation.axiom ? (
          <RelationDescription
            description={relation.axiom.description ?? ''}
            key={relation.axiom.id}
            onSave={canChange ? onSaveDescription : undefined}
          />
        ) : null}
        {renderAdvanced()}
        {canChange ? (
          <Box data-testid="ontology-relation-detail-actions">
            <Button
              noTextPadding
              color="link-destructive"
              data-testid="ontology-relation-delete"
              iconLeading={Trash01}
              isDisabled={isBusy}
              size="sm"
              onPress={() => void run(onDelete)}>
              {t('label.delete-entity', { entity: t('label.relationship') })}
            </Button>
          </Box>
        ) : null}
      </Box>
      {renderPicker()}
    </OntologyStudioDrawer>
  );
};

export default OntologyRelationDetail;
