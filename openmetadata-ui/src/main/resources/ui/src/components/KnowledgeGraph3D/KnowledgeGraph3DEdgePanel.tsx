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
import { FC, ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import {
  LINK_ONTOLOGY_COLOR,
  LINK_TECHNICAL_COLOR,
} from './KnowledgeGraph3D.constants';
import { KnowledgeGraph3DEdgePanelProps } from './KnowledgeGraph3D.interface';
import { TYPE_LABEL_KEY } from './KnowledgeGraph3DPanel';
import { colorFor } from './nodeCanvas';
import { RELATION_LABEL_KEYS } from './rdfGraphAdapter';
import { GraphNode3D } from './types';

const EndpointRow: FC<{
  node: GraphNode3D;
  sublabel: ReactNode;
  onSelect: (node: GraphNode3D) => void;
}> = ({ node, sublabel, onSelect }) => (
  <button
    className="tw:flex tw:w-full tw:items-center tw:gap-2.5 tw:border-b tw:border-white/[0.08] tw:py-2 tw:text-left tw:transition hover:tw:opacity-80"
    type="button"
    onClick={() => onSelect(node)}>
    <span
      className="tw:size-2 tw:flex-none tw:rounded-full"
      style={{ background: colorFor(node.type) }}
    />
    <span className="tw:min-w-0">
      <span className="tw:block tw:truncate tw:text-sm tw:font-semibold tw:text-primary">
        {node.name}
      </span>
      <span className="tw:text-xs tw:text-tertiary">{sublabel}</span>
    </span>
  </button>
);

const KnowledgeGraph3DEdgePanel: FC<KnowledgeGraph3DEdgePanelProps> = ({
  link,
  source,
  target,
  onClose,
  onSelectNode,
}) => {
  const { t } = useTranslation();
  const isOntology = link.kind === 'ontology';
  const accent = isOntology ? LINK_ONTOLOGY_COLOR : LINK_TECHNICAL_COLOR;
  const relationLabel = RELATION_LABEL_KEYS[link.label]
    ? t(RELATION_LABEL_KEYS[link.label])
    : link.label;

  return (
    <div className="dark-mode kg3d-panel tw:absolute tw:top-3.5 tw:right-3.5 tw:bottom-3.5 tw:flex tw:w-80 tw:flex-col tw:overflow-hidden tw:rounded-2xl tw:border tw:border-white/10 tw:shadow-2xl">
      <div className="tw:flex tw:items-start tw:gap-3 tw:border-b tw:border-white/[0.08] tw:p-4">
        <span
          className="tw:mt-1 tw:size-3 tw:flex-none tw:rounded-full"
          style={{ background: accent, boxShadow: `0 0 12px ${accent}` }}
        />
        <div className="tw:min-w-0 tw:flex-1">
          <div className="tw:text-base tw:font-bold tw:text-primary">
            {t('label.relationship')}
          </div>
          <div className="tw:mt-1.5">
            <Badge
              color={isOntology ? 'warning' : 'blue'}
              size="sm"
              type="pill-color">
              {isOntology ? t('label.ontology') : t('label.knowledge-graph')}
            </Badge>
          </div>
        </div>
        <CloseButton size="sm" onClick={onClose} />
      </div>

      <div className="tw:flex-1 tw:overflow-y-auto tw:px-4 tw:pt-1 tw:pb-4">
        <div className="tw:mt-4 tw:mb-1 tw:flex tw:items-center tw:gap-2">
          <span
            className="tw:size-2 tw:rounded-sm"
            style={{ background: accent }}
          />
          <span className="tw:text-xs tw:font-semibold tw:tracking-wide tw:text-quaternary tw:uppercase">
            {relationLabel}
          </span>
        </div>
        <EndpointRow
          node={source}
          sublabel={t(TYPE_LABEL_KEY[source.type])}
          onSelect={onSelectNode}
        />
        <EndpointRow
          node={target}
          sublabel={t(TYPE_LABEL_KEY[target.type])}
          onSelect={onSelectNode}
        />
      </div>
    </div>
  );
};

export default KnowledgeGraph3DEdgePanel;
