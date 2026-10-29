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
  Box,
  Button,
  Card,
  Typography,
} from '@openmetadata/ui-core-components';
import classNames from 'classnames';
import { useTranslation } from 'react-i18next';
import { DATA_MODE_MAX_RENDER_COUNT } from './OntologyExplorer.constants';

export interface LegendEntry {
  color: string;
  isSolid: boolean;
  key: string;
  label: string;
}

interface DataEdgeLegendProps {
  entries: LegendEntry[];
}

interface DataLayerHeadingProps {
  assetCount: number;
  conceptCount: number;
  isNative: boolean;
}

interface DataGraphFootnoteProps {
  hasMoreTerms: boolean;
  isLoadingMoreTerms: boolean;
  isRenderCapped: boolean;
  limitMessage?: string;
  top: number;
  onLoadMoreTerms: () => void;
}

const FOOTNOTE_CLASS = 'tw:absolute tw:left-1/2 tw:-translate-x-1/2';

export const DataEdgeLegend = ({ entries }: DataEdgeLegendProps) =>
  entries.length > 0 ? (
    <Card
      className="tw:flex tw:items-center tw:gap-4 tw:px-3 tw:py-2"
      data-testid="ontology-data-edge-legend"
      variant="elevated">
      {entries.map(({ color, isSolid, key, label }) => (
        <Box
          align="center"
          data-testid={`ontology-data-legend-${key}`}
          gap={2}
          key={key}>
          <svg aria-hidden="true" height="2" width="24">
            <line
              stroke={color}
              strokeDasharray={isSolid ? undefined : '4 3'}
              strokeWidth="2"
              x1="0"
              x2="24"
              y1="1"
              y2="1"
            />
          </svg>
          <Typography className="tw:text-secondary" size="text-xs">
            {label}
          </Typography>
        </Box>
      ))}
    </Card>
  ) : null;

export const DataLayerHeading = ({
  assetCount,
  conceptCount,
  isNative,
}: DataLayerHeadingProps) => {
  const { t } = useTranslation();
  // A native total counts bindings: a table bound to two concepts counts twice.
  const summary = isNative
    ? `${t('message.native-concept-count', {
        count: conceptCount,
      })} · ${t('message.native-binding-count', { count: assetCount })}`
    : t('message.data-layer-summary', { assetCount, termCount: conceptCount });

  return (
    <Box
      className={classNames(
        'tw:pointer-events-none tw:absolute',
        isNative ? 'tw:left-4 tw:top-15 tw:max-w-md' : 'tw:left-6 tw:top-5'
      )}
      data-testid="ontology-data-layer-heading"
      direction="col"
      gap={0}>
      <Typography className="tw:text-primary" size="text-sm" weight="medium">
        {t('label.data-layer')}
      </Typography>
      <Typography className="tw:text-tertiary" size="text-xs">
        {summary}
      </Typography>
      {isNative ? (
        <Typography className="tw:text-tertiary" size="text-xs">
          {t('message.ontology-data-graph-scope')}
        </Typography>
      ) : null}
    </Box>
  );
};

export const DataGraphFootnote = ({
  hasMoreTerms,
  isLoadingMoreTerms,
  isRenderCapped,
  limitMessage,
  top,
  onLoadMoreTerms,
}: DataGraphFootnoteProps) => {
  const { t } = useTranslation();
  if (hasMoreTerms) {
    return (
      <Button
        className={FOOTNOTE_CLASS}
        color="secondary"
        isDisabled={isLoadingMoreTerms}
        size="sm"
        style={{ top }}
        onPress={onLoadMoreTerms}>
        {isLoadingMoreTerms ? t('label.loading') : t('label.load-more')}
      </Button>
    );
  }
  if (!limitMessage && !isRenderCapped) {
    return null;
  }

  return (
    <Badge
      className={FOOTNOTE_CLASS}
      color="gray"
      data-testid={
        limitMessage ? 'ontology-data-context-full' : 'ontology-data-render-cap'
      }
      size="md"
      style={{ top }}
      type="pill-color">
      {limitMessage ??
        t('message.data-clusters-render-cap', {
          count: DATA_MODE_MAX_RENDER_COUNT,
        })}
    </Badge>
  );
};
