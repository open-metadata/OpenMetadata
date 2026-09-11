/*
 *  Copyright 2025 Collate.
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
import { useTranslation } from 'react-i18next';
import { GraphData, KnowledgeGraphMode } from './KnowledgeGraph.interface';
interface GraphStatusProps {
  data: GraphData | null;
  loading: boolean;
  partial: boolean;
  failed: boolean;
  mode: KnowledgeGraphMode;
  onRetry: () => void;
}
const KnowledgeGraphStatus = ({
  data,
  loading,
  partial,
  failed,
  mode,
  onRetry,
}: GraphStatusProps) => {
  const { t } = useTranslation();

  return (
    <Box
      align="center"
      className="tw:px-4 tw:py-2 tw:shrink-0 tw:border-b tw:border-secondary"
      gap={3}
      wrap="wrap">
      <Box align="center" gap={2}>
        <svg aria-hidden="true" height="10" width="10">
          <circle
            cx="5"
            cy="5"
            fill={
              mode === 'ontology'
                ? 'var(--om-color-purple-600)'
                : 'var(--om-color-blue-dark-600)'
            }
            r="4"
          />
        </svg>
        <Typography data-testid="graph-mode" size="text-xs" weight="semibold">
          {t(mode === 'ontology' ? 'label.ontology' : 'label.knowledge-graph')}
        </Typography>
      </Box>
      <Typography className="tw:text-tertiary" size="text-xs">
        {t(
          mode === 'ontology'
            ? 'message.kg-concept-scope'
            : 'message.kg-entity-scope'
        )}
      </Typography>
      <Typography
        aria-live="polite"
        className="tw:ml-auto tw:text-tertiary"
        data-testid="graph-status"
        size="text-xs">
        {data
          ? t('label.kg-returned-counts', {
              nodes: data.nodes.length,
              edges: data.edges.length,
            })
          : t('label.knowledge-graph')}
        {loading ? ' · ' + t('label.kg-updating') : ''}
      </Typography>
      {partial && (
        <Typography
          className="tw:text-warning-primary"
          data-testid="graph-partial"
          size="text-xs">
          {t('message.kg-partial-graph')}
        </Typography>
      )}
      {failed && (
        <Box align="center" gap={2}>
          <Typography role="alert" size="text-xs">
            {t('message.kg-load-error')}
          </Typography>
          <Button color="link-color" size="sm" onPress={onRetry}>
            {t('label.retry')}
          </Button>
        </Box>
      )}
    </Box>
  );
};

export default KnowledgeGraphStatus;
