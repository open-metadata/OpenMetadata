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
  Box,
  Button,
  Popover,
  PopoverTrigger,
  Typography,
} from '@openmetadata/ui-core-components';
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
  /** Families the user has hidden; the label then reads "shown of total". */
  hiddenCount?: number;
  isCollapsed: boolean;
  onToggleCollapsed: () => void;
  selectedCategory?: RelationCategory | null;
  onSelectCategory?: (category: RelationCategory) => void;
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
  hiddenCount = 0,
  isCollapsed,
  onToggleCollapsed,
  selectedCategory,
  onSelectCategory,
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
      className="kg-legend tw:shrink-0"
      data-testid="knowledge-graph-legend">
      <PopoverTrigger
        isOpen={!isCollapsed}
        onOpenChange={(open) => {
          if (open === isCollapsed) {
            handleToggle();
          }
        }}>
        <Button
          aria-expanded={!isCollapsed}
          className="tw:shrink-0 tw:rounded-full"
          color="secondary"
          data-testid="knowledge-graph-legend-toggle"
          iconTrailing={isCollapsed ? ChevronUp : ChevronDown}
          size="sm">
          <Box align="center" gap={2}>
            <Box aria-hidden="true" gap={1}>
              {presentCategories.map((category) => (
                <svg height="8" key={category} width="8">
                  <circle
                    cx="4"
                    cy="4"
                    fill={getRelationStyle(category).color}
                    r="4"
                  />
                </svg>
              ))}
            </Box>
            <Typography size="text-xs" weight="semibold">
              {hiddenCount > 0
                ? t('label.kg-family-of-count', {
                    shown: presentCategories.length,
                    total: presentCategories.length + hiddenCount,
                  })
                : t('label.kg-family-count', {
                    count: presentCategories.length,
                  })}
            </Typography>
          </Box>
        </Button>

        <Popover
          aria-label={t('label.relationship-type')}
          className="tw:w-72 tw:p-3"
          placement="top end">
          {!isCollapsed && (
            <ul
              className="tw:m-0 tw:flex tw:list-none tw:flex-wrap tw:gap-1 tw:p-0"
              data-testid="knowledge-graph-legend-items">
              {presentCategories.map((category) => {
                const style = getRelationStyle(category);

                return (
                  <li
                    className="tw:flex tw:items-center tw:gap-2"
                    data-testid={`legend-item-${category}`}
                    key={category}>
                    <Button
                      aria-pressed={selectedCategory === category}
                      className="tw:[&>[data-text]]:flex tw:[&>[data-text]]:items-center tw:[&>[data-text]]:gap-2"
                      color="tertiary"
                      size="sm"
                      onPress={() => onSelectCategory?.(category)}>
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
                    </Button>
                  </li>
                );
              })}
            </ul>
          )}
        </Popover>
      </PopoverTrigger>
    </section>
  );
};

export default KnowledgeGraphLegend;
