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
  Bank02,
  Classification,
  ClassificationFilled,
  Glossary,
  GlossaryFilled,
  GovernanceFilled,
  Metric,
  MetricFilled,
  Workflow,
  WorkflowsFilled,
} from '@openmetadata/ui-core-components/icons';
import { ROUTES } from '../../../constants/constants';
import { OntologyStudioIcon } from '../../../utils/IconUtils';
import { AppModule } from '../../platform/ai-shell/AppModule.types';

/**
 * Govern module — mirrors the classic "Govern" left-sidebar section (Glossary,
 * Ontology Studio, Classifications, Metrics, Workflows). Owns no routes of
 * its own: every target is a canonical OM path served by the shell's page-table
 * fallback (`applicationRoutesClass.getRouteElements()`). This module provides
 * the sidebar entry and the sub-nav panel only.
 */
export const governModule: AppModule = {
  id: 'govern',
  navOrder: 65,
  labelKey: 'label.governance',
  icon: Bank02,
  activeIcon: GovernanceFilled,
  prefix: ROUTES.GLOSSARY,
  additionalPrefixes: [
    ROUTES.TAGS,
    ROUTES.ONTOLOGY_EXPLORER,
    ROUTES.METRICS,
    ROUTES.WORKFLOWS,
  ],
  defaultPath: ROUTES.GLOSSARY,
  routes: [],
  subNav: {
    key: 'govern',
    titleKey: 'label.governance',
    rootPath: ROUTES.GLOSSARY,
    sections: [
      {
        items: [
          {
            key: 'glossary',
            icon: Glossary,
            activeIcon: GlossaryFilled,
            labelKey: 'label.glossary',
            path: ROUTES.GLOSSARY,
          },
          {
            key: 'ontology-explorer',
            icon: OntologyStudioIcon,
            labelKey: 'label.ontology-studio',
            path: ROUTES.ONTOLOGY_EXPLORER,
          },
          {
            key: 'tags',
            icon: Classification,
            activeIcon: ClassificationFilled,
            labelKey: 'label.classification',
            path: ROUTES.TAGS,
          },
          {
            key: 'metrics',
            icon: Metric,
            activeIcon: MetricFilled,
            labelKey: 'label.metric-plural',
            path: ROUTES.METRICS,
          },
          {
            key: 'workflows',
            icon: Workflow,
            activeIcon: WorkflowsFilled,
            labelKey: 'label.workflow-plural',
            path: ROUTES.WORKFLOWS,
          },
        ],
      },
    ],
  },
};
