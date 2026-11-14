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
  Tooltip,
  Typography,
} from '@openmetadata/ui-core-components';
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  BookClosed,
  Check,
  ChevronRight,
  Copy01,
  Edit01,
  InfoCircle,
  Trash01,
  XClose,
} from '@openmetadata/ui-core-components/icons';
import classNames from 'classnames';
import { uniqBy, upperFirst } from 'lodash';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  OntologyConcept,
  OntologyConceptType,
} from '../../../../generated/entity/data/ontologyConcept';
import { Kind } from '../../../../generated/entity/data/ontologyProperty';
import { useOntologyConceptBindings } from '../../../../hooks/governance/ontology/useOntologyConceptBindings';
import { useOntologyDirtyForm } from '../../../../hooks/governance/ontology/useOntologyDraftGuard';
import { useClipboard } from '../../../../hooks/useClipBoard';
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
import InlineEmptyPlaceholder from '../../../common/EmptyPlaceholder/InlineEmptyPlaceholder';
import {
  InspectorList,
  InspectorRow,
} from '../../../OntologyExplorer/OntologyInspectorSection';
import RelationshipTypePicker from '../../../OntologyExplorer/RelationshipTypePicker.component';
import { RelationTypeOptionGroup } from '../../../OntologyExplorer/RelationshipTypePicker.interface';
import { useRelationClash } from '../../../OntologyExplorer/RelationWarning.context';
import OntologyAdvancedDetails from '../OntologyAdvancedDetails/OntologyAdvancedDetails';
import {
  ConceptEditorFields,
  ConceptEditorFooter,
  ConceptEditorMappings,
  ConceptEditorProvider,
  OntologyConceptEditorState,
} from '../OntologyConceptEditor/OntologyConceptEditor';
import { CONCEPT_TYPE_LABELS } from '../OntologyConceptEditor/OntologyConceptEditor.utils';
import { OntologyConflict } from '../OntologyGraphView/OntologyConflicts.utils';
import OntologyRelationControls from '../OntologyRelationControls/OntologyRelationControls';
import OntologyStudioDrawer from '../OntologyStudioDrawer/OntologyStudioDrawer';
import OntologyConceptAssets from './OntologyConceptAssets';
import OntologyConceptConflicts from './OntologyConceptConflicts';
import {
  CONCEPT_STATUS_LABELS,
  RELATION_PAGE_SIZE,
} from './OntologyConceptInspector.constants';
import {
  countFilledSections,
  getCompletenessCounts,
  shortenIri,
} from './OntologyConceptInspector.utils';
import OntologyConceptLiveData, {
  LiveDataBindingState,
} from './OntologyConceptLiveData';
import OntologyConceptRules from './OntologyConceptRules';
import {
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
  /** Set by the Data view's Link data: open the data-asset link form once Edit is on. */
  readonly isLinkAssetsRequested?: boolean;
  readonly onLinkAssetsRequestClosed?: () => void;
  readonly selectedAssetId?: string;
  readonly isEditing?: boolean;
  readonly onSelectConcept: (concept: OntologyConcept) => void;
  /** Given in Edit mode: the concept's own fields edit in place with a Save bar. */
  readonly editor?: OntologyConceptEditorState;
  /** Edit mode could not load the concept's working copy, so it stays read-only. */
  readonly isEditorUnavailable?: boolean;
  /** Validation clashes this concept is part of. */
  readonly conflicts?: OntologyConflict[];
  readonly isConflictReviewOpen?: boolean;
  readonly onShowConflictOnGraph?: () => void;
}

interface RelationDraft {
  /** Unset until the user picks one, so the default can follow the offered types. */
  readonly relationType?: string;
  readonly targetId: string;
}

const EMPTY_RELATION_DRAFT: RelationDraft = { targetId: '' };

interface RelationAuthoringProps {
  readonly canCreateRelationType: boolean;
  readonly concept: OntologyConcept;
  readonly groups: RelationTypeOptionGroup[];
  readonly isAvailable: boolean;
  readonly isOpen: boolean;
  readonly model: OntologyStudioModel;
  /** A relation type to start from, e.g. one a synonym named. */
  readonly initialType?: string;
  /**
   * The choices so far. The panel keeps them: in Edit mode the working copy can
   * arrive after the form opens and re-mount the body, which must not empty it.
   */
  readonly draft: RelationDraft;
  readonly onDraftChange: (draft: RelationDraft) => void;
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

const BROWSE_RELATION_TYPES = '__browse-relation-types__';
// Options are keyed by predicate IRI (registry rdfPredicate or property IRI), not by name.
const DEFAULT_RELATION_TYPE = 'http://www.w3.org/2004/02/skos/core#broader';

/**
 * Every type once, in group order, with its inverse as the chooser shows it; a
 * "doesn't fit" type says why but stays selectable.
 */
const relationTypeItems = (
  groups: RelationTypeOptionGroup[],
  current: string,
  inverseLabel: string
) => {
  const options = uniqBy(
    groups.flatMap((group) => group.options),
    'id'
  );
  const items = options.map((option) => ({
    id: option.id,
    label: option.label,
    supportingText:
      [
        option.inverseLabel ? `${inverseLabel}: ${option.inverseLabel}` : '',
        option.isUnfit ? option.scopeLabel : '',
      ]
        .filter(Boolean)
        .join(' · ') || undefined,
  }));
  if (current && !options.some(({ id }) => id === current)) {
    items.push({
      id: current,
      label: humanizeName(current.replace(/^new:/, '')),
      supportingText: undefined,
    });
  }

  return items;
};

/** The handoff's default when the type is still open and the ontology offers it. */
const defaultRelationType = (
  groups: RelationTypeOptionGroup[],
  initialType: string
) =>
  initialType ||
  (groups.some((group) =>
    group.options.some(({ id }) => id === DEFAULT_RELATION_TYPE)
  )
    ? DEFAULT_RELATION_TYPE
    : '');

const RelationTypeSelect = ({
  canCreateType,
  groups,
  isDisabled,
  value,
  onChange,
  onCreateType,
}: {
  readonly canCreateType: boolean;
  readonly groups: RelationTypeOptionGroup[];
  readonly isDisabled: boolean;
  readonly value: string;
  readonly onChange: (id: string) => void;
  readonly onCreateType: () => void;
}) => {
  const { t } = useTranslation();
  // The full chooser keeps search, glosses and (with permission) a new type.
  const items = [
    ...relationTypeItems(groups, value, t('label.inverse')),
    {
      id: BROWSE_RELATION_TYPES,
      label: t(
        canCreateType
          ? 'label.ontology-browse-or-create-relationship-types'
          : 'label.ontology-browse-relationship-types'
      ),
      supportingText: undefined,
    },
  ];

  return (
    <Select
      className="tw:w-full"
      data-testid="ontology-relationship-type"
      isDisabled={isDisabled}
      items={items}
      label={t('label.relationship')}
      placeholder={t('label.choose-relationship')}
      size="sm"
      value={value || null}
      onChange={(key) => {
        // Choosing a target rebuilds the options (fit depends on it), and the
        // select then reports no key; the user's type must survive that.
        if (key === null) {
          return;
        }
        const id = String(key);
        if (id === BROWSE_RELATION_TYPES) {
          onCreateType();

          return;
        }
        onChange(id);
      }}>
      {(item) => (
        <Select.Item
          data-testid={`relation-type-${item.id}`}
          id={item.id}
          key={item.id}
          label={item.label}
          supportingText={item.supportingText}
        />
      )}
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
  draft,
  onDraftChange,
  onClose,
  onSave,
  check,
}: RelationAuthoringProps) => {
  const { t } = useTranslation();
  const { targetId } = draft;
  const relationType =
    draft.relationType ?? defaultRelationType(groups, initialType);
  const setTargetId = (id: string) =>
    onDraftChange({ relationType, targetId: id });
  const setRelationType = (type: string) =>
    onDraftChange({ relationType: type, targetId });
  // Browsing or creating a type goes through the full chooser.
  const [isCreatingType, setIsCreatingType] = useState(false);
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

  if (isCreatingType) {
    return (
      <ConceptFormCard testId="ontology-relationship-form">
        <RelationshipTypePicker
          canCreateType={canCreateRelationType}
          groups={groups}
          sourceId={concept.id}
          sourceLabel={getEntityName(concept)}
          targetLabel={t('label.target')}
          onCancel={() => setIsCreatingType(false)}
          onSelect={(type) => {
            setRelationType(type);
            setIsCreatingType(false);
          }}
        />
      </ConceptFormCard>
    );
  }

  return (
    <ConceptFormCard testId="ontology-relationship-form">
      <div className="tw:grid tw:grid-cols-2 tw:gap-3">
        <RelationTypeSelect
          canCreateType={canCreateRelationType}
          groups={groups}
          isDisabled={isSaving}
          value={relationType}
          onChange={setRelationType}
          onCreateType={() => setIsCreatingType(true)}
        />
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
          isDisabled={!targetId || !relationType || Boolean(issue)}
          isLoading={isSaving}
          size="sm"
          onPress={() => void save()}>
          {t('label.ontology-add-relationship')}
        </Button>
      </Box>
    </ConceptFormCard>
  );
};

const RDFS_SUBCLASS_OF = 'http://www.w3.org/2000/01/rdf-schema#subClassOf';
const KIND_TYPE_IDS: Partial<Record<OntologyModelRelation['kind'], string>> = {
  subClassOf: RDFS_SUBCLASS_OF,
  disjointWith: 'http://www.w3.org/2002/07/owl#disjointWith',
  equivalentClass: 'http://www.w3.org/2002/07/owl#equivalentClass',
};

/** The relation's current type as an offered option id, or '' when none matches. */
const currentRelationType = (
  relation: OntologyModelRelation,
  groups: RelationTypeOptionGroup[]
) => {
  const id = relation.propertyIri ?? KIND_TYPE_IDS[relation.kind] ?? '';

  return groups.some((group) =>
    group.options.some((option) => option.id === id)
  )
    ? id
    : '';
};

/**
 * Changes an existing relationship's type inline, the same form as Add. Only
 * the type can change; the two ends are fixed.
 */
const RelationEditForm = ({
  canCreateRelationType,
  check,
  groups,
  relation,
  onClose,
  onSave,
}: {
  readonly canCreateRelationType: boolean;
  /** The reason the relation cannot take this type, or undefined. */
  readonly check: (typeId: string) => string | undefined;
  readonly groups: RelationTypeOptionGroup[];
  readonly relation: OntologyModelRelation;
  readonly onClose: () => void;
  readonly onSave: (typeId: string) => Promise<boolean>;
}) => {
  const { t } = useTranslation();
  const current = currentRelationType(relation, groups);
  const [relationType, setRelationType] = useState(current);
  const [isCreatingType, setIsCreatingType] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const issue = relationType ? check(relationType) : undefined;
  const clash = useRelationClash(
    relation.from.id,
    relation.to.id,
    relationType === current ? '' : relationType
  );

  const save = async () => {
    setIsSaving(true);
    const saved = await onSave(relationType);
    setIsSaving(false);
    if (saved) {
      onClose();
    }
  };

  if (isCreatingType) {
    return (
      <ConceptFormCard testId="ontology-relationship-edit-form">
        <RelationshipTypePicker
          canCreateType={canCreateRelationType}
          checkRelation={check}
          groups={groups}
          sourceLabel={getEntityName(relation.from)}
          targetLabel={getEntityName(relation.to)}
          onCancel={() => setIsCreatingType(false)}
          onSelect={(type) => {
            setRelationType(type);
            setIsCreatingType(false);
          }}
        />
      </ConceptFormCard>
    );
  }

  return (
    <ConceptFormCard testId="ontology-relationship-edit-form">
      <div className="tw:grid tw:grid-cols-2 tw:gap-3">
        <RelationTypeSelect
          canCreateType={canCreateRelationType}
          groups={groups}
          isDisabled={isSaving}
          value={relationType}
          onChange={setRelationType}
          onCreateType={() => setIsCreatingType(true)}
        />
        <TargetConceptSelect
          isDisabled
          concepts={[relation.to]}
          value={relation.to.id}
          onChange={() => undefined}
        />
      </div>
      <ConceptFormPreview>
        {relationType
          ? `${getEntityName(relation.from)} ${relationTypeLabel(
              groups,
              relationType
            )} ${getEntityName(relation.to)}`
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
          data-testid="ontology-relationship-edit-save"
          isDisabled={
            !relationType || relationType === current || Boolean(issue)
          }
          isLoading={isSaving}
          size="sm"
          onPress={() => void save()}>
          {t('label.save')}
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

/** One read-only fact in the Advanced table, with a copy button for the identifiers. */
const RelationConflictDot = ({
  isShown,
  label,
}: {
  readonly isShown: boolean;
  readonly label: string;
}) =>
  isShown ? (
    <span
      aria-label={label}
      className="tw:size-2 tw:shrink-0 tw:rounded-full tw:bg-fg-error-secondary"
      data-testid="ontology-concept-relation-conflict-dot"
      role="img"
    />
  ) : null;

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
  isLinkAssetsRequested,
  onLinkAssetsRequestClosed,
  selectedAssetId,
  isEditing = false,
  onSelectConcept,
  editor,
  isEditorUnavailable,
  conflicts = [],
  isConflictReviewOpen,
  onShowConflictOnGraph,
}: OntologyConceptInspectorProps) => {
  const { t } = useTranslation();
  const conflictRelationKeys = useMemo(
    () =>
      new Set(conflicts.flatMap(({ parts }) => parts.map(({ key }) => key))),
    [conflicts]
  );
  const [authoring, setAuthoring] = useState<'property' | 'relation'>();
  const [relationPreset, setRelationPreset] = useState('');
  const [relationDraft, setRelationDraft] =
    useState<RelationDraft>(EMPTY_RELATION_DRAFT);
  const [editingRelationKey, setEditingRelationKey] = useState<string>();
  // An open property or relation form is work in progress: closing the drawer or leaving asks first.
  useOntologyDirtyForm([authoring, editingRelationKey].some(Boolean));
  // Leaving Edit drops an open edit, so it does not come back on the next switch.
  useEffect(() => {
    if (!canEditRelations) {
      setEditingRelationKey(undefined);
    }
  }, [canEditRelations]);
  const [isAdvancedOpen, setIsAdvancedOpen] = useState(false);
  const [relationLimit, setRelationLimit] = useState(RELATION_PAGE_SIZE);
  useEffect(() => {
    setRelationLimit(RELATION_PAGE_SIZE);
  }, [concept.id]);
  const bindings = useOntologyConceptBindings(concept.id);
  const { hasCopied: hasCopiedIri, onCopyToClipBoard } = useClipboard(
    concept.iri
  );
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
  const sectionCounts = getCompletenessCounts(concept, {
    relations: conceptRelations.length,
    properties: properties.length,
    assets: bindings.data?.assets.length ?? 0,
  });
  const completedSectionCount = countFilledSections(sectionCounts);

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
            className="tw:text-primary"
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
      <Badge
        className="tw:shrink-0"
        color="success"
        data-testid="ontology-concept-property-datatype"
        size="sm"
        type="pill-color">
        {upperFirst(humanizeName(datatype))}
      </Badge>
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
        domainLabel={getEntityName(concept)}
        isAvailable={canAddProperty}
        isOpen={authoring === 'property'}
        key={concept.id}
        reusable={reusableProperties}
        onClose={() => setAuthoring(undefined)}
        onSave={onAddProperty}
      />
    ) : null;

  const renderRelationEdit = ({
    direction,
    relation,
  }: (typeof conceptRelations)[number]) => (
    <li key={`${direction}:${relation.key}`}>
      <RelationEditForm
        canCreateRelationType={canCreateRelationType}
        check={(typeId) => checkRelationType?.(relation, typeId)}
        groups={relationTypeGroups}
        relation={relation}
        onClose={() => setEditingRelationKey(undefined)}
        onSave={(typeId) =>
          onEditRelation
            ? onEditRelation(relation, typeId)
            : Promise.resolve(false)
        }
      />
    </li>
  );

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

    const openRelation = () =>
      onOpenRelation ? onOpenRelation(relation) : onSelectConcept(other);

    return (
      // The whole card is a pointer target; keyboard users act through the
      // target Button, so the row adds no second tab stop. Clicks on any
      // button inside (target, edit, delete) are left to that button.
      // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-noninteractive-element-interactions
      <li
        className={classNames(
          'tw:flex tw:min-h-11 tw:items-center tw:gap-2 tw:rounded-lg tw:border tw:border-secondary tw:bg-surface tw:px-3 tw:py-1.5',
          'tw:cursor-pointer tw:transition-colors tw:hover:bg-primary_hover'
        )}
        data-direction={readsForward ? 'forward' : 'backward'}
        data-testid="ontology-concept-relation-row"
        key={`${direction}:${relation.key}`}
        onClick={(event) => {
          if (!(event.target as HTMLElement).closest('button')) {
            openRelation();
          }
        }}>
        <RelationConflictDot
          isShown={conflictRelationKeys.has(relation.key)}
          label={t('label.conflict')}
        />
        {/* Badge first on every row, as the design does; the arrow says which way the relation reads. */}
        {badge}
        {readsForward ? (
          <ArrowRight
            aria-hidden
            className="tw:size-3.5 tw:shrink-0 tw:text-fg-quaternary"
          />
        ) : (
          <ArrowLeft
            aria-hidden
            className="tw:size-3.5 tw:shrink-0 tw:text-fg-quaternary"
          />
        )}
        <Button
          ellipsis
          noTextPadding
          // The row owns the hover background; a button hover fill would stack a second one.
          // ADR:2026-10-30-data-mode-asset-rows-are-styled-at-the-call-site-until-core-ships-a-list-row-button
          className="tw:min-w-0 tw:flex-1 tw:justify-start tw:hover:bg-transparent"
          color="tertiary"
          data-testid={`ontology-concept-relation-${other.id}`}
          onPress={openRelation}>
          {other.displayName ?? other.name}
        </Button>
        {isRelationEditable(relation) && onEditRelation && onDeleteRelation ? (
          <OntologyRelationControls
            onDelete={() => onDeleteRelation(relation)}
            onEdit={() => setEditingRelationKey(relation.key)}
          />
        ) : null}
      </li>
    );
  };

  const renderRelationAuthoring = () =>
    onAddRelation ? (
      <RelationAuthoring
        canCreateRelationType={canCreateRelationType}
        check={checkAddRelation}
        concept={concept}
        draft={relationDraft}
        groups={relationTypeGroups}
        initialType={relationPreset}
        isAvailable={canAddRelation}
        isOpen={authoring === 'relation'}
        key={`${concept.id}:${relationPreset}`}
        model={model}
        onClose={() => {
          setAuthoring(undefined);
          setRelationPreset('');
          setRelationDraft(EMPTY_RELATION_DRAFT);
        }}
        onDraftChange={setRelationDraft}
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
      <Typography ellipsis className="tw:min-w-0 tw:flex-1" size="text-sm">
        {mapping.conceptIri}
      </Typography>
    </InspectorRow>
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
      <ChevronRight aria-hidden className="tw:size-3 tw:shrink-0" />
      {ancestors[0] ? (
        <Button
          noTextPadding
          className="tw:min-w-0"
          color="link-gray"
          data-testid="ontology-concept-parent"
          size="sm"
          onPress={() => onSelectConcept(ancestors[0])}>
          <span className="tw:truncate">
            {ancestors[0].displayName ?? ancestors[0].name}
          </span>
        </Button>
      ) : (
        <Typography
          className="tw:text-tertiary"
          data-testid="ontology-concept-parent"
          size="text-sm">
          {t('label.top-level-concept')}
        </Typography>
      )}
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
                entity: t('label.concept').toLocaleLowerCase(),
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
            <span
              className="tw:inline-flex tw:items-center tw:gap-1"
              data-testid="ontology-concept-type">
              {t(
                CONCEPT_TYPE_LABELS[
                  concept.conceptType ?? OntologyConceptType.OwlClass
                ]
              )}
              <Tooltip
                title={t('message.ontology-concept-type-help')}
                triggerClassName="tw:inline-flex">
                <InfoCircle
                  aria-label={t('label.type')}
                  className="tw:size-3"
                  role="img"
                />
              </Tooltip>
            </span>
          </BadgeWithDot>
        </Box>
        <Box align="center" className="tw:min-w-0" gap={1}>
          <Typography
            ellipsis
            className="tw:min-w-0 tw:text-tertiary"
            data-testid="ontology-concept-iri"
            size="text-sm">
            {shortenIri(concept.iri)}
          </Typography>
          <ButtonUtility
            color="tertiary"
            data-testid="ontology-concept-copy-iri"
            icon={hasCopiedIri ? Check : Copy01}
            size="xs"
            tooltip={t(
              hasCopiedIri
                ? 'message.copied-to-clipboard'
                : 'message.copy-to-clipboard'
            )}
            onClick={() => void onCopyToClipBoard(concept.iri)}
          />
        </Box>
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
    isAvailable && authoring !== kind
      ? () => {
          setRelationDraft(EMPTY_RELATION_DRAFT);
          setAuthoring(kind);
        }
      : undefined;

  const renderDescription = () =>
    editor ? (
      <Box className="tw:py-5" direction="col">
        <ConceptEditorFields
          editor={editor}
          names={['displayName', 'description', 'conceptType']}
        />
      </Box>
    ) : (
      <ConceptSection title={t('label.description')}>
        <Typography
          as="p"
          className={
            concept.description
              ? 'tw:m-0 tw:text-secondary'
              : 'tw:m-0 tw:text-tertiary'
          }
          data-testid="ontology-concept-description"
          size="text-sm">
          {concept.description || t('message.no-description-yet')}
          {!concept.description && onEdit ? (
            <>
              {' · '}
              <Button
                noTextPadding
                color="link-color"
                data-testid="ontology-concept-add-description"
                size="sm"
                onPress={onEdit}>
                {t('label.add')}
              </Button>
            </>
          ) : null}
        </Typography>
        {concept.definitionSource ? (
          <Typography
            className="tw:break-all tw:text-tertiary"
            data-testid="ontology-concept-definition-source"
            size="text-xs">
            {t('label.definition-source')} · {concept.definitionSource}
          </Typography>
        ) : null}
      </ConceptSection>
    );

  const renderSynonyms = () => (
    <ConceptSection
      count={concept.synonyms?.length ?? 0}
      testId="ontology-concept-synonyms"
      title={t('label.synonym-plural')}>
      {editor ? (
        <ConceptEditorFields hideLabels editor={editor} names={['synonyms']} />
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
          setRelationDraft(EMPTY_RELATION_DRAFT);
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
          <InlineEmptyPlaceholder
            data-testid="ontology-concept-empty"
            description={t('message.ontology-mappings-empty-hint')}
            title={t('message.ontology-no-mappings-yet')}
          />
        )}
      </ConceptSection>
    );

  const renderAdvanced = () => (
    <OntologyAdvancedDetails
      className="tw:py-4"
      footnote={t('message.ontology-generated-read-only')}
      isOpen={isAdvancedOpen}
      rows={[
        {
          copyable: true,
          label: t('label.name'),
          testId: 'ontology-concept-name',
          value: concept.name,
        },
        {
          copyable: true,
          label: t('label.iri'),
          testId: 'ontology-concept-full-iri',
          value: concept.iri,
        },
        {
          label: t('label.status'),
          testId: 'ontology-concept-lifecycle',
          value: t(
            concept.lifecycleStatus
              ? CONCEPT_STATUS_LABELS[concept.lifecycleStatus]
              : 'label.unavailable'
          ),
        },
        ...(concept.provider
          ? [
              {
                label: t('label.provider'),
                testId: 'ontology-concept-provider',
                value: concept.provider,
              },
            ]
          : []),
        ...(concept.abstract
          ? [
              {
                label: t('label.abstract'),
                testId: 'ontology-concept-abstract',
                value: t('label.yes'),
              },
            ]
          : []),
      ]}
      summary={t('label.id-and-iri')}
      testId="ontology-concept-advanced"
      onToggle={() => setIsAdvancedOpen((open) => !open)}
    />
  );

  const renderRelationList = () => (
    <>
      <ul className="tw:m-0 tw:flex tw:list-none tw:flex-col tw:gap-2 tw:p-0">
        {conceptRelations
          .slice(0, relationLimit)
          .map((row) =>
            canEditRelations && row.relation.key === editingRelationKey
              ? renderRelationEdit(row)
              : renderRelationRow(row)
          )}
      </ul>
      {conceptRelations.length > relationLimit ? (
        <Button
          className="tw:self-start"
          color="link-color"
          data-testid="ontology-concept-relations-load-more"
          size="sm"
          onPress={() =>
            setRelationLimit((limit) => limit + RELATION_PAGE_SIZE)
          }>
          {t('label.load-more')}
        </Button>
      ) : null}
    </>
  );

  const renderBody = () => (
    <div className="tw:min-h-0 tw:flex-1 tw:divide-y tw:divide-secondary tw:overflow-x-hidden tw:overflow-y-auto tw:px-6">
      {conflicts.length > 0 && onShowConflictOnGraph ? (
        <OntologyConceptConflicts
          conflicts={conflicts}
          defaultOpen={isConflictReviewOpen}
          onRemove={canAddRelation ? onDeleteRelation : undefined}
          onShowOnGraph={onShowConflictOnGraph}
        />
      ) : null}
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
          renderRelationList()
        ) : (
          <InlineEmptyPlaceholder
            data-testid="ontology-concept-empty"
            title={t('message.ontology-no-relationships-yet')}
            variant="text"
          />
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
          <InlineEmptyPlaceholder
            data-testid="ontology-concept-empty"
            description={t('message.ontology-properties-empty-hint')}
            title={t('message.ontology-no-properties-yet')}
          />
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
        isLinkRequested={isLinkAssetsRequested}
        key={concept.id}
        presentation={isEditing ? { kind: 'edit' } : { kind: 'view' }}
        properties={bindableProperties}
        selectedAssetId={selectedAssetId}
        onLinkRequestClosed={onLinkAssetsRequestClosed}
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
    <OntologyStudioDrawer
      testId="ontology-concept-inspector"
      // Unsaved work in the drawer (registered dirty forms) goes through the discard prompt first.
      onInteractOutside={onClose}>
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
