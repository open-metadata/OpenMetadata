/*
 *  Copyright 2024 Collate.
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
  Button,
  Card,
  Divider,
  Input,
  Select,
  Tooltip,
  TooltipTrigger,
  Typography,
} from '@openmetadata/ui-core-components';
import { AxiosError } from 'axios';
import { Operation } from 'fast-json-patch';
import React, { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ConceptMapping,
  ConceptMappingType,
} from '../../generated/entity/data/glossaryTerm';
import { RelationshipType } from '../../generated/entity/data/relationshipType';
import { patchGlossaryTerm } from '../../rest/glossaryAPI';
import { showErrorToast, showSuccessToast } from '../../utils/ToastUtils';
import { useOntologyTermDetails } from './hooks/useOntologyTermDetails';
import { OntologyConceptAttributes } from './OntologyConceptAttributes.component';
import { COLOR_META_BY_HEX, RELATION_META } from './OntologyExplorer.constants';
import { OntologyEdge, OntologyNode } from './OntologyExplorer.interface';
import { isValidUUID } from './utils/graphBuilders';
import { getEffectiveRelationColor } from './utils/graphStyles';
import { isHierarchicalRelationship } from './utils/relationshipTypeUtils';

export interface OntologyNodeRelationsContentProps {
  readonly node: OntologyNode;
  readonly edges: OntologyEdge[];
  readonly nodes: OntologyNode[];
  readonly relationTypes: RelationshipType[];
  readonly isEditMode?: boolean;
}

type RelationRow = OntologyEdge & {
  relatedNode?: OntologyNode;
};

export const OntologyNodeRelationsContent: React.FC<
  OntologyNodeRelationsContentProps
> = ({ node, edges, nodes, relationTypes, isEditMode = false }) => {
  const { t } = useTranslation();
  const [mappingType, setMappingType] = useState<ConceptMappingType>(
    ConceptMappingType.ExactMatch
  );
  const [mappingIri, setMappingIri] = useState('');
  const [isAddingMapping, setIsAddingMapping] = useState(false);
  const [isSavingMapping, setIsSavingMapping] = useState(false);
  const termId = node.termId ?? node.id;
  const { setTermDetails, termDetails } = useOntologyTermDetails(termId);

  const nodeRelations = useMemo(() => {
    const incoming = edges
      .filter((e) => e.to === node.id)
      .map((e) => ({
        ...e,
        relatedNode: nodes.find((n) => n.id === e.from),
      }));
    const outgoing = edges
      .filter((e) => e.from === node.id)
      .map((e) => ({
        ...e,
        relatedNode: nodes.find((n) => n.id === e.to),
      }));

    return { incoming, outgoing };
  }, [node, edges, nodes]);

  const relationTypeMap = useMemo(() => {
    const map = new Map<string, RelationshipType>();
    relationTypes.forEach((relationType) => {
      map.set(relationType.name, relationType);
    });

    return map;
  }, [relationTypes]);

  const relationLabelOverrides = useMemo<Record<string, string>>(
    () => ({
      metricFor: `${t('label.metric')} ${t('label.for-lowercase')}`,
      hasGlossaryTerm: t('label.tagged-with'),
    }),
    [t]
  );

  const getDisplayName = useCallback(
    (relationType: string) => {
      const relationMeta = relationTypeMap.get(relationType);
      const builtInLabelKey = RELATION_META[relationType]?.labelKey;

      return (
        (relationMeta?.displayName ||
          relationMeta?.name ||
          relationLabelOverrides[relationType]) ??
        (builtInLabelKey ? t(builtInLabelKey) : relationType)
      );
    },
    [relationTypeMap, relationLabelOverrides, t]
  );

  const totalRelations =
    nodeRelations.incoming.length + nodeRelations.outgoing.length;

  const parentCount = useMemo(() => {
    const parentIds = new Set<string>();
    const hierarchicalRelationNames = new Set(
      relationTypes
        .filter(isHierarchicalRelationship)
        .map((relationType) =>
          relationType.name.toLowerCase().replace(/[^a-z0-9]/g, '')
        )
    );
    edges.forEach((edge) => {
      const relationType = edge.relationType
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '');
      if (
        edge.to === node.id &&
        (relationType === 'parentof' || relationType === 'narrower')
      ) {
        parentIds.add(edge.from);
      } else if (
        edge.from === node.id &&
        (relationType === 'broader' ||
          relationType === 'isa' ||
          relationType === 'subclassof' ||
          hierarchicalRelationNames.has(relationType))
      ) {
        parentIds.add(edge.to);
      }
    });

    return parentIds.size;
  }, [edges, node.id, relationTypes]);

  const mappingLabelKeys: Record<ConceptMappingType, string> = {
    [ConceptMappingType.ExactMatch]: 'label.exact-match',
    [ConceptMappingType.CloseMatch]: 'label.close-match',
    [ConceptMappingType.BroadMatch]: 'label.broad-match',
    [ConceptMappingType.NarrowMatch]: 'label.narrow-match',
    [ConceptMappingType.RelatedMatch]: 'label.related-match',
    [ConceptMappingType.SameAs]: 'label.same-as',
  };
  const mappingBadgeColors: Record<
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
  const conceptMappings = termDetails?.conceptMappings ?? [];

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
  }, [conceptMappings, mappingIri, mappingType, t, termId]);

  const relatedDisplayName = useCallback(
    (rel: RelationRow) => {
      return (
        rel.relatedNode?.originalLabel ??
        rel.relatedNode?.label ??
        t('label.term-not-available')
      );
    },
    [t]
  );

  const renderSection = (
    sectionTitle: string,
    count: number,
    rows: RelationRow[],
    labelTestId: string,
    countTestId: string
  ) => {
    if (rows.length === 0) {
      return null;
    }

    return (
      <div className="tw:mb-5 tw:mt-1 tw:last:mb-0">
        <div className="tw:mb-2 tw:flex tw:items-center tw:gap-2">
          <Typography
            as="span"
            className="tw:text-primary"
            data-testid={labelTestId}
            size="text-sm"
            weight="semibold">
            {sectionTitle}
          </Typography>
          <Badge color="gray" data-testid={countTestId} type="color">
            {String(count).padStart(2, '0')}
          </Badge>
        </div>
        <Card className="tw:overflow-hidden tw:rounded-lg tw:border tw:border-utility-gray-blue-100 tw:p-4">
          <ul className="tw:m-0 tw:list-none tw:p-0">
            {rows.map((rel, rowIndex) => {
              const labelText = relatedDisplayName(rel);
              const hasRowBelow = rowIndex < rows.length - 1;

              const customRelation = relationTypeMap.get(rel.relationType);
              const effectiveColor = getEffectiveRelationColor(
                rel.relationType,
                customRelation
              );
              const meta = effectiveColor
                ? COLOR_META_BY_HEX[effectiveColor.toLowerCase()] ?? {
                    background: 'var(--color-bg-secondary)',
                    color: effectiveColor,
                  }
                : undefined;

              return (
                <li
                  className="tw:flex tw:flex-col tw:gap-2 tw:py-1"
                  key={`${rel.from}-${rel.to}-${rel.relationType}`}
                  style={
                    meta
                      ? ({
                          '--rel-bg': meta.background,
                          '--rel-color': meta.color,
                        } as React.CSSProperties)
                      : undefined
                  }>
                  <div className="tw:grid tw:w-full tw:grid-cols-2 tw:items-center tw:gap-3">
                    <Badge
                      className={
                        meta
                          ? 'tw:bg-[var(--rel-bg)] tw:text-[var(--rel-color)] tw:ring-0'
                          : 'tw:ring-0'
                      }
                      size="sm"
                      type="color">
                      {getDisplayName(rel.relationType)}
                    </Badge>
                    <div className="tw:min-w-0">
                      <Tooltip arrow placement="top" title={labelText}>
                        <TooltipTrigger className="tw:block tw:w-full">
                          <Typography
                            as="p"
                            className="tw:block tw:truncate tw:text-left tw:text-primary"
                            size="text-sm"
                            weight="regular">
                            {labelText}
                          </Typography>
                        </TooltipTrigger>
                      </Tooltip>
                    </div>
                  </div>
                  {hasRowBelow ? <Divider orientation="horizontal" /> : null}
                </li>
              );
            })}
          </ul>
        </Card>
      </div>
    );
  };

  return (
    <div className="tw:flex tw:flex-col tw:gap-4">
      {parentCount > 1 ? (
        <Card
          className="tw:flex tw:items-center tw:justify-between tw:rounded-xl tw:border tw:border-utility-purple-200 tw:bg-utility-purple-50 tw:p-3 tw:ring-0 tw:shadow-sm"
          data-testid="ontology-polyhierarchy">
          <div>
            <Typography as="p" size="text-sm" weight="semibold">
              {t('label.polyhierarchy')}
            </Typography>
            <Typography as="p" className="tw:text-tertiary" size="text-xs">
              {t('message.polyhierarchy-parent-count', { count: parentCount })}
            </Typography>
          </div>
          <Badge color="purple" size="sm" type="color">
            {parentCount}
          </Badge>
        </Card>
      ) : null}

      {isValidUUID(termId) ? (
        <OntologyConceptAttributes
          attributes={termDetails?.attributes ?? []}
          isEditMode={isEditMode}
          termId={termId}
          onTermUpdate={setTermDetails}
        />
      ) : null}

      {totalRelations === 0 ? (
        <Typography
          as="div"
          className="tw:py-8 tw:text-center"
          size="text-sm"
          weight="regular">
          {t('message.no-relations-found')}
        </Typography>
      ) : (
        <>
          {renderSection(
            t('label.outgoing-relation-plural'),
            nodeRelations.outgoing.length,
            nodeRelations.outgoing,
            'outgoing-relation-label',
            'outgoing-relation-count'
          )}
          {renderSection(
            t('label.incoming-relation-plural'),
            nodeRelations.incoming.length,
            nodeRelations.incoming,
            'incoming-relation-label',
            'incoming-relation-count'
          )}
        </>
      )}

      <div
        className="tw:flex tw:flex-col tw:gap-2"
        data-testid="ontology-mappings">
        <div className="tw:flex tw:items-center tw:gap-2">
          <Typography as="h3" size="text-sm" weight="semibold">
            {t('label.mapping-plural')}
          </Typography>
          <Badge color="gray" size="sm" type="color">
            {conceptMappings.length}
          </Badge>
        </div>
        {conceptMappings.map((mapping) => (
          <Card
            className="tw:flex tw:items-center tw:gap-2 tw:rounded-lg tw:border tw:border-utility-gray-blue-100 tw:p-3 tw:ring-0 tw:shadow-sm"
            key={`${mapping.mappingType}-${mapping.conceptIri}`}>
            <Badge
              color={mappingBadgeColors[mapping.mappingType]}
              size="sm"
              type="color">
              {t(mappingLabelKeys[mapping.mappingType])}
            </Badge>
            <Typography
              as="span"
              className="tw:min-w-0 tw:truncate tw:font-mono tw:text-secondary"
              size="text-xs">
              {mapping.conceptIri}
            </Typography>
          </Card>
        ))}
        {isEditMode && isValidUUID(termId) ? (
          isAddingMapping ? (
            <Card className="tw:flex tw:flex-col tw:gap-3 tw:rounded-xl tw:border tw:border-dashed tw:border-utility-gray-blue-200 tw:p-3 tw:ring-0 tw:shadow-sm">
              <Select
                aria-label={t('label.mapping-type')}
                items={Object.values(ConceptMappingType).map((type) => ({
                  id: type,
                  label: t(mappingLabelKeys[type]),
                }))}
                size="sm"
                value={mappingType}
                onChange={(key) =>
                  setMappingType(String(key) as ConceptMappingType)
                }>
                {(item) => (
                  <Select.Item id={item.id} key={item.id} label={item.label} />
                )}
              </Select>
              <Input
                data-testid="concept-mapping-iri"
                placeholder={t('label.concept-iri')}
                value={mappingIri}
                onChange={setMappingIri}
              />
              <div className="tw:flex tw:justify-end tw:gap-2">
                <Button
                  color="tertiary"
                  size="sm"
                  onClick={() => {
                    setMappingIri('');
                    setIsAddingMapping(false);
                  }}>
                  {t('label.cancel')}
                </Button>
                <Button
                  color="primary"
                  data-testid="save-concept-mapping"
                  isDisabled={isSavingMapping || !mappingIri.trim()}
                  size="sm"
                  onClick={handleAddMapping}>
                  {t('label.add-mapping')}
                </Button>
              </div>
            </Card>
          ) : (
            <Button
              className="tw:w-full!"
              color="secondary"
              data-testid="add-concept-mapping"
              size="sm"
              onClick={() => setIsAddingMapping(true)}>
              {t('label.add-mapping')}
            </Button>
          )
        ) : null}
      </div>
    </div>
  );
};
