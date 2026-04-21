/*
 *  Copyright 2024 Collate.
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

import { EntityFields } from '../enums/AdvancedSearch.enum';
import {
  DataProductType,
  PortfolioPriority,
  Visibility,
} from '../generated/api/domains/createDataProduct';

export const DATAPRODUCT_DEFAULT_QUICK_FILTERS = [
  EntityFields.OWNERS,
  EntityFields.DOMAINS,
  EntityFields.DATA_PRODUCT_TYPE,
  EntityFields.LIFECYCLE_STAGE,
  EntityFields.CLASSIFICATION_TAGS,
  EntityFields.GLOSSARY_TERMS,
];

export const DATAPRODUCT_FILTERS = [
  {
    label: 'label.owner-plural',
    key: EntityFields.OWNERS,
  },
  {
    label: 'label.domain-plural',
    key: EntityFields.DOMAINS,
  },
  {
    label: 'label.type',
    key: EntityFields.DATA_PRODUCT_TYPE,
  },
  {
    label: 'label.lifecycle-stage',
    key: EntityFields.LIFECYCLE_STAGE,
  },
  {
    label: 'label.visibility',
    key: EntityFields.VISIBILITY,
  },
  {
    label: 'label.portfolio-priority',
    key: EntityFields.PORTFOLIO_PRIORITY,
  },
  {
    label: 'label.tag-plural',
    key: EntityFields.CLASSIFICATION_TAGS,
  },
  {
    label: 'label.glossary-term-plural',
    key: EntityFields.GLOSSARY_TERMS,
  },
];

/**
 * i18n key maps for ODPS-aligned DataProduct enums. Callers resolve the key
 * with t() at render time so Select/filter UIs show localized labels instead
 * of raw uppercase enum identifiers like `BI_DIRECTIONAL`.
 */
export const DATA_PRODUCT_TYPE_LABEL_KEYS: Record<DataProductType, string> = {
  [DataProductType.RawData]: 'label.dp-type-raw-data',
  [DataProductType.DerivedData]: 'label.dp-type-derived-data',
  [DataProductType.Dataset]: 'label.dp-type-dataset',
  [DataProductType.Reports]: 'label.dp-type-reports',
  [DataProductType.AnalyticView]: 'label.dp-type-analytic-view',
  [DataProductType.Visualisation3D]: 'label.dp-type-visualisation-3d',
  [DataProductType.Algorithm]: 'label.dp-type-algorithm',
  [DataProductType.DecisionSupport]: 'label.dp-type-decision-support',
  [DataProductType.AutomatedDecisionMaking]:
    'label.dp-type-automated-decision-making',
  [DataProductType.DataEnhancedProduct]: 'label.dp-type-data-enhanced-product',
  [DataProductType.DataDrivenService]: 'label.dp-type-data-driven-service',
  [DataProductType.DataEnabledPerformance]:
    'label.dp-type-data-enabled-performance',
  [DataProductType.BIDirectional]: 'label.dp-type-bi-directional',
};

export const VISIBILITY_LABEL_KEYS: Record<Visibility, string> = {
  [Visibility.Private]: 'label.visibility-private',
  [Visibility.Invitation]: 'label.visibility-invitation',
  [Visibility.Organisation]: 'label.visibility-organisation',
  [Visibility.Dataspace]: 'label.visibility-dataspace',
  [Visibility.Public]: 'label.visibility-public',
};

export const PORTFOLIO_PRIORITY_LABEL_KEYS: Record<PortfolioPriority, string> =
  {
    [PortfolioPriority.Critical]: 'label.portfolio-priority-critical',
    [PortfolioPriority.High]: 'label.portfolio-priority-high',
    [PortfolioPriority.Medium]: 'label.portfolio-priority-medium',
    [PortfolioPriority.Low]: 'label.portfolio-priority-low',
  };
