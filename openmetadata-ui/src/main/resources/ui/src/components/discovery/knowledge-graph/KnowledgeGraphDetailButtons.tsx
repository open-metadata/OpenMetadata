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
import {
  AlertTriangle,
  Columns03,
  List,
} from '@openmetadata/ui-core-components/icons';
import classNames from 'classnames';
import { useTranslation } from 'react-i18next';
import {
  KnowledgeGraphDetailsControl,
  KnowledgeGraphDrawer,
  KnowledgeGraphMode,
} from './KnowledgeGraph.interface';

const icons = {
  columns: Columns03,
  relationships: List,
  coverage: AlertTriangle,
};
const labels = {
  'knowledge-graph': {
    columns: 'label.column-plural',
    relationships: 'label.relationship-plural',
    coverage: 'label.kg-gaps',
  },
  ontology: {
    columns: 'label.property-plural',
    relationships: 'label.kg-axioms',
    coverage: 'label.kg-coverage',
  },
};

/**
 * Design: quiet tabs in the footer that only take on colour when active, with
 * the gaps count flagged in the warning colour while there are gaps to close.
 */
const KnowledgeGraphDetailButtons = ({
  details,
  mode,
}: {
  details: KnowledgeGraphDetailsControl;
  mode: KnowledgeGraphMode;
}) => {
  const { t } = useTranslation();

  return (
    <Box align="center" className="tw:shrink-0" gap={1}>
      {(Object.keys(icons) as KnowledgeGraphDrawer[]).map((key) => {
        const active = details.active === key;
        const warn = key === 'coverage' && details.counts.coverage > 0;

        return (
          <Button
            aria-expanded={active}
            className={classNames(
              'tw:gap-1 tw:border',
              active
                ? 'tw:border-utility-brand-200 tw:bg-utility-brand-50'
                : 'tw:border-transparent',
              {
                'tw:*:data-icon:text-warning-primary tw:hover:*:data-icon:text-warning-primary':
                  warn,
                'tw:*:data-icon:text-utility-brand-600 tw:hover:*:data-icon:text-utility-brand-600':
                  active && !warn,
              }
            )}
            color="tertiary"
            data-testid={'graph-open-' + key}
            iconLeading={icons[key]}
            key={key}
            size="xs"
            onPress={() => details.onChange(key)}>
            <Box align="center" gap={1}>
              <Typography
                as="span"
                className={
                  active ? 'tw:text-utility-brand-700' : 'tw:text-secondary'
                }
                size="text-xs"
                weight="semibold">
                {t(labels[mode][key])}
              </Typography>
              <Typography
                as="span"
                className={classNames(
                  'tw:min-w-4 tw:rounded tw:px-1 tw:text-center',
                  {
                    'tw:bg-utility-brand-100 tw:text-utility-brand-700': active,
                    'tw:bg-utility-warning-50 tw:text-utility-warning-700':
                      warn && !active,
                    'tw:bg-secondary tw:text-tertiary': !active && !warn,
                  }
                )}
                data-testid={'graph-open-' + key + '-count'}
                size="text-xs"
                weight="semibold">
                {details.counts[key]}
              </Typography>
            </Box>
          </Button>
        );
      })}
    </Box>
  );
};

export default KnowledgeGraphDetailButtons;
