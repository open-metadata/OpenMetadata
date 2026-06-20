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

import { Badge, CloseButton } from '@openmetadata/ui-core-components';
import { FC, ReactNode, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  COVERAGE_GAP_COLOR,
  LINK_ONTOLOGY_COLOR,
  LINK_TECHNICAL_COLOR,
  ONTOLOGY_PARTICLE_COLOR,
} from './KnowledgeGraph3D.constants';
import { KnowledgeGraph3DPanelProps } from './KnowledgeGraph3D.interface';
import { colorFor } from './nodeCanvas';
import { relationsOf, RELATION_LABEL_KEYS } from './rdfGraphAdapter';
import { NodeType, RelationRow, SharedConceptRow } from './types';

const MEMBER_ACCENT = '#26C281';
const MAPPED_ACCENT = '#17B26A';

export const TYPE_LABEL_KEY: Record<NodeType, string> = {
  domain: 'label.domain',
  product: 'label.data-product',
  table: 'label.data-asset',
  column: 'label.column',
  database: 'label.database',
  schema: 'label.schema',
  service: 'label.service',
  dashboard: 'label.dashboard',
  pipeline: 'label.pipeline',
  user: 'label.user',
  team: 'label.team',
  concept: 'label.business-concept',
  tag: 'label.tag',
  query: 'label.query',
  topic: 'label.topic',
  container: 'label.container',
  mlmodel: 'label.ml-model',
  searchIndex: 'label.search-index',
  storedProcedure: 'label.stored-procedure',
  testCase: 'label.test-case',
  testSuite: 'label.test-suite',
  dataContract: 'label.data-contract',
  api: 'label.api-endpoint',
  metric: 'label.metric',
  chart: 'label.chart',
  file: 'label.file',
  directory: 'label.directory',
};

interface SectionProps {
  accent: string;
  title: string;
  count: number;
  children: ReactNode;
}

const Section: FC<SectionProps> = ({ accent, title, count, children }) => (
  <div className="tw:mt-4">
    <div className="tw:mb-1 tw:flex tw:items-center tw:gap-2">
      <span
        className="tw:size-2 tw:rounded-sm"
        style={{ background: accent }}
      />
      <span className="tw:text-xs tw:font-semibold tw:tracking-wide tw:text-quaternary tw:uppercase">
        {title}
      </span>
      <span className="tw:text-xs tw:text-quaternary">{count}</span>
    </div>
    {children}
  </div>
);

const RelationRowItem: FC<{ row: RelationRow }> = ({ row }) => {
  const { t } = useTranslation();
  const labelKey = RELATION_LABEL_KEYS[row.label];

  return (
    <div className="tw:flex tw:items-center tw:gap-2.5 tw:border-b tw:border-white/[0.08] tw:py-2">
      <span
        className="tw:size-2 tw:flex-none tw:rounded-full"
        style={{ background: colorFor(row.other.type) }}
      />
      <div className="tw:min-w-0">
        <div className="tw:truncate tw:text-sm tw:font-semibold tw:text-primary">
          {row.other.name}
        </div>
        <div className="tw:text-xs tw:text-tertiary">
          {row.direction === 'in' ? '← ' : ''}
          {labelKey ? t(labelKey) : row.label}
          {row.direction === 'out' ? ' →' : ''}
        </div>
      </div>
    </div>
  );
};

const SharedRowItem: FC<{ row: SharedConceptRow }> = ({ row }) => (
  <div className="tw:flex tw:items-start tw:gap-2.5 tw:border-b tw:border-white/[0.06] tw:py-1.5">
    <span
      className="tw:mt-1 tw:size-1.5 tw:flex-none tw:rounded-full"
      style={{ background: colorFor('table') }}
    />
    <div>
      <div className="tw:text-sm tw:font-medium tw:text-secondary">
        {row.asset.name}
      </div>
      <div className="tw:text-xs tw:text-tertiary">
        {row.via ? `${row.via} · ` : ''}
        <span style={{ color: ONTOLOGY_PARTICLE_COLOR }}>{row.path}</span>
      </div>
    </div>
  </div>
);

const KnowledgeGraph3DPanel: FC<KnowledgeGraph3DPanelProps> = ({
  graph,
  node,
  onClose,
}) => {
  const { t } = useTranslation();
  const relations = useMemo(
    () => relationsOf(graph, node.id),
    [graph, node.id]
  );
  const dotColor = colorFor(node.type);

  const hierarchyTitle =
    node.type === 'concept'
      ? t('label.concept-hierarchy')
      : t('label.ontology-relation-plural');
  const membersTitle =
    node.type === 'table' ? t('label.belongs-to') : t('label.member-plural');

  const hasBody =
    relations.mapped.length > 0 ||
    relations.shared.length > 0 ||
    relations.hierarchy.length > 0 ||
    relations.technical.length > 0 ||
    relations.members.length > 0;

  return (
    <div className="dark-mode kg3d-panel tw:absolute tw:top-3.5 tw:right-3.5 tw:bottom-3.5 tw:flex tw:w-80 tw:flex-col tw:overflow-hidden tw:rounded-2xl tw:border tw:border-white/10 tw:shadow-2xl">
      <div className="tw:border-b tw:border-white/[0.08] tw:p-4">
        <div className="tw:flex tw:items-start tw:gap-3">
          <span
            className="tw:mt-1 tw:size-3 tw:flex-none tw:rounded-full"
            style={{ background: dotColor, boxShadow: `0 0 12px ${dotColor}` }}
          />
          <div className="tw:min-w-0 tw:flex-1">
            <div className="tw:text-base tw:font-bold tw:break-words tw:text-primary">
              {node.name}
            </div>
            <div className="tw:mt-1.5">
              <Badge color="gray" size="sm" type="pill-color">
                {t(TYPE_LABEL_KEY[node.type])}
              </Badge>
            </div>
          </div>
          <CloseButton size="sm" onClick={onClose} />
        </div>

        {node.type === 'table' && (
          <div
            className="tw:mt-3.5 tw:flex tw:items-center tw:gap-2 tw:rounded-lg tw:border tw:px-3 tw:py-2.5 tw:text-xs"
            style={{
              color: node.mapped ? '#75E0A7' : '#FDA29B',
              background: node.mapped
                ? 'rgba(23,178,106,0.12)'
                : 'rgba(240,68,56,0.12)',
              borderColor: node.mapped
                ? 'rgba(23,178,106,0.25)'
                : 'rgba(240,68,56,0.3)',
            }}>
            <span
              className="tw:size-1.5 tw:rounded-full"
              style={{
                background: node.mapped ? MAPPED_ACCENT : COVERAGE_GAP_COLOR,
              }}
            />
            {node.mapped
              ? t('message.mapped-to-business-ontology')
              : t('message.coverage-gap-no-ontology')}
          </div>
        )}
      </div>

      <div className="tw:flex-1 tw:overflow-y-auto tw:px-4 tw:pt-1 tw:pb-4.5">
        {relations.mapped.length > 0 && (
          <Section
            accent={LINK_ONTOLOGY_COLOR}
            count={relations.mapped.length}
            title={t('label.mapped-business-concept-plural')}>
            {relations.mapped.map((row) => (
              <RelationRowItem key={`${row.label}-${row.other.id}`} row={row} />
            ))}
          </Section>
        )}

        {relations.shared.length > 0 && (
          <Section
            accent={ONTOLOGY_PARTICLE_COLOR}
            count={relations.shared.length}
            title={t('label.related-through-shared-concept-plural')}>
            {relations.shared.map((row) => (
              <SharedRowItem key={row.asset.id} row={row} />
            ))}
          </Section>
        )}

        {relations.hierarchy.length > 0 && (
          <Section
            accent={LINK_ONTOLOGY_COLOR}
            count={relations.hierarchy.length}
            title={hierarchyTitle}>
            {relations.hierarchy.map((row) => (
              <RelationRowItem key={`${row.label}-${row.other.id}`} row={row} />
            ))}
          </Section>
        )}

        {relations.technical.length > 0 && (
          <Section
            accent={LINK_TECHNICAL_COLOR}
            count={relations.technical.length}
            title={t('label.knowledge-graph-relation-plural')}>
            {relations.technical.map((row) => (
              <RelationRowItem key={`${row.label}-${row.other.id}`} row={row} />
            ))}
          </Section>
        )}

        {relations.members.length > 0 && (
          <Section
            accent={MEMBER_ACCENT}
            count={relations.members.length}
            title={membersTitle}>
            {relations.members.map((row) => (
              <RelationRowItem key={`${row.label}-${row.other.id}`} row={row} />
            ))}
          </Section>
        )}

        {!hasBody && (
          <div className="tw:py-6 tw:text-sm tw:text-tertiary">
            {t('message.no-relation-at-level')}
          </div>
        )}
      </div>
    </div>
  );
};

export default KnowledgeGraph3DPanel;
