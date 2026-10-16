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
  Input,
  ProgressBarBase,
  Select,
  SelectItemType,
  Typography,
} from '@openmetadata/ui-core-components';
import {
  BookClosed,
  ChevronRight,
  Edit01,
  LinkExternal01,
  Plus,
  XClose,
} from '@openmetadata/ui-core-components/icons';
import { AxiosError } from 'axios';
import classNames from 'classnames';
import { Operation } from 'fast-json-patch';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ConceptMapping,
  ConceptMappingType,
  GlossaryTerm,
} from '../../generated/entity/data/glossaryTerm';
import { RelationshipType } from '../../generated/entity/data/relationshipType';
import { Provenance } from '../../generated/type/termRelation';
import { patchGlossaryTerm } from '../../rest/glossaryAPI';
import Fqn from '../../utils/Fqn';
import { showErrorToast, showSuccessToast } from '../../utils/ToastUtils';
import { useOntologyTermDetails } from './hooks/useOntologyTermDetails';
import { OntologyConceptAttributes } from './OntologyConceptAttributes.component';
import { OntologyConceptDataAssets } from './OntologyConceptDataAssets';
import { OntologyConceptRealization } from './OntologyConceptRealization.component';
import { COLOR_META_BY_HEX, RELATION_META } from './OntologyExplorer.constants';
import { OntologyEdge, OntologyNode } from './OntologyExplorer.interface';
import {
  InspectorEmptyText,
  InspectorForm,
  InspectorList,
  InspectorRemoveButton,
  InspectorRow,
  InspectorSection,
  InspectorSectionHeading,
} from './OntologyInspectorSection';
import {
  isTermNode,
  isValidUUID,
  METRIC_NODE_TYPE,
} from './utils/graphBuilders';
import { getEffectiveRelationColor } from './utils/graphStyles';

interface OntologyAuthoringInspectorProps {
  readonly edges: OntologyEdge[];
  readonly isEditable: boolean;
  readonly node: OntologyNode;
  readonly nodes: OntologyNode[];
  readonly relationTypes: RelationshipType[];
  readonly onCreateRelation: (
    fromId: string,
    toId: string,
    relationType: string
  ) => Promise<void>;
  readonly onAssetsChange?: () => void;
  readonly onClose?: () => void;
  readonly onDeleteRelation?: (edge: OntologyEdge) => Promise<void>;
  readonly onRequestEdit?: () => void;
  readonly onSelectNode?: (node: OntologyNode) => void;
  readonly onShowFullDetails?: () => void;
}

interface InspectorRelation {
  readonly edge: OntologyEdge;
  readonly relatedNode?: OntologyNode;
  readonly relationName: string;
}

type SectionKey =
  | 'properties'
  | 'realizedIn'
  | 'relationships'
  | 'mappings'
  | 'dataAssets';

const SECTION_ORDER: SectionKey[] = [
  'properties',
  'realizedIn',
  'relationships',
  'mappings',
  'dataAssets',
];

const SECTION_ADD_LABEL_KEYS: Record<SectionKey, string> = {
  dataAssets: 'label.data-asset',
  mappings: 'label.mapping',
  properties: 'label.property',
  realizedIn: 'label.realized-in',
  relationships: 'label.relationship',
};

// The section's own add control keeps these ids, so either path is one locator.
const SECTION_ADD_TEST_IDS: Record<SectionKey, string> = {
  dataAssets: 'authoring-add-data-assets',
  mappings: 'authoring-add-mapping',
  properties: 'add-attribute',
  realizedIn: 'add-realization',
  relationships: 'authoring-add-relationship',
};

const EXTERNAL_SCHEME_SUGGESTIONS = ['schema', 'wikidata', 'fibo', 'snomed'];
// Hierarchy edges are derived from the term's parent, so no relationship type declares their inverse.
const HIERARCHY_INVERSES: Record<string, string> = {
  childOf: 'parentOf',
  parentOf: 'childOf',
};

// Every FQN segment above the term, with the glossary's display name first.
function getBreadcrumb(node: OntologyNode): string[] {
  const parents = node.fullyQualifiedName
    ? Fqn.split(node.fullyQualifiedName).slice(0, -1)
    : [];

  return parents.map((part, index) =>
    index === 0 && node.group ? node.group : part
  );
}

function toConceptSlug(label: string): string {
  return label.replace(/[^a-zA-Z0-9]/g, '');
}

// "fibo:Account" -> "fibo"; a full IRI reads as its host, e.g. "www.wikidata.org".
function getMappingScheme(conceptIri: string): string {
  try {
    const url = new URL(conceptIri);

    return url.protocol === 'http:' || url.protocol === 'https:'
      ? url.host
      : url.protocol.slice(0, -1);
  } catch {
    return '';
  }
}

const MAPPING_BADGE_COLORS: Record<
  ConceptMappingType,
  'blue' | 'indigo' | 'orange' | 'purple' | 'success'
> = {
  [ConceptMappingType.ExactMatch]: 'success',
  [ConceptMappingType.CloseMatch]: 'blue',
  [ConceptMappingType.BroadMatch]: 'orange',
  [ConceptMappingType.NarrowMatch]: 'purple',
  [ConceptMappingType.RelatedMatch]: 'indigo',
  [ConceptMappingType.SameAs]: 'success',
};

const MAPPING_HINT_KEYS: Record<ConceptMappingType, string> = {
  [ConceptMappingType.ExactMatch]: 'message.mapping-exact-match-hint',
  [ConceptMappingType.CloseMatch]: 'message.mapping-close-match-hint',
  [ConceptMappingType.BroadMatch]: 'message.mapping-broad-match-hint',
  [ConceptMappingType.NarrowMatch]: 'message.mapping-narrow-match-hint',
  [ConceptMappingType.RelatedMatch]: 'message.mapping-related-match-hint',
  [ConceptMappingType.SameAs]: 'message.mapping-same-as-hint',
};

const ColorDot = ({ color }: { color?: string }) => (
  <span
    aria-hidden="true"
    className="tw:size-2 tw:shrink-0 tw:rounded-full tw:bg-fg-quaternary"
    style={color ? { backgroundColor: color } : undefined}
  />
);

function getSectionCounts(
  termDetails: GlossaryTerm | null | undefined,
  relationshipCount: number,
  assetTotal: number
): Record<SectionKey, number> {
  const inheritedAttributeCount = (
    termDetails?.effectiveAttributes ?? []
  ).filter((attribute) => attribute.inherited).length;

  return {
    dataAssets: assetTotal,
    mappings: termDetails?.conceptMappings?.length ?? 0,
    properties:
      (termDetails?.attributes?.length ?? 0) + inheritedAttributeCount,
    realizedIn: termDetails?.realizedIn?.length ?? 0,
    relationships: relationshipCount,
  };
}

// Theme-variable colours for a relation pill; undefined keeps the brand Badge.
function getRelationBadgeStyle(
  effectiveColor: string | undefined
): React.CSSProperties | undefined {
  if (!effectiveColor) {
    return undefined;
  }
  const colorMeta = COLOR_META_BY_HEX[effectiveColor.toLowerCase()] ?? {
    background: 'var(--tw-color-bg-secondary)',
    color: effectiveColor,
  };

  return {
    backgroundColor: colorMeta.background,
    borderColor: `color-mix(in srgb, ${colorMeta.color} 30%, transparent)`,
    color: colorMeta.color,
  };
}

function getNodeLabel(node: OntologyNode | undefined): string | undefined {
  return node?.originalLabel ?? node?.label;
}

// Hierarchy and inferred edges are not stored relations, so they can't be removed here.
function isRemovableRelation(edge: OntologyEdge): boolean {
  return Boolean(edge.id) && edge.provenance !== Provenance.Inferred;
}

const OntologyAuthoringInspector = ({
  edges,
  isEditable,
  node,
  nodes,
  relationTypes,
  onCreateRelation,
  onAssetsChange,
  onClose,
  onDeleteRelation,
  onRequestEdit,
  onSelectNode,
  onShowFullDetails,
}: OntologyAuthoringInspectorProps) => {
  const { t } = useTranslation();
  const termId = node.termId ?? node.id;
  const isPersistedTerm = isValidUUID(termId);
  const { setTermDetails, termDetails } = useOntologyTermDetails(termId);
  const [openSection, setOpenSection] = useState<SectionKey>();
  const [assetTotal, setAssetTotal] = useState(node.assetCount ?? 0);
  const [selectedRelationType, setSelectedRelationType] = useState('');
  const [selectedTargetId, setSelectedTargetId] = useState('');
  const [isSavingRelationship, setIsSavingRelationship] = useState(false);
  const [deletingRelationKey, setDeletingRelationKey] = useState<string>();
  const [mappingType, setMappingType] = useState<ConceptMappingType>(
    ConceptMappingType.ExactMatch
  );
  const [mappingIri, setMappingIri] = useState('');
  const [isSavingMapping, setIsSavingMapping] = useState(false);

  useEffect(() => {
    setOpenSection(undefined);
    setSelectedRelationType('');
    setSelectedTargetId('');
    setMappingIri('');
  }, [node.id]);

  useEffect(() => {
    setAssetTotal(node.assetCount ?? 0);
  }, [node.id, node.assetCount]);

  const relationTypeMap = useMemo(
    () =>
      new Map(
        relationTypes.map((relationType) => [relationType.name, relationType])
      ),
    [relationTypes]
  );
  const relations = useMemo<InspectorRelation[]>(() => {
    // Both edges of an inverse pair (partOf / hasPart) read as the same
    // relationship from this node, so list it once.
    const listed = new Set<string>();

    return edges
      .flatMap((edge) => {
        if (edge.from === node.id) {
          return [
            {
              edge,
              relatedNode: nodes.find((candidate) => candidate.id === edge.to),
              relationName: edge.relationType,
            },
          ];
        }
        if (edge.to === node.id) {
          const relationType = relationTypeMap.get(edge.relationType);

          return [
            {
              edge,
              relatedNode: nodes.find(
                (candidate) => candidate.id === edge.from
              ),
              relationName:
                edge.inverseRelationType ??
                relationType?.inverse?.name ??
                HIERARCHY_INVERSES[edge.relationType] ??
                edge.relationType,
            },
          ];
        }

        return [];
      })
      .filter((relation) => {
        const otherEnd =
          relation.edge.from === node.id
            ? relation.edge.to
            : relation.edge.from;
        const key = `${otherEnd}|${relation.relationName}`;
        if (listed.has(key)) {
          return false;
        }
        listed.add(key);

        return true;
      });
  }, [edges, node.id, nodes, relationTypeMap]);
  const conceptMappings = useMemo(
    () => termDetails?.conceptMappings ?? [],
    [termDetails]
  );
  const sectionCounts = getSectionCounts(
    termDetails,
    relations.length,
    assetTotal
  );
  const completedSectionCount = SECTION_ORDER.filter(
    (key) => sectionCounts[key] > 0
  ).length;
  const isSectionShown = (key: SectionKey) =>
    sectionCounts[key] > 0 || openSection === key;
  const canAddToSection = (key: SectionKey) =>
    key === 'relationships' ||
    (isPersistedTerm &&
      (key !== 'dataAssets' || Boolean(termDetails?.fullyQualifiedName)));

  const getRelationLabel = useCallback(
    (relationName: string) => {
      const relationType = relationTypeMap.get(relationName);
      const labelKey = RELATION_META[relationName]?.labelKey;

      return (
        relationType?.displayName ||
        relationType?.name ||
        (labelKey ? t(labelKey) : relationName)
      );
    },
    [relationTypeMap, t]
  );

  const relationTypeItems = useMemo<SelectItemType[]>(
    () =>
      relationTypes.map((type) => ({
        icon: <ColorDot color={getEffectiveRelationColor(type.name, type)} />,
        id: type.name,
        label: type.displayName || type.name,
      })),
    [relationTypes]
  );
  const targetItems = useMemo<SelectItemType[]>(
    () =>
      nodes
        .filter(
          (candidate) => candidate.id !== node.id && isTermNode(candidate)
        )
        .map((candidate) => ({
          id: candidate.id,
          label: candidate.originalLabel ?? candidate.label,
          supportingText: candidate.fullyQualifiedName,
        })),
    [node.id, nodes]
  );
  const selectedTarget = targetItems.find(
    (item) => item.id === selectedTargetId
  );

  const setSectionOpen = useCallback((key: SectionKey, isOpen: boolean) => {
    setOpenSection((current) => {
      if (isOpen) {
        return key;
      }

      return current === key ? undefined : current;
    });
  }, []);

  const closeRelationshipForm = useCallback(() => {
    setSectionOpen('relationships', false);
    setSelectedRelationType('');
    setSelectedTargetId('');
  }, [setSectionOpen]);

  const handleCreateRelationship = useCallback(async () => {
    if (!selectedRelationType || !selectedTargetId || !isEditable) {
      return;
    }
    setIsSavingRelationship(true);
    try {
      await onCreateRelation(node.id, selectedTargetId, selectedRelationType);
      closeRelationshipForm();
    } finally {
      setIsSavingRelationship(false);
    }
  }, [
    closeRelationshipForm,
    isEditable,
    node.id,
    onCreateRelation,
    selectedRelationType,
    selectedTargetId,
  ]);

  const handleDeleteRelation = useCallback(
    async (relation: InspectorRelation, key: string) => {
      if (!onDeleteRelation) {
        return;
      }
      setDeletingRelationKey(key);
      try {
        await onDeleteRelation(relation.edge);
      } finally {
        setDeletingRelationKey(undefined);
      }
    },
    [onDeleteRelation]
  );

  const closeMappingForm = useCallback(() => {
    setSectionOpen('mappings', false);
    setMappingIri('');
  }, [setSectionOpen]);

  const patchMappings = useCallback(
    async (operation: Operation, successKey: string) => {
      setIsSavingMapping(true);
      try {
        const updatedTerm = await patchGlossaryTerm(termId, [operation]);
        setTermDetails(updatedTerm);
        showSuccessToast(t(successKey, { entity: t('label.mapping') }));

        return true;
      } catch (error) {
        showErrorToast(error as AxiosError);

        return false;
      } finally {
        setIsSavingMapping(false);
      }
    },
    [setTermDetails, t, termId]
  );

  const handleAddMapping = useCallback(async () => {
    const conceptIri = mappingIri.trim();
    try {
      new URL(conceptIri);
    } catch {
      showErrorToast(t('message.invalid-concept-iri'));

      return;
    }
    if (
      conceptMappings.some(
        (mapping) =>
          mapping.conceptIri === conceptIri &&
          mapping.mappingType === mappingType
      )
    ) {
      showErrorToast(t('message.concept-mapping-already-exists'));

      return;
    }

    const mapping: ConceptMapping = { conceptIri, mappingType };
    const operation: Operation = conceptMappings.length
      ? { op: 'add', path: '/conceptMappings/-', value: mapping }
      : { op: 'add', path: '/conceptMappings', value: [mapping] };
    const saved = await patchMappings(
      operation,
      'server.create-entity-success'
    );
    if (saved) {
      closeMappingForm();
    }
  }, [
    closeMappingForm,
    conceptMappings,
    mappingIri,
    mappingType,
    patchMappings,
    t,
  ]);

  const handleRemoveMapping = useCallback(
    (index: number) =>
      patchMappings(
        { op: 'remove', path: `/conceptMappings/${index}` },
        'server.entity-deleted-success'
      ),
    [patchMappings]
  );

  const renderRelationRow = (relation: InspectorRelation) => {
    const rowKey = `${relation.edge.from}-${relation.edge.to}-${relation.relationName}`;
    const badgeStyle = getRelationBadgeStyle(
      getEffectiveRelationColor(
        relation.relationName,
        relationTypeMap.get(relation.relationName)
      )
    );
    const relatedNode = relation.relatedNode;
    const targetLabel =
      getNodeLabel(relatedNode) ?? t('label.term-not-available');
    const canRemove =
      isEditable && onDeleteRelation && isRemovableRelation(relation.edge);
    const content = (
      <>
        <Badge
          className="tw:max-w-40 tw:shrink-0"
          color={badgeStyle ? 'gray' : 'brand'}
          size="sm"
          style={badgeStyle}
          type="pill-color">
          {getRelationLabel(relation.relationName)}
        </Badge>
        <Typography
          ellipsis
          className="tw:min-w-0 tw:flex-1 tw:text-primary"
          size="text-sm"
          weight="medium">
          {targetLabel}
        </Typography>
      </>
    );
    const navigateTo = relatedNode && onSelectNode ? relatedNode : undefined;

    return (
      <InspectorRow
        key={rowKey}
        testId={`authoring-relation-${relation.edge.from}-${relation.edge.to}`}>
        {navigateTo ? (
          <Button
            noTextPadding
            className={classNames(
              'tw:flex tw:min-w-0 tw:flex-1 tw:p-0 tw:text-left',
              'tw:*:data-text:flex tw:*:data-text:w-full tw:*:data-text:min-w-0 tw:*:data-text:items-center tw:*:data-text:gap-3'
            )}
            color="tertiary"
            data-testid={`authoring-relation-open-${navigateTo.id}`}
            onPress={() => onSelectNode?.(navigateTo)}>
            {content}
          </Button>
        ) : (
          <Box align="center" className="tw:min-w-0 tw:flex-1" gap={3}>
            {content}
          </Box>
        )}
        {canRemove ? (
          <InspectorRemoveButton
            isDisabled={deletingRelationKey !== undefined}
            label={t('label.remove-entity', { entity: targetLabel })}
            testId={`authoring-remove-relation-${relation.edge.from}-${relation.edge.to}`}
            onRemove={() => handleDeleteRelation(relation, rowKey)}
          />
        ) : null}
        {navigateTo ? (
          <ChevronRight
            aria-hidden="true"
            className="tw:size-4 tw:shrink-0 tw:text-fg-quaternary"
          />
        ) : null}
      </InspectorRow>
    );
  };

  const renderRelationshipForm = () => (
    <InspectorForm
      isSubmitDisabled={
        !selectedRelationType || !selectedTargetId || isSavingRelationship
      }
      submitLabel={t('label.add-entity', { entity: t('label.relationship') })}
      submitTestId="authoring-save-relationship"
      testId="authoring-relationship-draft"
      title={t('label.new-entity', { entity: t('label.relationship') })}
      onCancel={closeRelationshipForm}
      onSubmit={handleCreateRelationship}>
      <Select
        data-testid="authoring-relation-type"
        fontSize="sm"
        items={relationTypeItems}
        label={t('label.type')}
        placeholder={t('label.relationship-type')}
        value={selectedRelationType || null}
        onChange={(key) => setSelectedRelationType(String(key ?? ''))}>
        {(item) => (
          <Select.Item
            data-testid={`authoring-relation-type-${item.id}`}
            icon={item.icon}
            id={item.id}
            key={item.id}
            label={item.label}
          />
        )}
      </Select>
      <Select.ComboBox
        showSearchIcon
        data-testid="authoring-target-search"
        emptyState={t('message.no-terms-found')}
        fontSize="sm"
        items={targetItems}
        label={t('label.target-term')}
        placeholder={t('label.search-entity', {
          entity: t('label.term-plural'),
        })}
        shortcut={false}
        value={selectedTargetId || null}
        onChange={(key) => setSelectedTargetId(String(key ?? ''))}>
        {(item) => (
          <Select.Item
            data-testid={`authoring-target-${item.id}`}
            id={item.id}
            key={item.id}
            label={item.label}
            supportingText={item.supportingText}
          />
        )}
      </Select.ComboBox>
      {selectedRelationType && selectedTarget ? (
        <Box align="center" gap={2} wrap="wrap">
          <Typography
            className="tw:text-primary"
            size="text-sm"
            weight="semibold">
            {node.originalLabel ?? node.label}
          </Typography>
          <Badge color="brand" size="sm" type="pill-color">
            {getRelationLabel(selectedRelationType)}
          </Badge>
          <Typography
            className="tw:text-primary"
            size="text-sm"
            weight="semibold">
            {selectedTarget.label}
          </Typography>
        </Box>
      ) : null}
    </InspectorForm>
  );

  const renderMappingForm = () => {
    const conceptSlug = toConceptSlug(node.originalLabel ?? node.label);

    return (
      <InspectorForm
        isSubmitDisabled={!mappingIri.trim() || isSavingMapping}
        submitLabel={t('label.add-mapping')}
        submitTestId="authoring-save-mapping"
        title={t('label.new-entity', { entity: t('label.mapping') })}
        onCancel={closeMappingForm}
        onSubmit={handleAddMapping}>
        <Box direction="col" gap={1}>
          <Select
            data-testid="authoring-mapping-type"
            fontSize="sm"
            items={Object.values(ConceptMappingType).map((type) => ({
              id: type,
              label: type,
            }))}
            label={t('label.match-type')}
            value={mappingType}
            onChange={(key) => setMappingType(key as ConceptMappingType)}>
            {(item) => (
              <Select.Item
                data-testid={`authoring-mapping-type-${item.id}`}
                id={item.id}
                key={item.id}
                label={item.label}
              />
            )}
          </Select>
          <Typography className="tw:text-tertiary" size="text-xs">
            {t(MAPPING_HINT_KEYS[mappingType])}
          </Typography>
        </Box>
        <Input
          isRequired
          data-testid="authoring-mapping-iri"
          label={t('label.external-concept')}
          placeholder={t('label.concept-iri')}
          value={mappingIri}
          onChange={setMappingIri}
        />
        <Box gap={2} wrap="wrap">
          {EXTERNAL_SCHEME_SUGGESTIONS.map((scheme) => {
            const suggestion = `${scheme}:${conceptSlug}`;

            return (
              <Button
                color="secondary"
                data-testid={`authoring-mapping-scheme-${scheme}`}
                key={scheme}
                size="sm"
                type="button"
                onPress={() => setMappingIri(suggestion)}>
                {suggestion}
              </Button>
            );
          })}
        </Box>
      </InspectorForm>
    );
  };

  const renderHeaderActions = () => (
    <Box align="center" className="tw:shrink-0" gap={2}>
      {!isEditable && onRequestEdit ? (
        <Button
          color="secondary"
          data-testid="ontology-concept-edit"
          iconLeading={Edit01}
          size="xs"
          onPress={onRequestEdit}>
          {t('label.edit')}
        </Button>
      ) : null}
      {onShowFullDetails ? (
        <ButtonUtility
          color="tertiary"
          data-testid="ontology-concept-full-details"
          icon={LinkExternal01}
          size="lg"
          tooltip={t('label.view-detail-plural')}
          onClick={onShowFullDetails}
        />
      ) : null}
      {onClose ? (
        <ButtonUtility
          color="tertiary"
          data-testid="ontology-concept-inspector-close"
          icon={XClose}
          size="lg"
          tooltip={t('label.close')}
          onClick={onClose}
        />
      ) : null}
    </Box>
  );

  const renderHeader = () => {
    const breadcrumb = getBreadcrumb(node);

    return (
      <Box
        className="tw:shrink-0 tw:border-b tw:border-secondary tw:px-6 tw:pt-5 tw:pb-4"
        direction="col"
        gap={3}>
        <Box align="start" gap={3}>
          <Box className="tw:min-w-0 tw:flex-1" direction="col" gap={1}>
            {breadcrumb.length > 0 ? (
              <Box
                align="center"
                className="tw:min-w-0 tw:text-fg-quaternary"
                gap={1}>
                <BookClosed
                  aria-hidden="true"
                  className="tw:size-3.5 tw:shrink-0"
                />
                {breadcrumb.map((part, index) => (
                  <React.Fragment
                    key={breadcrumb.slice(0, index + 1).join('/')}>
                    {index > 0 ? (
                      <ChevronRight
                        aria-hidden="true"
                        className="tw:size-3 tw:shrink-0"
                      />
                    ) : null}
                    <Typography
                      ellipsis
                      className="tw:text-tertiary"
                      size="text-xs"
                      weight="medium">
                      {part}
                    </Typography>
                  </React.Fragment>
                ))}
              </Box>
            ) : null}
            <Box align="center" className="tw:min-w-0" gap={2} wrap="wrap">
              <Typography
                aria-level={2}
                className="tw:text-primary"
                role="heading"
                size="text-md"
                weight="semibold">
                {node.originalLabel ?? node.label}
              </Typography>
              <BadgeWithDot color="brand" size="sm" type="color">
                {t(
                  node.type === METRIC_NODE_TYPE
                    ? 'label.metric'
                    : 'label.concept'
                )}
              </BadgeWithDot>
            </Box>
          </Box>
          {renderHeaderActions()}
        </Box>
        {node.description ? (
          <Typography as="p" className="tw:m-0 tw:text-tertiary" size="text-sm">
            {node.description}
          </Typography>
        ) : null}
        <Box align="center" data-testid="ontology-concept-completeness" gap={3}>
          <Typography className="tw:shrink-0 tw:text-tertiary" size="text-xs">
            {t('label.completeness')}
          </Typography>
          <ProgressBarBase
            className="tw:h-1.5 tw:max-w-60 tw:flex-1"
            max={SECTION_ORDER.length}
            value={completedSectionCount}
          />
          <Typography
            className="tw:shrink-0 tw:text-secondary"
            size="text-xs"
            weight="medium">
            {t('message.completed-section-count', {
              count: completedSectionCount,
              total: SECTION_ORDER.length,
            })}
          </Typography>
        </Box>
      </Box>
    );
  };

  const renderRelationshipsSection = () => (
    <InspectorSection testId="authoring-relationships">
      <InspectorSectionHeading
        addTestId="authoring-add-relationship"
        count={relations.length}
        label={t('label.relationship-plural')}
        onAdd={
          isEditable && openSection !== 'relationships'
            ? () => setSectionOpen('relationships', true)
            : undefined
        }
      />
      {relations.length === 0 ? (
        <InspectorEmptyText>
          {t('message.no-concept-relationships')}
        </InspectorEmptyText>
      ) : (
        <InspectorList>{relations.map(renderRelationRow)}</InspectorList>
      )}
      {isEditable && openSection === 'relationships'
        ? renderRelationshipForm()
        : null}
    </InspectorSection>
  );

  const renderMappingsSection = () => (
    <InspectorSection testId="authoring-mappings">
      <InspectorSectionHeading
        addTestId="authoring-add-mapping"
        count={conceptMappings.length}
        label={t('label.mapping-plural')}
        onAdd={
          isEditable && isPersistedTerm && openSection !== 'mappings'
            ? () => setSectionOpen('mappings', true)
            : undefined
        }
      />
      {conceptMappings.length === 0 ? (
        <InspectorEmptyText>
          {t('message.no-concept-mappings')}
        </InspectorEmptyText>
      ) : (
        <InspectorList>
          {conceptMappings.map((mapping, index) => {
            const scheme = getMappingScheme(mapping.conceptIri);

            return (
              <InspectorRow
                key={`${mapping.mappingType}-${mapping.conceptIri}`}>
                <Box className="tw:min-w-0 tw:flex-1" direction="col">
                  <Typography
                    ellipsis
                    className="tw:text-primary"
                    size="text-sm"
                    weight="medium">
                    {mapping.conceptIri}
                  </Typography>
                  {scheme ? (
                    <Typography className="tw:text-tertiary" size="text-xs">
                      {scheme}
                    </Typography>
                  ) : null}
                </Box>
                <Badge
                  color={MAPPING_BADGE_COLORS[mapping.mappingType]}
                  size="sm"
                  type="pill-color">
                  {mapping.mappingType}
                </Badge>
                {isEditable ? (
                  <InspectorRemoveButton
                    isDisabled={isSavingMapping}
                    label={t('label.remove-entity', {
                      entity: mapping.conceptIri,
                    })}
                    testId={`authoring-remove-mapping-${index}`}
                    onRemove={() => handleRemoveMapping(index)}
                  />
                ) : null}
              </InspectorRow>
            );
          })}
        </InspectorList>
      )}
      {isEditable && openSection === 'mappings' ? renderMappingForm() : null}
    </InspectorSection>
  );

  const renderSection = (key: SectionKey) => {
    if (key === 'dataAssets') {
      return null;
    }
    if (!isSectionShown(key)) {
      return null;
    }
    if (key === 'relationships') {
      return (
        <React.Fragment key={key}>
          {renderRelationshipsSection()}
        </React.Fragment>
      );
    }
    if (key === 'mappings') {
      return (
        <React.Fragment key={key}>{renderMappingsSection()}</React.Fragment>
      );
    }
    if (!isPersistedTerm) {
      return null;
    }

    return key === 'properties' ? (
      <OntologyConceptAttributes
        showEditControls
        attributes={termDetails?.attributes ?? []}
        effectiveAttributes={termDetails?.effectiveAttributes}
        isAdding={openSection === 'properties'}
        isEditMode={isEditable}
        key={key}
        termId={termId}
        variant="inspector"
        onAddingChange={(isOpen) => setSectionOpen('properties', isOpen)}
        onTermUpdate={setTermDetails}
      />
    ) : (
      <OntologyConceptRealization
        isAdding={openSection === 'realizedIn'}
        isEditMode={isEditable}
        key={key}
        realizations={termDetails?.realizedIn ?? []}
        termId={termId}
        variant="inspector"
        onAddingChange={(isOpen) => setSectionOpen('realizedIn', isOpen)}
        onTermUpdate={setTermDetails}
      />
    );
  };

  const renderAddMoreDetails = () => {
    const addableSections = isEditable
      ? SECTION_ORDER.filter(
          (key) => !isSectionShown(key) && canAddToSection(key)
        )
      : [];

    return addableSections.length > 0 ? (
      <Box className="tw:pt-2" direction="col" gap={2}>
        <Typography className="tw:text-tertiary" size="text-xs">
          {t('label.add-more-details')}
        </Typography>
        <Box gap={2} wrap="wrap">
          {addableSections.map((key) => (
            <Button
              className="tw:rounded-full"
              color="secondary"
              data-testid={SECTION_ADD_TEST_IDS[key]}
              iconLeading={Plus}
              key={key}
              size="sm"
              onPress={() => setSectionOpen(key, true)}>
              {t(SECTION_ADD_LABEL_KEYS[key])}
            </Button>
          ))}
        </Box>
      </Box>
    ) : null;
  };

  const renderNoDetails = () => {
    const hasNoDetails =
      Boolean(termDetails) &&
      !isEditable &&
      SECTION_ORDER.every((key) => !isSectionShown(key));

    return hasNoDetails ? (
      <InspectorEmptyText>{t('message.no-concept-details')}</InspectorEmptyText>
    ) : null;
  };

  return (
    // Non-modal so the graph behind stays clickable (node switching, port connect);
    // fixed so it spans the viewport from the top, over the app navbar.
    <aside
      className="tw:fixed tw:inset-y-0 tw:right-0 tw:z-20 tw:flex tw:w-[max(420px,40vw)] tw:max-w-full tw:flex-col tw:border-l tw:border-secondary tw:bg-overlay-surface tw:shadow-overlay"
      data-testid="ontology-authoring-inspector">
      {renderHeader()}
      <Box
        className="tw:min-h-0 tw:flex-1 tw:overflow-y-auto tw:px-6 tw:pt-5 tw:pb-8"
        direction="col"
        gap={3}>
        {SECTION_ORDER.map(renderSection)}

        {isPersistedTerm ? (
          <OntologyConceptDataAssets
            initialCount={node.assetCount}
            isEditMode={isEditable}
            isPickerOpen={openSection === 'dataAssets'}
            term={termDetails}
            termId={termId}
            onAssetsChange={onAssetsChange}
            onPickerOpenChange={(isOpen) =>
              setSectionOpen('dataAssets', isOpen)
            }
            onTotalChange={setAssetTotal}
          />
        ) : null}

        {renderNoDetails()}
        {renderAddMoreDetails()}
      </Box>
    </aside>
  );
};

export default OntologyAuthoringInspector;
