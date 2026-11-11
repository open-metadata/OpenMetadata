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
  BadgeWithDot,
  Box,
  Button,
  ButtonUtility,
  Dropdown,
  ProgressBarBase,
  Select,
  Typography,
} from '@openmetadata/ui-core-components';
import {
  AlertCircle,
  BookClosed,
  ChevronDown,
  ChevronRight,
  Edit01,
  Trash01,
  XClose,
} from '@openmetadata/ui-core-components/icons';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { OntologyConcept } from '../../../../generated/entity/data/ontologyConcept';
import { Kind } from '../../../../generated/entity/data/ontologyProperty';
import { useOntologyConceptBindings } from '../../../../hooks/governance/ontology/useOntologyConceptBindings';
import { getEntityName } from '../../../../utils/EntityNameUtils';
import {
  ConceptPropertyInput,
  getInverseRelationLabel,
  getRelationPhrase,
} from '../../../../utils/governance/ontology/OntologyNativeRelation.utils';
import {
  getBindableConceptProperties,
  getConceptAncestors,
  getConceptPropertyRows,
  getConceptRelationRows,
  getModelRelationLabel,
  getPropertyLabel,
  humanizeName,
  OntologyModelRelation,
  OntologyStudioModel,
} from '../../../../utils/governance/ontology/OntologyStudioModel.utils';
import {
  InspectorList,
  InspectorRow,
} from '../../../OntologyExplorer/OntologyInspectorSection';
import RelationshipTypePicker from '../../../OntologyExplorer/RelationshipTypePicker.component';
import { RelationTypeOptionGroup } from '../../../OntologyExplorer/RelationshipTypePicker.interface';
import { useRelationClash } from '../../../OntologyExplorer/RelationWarning.context';
import {
  ConceptEditorFields,
  ConceptEditorFooter,
  ConceptEditorMappings,
  ConceptEditorProvider,
  OntologyConceptEditorState,
} from '../OntologyConceptEditor/OntologyConceptEditor';
import OntologyRelationControls from '../OntologyRelationControls/OntologyRelationControls';
import OntologyStudioDrawer from '../OntologyStudioDrawer/OntologyStudioDrawer';
import OntologyConceptAssets from './OntologyConceptAssets';
import { CONCEPT_STATUS_LABELS } from './OntologyConceptInspector.constants';
import OntologyConceptLiveData, {
  LiveDataBindingState,
} from './OntologyConceptLiveData';
import OntologyConceptRules from './OntologyConceptRules';
import {
  ConceptEmptyState,
  ConceptFormCard,
  ConceptFormPreview,
  ConceptSection,
} from './OntologyConceptSection';
import OntologyPropertyAuthoring from './OntologyPropertyAuthoring';
import OntologyPropertyBindings from './OntologyPropertyBindings';

interface OntologyConceptInspectorProps {
  readonly concept: OntologyConcept;
  readonly model: OntologyStudioModel;
  readonly relations: OntologyModelRelation[];
  readonly canAddProperty?: boolean;
  readonly canAddRelation?: boolean;
  readonly canCreateRelationType?: boolean;
  readonly relationTypeGroups?: RelationTypeOptionGroup[];
  readonly onAddProperty?: (input: ConceptPropertyInput) => Promise<boolean>;
  /** Opens the relationship's own panel; rows open the other concept without it. */
  readonly onOpenRelation?: (relation: OntologyModelRelation) => void;
  /** The relation type id a phrase such as "part of" names, if any. */
  readonly findRelationType?: (phrase: string) => string | undefined;
  readonly canAddRule?: boolean;
  readonly onRuleCreated?: () => void;
  readonly onAddRelation?: (
    targetId: string,
    relationType: string
  ) => Promise<boolean>;
  readonly canEditRelations?: boolean;
  readonly checkAddRelation?: (
    targetId: string,
    relationType: string
  ) => string | undefined;
  /** The reason the relation cannot take this type, or undefined. */
  readonly checkRelationType?: (
    relation: OntologyModelRelation,
    typeId: string
  ) => string | undefined;
  readonly onEditRelation?: (
    relation: OntologyModelRelation,
    typeId: string
  ) => Promise<boolean>;
  readonly onDeleteRelation?: (
    relation: OntologyModelRelation
  ) => Promise<boolean>;
  readonly onClose: () => void;
  readonly onDelete?: () => void;
  readonly onEdit?: () => void;
  readonly onEditMappings?: () => void;
  readonly canEditBindings?: boolean;
  readonly isEditing?: boolean;
  readonly onOpenData: () => void;
  readonly onSelectConcept: (concept: OntologyConcept) => void;
  /** Given in Edit mode: the concept's own fields edit in place with a Save bar. */
  readonly editor?: OntologyConceptEditorState;
  /** Edit mode could not load the concept's working copy, so it stays read-only. */
  readonly isEditorUnavailable?: boolean;
}

interface RelationAuthoringProps {
  readonly canCreateRelationType: boolean;
  readonly concept: OntologyConcept;
  readonly groups: RelationTypeOptionGroup[];
  readonly isAvailable: boolean;
  readonly isOpen: boolean;
  readonly model: OntologyStudioModel;
  /** A relation type to start from, e.g. one a synonym named. */
  readonly initialType?: string;
  readonly onClose: () => void;
  readonly onSave: (targetId: string, relationType: string) => Promise<boolean>;
  /** The reason the relation cannot be written, or undefined; shown before any write. */
  readonly check?: (
    targetId: string,
    relationType: string
  ) => string | undefined;
}

const RelationIssue = ({ message }: { message?: string }) =>
  message ? (
    <Typography
      className="tw:text-error-primary"
      data-testid="ontology-relationship-issue"
      role="alert"
      size="text-xs">
      {message}
    </Typography>
  ) : null;

const RelationClash = ({ message }: { message?: string }) =>
  message ? (
    <Typography
      className="tw:text-warning-primary"
      data-testid="ontology-relationship-clash"
      role="status"
      size="text-xs">
      {message}
    </Typography>
  ) : null;

/** The chosen type's label; a new type reads as the name it was typed with. */
const relationTypeLabel = (
  groups: RelationTypeOptionGroup[],
  relationType: string
) =>
  groups
    .flatMap((group) => group.options)
    .find((option) => option.id === relationType)?.label ||
  humanizeName(relationType.replace(/^new:/, ''));

const TargetConceptSelect = ({
  concepts,
  isDisabled,
  value,
  onChange,
}: {
  readonly concepts: readonly OntologyConcept[];
  readonly isDisabled: boolean;
  readonly value: string;
  readonly onChange: (id: string) => void;
}) => {
  const { t } = useTranslation();

  return (
    <Select
      className="tw:w-full"
      isDisabled={isDisabled}
      items={concepts.map((candidate) => ({
        id: candidate.id,
        label: getEntityName(candidate),
      }))}
      label={t('label.target-concept')}
      placeholder={t('label.choose-concept')}
      size="sm"
      value={value || null}
      onChange={(key) => onChange(String(key ?? ''))}>
      {(item) => <Select.Item id={item.id} key={item.id} label={item.label} />}
    </Select>
  );
};

const RelationAuthoring = ({
  canCreateRelationType,
  concept,
  groups,
  initialType = '',
  isAvailable,
  isOpen,
  model,
  onClose,
  onSave,
  check,
}: RelationAuthoringProps) => {
  const { t } = useTranslation();
  const [targetId, setTargetId] = useState('');
  const [relationType, setRelationType] = useState(initialType);
  const [isSaving, setIsSaving] = useState(false);
  const targetConcepts = useMemo(
    () => model.concepts.filter((candidate) => candidate.id !== concept.id),
    [concept.id, model.concepts]
  );

  const save = async () => {
    setIsSaving(true);
    const saved = await onSave(targetId, relationType);
    setIsSaving(false);
    if (saved) {
      setTargetId('');
      setRelationType('');
      onClose();
    }
  };

  const target = targetConcepts.find(({ id }) => id === targetId);
  const issue = check?.(targetId, relationType);
  const clash = useRelationClash(concept.id, targetId, relationType);
  const relationLabel =
    relationTypeLabel(groups, relationType) || t('label.new-link');

  if (!isAvailable || !isOpen) {
    return null;
  }

  if (!relationType) {
    return (
      <ConceptFormCard testId="ontology-relationship-form">
        <RelationshipTypePicker
          canCreateType={canCreateRelationType}
          groups={groups}
          sourceId={concept.id}
          sourceLabel={getEntityName(concept)}
          targetLabel={t('label.target')}
          onCancel={onClose}
          onSelect={setRelationType}
        />
      </ConceptFormCard>
    );
  }

  return (
    <ConceptFormCard testId="ontology-relationship-form">
      <div className="tw:grid tw:grid-cols-2 tw:gap-3">
        <Box direction="col" gap={2}>
          <Typography
            className="tw:text-secondary"
            size="text-sm"
            weight="medium">
            {t('label.relationship')}
          </Typography>
          <Button
            className="tw:justify-between"
            color="secondary"
            data-testid="ontology-relationship-type"
            iconTrailing={ChevronDown}
            isDisabled={isSaving}
            size="sm"
            onPress={() => setRelationType('')}>
            <span className="tw:truncate">{relationLabel}</span>
          </Button>
        </Box>
        <TargetConceptSelect
          concepts={targetConcepts}
          isDisabled={isSaving}
          value={targetId}
          onChange={setTargetId}
        />
      </div>
      <ConceptFormPreview>
        {target
          ? `${getEntityName(concept)} ${relationLabel} ${getEntityName(
              target
            )}`
          : t('message.pick-concept-to-complete-sentence')}
      </ConceptFormPreview>
      <RelationIssue message={issue} />
      <RelationClash message={clash} />
      <Box gap={2} justify="end">
        <Button
          color="secondary"
          isDisabled={isSaving}
          size="sm"
          onPress={onClose}>
          {t('label.cancel')}
        </Button>
        <Button
          color="primary"
          data-testid="ontology-relationship-submit"
          isDisabled={!targetId || Boolean(issue)}
          isLoading={isSaving}
          size="sm"
          onPress={() => void save()}>
          {t('label.add-entity', { entity: t('label.relationship') })}
        </Button>
      </Box>
    </ConceptFormCard>
  );
};

/** A synonym that reads like a relation phrase, offered as a relationship instead. */
const RelationSynonymWarning = ({
  editor,
  savedSynonyms = [],
  canConvert,
  onConvert,
}: {
  readonly editor?: OntologyConceptEditorState;
  readonly savedSynonyms?: readonly string[];
  readonly canConvert: boolean;
  /** Receives the relation phrase the synonym starts with. */
  readonly onConvert: (phrase: string) => void;
}) => {
  const { t } = useTranslation();
  // Edit reads the unsaved chips, so a synonym just typed is flagged too.
  const synonyms =
    editor?.form.watch('synonyms').map((item) => String(item.id)) ??
    savedSynonyms;
  const synonym = synonyms.find((candidate) => getRelationPhrase(candidate));
  if (!synonym) {
    return null;
  }
  // The synonym leaves the unsaved form; the relationship is written by its own form.
  const convert = () => {
    editor?.form.setValue(
      'synonyms',
      editor.form
        .getValues('synonyms')
        .filter((item) => String(item.id) !== synonym),
      { shouldDirty: true }
    );
    onConvert(getRelationPhrase(synonym) ?? '');
  };

  return (
    <Box
      align="center"
      className="tw:rounded-lg tw:border tw:border-warning_subtle tw:bg-warning-primary tw:px-3 tw:py-2"
      data-testid="ontology-synonym-relation-warning"
      gap={2}
      role="status">
      <AlertCircle
        aria-hidden
        className="tw:size-4 tw:shrink-0 tw:text-fg-warning-primary"
      />
      <Typography
        className="tw:min-w-0 tw:flex-1"
        color="warning"
        size="text-sm">
        {t('message.synonym-looks-like-relationship', { synonym })}
      </Typography>
      {canConvert && editor ? (
        <Button
          color="secondary"
          data-testid="ontology-synonym-add-as-relationship"
          size="xs"
          onPress={convert}>
          {t('label.add-as-relationship')}
        </Button>
      ) : null}
    </Box>
  );
};

const OntologyConceptInspector = ({
  concept,
  model,
  relations,
  canAddProperty = false,
  canAddRelation = false,
  canCreateRelationType = false,
  relationTypeGroups = [],
  onAddProperty,
  onOpenRelation,
  findRelationType,
  canAddRule,
  onRuleCreated,
  onAddRelation,
  canEditRelations = false,
  checkAddRelation,
  checkRelationType,
  onEditRelation,
  onDeleteRelation,
  onClose,
  onDelete,
  onEdit,
  onEditMappings,
  canEditBindings = false,
  isEditing = false,
  onOpenData,
  onSelectConcept,
  editor,
  isEditorUnavailable,
}: OntologyConceptInspectorProps) => {
  const { t } = useTranslation();
  const [authoring, setAuthoring] = useState<'property' | 'relation'>();
  const [relationPreset, setRelationPreset] = useState('');
  const [isAdvancedOpen, setIsAdvancedOpen] = useState(false);
  const bindings = useOntologyConceptBindings(concept.id);
  let liveDataBindingState: LiveDataBindingState = 'loading';
  if (bindings.data) {
    liveDataBindingState = bindings.data.assets.length ? 'bound' : 'unbound';
  } else if (bindings.isError) {
    liveDataBindingState = 'failed';
  }
  const ancestors = useMemo(
    () => getConceptAncestors(relations, concept.id),
    [relations, concept.id]
  );
  const properties = useMemo(
    () => getConceptPropertyRows(model, relations, concept),
    [concept, model, relations]
  );
  const bindableProperties = useMemo(
    () => getBindableConceptProperties(model, relations, concept),
    [concept, model, relations]
  );
  const unavailableProperties = useMemo(() => {
    const propertyIds = new Set(properties.map(({ property }) => property.id));
    const unavailable = new Map<string, string>();
    bindings.data?.assets.forEach(({ columns }) => {
      columns.forEach(({ propertyId, property }) => {
        if (!propertyIds.has(propertyId)) {
          unavailable.set(propertyId, getEntityName(property) || propertyId);
        }
      });
    });

    return [...unavailable];
  }, [bindings.data, properties]);
  const conceptRelations = useMemo(
    () => getConceptRelationRows(relations, concept.id),
    [concept.id, relations]
  );
  const mappings = concept.conceptMappings ?? [];

  const ontologyName =
    concept.ontology?.id === model.ontology?.id
      ? getEntityName(model.ontology)
      : getEntityName(concept.ontology);
  // Same rule as the glossary inspector: a section counts once it has an item.
  const sectionCounts = [
    conceptRelations.length,
    mappings.length,
    bindings.data?.assets.length ?? 0,
  ];
  const completedSectionCount = sectionCounts.filter(
    (count) => count > 0
  ).length;

  const renderInheritedFrom = () =>
    ancestors.length > 0 ? (
      <Box align="center" gap={1} wrap="wrap">
        <Typography color="secondary" size="text-xs">
          {t('label.inherited-from')}
        </Typography>
        {ancestors.map((ancestor) => (
          <Button
            color="link-color"
            key={ancestor.id}
            size="xs"
            onPress={() => onSelectConcept(ancestor)}>
            {ancestor.displayName ?? ancestor.name}
          </Button>
        ))}
      </Box>
    ) : null;

  const renderBoundCount = () =>
    bindings.data && properties.length > 0 ? (
      <Typography color="secondary" size="text-xs">
        {t('label.ontology-properties-bound', {
          count: properties.filter(({ property }) =>
            bindings.data?.assets.some((asset) =>
              asset.columns.some(
                (column) =>
                  column.propertyId === property.id &&
                  column.state === 'resolved'
              )
            )
          ).length,
          total: properties.length,
        })}
      </Typography>
    ) : null;

  const renderPropertyRow = ({
    datatype,
    inheritedFrom,
    property,
  }: (typeof properties)[number]) => (
    <InspectorRow key={property.id}>
      <Box className="tw:min-w-0 tw:flex-1" direction="col" gap={1}>
        <Box align="center" gap={2}>
          <Typography
            className="tw:font-mono tw:text-primary"
            size="text-sm"
            weight="medium">
            {getPropertyLabel(property)}
          </Typography>
          {property.isIdentifier ? (
            <Badge color="warning" size="sm" type="pill-color">
              {t('label.identifier')}
            </Badge>
          ) : null}
        </Box>
        {inheritedFrom ? (
          <Typography color="secondary" size="text-xs">
            {t('label.inherited')} ·{' '}
            {inheritedFrom.displayName ?? inheritedFrom.name}
          </Typography>
        ) : null}
        <OntologyPropertyBindings
          bindings={bindings}
          canAdd={property.kind !== Kind.Annotation}
          canEdit={canEditBindings}
          conceptId={concept.id}
          isIdentifier={property.isIdentifier}
          key={concept.id}
          propertyId={property.id}
          propertyLabel={getPropertyLabel(property)}
        />
      </Box>
      <Typography
        className="tw:font-mono tw:text-utility-brand-700"
        size="text-xs"
        weight="semibold">
        {datatype}
      </Typography>
    </InspectorRow>
  );

  const reusableProperties = model
    ? model.properties
        .filter(
          (property) =>
            property.kind !== Kind.Object &&
            !(property.domain ?? []).includes(concept.iri)
        )
        .map((property) => ({
          iri: property.iri,
          label: getPropertyLabel(property),
        }))
    : [];

  const renderPropertyAuthoring = () =>
    onAddProperty ? (
      <OntologyPropertyAuthoring
        concepts={model.concepts.map((candidate) => ({
          iri: candidate.iri,
          label: getEntityName(candidate),
        }))}
        isAvailable={canAddProperty}
        isOpen={authoring === 'property'}
        key={concept.id}
        reusable={reusableProperties}
        onClose={() => setAuthoring(undefined)}
        onSave={onAddProperty}
      />
    ) : null;

  const renderRelationRow = ({
    direction,
    other,
    relation,
  }: (typeof conceptRelations)[number]) => {
    const inverseLabel =
      direction === 'incoming'
        ? getInverseRelationLabel(relation, model)
        : undefined;
    const readsForward = direction === 'outgoing' || !!inverseLabel;
    const isRelationEditable = ({ axiom, kind }: OntologyModelRelation) =>
      canEditRelations && Boolean(axiom) && kind !== 'objectProperty';
    const badge = (
      <Badge color="brand" size="sm" type="pill-color">
        {humanizeName(inverseLabel ?? getModelRelationLabel(relation))}
      </Badge>
    );

    return (
      <InspectorRow key={`${direction}:${relation.key}`}>
        {readsForward ? badge : null}
        <Button
          noTextPadding
          className="tw:min-w-0 tw:flex-1 tw:justify-start"
          color="tertiary"
          data-testid={`ontology-concept-relation-${other.id}`}
          onPress={() =>
            onOpenRelation ? onOpenRelation(relation) : onSelectConcept(other)
          }>
          <span className="tw:truncate">{other.displayName ?? other.name}</span>
        </Button>
        {readsForward ? null : badge}
        {isRelationEditable(relation) && onEditRelation && onDeleteRelation ? (
          <OntologyRelationControls
            canCreateRelationType={canCreateRelationType}
            checkType={(typeId) => checkRelationType?.(relation, typeId)}
            groups={relationTypeGroups}
            relation={relation}
            onDelete={() => onDeleteRelation(relation)}
            onEdit={(typeId) => onEditRelation(relation, typeId)}
          />
        ) : null}
      </InspectorRow>
    );
  };

  const renderRelationAuthoring = () =>
    onAddRelation ? (
      <RelationAuthoring
        canCreateRelationType={canCreateRelationType}
        check={checkAddRelation}
        concept={concept}
        groups={relationTypeGroups}
        initialType={relationPreset}
        isAvailable={canAddRelation}
        isOpen={authoring === 'relation'}
        key={`${concept.id}:${relationPreset}`}
        model={model}
        onClose={() => {
          setAuthoring(undefined);
          setRelationPreset('');
        }}
        onSave={onAddRelation}
      />
    ) : null;

  const renderUnavailableList = () => (
    <InspectorList>
      {unavailableProperties.map(([propertyId, label]) => (
        <InspectorRow key={propertyId}>
          <Box className="tw:min-w-0 tw:flex-1" direction="col" gap={1}>
            <Typography size="text-sm" weight="medium">
              {label}
            </Typography>
            <OntologyPropertyBindings
              bindings={bindings}
              canAdd={false}
              canEdit={canEditBindings}
              conceptId={concept.id}
              propertyId={propertyId}
            />
          </Box>
        </InspectorRow>
      ))}
    </InspectorList>
  );

  const renderMappingRow = (mapping: (typeof mappings)[number]) => (
    <InspectorRow key={`${mapping.mappingType}:${mapping.conceptIri}`}>
      <Badge color="success" size="sm" type="pill-color">
        {humanizeName(mapping.mappingType)}
      </Badge>
      <Typography
        ellipsis
        className="tw:min-w-0 tw:flex-1 tw:font-mono"
        size="text-xs">
        {mapping.conceptIri}
      </Typography>
    </InspectorRow>
  );

  const renderAiEmpty = (
    entity: string,
    hint = t('message.no-data-available')
  ) => (
    <ConceptEmptyState hint={hint} title={t('label.no-entity', { entity })} />
  );

  const renderAiBreadcrumb = () => (
    <Box
      align="center"
      className="tw:min-w-0 tw:flex-1 tw:text-tertiary"
      gap={1}>
      <BookClosed aria-hidden className="tw:size-3.5 tw:shrink-0" />
      <Typography
        ellipsis
        className="tw:text-tertiary"
        data-testid="ontology-concept-owner"
        size="text-sm"
        weight="medium">
        {ontologyName}
      </Typography>
      {ancestors[0] ? (
        <>
          <ChevronRight aria-hidden className="tw:size-3 tw:shrink-0" />
          <Typography
            ellipsis
            className="tw:text-tertiary"
            size="text-xs"
            weight="medium">
            {ancestors[0].displayName ?? ancestors[0].name}
          </Typography>
        </>
      ) : null}
    </Box>
  );

  const renderMoreMenu = () =>
    onDelete ? (
      <Dropdown.Root>
        <Dropdown.DotsButton
          aria-label={t('label.more-actions')}
          data-testid="ontology-concept-more"
        />
        <Dropdown.Popover placement="bottom end">
          <Dropdown.Menu
            aria-label={t('label.more-actions')}
            onAction={(key) => key === 'delete' && onDelete()}>
            <Dropdown.Item
              data-testid="ontology-concept-delete"
              icon={Trash01}
              id="delete"
              label={t('label.delete-entity', {
                entity: t('label.concept'),
              })}
              textValue={t('label.delete')}
            />
          </Dropdown.Menu>
        </Dropdown.Popover>
      </Dropdown.Root>
    ) : null;

  const renderHeader = () => (
    <Box
      className="tw:shrink-0 tw:border-b tw:border-secondary tw:px-6 tw:pt-5 tw:pb-4"
      direction="col"
      gap={3}>
      <Box align="center" gap={2}>
        {renderAiBreadcrumb()}
        {editor?.isDirty ? (
          <BadgeWithDot
            color="warning"
            data-testid="ontology-concept-unsaved"
            size="sm"
            type="pill-color">
            {t('label.unsaved')}
          </BadgeWithDot>
        ) : null}
        {onEdit && !editor ? (
          <Button
            color="secondary"
            data-testid="ontology-concept-edit"
            iconLeading={Edit01}
            size="sm"
            onPress={onEdit}>
            {t('label.edit')}
          </Button>
        ) : null}
        {renderMoreMenu()}
        <ButtonUtility
          data-testid="ontology-concept-close"
          icon={XClose}
          size="lg"
          tooltip={t('label.close')}
          onClick={onClose}
        />
      </Box>
      <Box direction="col" gap={1}>
        <Box align="center" className="tw:min-w-0" gap={2} wrap="wrap">
          <Typography
            as="h2"
            className="not-prose tw:m-0"
            size="text-xl"
            weight="semibold">
            {concept.displayName ?? concept.name}
          </Typography>
          <BadgeWithDot color="brand" size="sm" type="color">
            {humanizeName(concept.conceptType)}
          </BadgeWithDot>
          {concept.abstract ? (
            <Badge color="gray" size="sm" type="pill-color">
              {t('label.abstract')}
            </Badge>
          ) : null}
          {concept.provider ? (
            <Badge color="gray" size="sm" type="pill-color">
              {concept.provider}
            </Badge>
          ) : null}
          <Badge
            color="gray"
            data-testid="ontology-concept-lifecycle"
            size="sm"
            type="pill-color">
            {t(
              concept.lifecycleStatus
                ? CONCEPT_STATUS_LABELS[concept.lifecycleStatus]
                : 'label.unavailable'
            )}
          </Badge>
        </Box>
        <Typography
          ellipsis
          className="tw:font-mono tw:text-xs tw:text-tertiary">
          {concept.iri}
        </Typography>
      </Box>
      <Box align="center" data-testid="ontology-concept-completeness" gap={3}>
        <Typography className="tw:shrink-0 tw:text-tertiary" size="text-sm">
          {t('label.completeness')}
        </Typography>
        <ProgressBarBase
          className="tw:h-1.5 tw:flex-1"
          max={sectionCounts.length}
          value={completedSectionCount}
        />
        <Typography
          className="tw:shrink-0 tw:text-secondary"
          size="text-sm"
          weight="medium">
          {t('message.completed-section-count', {
            count: completedSectionCount,
            total: sectionCounts.length,
          })}
        </Typography>
      </Box>
    </Box>
  );

  const getOpenAuthoring = (
    kind: 'property' | 'relation',
    isAvailable: boolean
  ) =>
    isAvailable && authoring !== kind ? () => setAuthoring(kind) : undefined;

  const renderDescription = () =>
    editor ? (
      <Box className="tw:py-5" direction="col">
        <ConceptEditorFields
          editor={editor}
          names={['displayName', 'description', 'conceptType']}
        />
      </Box>
    ) : (
      <Box className="tw:py-4" direction="col" gap={1}>
        <Typography
          as="p"
          className="tw:m-0 tw:text-secondary"
          data-testid="ontology-concept-description"
          size="text-sm">
          {concept.description || t('label.no-description')}
        </Typography>
        {concept.definitionSource ? (
          <Typography
            className="tw:break-all tw:text-tertiary"
            data-testid="ontology-concept-definition-source"
            size="text-xs">
            {t('label.definition-source')} · {concept.definitionSource}
          </Typography>
        ) : null}
      </Box>
    );

  const renderSynonyms = () => (
    <ConceptSection
      count={concept.synonyms?.length ?? 0}
      testId="ontology-concept-synonyms"
      title={t('label.synonym-plural')}>
      {editor ? (
        <ConceptEditorFields editor={editor} names={['synonyms']} />
      ) : (
        <Box gap={1} wrap="wrap">
          {concept.synonyms?.length ? (
            concept.synonyms.map((synonym) => (
              <Badge key={synonym} size="sm">
                {synonym}
              </Badge>
            ))
          ) : (
            <Typography className="tw:text-tertiary" size="text-sm">
              {t('label.none')}
            </Typography>
          )}
        </Box>
      )}
      <RelationSynonymWarning
        canConvert={Boolean(onAddRelation) && canAddRelation}
        editor={editor}
        savedSynonyms={concept.synonyms}
        onConvert={(phrase) => {
          setRelationPreset(findRelationType?.(phrase) ?? '');
          setAuthoring('relation');
        }}
      />
    </ConceptSection>
  );

  const renderMappings = () =>
    editor ? (
      <section className="tw:py-5" data-testid="ontology-concept-mappings">
        <ConceptEditorMappings editor={editor} />
      </section>
    ) : (
      <ConceptSection
        addTestId="ontology-add-mapping"
        count={mappings.length}
        testId="ontology-concept-mappings"
        title={t('label.mapping-plural')}
        onAdd={onEditMappings}>
        {mappings.length > 0 ? (
          <InspectorList>{mappings.map(renderMappingRow)}</InspectorList>
        ) : (
          renderAiEmpty(t('label.mapping-plural'))
        )}
      </ConceptSection>
    );

  const renderAdvanced = () => (
    <section className="tw:py-4" data-testid="ontology-concept-advanced">
      <Button
        aria-expanded={isAdvancedOpen}
        color="link-gray"
        data-testid="ontology-concept-advanced-toggle"
        iconLeading={isAdvancedOpen ? ChevronDown : ChevronRight}
        size="sm"
        onPress={() => setIsAdvancedOpen((open) => !open)}>
        {t('label.advanced')}
      </Button>
      {isAdvancedOpen ? (
        <Box className="tw:pt-3" direction="col" gap={3}>
          {editor ? (
            <ConceptEditorFields editor={editor} names={['name', 'iri']} />
          ) : (
            <dl className="tw:m-0 tw:grid tw:grid-cols-[auto_1fr] tw:gap-x-4 tw:gap-y-2 tw:text-sm">
              <dt className="tw:text-tertiary">{t('label.name')}</dt>
              <dd className="tw:m-0 tw:break-all tw:font-mono tw:text-xs">
                {concept.name}
              </dd>
              <dt className="tw:text-tertiary">{t('label.concept-iri')}</dt>
              <dd className="tw:m-0 tw:break-all tw:font-mono tw:text-xs">
                {concept.iri}
              </dd>
            </dl>
          )}
        </Box>
      ) : null}
    </section>
  );

  const renderBody = () => (
    <div className="tw:min-h-0 tw:flex-1 tw:divide-y tw:divide-secondary tw:overflow-auto tw:px-6">
      {renderDescription()}
      <ConceptSection
        addTestId="ontology-add-relationship"
        count={conceptRelations.length}
        testId="ontology-concept-relationships"
        title={t('label.relationship-plural')}
        onAdd={getOpenAuthoring(
          'relation',
          Boolean(onAddRelation) && canAddRelation
        )}>
        {renderRelationAuthoring()}
        {conceptRelations.length > 0 ? (
          <InspectorList>
            {conceptRelations.map(renderRelationRow)}
          </InspectorList>
        ) : (
          renderAiEmpty(
            t('label.relationship-plural'),
            t('message.ontology-relationships-feature-description')
          )
        )}
      </ConceptSection>
      <ConceptSection
        addTestId="ontology-add-property"
        count={properties.length}
        testId="ontology-concept-properties"
        title={t('label.property-plural')}
        onAdd={getOpenAuthoring(
          'property',
          Boolean(onAddProperty) && canAddProperty
        )}>
        {renderPropertyAuthoring()}
        {renderInheritedFrom()}
        {renderBoundCount()}
        {properties.length > 0 ? (
          <InspectorList>{properties.map(renderPropertyRow)}</InspectorList>
        ) : (
          renderAiEmpty(t('label.property-plural'))
        )}
      </ConceptSection>
      <OntologyConceptRules
        canAdd={canAddRule}
        concept={concept}
        isEditing={Boolean(editor)}
        key={`rules:${concept.id}`}
        model={model}
        relations={relations}
        onCreated={onRuleCreated}
      />
      {unavailableProperties.length > 0 ? (
        <ConceptSection
          count={unavailableProperties.length}
          title={t('label.unavailable')}>
          {renderUnavailableList()}
        </ConceptSection>
      ) : null}
      {renderSynonyms()}
      {renderMappings()}
      <OntologyConceptAssets
        canEdit={canEditBindings}
        conceptId={concept.id}
        conceptName={getEntityName(concept)}
        key={concept.id}
        presentation={
          isEditing ? { kind: 'edit' } : { kind: 'view', onOpenData }
        }
        properties={bindableProperties}
      />
      <Box className="tw:py-5" direction="col">
        <OntologyConceptLiveData
          bindingState={liveDataBindingState}
          concept={concept}
          key={`live-data:${concept.id}`}
          model={model}
          relations={relations}
          onRetryBindings={() =>
            void bindings.retryRead().catch(() => undefined)
          }
        />
      </Box>
      {renderAdvanced()}
    </div>
  );

  return (
    <OntologyStudioDrawer testId="ontology-concept-inspector">
      {renderHeader()}
      {isEditorUnavailable ? (
        <Typography
          className="tw:px-6 tw:pt-3"
          color="danger"
          data-testid="ontology-concept-editor-error"
          role="alert"
          size="text-sm">
          {t('server.unexpected-error')}
        </Typography>
      ) : null}
      {editor ? (
        // Edit mode: the body and its Save bar are the concept editor's form.
        <ConceptEditorProvider editor={editor}>
          {renderBody()}
          <ConceptEditorFooter editor={editor} />
        </ConceptEditorProvider>
      ) : (
        renderBody()
      )}
    </OntologyStudioDrawer>
  );
};

export default OntologyConceptInspector;
