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

import { LayersThree01 } from '@untitledui/icons';
import { ReactComponent as ClassificationActiveIcon } from '../../../assets/svg/ask-collate-nav-bar/classification-active.svg';
import { ReactComponent as ClassificationIcon } from '../../../assets/svg/ask-collate-nav-bar/classification-default.svg';
import { ReactComponent as GlossaryActiveIcon } from '../../../assets/svg/ask-collate-nav-bar/glossary-active.svg';
import { ReactComponent as GlossaryIcon } from '../../../assets/svg/ask-collate-nav-bar/glossary-default.svg';
import { ReactComponent as GovernIcon } from '../../../assets/svg/ask-collate-nav-bar/governanace-default.svg';
import { ReactComponent as GovernActiveIcon } from '../../../assets/svg/ask-collate-nav-bar/governance-active.svg';
import { ReactComponent as MetricsActiveIcon } from '../../../assets/svg/ask-collate-nav-bar/metrics-active.svg';
import { ReactComponent as MetricsIcon } from '../../../assets/svg/ask-collate-nav-bar/metrics-default.svg';
import { ReactComponent as WorkflowsActiveIcon } from '../../../assets/svg/ask-collate-nav-bar/workflows-active.svg';
import { ReactComponent as WorkflowsIcon } from '../../../assets/svg/ask-collate-nav-bar/workflows-default.svg';
import { ROUTES } from '../../../constants/constants';
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
  icon: GovernIcon,
  activeIcon: GovernActiveIcon,
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
            icon: GlossaryIcon,
            activeIcon: GlossaryActiveIcon,
            labelKey: 'label.glossary',
            path: ROUTES.GLOSSARY,
          },
          {
            key: 'ontology-explorer',
            icon: LayersThree01,
            labelKey: 'label.ontology-studio',
            path: ROUTES.ONTOLOGY_EXPLORER,
          },
          {
            key: 'tags',
            icon: ClassificationIcon,
            activeIcon: ClassificationActiveIcon,
            labelKey: 'label.classification',
            path: ROUTES.TAGS,
          },
          {
            key: 'metrics',
            icon: MetricsIcon,
            activeIcon: MetricsActiveIcon,
            labelKey: 'label.metric-plural',
            path: ROUTES.METRICS,
          },
          {
            key: 'workflows',
            icon: WorkflowsIcon,
            activeIcon: WorkflowsActiveIcon,
            labelKey: 'label.workflow-plural',
            path: ROUTES.WORKFLOWS,
          },
        ],
      },
    ],
  },
};
