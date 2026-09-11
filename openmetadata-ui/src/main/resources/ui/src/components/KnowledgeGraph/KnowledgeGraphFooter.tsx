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
import { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import {
  GraphData,
  KnowledgeGraphDetailsControl,
  KnowledgeGraphLabelMode,
  KnowledgeGraphLevel,
  KnowledgeGraphMode,
  KnowledgeGraphPresentation,
} from './KnowledgeGraph.interface';
import KnowledgeGraphDetailButtons from './KnowledgeGraphDetailButtons';

interface FooterProps {
  data: GraphData | null;
  details: KnowledgeGraphDetailsControl;
  expanded: string[];
  mode: KnowledgeGraphMode;
  presentation: KnowledgeGraphPresentation;
  labelMode: KnowledgeGraphLabelMode;
  level: KnowledgeGraphLevel;
  onCollapse: () => void;
  children: ReactNode;
}
const labelKeys = {
  auto: 'label.kg-direct-only',
  all: 'label.all',
  none: 'label.none',
};

/**
 * Design: the footer carries the details tabs, the presentation summary and
 * the legend, so the toolbar above the graph is left to scope and search.
 */
const KnowledgeGraphFooter = ({
  data,
  details,
  expanded,
  mode,
  presentation,
  labelMode,
  level,
  onCollapse,
  children,
}: FooterProps) => {
  const { t } = useTranslation();
  const groups = (data?.nodes ?? []).filter(
    (node) => node.presentation?.members
  );
  const shown = new Set(data?.nodes.map((node) => node.id));
  const bundled = groups.reduce(
    (total, node) =>
      total +
      (node.presentation?.members?.filter((member) => !shown.has(member.id))
        .length ?? 0),
    0
  );
  const individual = (data?.nodes.length ?? 0) - groups.length;

  return (
    <Box
      align="center"
      className="tw:min-h-10 tw:shrink-0 tw:border-t tw:border-secondary tw:bg-secondary_subtle tw:px-3 tw:py-1"
      data-testid="graph-footer"
      gap={3}
      justify="between">
      <Box align="center" className="tw:min-w-0 tw:flex-1" gap={3}>
        <KnowledgeGraphDetailButtons details={details} mode={mode} />
        <Typography
          className="tw:shrink-0 tw:whitespace-nowrap tw:border-l tw:border-secondary tw:pl-3 tw:text-secondary"
          size="text-xs"
          weight="semibold">
          {t(
            presentation === 'balanced'
              ? 'label.kg-balanced-summary'
              : 'label.kg-every-entity'
          )}
        </Typography>
        <Typography
          className="tw:min-w-0 tw:truncate tw:text-tertiary"
          size="text-xs">
          {t('label.kg-bundle-summary', {
            individual,
            bundled,
            groups: groups.length,
          })}
          {' · ' + t('label.kg-level-summary', { level })}
        </Typography>
      </Box>
      {expanded.length > 0 && (
        <Button
          className="tw:shrink-0"
          color="link-color"
          data-testid="graph-collapse-groups"
          size="xs"
          onPress={onCollapse}>
          {t('label.kg-collapse-groups')}
        </Button>
      )}
      <Box align="center" className="tw:shrink-0" gap={3}>
        {children}
        <Typography
          className="tw:whitespace-nowrap tw:border-l tw:border-secondary tw:pl-3 tw:text-tertiary"
          size="text-xs">
          {t('label.kg-labels')}: {t(labelKeys[labelMode])}
        </Typography>
      </Box>
    </Box>
  );
};

export default KnowledgeGraphFooter;
