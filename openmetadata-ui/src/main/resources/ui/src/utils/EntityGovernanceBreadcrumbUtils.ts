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

import { startCase } from 'lodash';
import type { TitleLink } from '../components/common/TitleBreadcrumb/TitleBreadcrumb.interface';
import type { SourceType } from '../components/SearchedData/SearchedData.interface';
import { ROUTES } from '../constants/constants';
import {
  GlobalSettingOptions,
  GlobalSettingsMenuCategory,
} from '../constants/GlobalSettings.constants';
import { EntityType } from '../enums/entity.enum';
import type { Kpi } from '../generated/dataInsight/kpi/kpi';
import type { GlossaryTerm } from '../generated/entity/data/glossaryTerm';
import type { DataProduct } from '../generated/entity/domains/dataProduct';
import type { Team } from '../generated/entity/teams/team';
import {
  AlertType,
  type EventSubscription,
} from '../generated/events/eventSubscription';
import type { TestCase, TestSuite } from '../generated/tests/testCase';
import { DataInsightTabs } from '../interface/data-insight.interface';
import type { SearchSourceAlias } from '../interface/search.interface';
import { DataQualityPageTabs } from '../pages/DataQuality/DataQualityPage.interface';
import { getDataInsightPathWithFqn } from './DataInsightUtils';
import { getEntityLinkFromType } from './EntityLinkUtils';
import { getEntityName } from './EntityNameUtils';
import Fqn from './Fqn';
import i18n from './i18next/LocalUtil';
import {
  getApplicationDetailsPath,
  getBotsPagePath,
  getBotsPath,
  getClassificationTagPath,
  getDataQualityPagePath,
  getDomainPath,
  getGlossaryPath,
  getKpiPath,
  getPersonaDetailsPath,
  getPolicyWithFqnPath,
  getRoleWithFqnPath,
  getSettingPath,
  getTagsDetailsPath,
  getTeamsWithFqnPath,
} from './RouterUtils';

export const getBreadcrumbForGlossaryOrTerm = (entity: GlossaryTerm) => {
  const glossary = entity.glossary;
  if (!glossary) {
    return [];
  }
  const fqnList = entity.fullyQualifiedName
    ? Fqn.split(entity.fullyQualifiedName)
    : [];
  const tree = fqnList.slice(1, fqnList.length);

  return [
    {
      name: glossary.fullyQualifiedName,
      url: getGlossaryPath(glossary.fullyQualifiedName),
    },
    ...tree.map((fqn, index, source) => ({
      name: fqn,
      url: getGlossaryPath(
        `${glossary.fullyQualifiedName}.${source.slice(0, index + 1).join('.')}`
      ),
    })),
  ];
};

export const getBreadcrumbForTestCase = (entity: TestCase): TitleLink[] => [
  {
    name: i18n.t('label.data-quality'),
    url: `${ROUTES.DATA_QUALITY}/${DataQualityPageTabs.TEST_CASES}`,
  },
  {
    name: entity.name,
    url: getEntityLinkFromType(
      entity.fullyQualifiedName ?? '',
      (entity as SourceType)?.entityType as EntityType
    ),
    options: {
      state: {
        breadcrumbData: [
          {
            name: i18n.t('label.data-quality'),
            url: `${ROUTES.DATA_QUALITY}/${DataQualityPageTabs.TEST_CASES}`,
          },
        ],
      },
    },
  },
];

export const getBreadcrumbForTestSuite = (entity: TestSuite) => {
  const { t } = i18n;

  return entity.basic
    ? [
        {
          name: getEntityName(entity.basicEntityReference),
          url: getEntityLinkFromType(
            entity.basicEntityReference?.fullyQualifiedName ?? '',
            EntityType.TABLE
          ),
        },
        {
          name: t('label.test-suite'),
          url: '',
        },
      ]
    : [
        {
          name: t('label.test-suite-plural'),
          url: getDataQualityPagePath(DataQualityPageTabs.TEST_SUITES),
        },
        {
          name: getEntityName(entity),
          url: '',
        },
      ];
};

export const getBreadCrumbForKpi = (entity: Kpi) => [
  {
    name: i18n.t('label.kpi-uppercase'),
    url: getDataInsightPathWithFqn(DataInsightTabs.KPIS),
  },
  {
    name: getEntityName(entity),
    url: getKpiPath(entity.name),
  },
];

export const getBreadcrumbForDomain = () => [
  {
    name: i18n.t('label.domain-plural'),
    url: getDomainPath(),
  },
];

export const getBreadcrumbForDataProduct = (entity: DataProduct) => {
  if (!entity.domains?.length) {
    return [];
  }

  return [
    {
      name: getEntityName(entity.domains[0]),
      url: getDomainPath(entity.domains[0].fullyQualifiedName),
    },
  ];
};

export const getBreadcrumbForEventSubscription = (
  entity: EventSubscription,
  entityFqn: string,
  entitySourceType: SearchSourceAlias
) => [
  {
    name: startCase(EntityType.ALERT),
    url:
      entity.alertType === AlertType.Observability
        ? ROUTES.OBSERVABILITY_ALERTS
        : ROUTES.NOTIFICATION_ALERT_LIST,
  },
  {
    name: entity.name,
    url: getEntityLinkFromType(
      entityFqn,
      (entitySourceType as SourceType).entityType as EntityType,
      entitySourceType
    ),
  },
];

export const getBreadcrumbForBot = (entityName: string, fqn: string) => [
  {
    name: startCase(EntityType.BOT),
    url: getBotsPagePath(),
  },
  {
    name: entityName,
    url: getBotsPath(fqn),
  },
];

export const getBreadcrumbForTeam = (entity: Team) => [
  {
    name: getEntityName(entity.parents?.[0]),
    url: getTeamsWithFqnPath(entity.parents?.[0]?.fullyQualifiedName ?? ''),
  },
  {
    name: getEntityName(entity),
    url: getTeamsWithFqnPath(entity.fullyQualifiedName ?? ''),
  },
];

export const getBreadcrumbForApplication = (
  entityName: string,
  fqn: string
) => [
  {
    name: i18n.t('label.application-plural'),
    url: getSettingPath(GlobalSettingsMenuCategory.APPLICATIONS),
  },
  {
    name: entityName,
    url: getApplicationDetailsPath(fqn),
  },
];

export const getBreadcrumbForPersona = (entityName: string, fqn: string) => [
  {
    name: i18n.t('label.persona-plural'),
    url: getSettingPath(
      GlobalSettingsMenuCategory.MEMBERS,
      GlobalSettingOptions.PERSONA
    ),
  },
  {
    name: entityName,
    url: getPersonaDetailsPath(fqn),
  },
];

export const getBreadcrumbForRole = (entityName: string, fqn: string) => [
  {
    name: i18n.t('label.role-plural'),
    url: getSettingPath(
      GlobalSettingsMenuCategory.ACCESS,
      GlobalSettingOptions.ROLES
    ),
  },
  {
    name: entityName,
    url: getRoleWithFqnPath(fqn),
  },
];

export const getBreadcrumbForPolicy = (entityName: string, fqn: string) => [
  {
    name: i18n.t('label.policy-plural'),
    url: getSettingPath(
      GlobalSettingsMenuCategory.ACCESS,
      GlobalSettingOptions.POLICIES
    ),
  },
  {
    name: entityName,
    url: getPolicyWithFqnPath(fqn),
  },
];

export const getBreadcrumbForTag = (
  classificationName: string,
  classificationFqn: string,
  entityName: string,
  entityFqn: string
) => [
  {
    name: classificationName,
    url: getTagsDetailsPath(classificationFqn),
  },
  {
    name: entityName,
    url: getClassificationTagPath(entityFqn),
  },
];

export const getBreadcrumbForClassification = (entityName: string) => [
  {
    name: entityName,
    url: '',
  },
];

export const getBreadcrumbForMetric = (entityName: string) => [
  {
    name: i18n.t('label.metric-plural'),
    url: ROUTES.METRICS,
  },
  {
    name: entityName,
    url: '',
  },
];

export const getBreadcrumbForKnowledgePage = (
  entityName: string,
  includeCurrent: boolean
) => [
  {
    name: i18n.t('label.knowledge-center'),
    url: ROUTES.KNOWLEDGE_CENTER,
  },
  {
    name: entityName,
    url: '',
    activeTitle: Boolean(includeCurrent),
  },
];
