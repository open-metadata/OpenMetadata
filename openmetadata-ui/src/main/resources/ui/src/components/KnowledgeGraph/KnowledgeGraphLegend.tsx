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

import { Button, Typography } from '@openmetadata/ui-core-components';
import { ChevronDown, ChevronUp } from '@untitledui/icons';
import { FC, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  getRelationStyle,
  RelationCategory,
  RELATION_CATEGORIES,
} from './KnowledgeGraph.relations';

interface KnowledgeGraphLegendProps {
  /** How many edges of each family the rendered graph contains. */
  counts: Record<RelationCategory, number>;
  isCollapsed: boolean;
  onToggleCollapsed: () => void;
}

/** Width of the dash sample, wide enough to show two dash periods. */
const SAMPLE_WIDTH = 26;
const SAMPLE_HEIGHT = 8;

/**
 * Decodes the graph's edge styling. Only families actually present are listed,
 * so the legend stays a description of what is on screen rather than a catalogue
 * of everything the renderer could draw.
 */
const KnowledgeGraphLegend: FC<KnowledgeGraphLegendProps> = ({
  counts,
  isCollapsed,
  onToggleCollapsed,
}) => {
  const { t } = useTranslation();

  const presentCategories = useMemo(
    () => RELATION_CATEGORIES.filter((category) => counts[category] > 0),
    [counts]
  );

  const handleToggle = useCallback(
    () => onToggleCollapsed(),
    [onToggleCollapsed]
  );

  if (presentCategories.length === 0) {
    return null;
  }

  return (
    <section
      aria-label={t('label.relationship-type')}
      className="tw:absolute tw:bottom-4 tw:left-4 tw:z-10 tw:max-w-xs tw:rounded-lg tw:border tw:border-secondary tw:bg-primary tw:shadow-md"
      data-testid="knowledge-graph-legend">
      <Button
        aria-expanded={!isCollapsed}
        className="tw:w-full tw:justify-between tw:px-3 tw:py-2"
        color="link-gray"
        data-testid="knowledge-graph-legend-toggle"
        size="sm"
        onPress={handleToggle}>
        <Typography size="text-xs" weight="semibold">
          {t('label.relationship-plural')}
        </Typography>
        {isCollapsed ? (
          <ChevronUp aria-hidden="true" className="tw:size-4 tw:shrink-0" />
        ) : (
          <ChevronDown aria-hidden="true" className="tw:size-4 tw:shrink-0" />
        )}
      </Button>

      {!isCollapsed && (
        <ul
          className="tw:m-0 tw:flex tw:list-none tw:flex-col tw:gap-2 tw:border-t tw:border-secondary tw:px-3 tw:py-2"
          data-testid="knowledge-graph-legend-items">
          {presentCategories.map((category) => {
            const style = getRelationStyle(category);

            return (
              <li
                className="tw:flex tw:items-center tw:gap-2"
                data-testid={`legend-item-${category}`}
                key={category}>
                <svg
                  aria-hidden="true"
                  className="tw:shrink-0"
                  height={SAMPLE_HEIGHT}
                  viewBox={`0 0 ${SAMPLE_WIDTH} ${SAMPLE_HEIGHT}`}
                  width={SAMPLE_WIDTH}>
                  <line
                    stroke={style.color}
                    strokeDasharray={
                      style.lineDash.length > 0
                        ? style.lineDash.join(' ')
                        : undefined
                    }
                    strokeLinecap="round"
                    strokeWidth={2}
                    x1={0}
                    x2={SAMPLE_WIDTH - 6}
                    y1={SAMPLE_HEIGHT / 2}
                    y2={SAMPLE_HEIGHT / 2}
                  />
                  <path
                    d={`M${SAMPLE_WIDTH - 7} 1 L${SAMPLE_WIDTH} ${
                      SAMPLE_HEIGHT / 2
                    } L${SAMPLE_WIDTH - 7} ${SAMPLE_HEIGHT - 1} Z`}
                    fill={style.color}
                  />
                </svg>
                <Typography className="tw:flex-1" size="text-xs">
                  {t(style.labelKey)}
                </Typography>
                <Typography
                  className="tw:text-tertiary"
                  data-testid={`legend-count-${category}`}
                  size="text-xs">
                  {counts[category]}
                </Typography>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
};

export default KnowledgeGraphLegend;
