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

import { Badge, Button, Input } from '@openmetadata/ui-core-components';
import { Edit03, Plus, SearchMd } from '@untitledui/icons';
import { AxiosError } from 'axios';
import classNames from 'classnames';
import { Operation } from 'fast-json-patch';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ConceptMapping,
  ConceptMappingType,
} from '../../generated/entity/data/glossaryTerm';
import { RelationshipType } from '../../generated/entity/data/relationshipType';
import { EntityReference } from '../../generated/entity/type';
import {
  getGlossaryTermAssets,
  patchGlossaryTerm,
} from '../../rest/glossaryAPI';
import serviceUtilClassBase from '../../utils/ServiceUtilClassBase';
import { showErrorToast, showSuccessToast } from '../../utils/ToastUtils';
import { useOntologyTermDetails } from './hooks/useOntologyTermDetails';
import { OntologyConceptAttributes } from './OntologyConceptAttributes.component';
import { OntologyConceptRealization } from './OntologyConceptRealization.component';
import { COLOR_META_BY_HEX, RELATION_META } from './OntologyExplorer.constants';
import { OntologyEdge, OntologyNode } from './OntologyExplorer.interface';
import { isTermNode, isValidUUID } from './utils/graphBuilders';
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
  readonly onShowDataAssets: () => void;
  readonly onRequestEdit?: () => void;
  readonly onShowFullDetails?: () => void;
}

interface InspectorRelation {
  readonly edge: OntologyEdge;
  readonly relatedNode?: OntologyNode;
  readonly relationName: string;
}

const ASSET_PREVIEW_LIMIT = 3;
const EXTERNAL_SCHEME_SUGGESTIONS = ['schema', 'wikidata', 'fibo', 'snomed'];
const SearchInputIcon = ({ className }: { className?: string }) => (
  <SearchMd aria-hidden="true" className={className} />
);

function toConceptSlug(label: string): string {
  return label.replace(/[^a-zA-Z0-9]/g, '');
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

interface SectionHeadingProps {
  readonly count: number;
  readonly label: string;
}

const SectionHeading = ({ count, label }: SectionHeadingProps) => (
  <div className="tw:mb-2.5 tw:flex tw:items-center tw:gap-2">
    <h3 className="tw:m-0 tw:font-body tw:text-[13px] tw:leading-normal tw:font-semibold tw:text-primary">
      {label}
    </h3>
    <span className="tw:rounded-full tw:border tw:border-secondary tw:bg-tertiary tw:px-2 tw:py-px tw:font-body tw:text-[11px] tw:leading-normal tw:font-semibold tw:text-secondary">
      {count}
    </span>
  </div>
);

interface AddButtonProps {
  readonly isDisabled: boolean;
  readonly isPrimary?: boolean;
  readonly label: string;
  readonly testId: string;
  readonly onClick: () => void;
}

const AddButton = ({
  isDisabled,
  isPrimary = false,
  label,
  testId,
  onClick,
}: AddButtonProps) => (
  <Button
    noTextPadding
    className={classNames(
      'tw:mt-2 tw:flex tw:w-full tw:items-center tw:justify-center tw:gap-1 tw:rounded-[9px] tw:border tw:border-dashed tw:bg-primary tw:px-2.5 tw:py-[9px] tw:*:data-icon:size-3',
      'tw:font-body tw:text-xs tw:leading-normal tw:font-semibold',
      isPrimary
        ? 'tw:border-brand tw:text-brand-tertiary'
        : 'tw:border-primary tw:text-secondary',
      isDisabled && 'tw:cursor-not-allowed tw:opacity-50'
    )}
    color="tertiary"
    data-testid={testId}
    iconLeading={Plus}
    isDisabled={isDisabled}
    onClick={onClick}>
    {label}
  </Button>
);

const OntologyAuthoringInspector = ({
  edges,
  isEditable,
  node,
  nodes,
  relationTypes,
  onCreateRelation,
  onShowDataAssets,
  onRequestEdit,
  onShowFullDetails,
}: OntologyAuthoringInspectorProps) => {
  const { t } = useTranslation();
  const termId = node.termId ?? node.id;
  const { setTermDetails, termDetails } = useOntologyTermDetails(termId);
  const [assets, setAssets] = useState<EntityReference[]>([]);
  const [assetTotal, setAssetTotal] = useState(node.assetCount ?? 0);
  const [isAddingRelationship, setIsAddingRelationship] = useState(false);
  const [selectedRelationType, setSelectedRelationType] = useState('');
  const [targetSearch, setTargetSearch] = useState('');
  const [isSavingRelationship, setIsSavingRelationship] = useState(false);
  const [isAddingMapping, setIsAddingMapping] = useState(false);
  const [mappingType, setMappingType] = useState<ConceptMappingType>(
    ConceptMappingType.ExactMatch
  );
  const [mappingIri, setMappingIri] = useState('');
  const [isSavingMapping, setIsSavingMapping] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    setAssets([]);
    setAssetTotal(node.assetCount ?? 0);

    if (!isValidUUID(termId)) {
      return () => controller.abort();
    }

    getGlossaryTermAssets(termId, ASSET_PREVIEW_LIMIT, 0, controller.signal)
      .then((response) => {
        setAssets(response.data);
        setAssetTotal(response.paging.total);
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setAssets([]);
        }
      });

    return () => controller.abort();
  }, [node.assetCount, termId]);

  useEffect(() => {
    setIsAddingRelationship(false);
    setSelectedRelationType('');
    setTargetSearch('');
    setIsAddingMapping(false);
    setMappingIri('');
  }, [node.id]);

  const relationTypeMap = useMemo(
    () =>
      new Map(
        relationTypes.map((relationType) => [relationType.name, relationType])
      ),
    [relationTypes]
  );
  const relations = useMemo<InspectorRelation[]>(
    () =>
      edges.flatMap((edge) => {
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
                edge.relationType,
            },
          ];
        }

        return [];
      }),
    [edges, node.id, nodes, relationTypeMap]
  );
  const targetNodes = useMemo(() => {
    const normalizedSearch = targetSearch.trim().toLocaleLowerCase();

    return nodes
      .filter((candidate) => candidate.id !== node.id && isTermNode(candidate))
      .filter((candidate) => {
        if (!normalizedSearch) {
          return true;
        }

        return [candidate.label, candidate.fullyQualifiedName]
          .filter(Boolean)
          .some((value) =>
            value?.toLocaleLowerCase().includes(normalizedSearch)
          );
      })
      .slice(0, 6);
  }, [node.id, nodes, targetSearch]);
  const conceptMappings = termDetails?.conceptMappings ?? [];

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

  const handleCreateRelationship = useCallback(
    async (targetId: string) => {
      if (!selectedRelationType || !isEditable) {
        return;
      }
      setIsSavingRelationship(true);
      try {
        await onCreateRelation(node.id, targetId, selectedRelationType);
        setIsAddingRelationship(false);
        setSelectedRelationType('');
        setTargetSearch('');
      } finally {
        setIsSavingRelationship(false);
      }
    },
    [isEditable, node.id, onCreateRelation, selectedRelationType]
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
    setIsSavingMapping(true);
    try {
      const updatedTerm = await patchGlossaryTerm(termId, [operation]);
      setTermDetails(updatedTerm);
      setMappingIri('');
      setIsAddingMapping(false);
      showSuccessToast(
        t('server.create-entity-success', { entity: t('label.mapping') })
      );
    } catch (error) {
      showErrorToast(error as AxiosError);
    } finally {
      setIsSavingMapping(false);
    }
  }, [conceptMappings, mappingIri, mappingType, setTermDetails, t, termId]);

  const renderRelationRow = (relation: InspectorRelation) => {
    const relationshipType = relationTypeMap.get(relation.relationName);
    const effectiveColor = getEffectiveRelationColor(
      relation.relationName,
      relationshipType
    );
    const colorMeta = effectiveColor
      ? COLOR_META_BY_HEX[effectiveColor.toLowerCase()] ?? {
          background: 'var(--color-bg-secondary)',
          color: effectiveColor,
        }
      : undefined;
    const targetLabel =
      relation.relatedNode?.originalLabel ??
      relation.relatedNode?.label ??
      t('label.term-not-available');

    return (
      <div
        className="tw:flex tw:items-center tw:gap-2 tw:rounded-lg tw:border tw:border-secondary tw:bg-secondary tw:px-2.5 tw:py-2"
        data-testid={`authoring-relation-${relation.edge.from}-${relation.edge.to}`}
        key={`${relation.edge.from}-${relation.edge.to}-${relation.relationName}`}
        style={
          colorMeta
            ? ({
                '--relation-bg': colorMeta.background,
                '--relation-color': colorMeta.color,
              } as React.CSSProperties)
            : undefined
        }>
        <span
          className={classNames(
            'tw:max-w-[112px] tw:shrink-0 tw:truncate tw:rounded-md tw:px-2 tw:py-0.5 tw:font-body tw:text-[10px] tw:leading-normal tw:font-semibold',
            colorMeta
              ? 'tw:bg-[var(--relation-bg)] tw:text-[var(--relation-color)]'
              : 'tw:bg-brand-primary tw:text-brand-secondary'
          )}>
          {getRelationLabel(relation.relationName)}
        </span>
        <span className="tw:min-w-0 tw:flex-1 tw:truncate tw:font-body tw:text-xs tw:leading-normal tw:font-medium tw:text-primary">
          {targetLabel}
        </span>
      </div>
    );
  };

  const renderRelationTypeGroup = (group: {
    label: string;
    types: RelationshipType[];
  }) =>
    group.types.length ? (
      <div className="tw:flex tw:flex-col tw:gap-1.5" key={group.label}>
        <span className="tw:font-body tw:text-[9px] tw:leading-normal tw:font-semibold tw:tracking-[0.06em] tw:text-quaternary tw:uppercase">
          {group.label}
        </span>
        <div className="tw:flex tw:flex-wrap tw:gap-1.5">
          {group.types.map((type) => (
            <Button
              color="secondary"
              data-testid={`authoring-relation-type-${type.name}`}
              key={type.name}
              size="sm"
              onPress={() => setSelectedRelationType(type.name)}>
              <span
                className="tw:size-1.5 tw:rounded-full"
                style={{
                  backgroundColor: getEffectiveRelationColor(type.name, type),
                }}
              />
              {type.displayName || type.name}
            </Button>
          ))}
        </div>
      </div>
    ) : null;

  const renderRelationshipDraft = () => (
    <div
      className="tw:mt-2 tw:flex tw:flex-col tw:gap-2.5 tw:rounded-[10px] tw:border tw:border-secondary tw:bg-secondary tw:p-3"
      data-testid="authoring-relationship-draft">
      <span className="tw:font-body tw:text-[10px] tw:leading-normal tw:font-semibold tw:tracking-[0.06em] tw:text-quaternary tw:uppercase">
        {selectedRelationType ? '2' : '1'} ·{' '}
        {selectedRelationType
          ? t('label.target-term')
          : t('label.relationship-type')}
      </span>
      {selectedRelationType ? (
        <>
          <Input
            aria-label={t('label.search')}
            icon={SearchInputIcon}
            inputClassName="tw:text-xs"
            inputDataTestId="authoring-target-search"
            placeholder={`${t('label.search')} ${t('label.term-lowercase')}…`}
            size="sm"
            value={targetSearch}
            onChange={setTargetSearch}
          />
          <div className="tw:flex tw:max-h-48 tw:flex-col tw:gap-1 tw:overflow-auto">
            {targetNodes.map((targetNode) => (
              <Button
                noTextPadding
                className={classNames(
                  'tw:flex tw:w-full tw:rounded-lg tw:border-0 tw:bg-primary tw:px-2.5 tw:py-2',
                  'tw:text-left tw:whitespace-normal hover:tw:bg-primary_hover disabled:tw:cursor-wait',
                  'tw:*:data-text:flex tw:*:data-text:w-full tw:*:data-text:flex-col'
                )}
                color="tertiary"
                data-testid={`authoring-target-${targetNode.id}`}
                isDisabled={isSavingRelationship}
                key={targetNode.id}
                onClick={() => handleCreateRelationship(targetNode.id)}>
                <span className="tw:truncate tw:font-body tw:text-xs tw:leading-normal tw:font-medium tw:text-primary">
                  {targetNode.originalLabel ?? targetNode.label}
                </span>
                <span className="tw:truncate tw:font-mono tw:text-[10px] tw:leading-normal tw:text-quaternary">
                  {targetNode.fullyQualifiedName}
                </span>
              </Button>
            ))}
          </div>
        </>
      ) : (
        <div className="tw:flex tw:flex-col tw:gap-2.5">
          {[
            {
              label: t('label.system-defined'),
              types: relationTypes.filter((type) => type.systemDefined),
            },
            {
              label: t('label.custom'),
              types: relationTypes.filter((type) => !type.systemDefined),
            },
          ].map(renderRelationTypeGroup)}
        </div>
      )}
      <Button
        className="tw:self-end"
        color="tertiary"
        size="sm"
        onPress={() => {
          setIsAddingRelationship(false);
          setSelectedRelationType('');
          setTargetSearch('');
        }}>
        {t('label.cancel')}
      </Button>
    </div>
  );

  const renderMappingDraft = () => {
    const conceptSlug = toConceptSlug(node.originalLabel ?? node.label);

    return (
      <div className="tw:mt-2 tw:flex tw:flex-col tw:gap-2.5 tw:rounded-[9px] tw:border tw:border-dashed tw:border-primary tw:bg-secondary tw:p-[11px]">
        <span className="tw:font-body tw:text-[10px] tw:leading-normal tw:font-semibold tw:tracking-[0.06em] tw:text-quaternary tw:uppercase">
          {t('label.match-type')}
        </span>
        <div className="tw:flex tw:flex-wrap tw:gap-1.5">
          {Object.values(ConceptMappingType).map((type) => (
            <Button
              noTextPadding
              aria-pressed={mappingType === type}
              className={classNames(
                'tw:rounded-full tw:border tw:px-2.5 tw:py-1 tw:font-mono tw:text-[11px] tw:leading-normal tw:font-medium',
                mappingType === type
                  ? 'tw:border-utility-success-200 tw:bg-utility-success-50 tw:text-success-primary'
                  : 'tw:border-secondary tw:bg-primary tw:text-tertiary hover:tw:bg-secondary'
              )}
              color="tertiary"
              data-testid={`authoring-mapping-type-${type}`}
              key={type}
              onClick={() => setMappingType(type)}>
              {type}
            </Button>
          ))}
        </div>
        <span className="tw:font-body tw:text-[10px] tw:leading-normal tw:font-semibold tw:tracking-[0.06em] tw:text-quaternary tw:uppercase">
          {t('label.map-to-external-scheme')}
        </span>
        <Input
          aria-label={t('label.concept-iri')}
          data-testid="authoring-mapping-iri"
          placeholder={t('label.concept-iri')}
          value={mappingIri}
          onChange={setMappingIri}
        />
        <div className="tw:flex tw:flex-wrap tw:gap-1.5">
          {EXTERNAL_SCHEME_SUGGESTIONS.map((scheme) => {
            const suggestion = `${scheme}:${conceptSlug}`;

            return (
              <Button
                noTextPadding
                className={classNames(
                  'tw:rounded-md tw:border tw:border-secondary tw:bg-primary tw:px-2 tw:py-1',
                  'tw:font-mono tw:text-[11px] tw:leading-normal tw:font-medium tw:text-brand-secondary hover:tw:bg-secondary'
                )}
                color="tertiary"
                data-testid={`authoring-mapping-scheme-${scheme}`}
                key={scheme}
                onClick={() => setMappingIri(suggestion)}>
                {suggestion}
              </Button>
            );
          })}
        </div>
        <div className="tw:flex tw:justify-end tw:gap-2">
          <Button
            color="tertiary"
            size="sm"
            onPress={() => {
              setIsAddingMapping(false);
              setMappingIri('');
            }}>
            {t('label.cancel')}
          </Button>
          <Button
            color="primary"
            data-testid="authoring-save-mapping"
            isDisabled={!mappingIri.trim() || isSavingMapping}
            size="sm"
            onPress={handleAddMapping}>
            {t('label.add-mapping')}
          </Button>
        </div>
      </div>
    );
  };

  return (
    <aside
      className="tw:z-4 tw:h-full tw:w-[300px] tw:shrink-0 tw:overflow-y-auto tw:border-l tw:border-secondary tw:bg-primary tw:p-[18px]"
      data-testid="ontology-authoring-inspector">
      <div className="tw:mb-2 tw:flex tw:items-center tw:justify-between tw:gap-2">
        <span className="tw:font-body tw:text-[10px] tw:leading-normal tw:font-semibold tw:tracking-[0.08em] tw:text-quaternary tw:uppercase">
          {t('label.concept')}
        </span>
        <div className="tw:flex tw:shrink-0 tw:items-center tw:gap-2">
          {onShowFullDetails ? (
            <Button
              noTextPadding
              className="tw:border-0 tw:bg-transparent tw:p-0 tw:font-body tw:text-[11px] tw:leading-normal tw:font-semibold tw:text-brand-secondary"
              color="tertiary"
              data-testid="ontology-concept-full-details"
              onClick={onShowFullDetails}>
              {t('label.view-detail-plural')}
            </Button>
          ) : null}
          {!isEditable && onRequestEdit ? (
            <Button
              noTextPadding
              className={classNames(
                'tw:inline-flex tw:items-center tw:gap-1 tw:rounded-md tw:border tw:border-secondary tw:bg-primary tw:px-2 tw:py-1',
                'tw:font-body tw:text-[11px] tw:leading-normal tw:font-semibold tw:text-secondary'
              )}
              color="tertiary"
              data-testid="ontology-concept-edit"
              iconLeading={Edit03}
              onClick={onRequestEdit}>
              {t('label.edit')}
            </Button>
          ) : null}
        </div>
      </div>
      <h2 className="tw:m-0 tw:font-body tw:text-[17px] tw:leading-[1.25] tw:font-bold tw:text-primary">
        {node.originalLabel ?? node.label}
      </h2>
      <p className="tw:mb-3 tw:mt-[3px] tw:truncate tw:font-mono tw:text-[11px] tw:leading-normal tw:font-normal tw:text-quaternary">
        {node.fullyQualifiedName}
      </p>

      {isValidUUID(termId) ? (
        <OntologyConceptAttributes
          showEditControls
          attributes={termDetails?.attributes ?? []}
          effectiveAttributes={termDetails?.effectiveAttributes}
          isEditMode={isEditable}
          termId={termId}
          variant="inspector"
          onTermUpdate={setTermDetails}
        />
      ) : null}

      {isValidUUID(termId) ? (
        <OntologyConceptRealization
          isEditMode={isEditable}
          realizations={termDetails?.realizedIn ?? []}
          termId={termId}
          variant="inspector"
          onTermUpdate={setTermDetails}
        />
      ) : null}

      <div className="tw:my-[15px] tw:h-px tw:bg-secondary" />
      <section data-testid="authoring-relationships">
        <SectionHeading
          count={relations.length}
          label={t('label.relationship-plural')}
        />
        <div className="tw:flex tw:flex-col tw:gap-1.5">
          {relations.map(renderRelationRow)}
        </div>
        {isAddingRelationship ? (
          renderRelationshipDraft()
        ) : (
          <AddButton
            isPrimary
            isDisabled={!isEditable}
            label={t('label.add-entity', {
              entity: t('label.relationship'),
            })}
            testId="authoring-add-relationship"
            onClick={() => setIsAddingRelationship(true)}
          />
        )}
      </section>

      <div className="tw:my-[15px] tw:h-px tw:bg-secondary" />
      <section data-testid="authoring-mappings">
        <SectionHeading
          count={conceptMappings.length}
          label={t('label.mapping-plural')}
        />
        <div className="tw:flex tw:flex-col tw:gap-1.5">
          {conceptMappings.map((mapping) => (
            <div
              className="tw:flex tw:items-center tw:gap-2 tw:rounded-lg tw:border tw:border-secondary tw:bg-secondary tw:px-2.5 tw:py-2"
              key={`${mapping.mappingType}-${mapping.conceptIri}`}>
              <Badge
                color={MAPPING_BADGE_COLORS[mapping.mappingType]}
                size="sm"
                type="color">
                {mapping.mappingType}
              </Badge>
              <span className="tw:min-w-0 tw:flex-1 tw:truncate tw:font-mono tw:text-[11px] tw:leading-normal tw:text-secondary">
                {mapping.conceptIri}
              </span>
            </div>
          ))}
        </div>
        {isAddingMapping ? (
          renderMappingDraft()
        ) : (
          <AddButton
            isDisabled={!isEditable || !isValidUUID(termId)}
            label={t('label.add-mapping')}
            testId="authoring-add-mapping"
            onClick={() => setIsAddingMapping(true)}
          />
        )}
      </section>

      <div className="tw:my-[15px] tw:h-px tw:bg-secondary" />
      <section data-testid="authoring-data-assets">
        <SectionHeading
          count={assetTotal}
          label={t('label.data-asset-plural')}
        />
        <div className="tw:flex tw:flex-col tw:gap-[7px]">
          {assets.map((asset) => {
            const assetName =
              asset.displayName ??
              asset.name ??
              asset.fullyQualifiedName ??
              asset.id;

            return (
              <div
                className="tw:flex tw:items-center tw:gap-2 tw:rounded-lg tw:border tw:border-secondary tw:bg-secondary tw:px-2.5 tw:py-2"
                data-testid={`authoring-asset-${asset.id}`}
                key={asset.id}>
                <img
                  alt={asset.type}
                  className="tw:size-3.5 tw:shrink-0 tw:object-contain"
                  height={14}
                  src={serviceUtilClassBase.getServiceTypeLogo({
                    entityType: asset.type,
                  })}
                  width={14}
                />
                <div className="tw:min-w-0 tw:flex-1">
                  <div className="tw:truncate tw:font-mono tw:text-xs tw:leading-normal tw:font-medium tw:text-primary">
                    {assetName}
                  </div>
                  <div className="tw:truncate tw:font-body tw:text-[10px] tw:leading-normal tw:font-normal tw:text-quaternary">
                    {asset.type}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        {assetTotal > assets.length ? (
          <Button
            noTextPadding
            className={classNames(
              'tw:mt-2 tw:w-full tw:rounded-lg tw:border tw:border-secondary tw:bg-primary tw:px-2.5 tw:py-2',
              'tw:font-body tw:text-[11px] tw:leading-normal tw:font-semibold tw:text-brand-tertiary'
            )}
            color="tertiary"
            data-testid="authoring-more-assets"
            onClick={onShowDataAssets}>
            +{assetTotal - assets.length} {t('label.more-lowercase')}{' '}
            {t('label.data-asset-lowercase-plural')}
          </Button>
        ) : null}
      </section>
    </aside>
  );
};

export default OntologyAuthoringInspector;
