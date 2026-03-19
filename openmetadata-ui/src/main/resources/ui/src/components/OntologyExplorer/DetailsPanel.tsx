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
  ButtonUtility,
  Divider,
  Tabs,
  Typography,
} from '@openmetadata/ui-core-components';
import { Copy01, Tag01, X } from '@untitledui/icons';
import React, { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { GlossaryTermRelationType } from '../../rest/settingConfigAPI';
import { getEntityName } from '../../utils/EntityUtils';
import { OwnerAvatar } from '../common/OwnerAvtar/OwnerAvatar';
import RichTextEditorPreviewerNew from '../common/RichTextEditor/RichTextEditorPreviewNew';
import { RELATION_META } from './OntologyExplorer.constants';
import { EnhancedDetailsPanelProps } from './OntologyExplorer.interface';

type DetailsTabId = 'summary' | 'relations';

const PANEL_WIDTH = 320;
const PANEL_MAX_HEIGHT = 560;
const PANEL_OFFSET = 16;

const DetailsPanel: React.FC<EnhancedDetailsPanelProps> = ({
  node,
  edges = [],
  nodes = [],
  relationTypes = [],
  position,
  onClose,
  onNodeClick: _onNodeClick,
}) => {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<DetailsTabId>('summary');

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

  const getRelationBadgeStyle = useCallback(
    (relationType: string): React.CSSProperties => {
      const meta = RELATION_META[relationType] ?? RELATION_META.default;

      return { background: meta.background, color: meta.color };
    },
    []
  );

  const getDisplayName = useCallback(
    (relationType: string) => {
      const relationMeta = relationTypeMap.get(relationType);

      return (
        relationMeta?.displayName ??
        relationLabelOverrides[relationType] ??
        relationType
      );
    },
    [relationTypeMap, relationLabelOverrides]
  );

  if (!node) {
    return null;
  }

  let panelLeft: number | undefined;
  if (position) {
    const wouldOverflow =
      position.x + PANEL_OFFSET + PANEL_WIDTH > window.innerWidth;
    panelLeft = wouldOverflow
      ? position.x - PANEL_OFFSET - PANEL_WIDTH
      : position.x + PANEL_OFFSET;
  } else {
    panelLeft = undefined;
  }

  const panelTop = position
    ? Math.min(
        Math.max(position.y - PANEL_MAX_HEIGHT / 2, 8),
        window.innerHeight - PANEL_MAX_HEIGHT - 8
      )
    : undefined;

  const panelStyle: React.CSSProperties = position
    ? { position: 'fixed', left: panelLeft, top: panelTop }
    : {};

  const totalRelations =
    nodeRelations.incoming.length + nodeRelations.outgoing.length;

  return (
    <div
      className={
        (position
          ? 'tw:w-80 tw:min-w-72 '
          : 'tw:absolute tw:top-3 tw:left-3.5 tw:w-80 tw:min-w-72 tw:max-w-[calc(100%-28px)] ') +
        'tw:max-h-[calc(100vh-16px)] tw:bg-white tw:rounded-xl tw:shadow-lg tw:box-border ' +
        'tw:z-1050 tw:flex tw:flex-col tw:min-h-0 tw:overflow-hidden'
      }
      data-testid="ontology-details-panel"
      style={panelStyle}>
      <div className="tw:shrink-0 tw:flex tw:flex-col tw:min-h-0 tw:w-full tw:min-w-0 tw:box-border">
        <div className="tw:flex tw:justify-between tw:items-center tw:gap-2 tw:w-full tw:min-w-0 tw:box-border tw:p-3">
          <div className="tw:flex tw:items-center tw:gap-2 tw:min-w-0 tw:flex-1 tw:overflow-hidden">
            <Tag01 className="tw:shrink-0 tw:w-5 tw:h-5 tw:text-gray-600" />
            <Typography
              as="span"
              className="tw:truncate tw:min-w-0 tw:text-sm tw:font-semibold tw:text-blue-dark-700"
              data-testid="details-panel-title"
              title={node.originalLabel ?? node.label}>
              {node.originalLabel ?? node.label}
            </Typography>
          </div>
          <ButtonUtility
            className="tw:shrink-0"
            color="tertiary"
            data-testid="details-panel-close-button"
            icon={X}
            size="xs"
            tooltip={t('label.close')}
            onClick={onClose}
          />
        </div>

        <Divider />

        <div className="tw:w-full tw:min-w-0 tw:overflow-hidden tw:box-border tw:py-4 tw:px-3.5">
          <Tabs
            className="tw:w-full tw:min-w-0 tw:flex-1 tw:flex tw:flex-col tw:overflow-hidden"
            selectedKey={activeTab}
            onSelectionChange={(key) => {
              if (key === 'summary' || key === 'relations') {
                setActiveTab(key);
              }
            }}>
            <Tabs.List
              fullWidth
              className="tw:w-full tw:min-w-0 tw:overflow-hidden [&_[role=tab]]:tw:min-w-0 [&_[role=tab]]:tw:truncate"
              items={[
                { id: 'summary', label: t('label.summary') },
                { id: 'relations', label: t('label.relation-plural') },
              ]}
              size="sm"
              type="button-minimal"
            />
            <Tabs.Panel
              className="tw:flex-1 tw:min-h-0 tw:pt-4 tw:min-w-0 tw:overflow-hidden"
              id="summary">
              <div className="tw:flex-1 tw:min-h-0 tw:overflow-y-auto tw:min-w-0">
                {node.fullyQualifiedName && (
                  <div className="tw:mb-4 last:tw:mb-0">
                    <Typography
                      as="div"
                      className="tw:mb-1 tw:text-xs tw:font-normal tw:text-gray-700">
                      {t('label.fully-qualified-name')}
                    </Typography>
                    <div className="tw:flex tw:items-center tw:gap-2 tw:min-w-0">
                      <Typography
                        as="span"
                        className="tw:flex-1 tw:min-w-0 tw:truncate tw:text-sm tw:font-semibold tw:text-gray-900"
                        title={node.fullyQualifiedName}>
                        {node.fullyQualifiedName}
                      </Typography>
                      <ButtonUtility
                        className="tw:shrink-0"
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
                  <div className="tw:mb-4 last:tw:mb-0">
                    <Typography
                      as="div"
                      className="tw:mb-1 tw:text-xs tw:font-normal tw:text-gray-700">
                      {t('label.description')}
                    </Typography>
                    <div className="tw:text-sm tw:leading-5 tw:max-h-35 tw:overflow-y-auto tw:text-gray-700">
                      <RichTextEditorPreviewerNew markdown={node.description} />
                    </div>
                  </div>
                )}

                {node.group && (
                  <div className="tw:mb-4 last:tw:mb-0">
                    <Typography
                      as="div"
                      className="tw:mb-1 tw:text-xs tw:font-normal tw:text-gray-700">
                      {t('label.glossary')}
                    </Typography>
                    <Badge
                      className="tw:border tw:border-(--color-gray-300)"
                      color="gray"
                      type="color">
                      {node.group}
                    </Badge>
                  </div>
                )}

                <div className="tw:mb-4 last:tw:mb-0">
                  <Typography
                    as="div"
                    className="tw:mb-1 tw:text-xs tw:font-normal tw:text-gray-700">
                    {t('label.owner-plural')}
                  </Typography>
                  <div className="tw:flex tw:flex-wrap tw:items-center tw:gap-2">
                    {((node.originalNode ?? node).owners ?? []).map((owner) => (
                      <span key={owner.id} title={getEntityName(owner)}>
                        <OwnerAvatar
                          isCompactView
                          avatarSize={24}
                          owner={owner}
                        />
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </Tabs.Panel>
            <Tabs.Panel
              className="tw:flex-1 tw:min-h-0 tw:overflow-y-auto tw:py-0 tw:min-w-0 tw:overflow-x-hidden"
              id="relations">
              <div className="tw:flex-1 tw:min-h-0 tw:overflow-y-auto tw:min-w-0">
                {totalRelations === 0 ? (
                  <Typography
                    as="div"
                    className="tw:text-center tw:py-8 tw:text-sm tw:text-gray-500">
                    {t('message.no-relations-found')}
                  </Typography>
                ) : (
                  <>
                    {nodeRelations.outgoing.length > 0 && (
                      <div className="tw:mb-5 tw:mt-3.5">
                        <div className="tw:flex tw:items-center tw:gap-2 tw:mb-2">
                          <Typography
                            as="span"
                            className="tw:text-xs tw:font-normal tw:text-gray-700"
                            data-testid="outgoing-relation-label">
                            {t('label.outgoing-relation-plural')}
                          </Typography>
                          <Typography
                            as="span"
                            className="tw:rounded tw:border tw:border-gray-blue-100 tw:bg-gray-blue-50 tw:px-2 tw:py-0.5 tw:text-xs tw:font-medium"
                            data-testid="outgoing-relation-count">
                            {String(nodeRelations.outgoing.length).padStart(
                              2,
                              '0'
                            )}
                          </Typography>
                        </div>
                        <div className="tw:min-w-0 tw:overflow-hidden tw:rounded-lg tw:border tw:border-gray-100 tw:bg-white tw:p-3.5 tw:px-4">
                          <ul className="tw:space-y-2 tw:list-none tw:m-0 tw:p-0 tw:min-w-0">
                            {nodeRelations.outgoing.map((rel) => (
                              <li
                                className="tw:flex tw:items-start tw:py-1 tw:min-w-0 tw:gap-6"
                                key={`${rel.from}-${rel.to}-${rel.relationType}`}>
                                <span
                                  className="tw:shrink-0 tw:min-w-[90px] tw:w-[90px] tw:rounded-md tw:border-0 tw:px-2 tw:py-1 tw:text-xs tw:font-bold tw:uppercase tw:text-center"
                                  style={getRelationBadgeStyle(
                                    rel.relationType
                                  )}>
                                  {getDisplayName(rel.relationType)}
                                </span>
                                <Typography
                                  as="span"
                                  className="tw:flex-1 tw:min-w-0 tw:truncate tw:text-sm tw:text-gray-900"
                                  title={`${
                                    rel.relatedNode?.originalLabel ??
                                    rel.relatedNode?.label ??
                                    rel.to
                                  }`}>
                                  {rel.relatedNode?.originalLabel ??
                                    rel.relatedNode?.label ??
                                    rel.to}
                                </Typography>
                              </li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    )}

                    {nodeRelations.incoming.length > 0 && (
                      <div className="tw:mt-3.5">
                        <div className="tw:flex tw:items-center tw:gap-2 tw:mb-2">
                          <Typography
                            as="span"
                            className="tw:text-xs tw:font-normal tw:text-gray-700"
                            data-testid="incoming-relation-label">
                            {t('label.incoming-relation-plural')}
                          </Typography>
                          <Typography
                            as="span"
                            className="tw:rounded tw:border tw:border-gray-blue-100 tw:bg-gray-blue-50 tw:px-2 tw:py-0.5 tw:text-xs tw:font-medium"
                            data-testid="incoming-relation-count">
                            {String(nodeRelations.incoming.length).padStart(
                              2,
                              '0'
                            )}
                          </Typography>
                        </div>
                        <div className="tw:min-w-0 tw:overflow-hidden tw:rounded-lg tw:border tw:border-gray-100 tw:bg-white tw:p-3.5 tw:px-4">
                          <ul className="tw:space-y-2 tw:list-none tw:m-0 tw:p-0 tw:min-w-0">
                            {nodeRelations.incoming.map((rel) => (
                              <li
                                className="tw:flex tw:items-start tw:py-1 tw:min-w-0 tw:gap-6"
                                key={`${rel.from}-${rel.to}-${rel.relationType}`}>
                                <span
                                  className="tw:shrink-0 tw:min-w-[90px] tw:w-[90px] tw:rounded-md tw:border-0 tw:px-2 tw:py-1 tw:text-xs tw:font-bold tw:uppercase tw:text-center"
                                  style={getRelationBadgeStyle(
                                    rel.relationType
                                  )}>
                                  {getDisplayName(rel.relationType)}
                                </span>
                                <Typography
                                  as="span"
                                  className="tw:flex-1 tw:min-w-0 tw:truncate tw:text-sm tw:text-gray-900"
                                  title={`${
                                    rel.relatedNode?.originalLabel ??
                                    rel.relatedNode?.label ??
                                    rel.from
                                  }`}>
                                  {rel.relatedNode?.originalLabel ??
                                    rel.relatedNode?.label ??
                                    rel.from}
                                </Typography>
                              </li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            </Tabs.Panel>
          </Tabs>
        </div>
      </div>
    </div>
  );
};

export default DetailsPanel;
