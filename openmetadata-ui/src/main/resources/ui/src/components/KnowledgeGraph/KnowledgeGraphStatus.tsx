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
import { GraphData } from './KnowledgeGraph.interface';
interface GraphStatusProps {
  data: GraphData | null;
  loading: boolean;
  partial: boolean;
  failed: boolean;
  level: number;
  onRetry: () => void;
}
const KnowledgeGraphStatus = ({
  data,
  loading,
  partial,
  failed,
  level,
  onRetry,
}: GraphStatusProps) => {
  const { t } = useTranslation();

  return (
    <Box
      align="center"
      className="tw:px-4 tw:py-2 tw:shrink-0 tw:border-b tw:border-secondary"
      gap={3}
      wrap="wrap">
      <Typography
        aria-live="polite"
        className="tw:text-tertiary"
        data-testid="graph-status"
        size="text-xs">
        {data
          ? t('label.kg-returned-counts', {
              nodes: data.nodes.length,
              edges: data.edges.length,
            }) +
            ' · ' +
            t('label.kg-level-name', { level })
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
