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

import { Box, Button, Typography } from '@openmetadata/ui-core-components';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { OntologyPackSample } from '../../generated/api/data/ontologyPackSample';
import { getOntologyPackSample } from '../../rest/ontologyAPI';
import { layoutOntologyPackSample } from './OntologyPackSampleGraph.utils';

interface OntologyPackSampleGraphProps {
  packId: string;
  selectedModuleIds: string[];
}

const OntologyPackSampleGraph = ({
  packId,
  selectedModuleIds,
}: OntologyPackSampleGraphProps) => {
  const { t } = useTranslation();
  const [sample, setSample] = useState<OntologyPackSample>();
  const [state, setState] = useState<'loading' | 'error' | 'ready'>('loading');
  const [retry, setRetry] = useState(0);
  const selection = selectedModuleIds.join(',');

  useEffect(() => {
    if (!selection) {
      setSample(undefined);
      setState('ready');

      return;
    }
    let stale = false;
    setState('loading');
    void getOntologyPackSample(packId, selection.split(','))
      .then((result) => {
        if (!stale) {
          setSample(result);
          setState('ready');
        }
      })
      .catch(() => {
        if (!stale) {
          setState('error');
        }
      });

    return () => {
      stale = true;
    };
  }, [packId, retry, selection]);

  if (!selection) {
    return (
      <Typography color="secondary" size="text-sm">
        {t('message.ontology-pack-select-modules')}
      </Typography>
    );
  }
  if (state === 'loading') {
    return (
      <Typography color="secondary" size="text-sm">
        {t('label.loading')}
      </Typography>
    );
  }
  if (state === 'error' || !sample) {
    return (
      <Box align="center" gap={2}>
        <Typography color="secondary" size="text-sm">
          {t('message.ontology-pack-sample-error')}
        </Typography>
        <Button color="secondary" size="sm" onPress={() => setRetry(retry + 1)}>
          {t('label.retry')}
        </Button>
      </Box>
    );
  }

  const layout = layoutOntologyPackSample(sample);

  return (
    <Box direction="col" gap={2}>
      <svg
        aria-label={t('message.ontology-pack-sample-graph', {
          concepts: sample.conceptCount,
          relations: sample.relationCount,
        })}
        className="tw:w-full tw:h-auto tw:text-fg-brand-primary"
        data-testid="ontology-pack-sample"
        preserveAspectRatio="xMidYMin meet"
        role="img"
        viewBox={`0 0 ${layout.width} ${layout.height}`}>
        <defs>
          <marker
            id="ontology-pack-sample-arrow"
            markerHeight="6"
            markerWidth="6"
            orient="auto-start-reverse"
            refX="5"
            refY="3">
            <path d="M 0 0 L 6 3 L 0 6 Z" fill="currentColor" />
          </marker>
        </defs>
        {layout.edges.map((edge, index) => (
          <path
            d={edge.path}
            data-testid={`ontology-pack-sample-edge-${index}`}
            fill="none"
            key={`${edge.sourceIri}-${edge.propertyIri}-${edge.targetIri}`}
            markerEnd="url(#ontology-pack-sample-arrow)"
            stroke="currentColor"
            strokeWidth="2">
            <title>{edge.label}</title>
          </path>
        ))}
        {layout.nodes.map((node, index) => (
          <g
            data-testid={`ontology-pack-sample-node-${index}`}
            key={node.iri}
            transform={`translate(${node.x - layout.nodeWidth / 2}, ${
              node.y - layout.nodeHeight / 2
            })`}>
            <rect
              fill="var(--tw-background-color-surface)"
              height={layout.nodeHeight}
              rx="8"
              stroke="var(--tw-border-color-secondary)"
              width={layout.nodeWidth}
            />
            <text
              dominantBaseline="middle"
              fill="var(--tw-text-color-primary)"
              fontSize="13"
              textAnchor="middle"
              x={layout.nodeWidth / 2}
              y={layout.nodeHeight / 2}>
              {node.label.length > 20
                ? `${node.label.slice(0, 19)}…`
                : node.label}
            </text>
            <title>{node.label}</title>
          </g>
        ))}
      </svg>
      {sample.concepts.length < sample.conceptCount && (
        <Typography color="secondary" size="text-xs">
          {t('message.ontology-pack-sample-truncated', {
            shown: sample.concepts.length,
            total: sample.conceptCount,
          })}
        </Typography>
      )}
    </Box>
  );
};

export default OntologyPackSampleGraph;
