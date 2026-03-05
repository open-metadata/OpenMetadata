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

import { Button, ButtonUtility, Tabs } from '@openmetadata/ui-core-components';
import {
  ChevronRight,
  Copy01,
  LinkExternal01,
  Plus,
  Target01,
  X,
} from '@untitledui/icons';
import { startCase } from 'lodash';
import React, { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { EntityType } from '../../enums/entity.enum';
import { GlossaryTermRelationType } from '../../rest/settingConfigAPI';
import {
  getEntityDetailsPath,
  getGlossaryTermDetailsPath,
} from '../../utils/RouterUtils';
import RichTextEditorPreviewerNew from '../common/RichTextEditor/RichTextEditorPreviewNew';
import {
  DetailsPanelProps,
  OntologyEdge,
  OntologyNode,
} from './OntologyExplorer.interface';

interface EnhancedDetailsPanelProps extends DetailsPanelProps {
  edges?: OntologyEdge[];
  nodes?: OntologyNode[];
  relationTypes?: GlossaryTermRelationType[];
  onNodeClick?: (nodeId: string) => void;
  onFocusNode?: () => void;
}

type DetailsTabId = 'summary' | 'relations';

const DetailsPanel: React.FC<EnhancedDetailsPanelProps> = ({
  node,
  edges = [],
  nodes = [],
  relationTypes = [],
  onClose,
  onAddRelation,
  onNodeClick,
  onFocusNode,
}) => {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<DetailsTabId>('summary');

  const entityPath = useMemo(() => {
    if (!node?.fullyQualifiedName) {
      return '';
    }

    if (node.entityRef?.type && node.entityRef?.fullyQualifiedName) {
      return getEntityDetailsPath(
        node.entityRef.type as EntityType,
        node.entityRef.fullyQualifiedName
      );
    }

    if (node.type === 'metric') {
      return getEntityDetailsPath(EntityType.METRIC, node.fullyQualifiedName);
    }

    return getGlossaryTermDetailsPath(node.fullyQualifiedName);
  }, [node]);

  const handleNavigateToEntity = useCallback(() => {
    if (entityPath) {
      window.open(entityPath, '_blank');
    }
  }, [entityPath]);

  const nodeRelations = useMemo(() => {
    if (!node) {
      return { incoming: [], outgoing: [] };
    }
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
    const map = new Map<string, GlossaryTermRelationType>();
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

  const cardinalityLabels = useMemo(
    () => ({
      ONE_TO_ONE: t('label.one-to-one'),
      ONE_TO_MANY: t('label.one-to-many'),
      MANY_TO_ONE: t('label.many-to-one'),
      MANY_TO_MANY: t('label.many-to-many'),
      CUSTOM: t('label.custom'),
    }),
    [t]
  );

  const deriveCardinality = useCallback(
    (relationType?: GlossaryTermRelationType) => {
      if (!relationType) {
        return undefined;
      }
      const sourceMax = relationType.sourceMax;
      const targetMax = relationType.targetMax;
      if (sourceMax == null && targetMax == null) {
        return 'MANY_TO_MANY';
      }
      if (sourceMax === 1 && targetMax === 1) {
        return 'ONE_TO_ONE';
      }
      if (sourceMax === 1 && targetMax == null) {
        return 'ONE_TO_MANY';
      }
      if (sourceMax == null && targetMax === 1) {
        return 'MANY_TO_ONE';
      }

      return 'CUSTOM';
    },
    []
  );

  const formatCardinality = useCallback(
    (relationType?: GlossaryTermRelationType) => {
      if (!relationType) {
        return null;
      }
      const cardinality =
        relationType.cardinality ?? deriveCardinality(relationType);
      if (cardinality && cardinality !== 'CUSTOM') {
        return (
          cardinalityLabels[cardinality as keyof typeof cardinalityLabels] ??
          cardinality
        );
      }

      const source =
        relationType.sourceMax == null ? '*' : relationType.sourceMax;
      const target =
        relationType.targetMax == null ? '*' : relationType.targetMax;
      const customLabel = cardinalityLabels.CUSTOM;

      return `${customLabel} - ${t('label.source')}: ${source}, ${t(
        'label.target'
      )}: ${target}`;
    },
    [cardinalityLabels, deriveCardinality, t]
  );

  const handleRelatedNodeClick = useCallback(
    (nodeId: string) => {
      onNodeClick?.(nodeId);
    },
    [onNodeClick]
  );

  const getReadableType = useCallback(
    (type: string) => {
      if (node?.entityRef?.type) {
        return startCase(node.entityRef.type);
      }
      const typeMap: Record<string, string> = {
        glossary: t('label.glossary'),
        glossaryTerm: t('label.glossary-term'),
        glossaryTermIsolated: t('label.glossary-term'),
        metric: t('label.metric'),
        dataAsset: t('label.data-asset'),
      };

      return typeMap[type] ?? type;
    },
    [node?.entityRef?.type, t]
  );

  const breadcrumbParts = useMemo(() => {
    if (!node?.fullyQualifiedName) {
      return [];
    }

    return node.fullyQualifiedName.split('.');
  }, [node?.fullyQualifiedName]);

  const typeColor = useMemo(() => {
    if (node?.type === 'glossary') {
      return '#7c3aed';
    }
    if (node?.type === 'dataAsset') {
      return '#d97706';
    }

    return '#0891b2';
  }, [node?.type]);

  const totalRelations =
    nodeRelations.incoming.length + nodeRelations.outgoing.length;

  if (!node) {
    return null;
  }

  return (
    <div
      className="ontology-explorer-details enhanced"
      data-testid="ontology-details-panel">
      {/* Header */}
      <div className="details-header">
        <div className="details-title">
          <span
            className="title-text"
            data-testid="details-panel-title"
            title={node.originalLabel ?? node.label}>
            {node.originalLabel ?? node.label}
          </span>
        </div>
        <div className="details-header__actions">
          {onFocusNode && (
            <ButtonUtility
              color="tertiary"
              icon={Target01}
              size="xs"
              tooltip={t('label.focus-selected')}
              onClick={onFocusNode}
            />
          )}
          <ButtonUtility
            color="tertiary"
            data-testid="details-panel-close-button"
            icon={X}
            size="xs"
            tooltip={t('label.close')}
            onClick={onClose}
          />
        </div>
      </div>

      {/* Breadcrumb */}
      {breadcrumbParts.length > 1 && (
        <div className="details-breadcrumb">
          {breadcrumbParts.map((part, index) => (
            <span key={`${part}-${index}`}>
              {index > 0 && (
                <ChevronRight
                  size={10}
                  style={{ margin: '0 2px', opacity: 0.5 }}
                />
              )}
              <span
                style={{
                  color:
                    index === breadcrumbParts.length - 1
                      ? 'inherit'
                      : '#94a3b8',
                  fontWeight:
                    index === breadcrumbParts.length - 1 ? 600 : undefined,
                }}>
                {part}
              </span>
            </span>
          ))}
        </div>
      )}

      <div className="details-tabs">
        <Tabs
          selectedKey={activeTab}
          onSelectionChange={(key) =>
            key != null && setActiveTab(key as DetailsTabId)
          }>
          <Tabs.List
            items={[
              { id: 'summary', label: t('label.summary') },
              {
                id: 'relations',
                label: `${t('label.relation-plural')} (${totalRelations})`,
              },
            ]}
            size="sm"
            type="button-border"
          />
          <Tabs.Panel
            className="details-tab-content tw:flex-1 tw:min-h-0 tw:overflow-y-auto"
            id="summary">
            {node.fullyQualifiedName && (
              <div className="detail-section">
                <div className="section-label">
                  {t('label.fully-qualified-name')}
                </div>
                <div className="section-value">
                  <span
                    style={{
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      display: 'block',
                    }}
                    title={node.fullyQualifiedName}>
                    {node.fullyQualifiedName}
                  </span>
                  <ButtonUtility
                    color="tertiary"
                    icon={Copy01}
                    size="xs"
                    tooltip={t('label.copy')}
                    onClick={() =>
                      navigator.clipboard.writeText(
                        node.fullyQualifiedName ?? ''
                      )
                    }
                  />
                </div>
              </div>
            )}

            {node.description && (
              <div className="detail-section">
                <div className="section-label">{t('label.description')}</div>
                <div className="section-value description-preview">
                  <RichTextEditorPreviewerNew markdown={node.description} />
                </div>
              </div>
            )}

            {node.group && (
              <div className="detail-section">
                <div className="section-label">{t('label.glossary')}</div>
                <div className="section-value">
                  <span className="details-tag details-tag--blue">
                    {node.group}
                  </span>
                </div>
              </div>
            )}

            <div className="detail-section">
              <div className="section-label">{t('label.type')}</div>
              <div className="section-value">
                <span
                  className="details-tag"
                  style={{
                    backgroundColor: `${typeColor}15`,
                    color: typeColor,
                  }}>
                  {getReadableType(node.type)}
                </span>
              </div>
            </div>
          </Tabs.Panel>
          <Tabs.Panel
            className="details-tab-content tw:flex-1 tw:min-h-0 tw:overflow-y-auto"
            id="relations">
            {nodeRelations.outgoing.length > 0 && (
              <div className="relations-section">
                <div className="relations-section__title">
                  {t('label.outgoing-relation-plural')} (
                  {nodeRelations.outgoing.length})
                </div>
                {nodeRelations.outgoing.map((rel) => {
                  const relationMeta = relationTypeMap.get(rel.relationType);
                  const displayName =
                    relationMeta?.displayName ??
                    relationLabelOverrides[rel.relationType] ??
                    rel.relationType;
                  const predicate = relationMeta?.rdfPredicate;
                  const cardinality = formatCardinality(relationMeta);

                  return (
                    <button
                      className="relation-item"
                      key={`${rel.from}-${rel.to}-${rel.relationType}`}
                      type="button"
                      onClick={() =>
                        rel.relatedNode &&
                        handleRelatedNodeClick(rel.relatedNode.id)
                      }>
                      <div className="relation-item__row">
                        <span
                          className="relation-item__tag"
                          style={
                            relationMeta?.color
                              ? {
                                  backgroundColor: relationMeta.color,
                                  borderColor: relationMeta.color,
                                  color: '#fff',
                                }
                              : undefined
                          }>
                          {displayName}
                        </span>
                        <span className="relation-item__name">
                          {rel.relatedNode?.originalLabel ??
                            rel.relatedNode?.label ??
                            rel.to}
                        </span>
                      </div>
                      {(predicate || cardinality) && (
                        <div className="relation-item__meta">
                          {predicate}
                          {predicate && cardinality ? ' • ' : ''}
                          {cardinality}
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            )}

            {nodeRelations.incoming.length > 0 && (
              <div className="relations-section">
                <div className="relations-section__title">
                  {t('label.incoming-relation-plural')} (
                  {nodeRelations.incoming.length})
                </div>
                {nodeRelations.incoming.map((rel) => {
                  const relationMeta = relationTypeMap.get(rel.relationType);
                  const displayName =
                    relationMeta?.displayName ??
                    relationLabelOverrides[rel.relationType] ??
                    rel.relationType;
                  const predicate = relationMeta?.rdfPredicate;
                  const cardinality = formatCardinality(relationMeta);

                  return (
                    <button
                      className="relation-item"
                      key={`${rel.from}-${rel.to}-${rel.relationType}`}
                      type="button"
                      onClick={() =>
                        rel.relatedNode &&
                        handleRelatedNodeClick(rel.relatedNode.id)
                      }>
                      <div className="relation-item__row">
                        <span
                          className="relation-item__tag"
                          style={
                            relationMeta?.color
                              ? {
                                  backgroundColor: relationMeta.color,
                                  borderColor: relationMeta.color,
                                  color: '#fff',
                                }
                              : undefined
                          }>
                          {displayName}
                        </span>
                        <span className="relation-item__name">
                          {rel.relatedNode?.originalLabel ??
                            rel.relatedNode?.label ??
                            rel.from}
                        </span>
                      </div>
                      {(predicate || cardinality) && (
                        <div className="relation-item__meta">
                          {predicate}
                          {predicate && cardinality ? ' • ' : ''}
                          {cardinality}
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            )}

            {totalRelations === 0 && (
              <div className="details-empty">
                {t('message.no-relations-found')}
              </div>
            )}
          </Tabs.Panel>
        </Tabs>
      </div>

      {/* Footer actions */}
      <div className="details-actions">
        {entityPath && (
          <Button
            color="secondary"
            data-testid="details-panel-view-button"
            iconLeading={LinkExternal01}
            size="sm"
            onClick={handleNavigateToEntity}>
            {t('label.view')}
          </Button>
        )}
        {onAddRelation && (
          <Button
            color="primary"
            data-testid="details-panel-add-relation-button"
            iconLeading={Plus}
            size="sm"
            onClick={() => onAddRelation(node)}>
            {t('label.add-entity', { entity: t('label.relation') })}
          </Button>
        )}
      </div>
    </div>
  );
};

export default DetailsPanel;
