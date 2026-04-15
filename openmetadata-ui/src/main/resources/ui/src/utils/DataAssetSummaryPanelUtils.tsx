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
import { isEmpty, isNil, isObject, isUndefined } from 'lodash';
import { DomainLabel } from '../components/common/DomainLabel/DomainLabel.component';
import { OwnerLabel } from '../components/common/OwnerLabel/OwnerLabel.component';
import QueryCount from '../components/common/QueryCount/QueryCount.component';
import { DataAssetSummaryPanelProps } from '../components/DataAssetSummaryPanelV1/DataAssetSummaryPanelV1.interface';
import { ProfilerTabPath } from '../components/Database/Profiler/ProfilerDashboard/profilerDashboard.interface';
import { EntityServiceUnion } from '../components/Explore/ExplorePage.interface';
import TagsV1 from '../components/Tag/TagsV1/TagsV1.component';
import { FQN_SEPARATOR_CHAR } from '../constants/char.constants';
import { NO_DATA } from '../constants/constants';
import { TAG_START_WITH } from '../constants/Tag.constants';
import { EntityTabs, EntityType, FqnPart } from '../enums/entity.enum';
import { ExplorePageTabs } from '../enums/Explore.enum';
import { ServiceCategory } from '../enums/service.enum';
import { APICollection } from '../generated/entity/data/apiCollection';
import { APIEndpoint } from '../generated/entity/data/apiEndpoint';
import { Chart } from '../generated/entity/data/chart';
import { Container } from '../generated/entity/data/container';
import { Dashboard } from '../generated/entity/data/dashboard';
import { DashboardDataModel } from '../generated/entity/data/dashboardDataModel';
import { Database } from '../generated/entity/data/database';
import { DatabaseSchema } from '../generated/entity/data/databaseSchema';
import { Directory } from '../generated/entity/data/directory';
import { File } from '../generated/entity/data/file';
import { Metric } from '../generated/entity/data/metric';
import { Mlmodel } from '../generated/entity/data/mlmodel';
import { SearchIndex } from '../generated/entity/data/searchIndex';
import { Spreadsheet } from '../generated/entity/data/spreadsheet';
import {
  StoredProcedure,
  StoredProcedureCodeObject,
} from '../generated/entity/data/storedProcedure';
import { Table, TableType, TagLabel } from '../generated/entity/data/table';
import { Topic } from '../generated/entity/data/topic';
import { Worksheet } from '../generated/entity/data/worksheet';

import { Pipeline } from '../generated/entity/data/pipeline';
import { EntityReference } from '../generated/entity/type';
import { UsageDetails } from '../generated/type/usageDetails';
import {
  formatNumberWithComma,
  getPartialNameFromTableFQN,
} from './CommonUtils';
import { DRAWER_NAVIGATION_OPTIONS, getEntityName } from './EntityUtils';
import { BasicEntityOverviewInfo } from './EntityUtils.interface';
import i18n from './i18next/LocalUtil';
import { getEntityDetailsPath, getServiceDetailsPath } from './RouterUtils';
import { bytesToSize, stringToHTML } from './StringsUtils';
import { getTierTags, getUsagePercentile } from './TableUtils';

interface ColumnSearchResult {
  dataType?: string;
  dataTypeDisplay?: string;
  constraint?: string;
  table?: {
    name?: string;
    displayName?: string;
    fullyQualifiedName?: string;
  };
  service?: {
    name?: string;
    displayName?: string;
    fullyQualifiedName?: string;
    type?: string;
  };
  database?: {
    name?: string;
    displayName?: string;
    fullyQualifiedName?: string;
  };
  databaseSchema?: {
    name?: string;
    displayName?: string;
    fullyQualifiedName?: string;
  };
  owners?: EntityReference[];
  domains?: EntityReference[];
}

const entityTierRenderer = (tier?: TagLabel) => {
  return tier ? (
    <TagsV1 startWith={TAG_START_WITH.SOURCE_ICON} tag={tier} />
  ) : (
    NO_DATA
  );
};

const getUsageData = (usageSummary: UsageDetails | undefined) =>
  isNil(usageSummary?.weeklyStats?.percentileRank)
    ? NO_DATA
    : getUsagePercentile(usageSummary?.weeklyStats?.percentileRank ?? 0);

const getTableFieldsFromTableDetails = (tableDetails: Table) => {
  const {
    fullyQualifiedName,
    owners,
    tags,
    usageSummary,
    profile,
    columns,
    tableType,
    service,
    database,
    databaseSchema,
    domains,
  } = tableDetails;
  const [serviceName, databaseName, schemaName] = getPartialNameFromTableFQN(
    fullyQualifiedName ?? '',
    [FqnPart.Service, FqnPart.Database, FqnPart.Schema],
    FQN_SEPARATOR_CHAR
  ).split(FQN_SEPARATOR_CHAR);

  const serviceDisplayName = getEntityName(service) || serviceName;
  const databaseDisplayName = getEntityName(database) || databaseName;
  const schemaDisplayName = getEntityName(databaseSchema) || schemaName;

  const tier = getTierTags(tags ?? []);

  return {
    fullyQualifiedName,
    owners,
    service: serviceDisplayName,
    database: databaseDisplayName,
    schema: schemaDisplayName,
    tier,
    usage: getUsageData(usageSummary),
    profile,
    columns,
    tableType,
    domains,
  };
};

const getCommonOverview = (
  {
    owners,
    domains,
  }: {
    owners?: EntityReference[];
    domains?: EntityReference[];
  },
  showOwner = true
) => {
  return [
    ...(showOwner
      ? [
          {
            name: i18n.t('label.owner-plural'),
            value: (
              <OwnerLabel
                hasPermission={false}
                isCompactView={false}
                owners={owners}
                showLabel={false}
              />
            ),
            visible: [DRAWER_NAVIGATION_OPTIONS.lineage],
          },
        ]
      : []),
    {
      name: i18n.t('label.domain-plural'),
      value: (
        <DomainLabel
          domains={domains}
          entityFqn=""
          entityId=""
          entityType={EntityType.TABLE}
          showDomainHeading={false}
        />
      ),
      visible: [DRAWER_NAVIGATION_OPTIONS.lineage],
    },
  ];
};

const getTableOverview = (
  tableDetails: Table,
  additionalInfo?: Record<string, number | string>
) => {
  const {
    fullyQualifiedName,
    owners,
    profile,
    columns,
    tableType,
    service,
    database,
    schema,
    tier,
    usage,
    domains,
  } = getTableFieldsFromTableDetails(tableDetails);

  const overview: BasicEntityOverviewInfo[] = [
    ...getCommonOverview({ owners, domains }),
    {
      name: i18n.t('label.type'),
      value: tableType ?? TableType.Regular,
      isLink: false,
      visible: [
        DRAWER_NAVIGATION_OPTIONS.lineage,
        DRAWER_NAVIGATION_OPTIONS.explore,
      ],
    },
    {
      name: i18n.t('label.service'),
      value: service || NO_DATA,
      url: getServiceDetailsPath(service, ServiceCategory.DATABASE_SERVICES),
      isLink: true,
      visible: [DRAWER_NAVIGATION_OPTIONS.lineage],
    },
    {
      name: i18n.t('label.database'),
      value: database || NO_DATA,
      url: getEntityDetailsPath(
        EntityType.DATABASE,
        getPartialNameFromTableFQN(
          fullyQualifiedName ?? '',
          [FqnPart.Service, FqnPart.Database],
          FQN_SEPARATOR_CHAR
        )
      ),
      isLink: true,
      visible: [DRAWER_NAVIGATION_OPTIONS.lineage],
    },
    {
      name: i18n.t('label.schema'),
      value: schema || NO_DATA,
      url: getEntityDetailsPath(
        EntityType.DATABASE_SCHEMA,
        getPartialNameFromTableFQN(
          fullyQualifiedName ?? '',
          [FqnPart.Service, FqnPart.Database, FqnPart.Schema],
          FQN_SEPARATOR_CHAR
        )
      ),
      isLink: true,
      visible: [DRAWER_NAVIGATION_OPTIONS.lineage],
    },
    {
      name: i18n.t('label.tier'),
      value: entityTierRenderer(tier),
      isLink: false,
      visible: [DRAWER_NAVIGATION_OPTIONS.lineage],
    },
    {
      name: i18n.t('label.usage'),
      value: usage || NO_DATA,
      isLink: false,
      visible: [DRAWER_NAVIGATION_OPTIONS.lineage],
    },
    {
      name: i18n.t('label.query-plural'),
      value: <QueryCount tableId={tableDetails.id || ''} />,
      isLink: false,
      visible: [
        DRAWER_NAVIGATION_OPTIONS.lineage,
        DRAWER_NAVIGATION_OPTIONS.explore,
      ],
    },
    {
      name: i18n.t('label.column-plural'),
      value: columns ? columns.length : NO_DATA,
      isLink: false,
      visible: [
        DRAWER_NAVIGATION_OPTIONS.lineage,
        DRAWER_NAVIGATION_OPTIONS.explore,
      ],
    },
    {
      name: i18n.t('label.row-plural'),
      value:
        !isUndefined(profile) && profile?.rowCount
          ? formatNumberWithComma(profile.rowCount)
          : NO_DATA,
      isLink: false,
      visible: [DRAWER_NAVIGATION_OPTIONS.lineage],
    },
    {
      name: i18n.t('label.incident-plural'),
      value: additionalInfo?.incidentCount ?? 0,
      isLink: true,
      linkProps: {
        pathname: getEntityDetailsPath(
          EntityType.TABLE,
          fullyQualifiedName ?? '',
          EntityTabs.PROFILER,
          ProfilerTabPath.INCIDENTS
        ),
      },
      visible: [
        DRAWER_NAVIGATION_OPTIONS.lineage,
        DRAWER_NAVIGATION_OPTIONS.explore,
      ],
    },
  ];

  return overview;
};

const getTopicOverview = (topicDetails: Topic) => {
  const {
    domains,
    partitions,
    replicationFactor,
    retentionSize,
    cleanupPolicies,
    maximumMessageSize,
    messageSchema,
  } = topicDetails;

  const overview: BasicEntityOverviewInfo[] = [
    ...getCommonOverview({ domains, owners: topicDetails.owners }),
    {
      name: i18n.t('label.partition-plural'),
      value: partitions ?? NO_DATA,
      isLink: false,
      visible: [
        DRAWER_NAVIGATION_OPTIONS.lineage,
        DRAWER_NAVIGATION_OPTIONS.explore,
      ],
    },
    {
      name: i18n.t('label.replication-factor'),
      value: replicationFactor,
      isLink: false,
      visible: [
        DRAWER_NAVIGATION_OPTIONS.lineage,
        DRAWER_NAVIGATION_OPTIONS.explore,
      ],
    },
    {
      name: i18n.t('label.retention-size'),
      value: bytesToSize(retentionSize ?? 0),
      isLink: false,
      visible: [
        DRAWER_NAVIGATION_OPTIONS.lineage,
        DRAWER_NAVIGATION_OPTIONS.explore,
      ],
    },
    {
      name: i18n.t('label.clean-up-policy-plural'),
      value: cleanupPolicies ? cleanupPolicies.join(', ') : NO_DATA,
      isLink: false,
      visible: [
        DRAWER_NAVIGATION_OPTIONS.lineage,
        DRAWER_NAVIGATION_OPTIONS.explore,
      ],
    },
    {
      name: i18n.t('label.max-message-size'),
      value: bytesToSize(maximumMessageSize ?? 0),
      isLink: false,
      visible: [
        DRAWER_NAVIGATION_OPTIONS.lineage,
        DRAWER_NAVIGATION_OPTIONS.explore,
      ],
    },
    {
      name: i18n.t('label.schema-type'),
      value: messageSchema?.schemaType ?? NO_DATA,
      isLink: false,
      visible: [
        DRAWER_NAVIGATION_OPTIONS.lineage,
        DRAWER_NAVIGATION_OPTIONS.explore,
      ],
    },
  ];

  return overview;
};

const getPipelineOverview = (pipelineDetails: Pipeline) => {
  const { owners, tags, sourceUrl, service, displayName, domains } =
    pipelineDetails;
  const tier = getTierTags(tags ?? []);
  const serviceDisplayName = getEntityName(service);

  const overview: BasicEntityOverviewInfo[] = [
    ...getCommonOverview({ owners, domains }),
    {
      name: `${i18n.t('label.pipeline')} ${i18n.t('label.url-uppercase')}`,
      dataTestId: 'pipeline-url-label',
      value: stringToHTML(displayName ?? '') || NO_DATA,
      url: sourceUrl,
      isLink: true,
      isExternal: true,
      visible: [
        DRAWER_NAVIGATION_OPTIONS.lineage,
        DRAWER_NAVIGATION_OPTIONS.explore,
      ],
    },
    {
      name: i18n.t('label.service'),
      value: serviceDisplayName || NO_DATA,
      url: getServiceDetailsPath(
        service?.name ?? '',
        ServiceCategory.PIPELINE_SERVICES
      ),
      isLink: true,
      isExternal: false,
      visible: [DRAWER_NAVIGATION_OPTIONS.lineage],
    },
    {
      name: i18n.t('label.tier'),
      value: entityTierRenderer(tier),
      isLink: false,
      visible: [DRAWER_NAVIGATION_OPTIONS.lineage],
    },
  ];

  return overview;
};

const getDashboardOverview = (dashboardDetails: Dashboard) => {
  const { owners, tags, sourceUrl, service, displayName, project, domains } =
    dashboardDetails;
  const tier = getTierTags(tags ?? []);
  const serviceDisplayName = getEntityName(service);

  const overview: BasicEntityOverviewInfo[] = [
    ...getCommonOverview({ owners, domains }),
    {
      name: `${i18n.t('label.dashboard')} ${i18n.t('label.url-uppercase')}`,
      value: stringToHTML(displayName ?? '') || NO_DATA,
      url: sourceUrl,
      isLink: true,
      isExternal: true,
      visible: [
        DRAWER_NAVIGATION_OPTIONS.lineage,
        DRAWER_NAVIGATION_OPTIONS.explore,
      ],
    },
    {
      name: i18n.t('label.service'),
      value: serviceDisplayName || NO_DATA,
      url: getServiceDetailsPath(
        service?.name ?? '',
        ServiceCategory.DASHBOARD_SERVICES
      ),
      isExternal: false,
      isLink: true,
      visible: [DRAWER_NAVIGATION_OPTIONS.lineage],
    },
    {
      name: i18n.t('label.tier'),
      value: entityTierRenderer(tier),
      isLink: false,
      isExternal: false,
      visible: [DRAWER_NAVIGATION_OPTIONS.lineage],
    },
    {
      name: i18n.t('label.project'),
      value: project ?? NO_DATA,
      isLink: false,
      visible: [
        DRAWER_NAVIGATION_OPTIONS.explore,
        DRAWER_NAVIGATION_OPTIONS.lineage,
      ],
    },
  ];

  return overview;
};

export const getSearchIndexOverview = (searchIndexDetails: SearchIndex) => {
  const { owners, tags, service, domains } = searchIndexDetails;
  const tier = getTierTags(tags ?? []);

  const overview: BasicEntityOverviewInfo[] = [
    ...getCommonOverview({ owners, domains }),
    {
      name: i18n.t('label.tier'),
      value: entityTierRenderer(tier),
      isLink: false,
      isExternal: false,
      visible: [DRAWER_NAVIGATION_OPTIONS.lineage],
    },
    {
      name: i18n.t('label.service'),
      value: service?.fullyQualifiedName ?? NO_DATA,
      url: getServiceDetailsPath(
        service?.name ?? '',
        ServiceCategory.SEARCH_SERVICES
      ),
      isExternal: false,
      isLink: true,
      visible: [DRAWER_NAVIGATION_OPTIONS.lineage],
    },
  ];

  return overview;
};

const getMlModelOverview = (mlModelDetails: Mlmodel) => {
  const { algorithm, target, server, dashboard, owners, domains } =
    mlModelDetails;

  const overview: BasicEntityOverviewInfo[] = [
    ...getCommonOverview({ owners, domains }),
    {
      name: i18n.t('label.algorithm'),
      value: algorithm || NO_DATA,
      url: '',
      isLink: false,
      visible: [
        DRAWER_NAVIGATION_OPTIONS.lineage,
        DRAWER_NAVIGATION_OPTIONS.explore,
      ],
    },
    {
      name: i18n.t('label.target'),
      value: target ?? NO_DATA,
      url: '',
      isLink: false,
      visible: [
        DRAWER_NAVIGATION_OPTIONS.lineage,
        DRAWER_NAVIGATION_OPTIONS.explore,
      ],
    },
    {
      name: i18n.t('label.server'),
      value: server ?? NO_DATA,
      url: server,
      isLink: Boolean(server),
      isExternal: true,
      visible: [
        DRAWER_NAVIGATION_OPTIONS.lineage,
        DRAWER_NAVIGATION_OPTIONS.explore,
      ],
    },
    {
      name: i18n.t('label.dashboard'),
      value: getEntityName(dashboard) || NO_DATA,
      url: getEntityDetailsPath(
        EntityType.DASHBOARD,
        dashboard?.fullyQualifiedName ?? ''
      ),
      isLink: true,
      isExternal: false,
      visible: [
        DRAWER_NAVIGATION_OPTIONS.lineage,
        DRAWER_NAVIGATION_OPTIONS.explore,
      ],
    },
  ];

  return overview;
};

const getContainerOverview = (containerDetails: Container) => {
  const { numberOfObjects, serviceType, dataModel, owners, domains } =
    containerDetails;

  const visible = [
    DRAWER_NAVIGATION_OPTIONS.lineage,
    DRAWER_NAVIGATION_OPTIONS.explore,
  ];

  const overview: BasicEntityOverviewInfo[] = [
    ...getCommonOverview({ owners, domains }),
    {
      name: i18n.t('label.object-plural'),
      value: numberOfObjects,
      isLink: false,
      visible,
    },
    {
      name: i18n.t('label.service-type'),
      value: serviceType,
      isLink: false,
      visible,
    },
    {
      name: i18n.t('label.column-plural'),
      value:
        !isUndefined(dataModel) && dataModel.columns
          ? dataModel.columns.length
          : NO_DATA,
      isLink: false,
      visible,
    },
  ];

  return overview;
};

const getChartOverview = (chartDetails: Chart) => {
  const {
    owners,
    sourceUrl,
    chartType,
    service,
    serviceType,
    displayName,
    domains,
  } = chartDetails;
  const serviceDisplayName = getEntityName(service);

  const overview: BasicEntityOverviewInfo[] = [
    ...getCommonOverview({ owners, domains }),
    {
      name: `${i18n.t('label.chart')} ${i18n.t('label.url-uppercase')}`,
      value: stringToHTML(displayName ?? '') || NO_DATA,
      url: sourceUrl,
      isLink: true,
      isExternal: true,
      visible: [
        DRAWER_NAVIGATION_OPTIONS.lineage,
        DRAWER_NAVIGATION_OPTIONS.explore,
      ],
    },
    {
      name: i18n.t('label.service'),
      value: serviceDisplayName || NO_DATA,
      url: getServiceDetailsPath(
        service?.name ?? '',
        ServiceCategory.DASHBOARD_SERVICES
      ),
      isExternal: false,
      isLink: true,
      visible: [
        DRAWER_NAVIGATION_OPTIONS.lineage,
        DRAWER_NAVIGATION_OPTIONS.explore,
      ],
    },
    {
      name: i18n.t('label.chart-type'),
      value: chartType ?? NO_DATA,
      isLink: false,
      visible: [
        DRAWER_NAVIGATION_OPTIONS.explore,
        DRAWER_NAVIGATION_OPTIONS.lineage,
      ],
    },
    {
      name: i18n.t('label.service-type'),
      value: serviceType ?? NO_DATA,
      isLink: false,
      visible: [
        DRAWER_NAVIGATION_OPTIONS.explore,
        DRAWER_NAVIGATION_OPTIONS.lineage,
      ],
    },
  ];

  return overview;
};

const getDataModelOverview = (dataModelDetails: DashboardDataModel) => {
  const {
    owners,
    tags,
    service,
    domains,
    displayName,
    dataModelType,
    fullyQualifiedName,
  } = dataModelDetails;
  const tier = getTierTags(tags ?? []);

  const overview: BasicEntityOverviewInfo[] = [
    ...getCommonOverview({ owners, domains }),
    {
      name: `${i18n.t('label.data-model')} ${i18n.t('label.url-uppercase')}`,
      value: stringToHTML(displayName ?? '') || NO_DATA,
      url: getEntityDetailsPath(
        EntityType.DASHBOARD_DATA_MODEL,
        fullyQualifiedName ?? ''
      ),
      isLink: true,
      visible: [
        DRAWER_NAVIGATION_OPTIONS.lineage,
        DRAWER_NAVIGATION_OPTIONS.explore,
      ],
    },
    {
      name: i18n.t('label.service'),
      value: service?.fullyQualifiedName ?? NO_DATA,
      url: getServiceDetailsPath(
        service?.name ?? '',
        ServiceCategory.DASHBOARD_SERVICES
      ),
      isExternal: false,
      isLink: true,
      visible: [
        DRAWER_NAVIGATION_OPTIONS.lineage,
        DRAWER_NAVIGATION_OPTIONS.explore,
      ],
    },

    {
      name: i18n.t('label.tier'),
      value: entityTierRenderer(tier),
      isLink: false,
      isExternal: false,
      visible: [
        DRAWER_NAVIGATION_OPTIONS.lineage,
        DRAWER_NAVIGATION_OPTIONS.explore,
      ],
    },
    {
      name: i18n.t('label.data-model-type'),
      value: dataModelType,
      isLink: false,
      isExternal: false,
      visible: [
        DRAWER_NAVIGATION_OPTIONS.lineage,
        DRAWER_NAVIGATION_OPTIONS.explore,
      ],
    },
  ];

  return overview;
};

const getStoredProcedureOverview = (
  storedProcedureDetails: StoredProcedure
) => {
  const { fullyQualifiedName, owners, tags, domains, storedProcedureCode } =
    storedProcedureDetails;
  const [service, database, schema] = getPartialNameFromTableFQN(
    fullyQualifiedName ?? '',
    [FqnPart.Service, FqnPart.Database, FqnPart.Schema],
    FQN_SEPARATOR_CHAR
  ).split(FQN_SEPARATOR_CHAR);

  const tier = getTierTags(tags ?? []);

  const overview: BasicEntityOverviewInfo[] = [
    ...getCommonOverview({ owners, domains }),
    {
      name: i18n.t('label.service'),
      value: service || NO_DATA,
      url: getServiceDetailsPath(service, ServiceCategory.DATABASE_SERVICES),
      isLink: true,
      visible: [DRAWER_NAVIGATION_OPTIONS.lineage],
    },
    {
      name: i18n.t('label.database'),
      value: database || NO_DATA,
      url: getEntityDetailsPath(
        EntityType.DATABASE,
        getPartialNameFromTableFQN(
          fullyQualifiedName ?? '',
          [FqnPart.Service, FqnPart.Database],
          FQN_SEPARATOR_CHAR
        )
      ),
      isLink: true,
      visible: [DRAWER_NAVIGATION_OPTIONS.lineage],
    },
    {
      name: i18n.t('label.schema'),
      value: schema || NO_DATA,
      url: getEntityDetailsPath(
        EntityType.DATABASE_SCHEMA,
        getPartialNameFromTableFQN(
          fullyQualifiedName ?? '',
          [FqnPart.Service, FqnPart.Database, FqnPart.Schema],
          FQN_SEPARATOR_CHAR
        )
      ),
      isLink: true,
      visible: [
        DRAWER_NAVIGATION_OPTIONS.lineage,
        DRAWER_NAVIGATION_OPTIONS.explore,
      ],
    },
    {
      name: i18n.t('label.tier'),
      value: entityTierRenderer(tier),
      isLink: false,
      visible: [
        DRAWER_NAVIGATION_OPTIONS.lineage,
        DRAWER_NAVIGATION_OPTIONS.explore,
      ],
    },
    ...(isObject(storedProcedureCode)
      ? [
          {
            name: i18n.t('label.language'),
            value:
              (storedProcedureCode as StoredProcedureCodeObject).language ??
              NO_DATA,
            isLink: false,
            visible: [
              DRAWER_NAVIGATION_OPTIONS.lineage,
              DRAWER_NAVIGATION_OPTIONS.explore,
            ],
          },
        ]
      : []),
  ];

  return overview;
};

const getDatabaseOverview = (databaseDetails: Database) => {
  const { owners, service, domains, tags, usageSummary } = databaseDetails;

  const tier = getTierTags(tags ?? []);

  const overview: BasicEntityOverviewInfo[] = [
    {
      name: i18n.t('label.owner-plural'),
      value: <OwnerLabel hasPermission={false} owners={owners} />,
      visible: [DRAWER_NAVIGATION_OPTIONS.explore],
    },
    ...getCommonOverview({ domains }, false),
    {
      name: i18n.t('label.tier'),
      value: entityTierRenderer(tier),
      isLink: false,
      visible: [DRAWER_NAVIGATION_OPTIONS.explore],
    },
    {
      name: i18n.t('label.service'),
      value: service?.fullyQualifiedName || NO_DATA,
      url: getServiceDetailsPath(
        service?.fullyQualifiedName ?? '',
        ServiceCategory.DATABASE_SERVICES
      ),
      isLink: true,
      visible: [DRAWER_NAVIGATION_OPTIONS.explore],
    },

    {
      name: i18n.t('label.usage'),
      value: getUsageData(usageSummary),
      isLink: false,
      visible: [DRAWER_NAVIGATION_OPTIONS.explore],
    },
  ];

  return overview;
};

const getDatabaseSchemaOverview = (databaseSchemaDetails: DatabaseSchema) => {
  const { owners, service, tags, domains, usageSummary, database } =
    databaseSchemaDetails;

  const tier = getTierTags(tags ?? []);

  const overview: BasicEntityOverviewInfo[] = [
    {
      name: i18n.t('label.owner-plural'),
      value: <OwnerLabel hasPermission={false} owners={owners} />,
      visible: [DRAWER_NAVIGATION_OPTIONS.explore],
    },
    ...getCommonOverview({ domains }, false),
    {
      name: i18n.t('label.tier'),
      value: entityTierRenderer(tier),
      isLink: false,
      visible: [DRAWER_NAVIGATION_OPTIONS.explore],
    },
    {
      name: i18n.t('label.service'),
      value: service?.fullyQualifiedName ?? NO_DATA,
      url: getServiceDetailsPath(
        service?.fullyQualifiedName ?? '',
        ServiceCategory.DATABASE_SERVICES
      ),
      isLink: true,
      visible: [DRAWER_NAVIGATION_OPTIONS.explore],
    },
    {
      name: i18n.t('label.database'),
      value: database?.fullyQualifiedName ?? NO_DATA,
      url: getEntityDetailsPath(
        EntityType.DATABASE,
        database?.fullyQualifiedName ?? ''
      ),
      isLink: true,
      visible: [DRAWER_NAVIGATION_OPTIONS.explore],
    },
    {
      name: i18n.t('label.usage'),
      value: getUsageData(usageSummary),
      isLink: false,
      visible: [DRAWER_NAVIGATION_OPTIONS.explore],
    },
  ];

  return overview;
};

const getEntityServiceOverview = (serviceDetails: EntityServiceUnion) => {
  const { owners, domains, tags, serviceType } = serviceDetails;

  const tier = getTierTags(tags ?? []);

  const overview: BasicEntityOverviewInfo[] = [
    {
      name: i18n.t('label.owner-plural'),
      value: <OwnerLabel hasPermission={false} owners={owners} />,
      visible: [DRAWER_NAVIGATION_OPTIONS.explore],
    },
    ...getCommonOverview({ domains }, false),
    {
      name: i18n.t('label.tier'),
      value: entityTierRenderer(tier),
      isLink: false,
      visible: [DRAWER_NAVIGATION_OPTIONS.explore],
    },
    {
      name: i18n.t('label.service-type'),
      value: serviceType,
      isLink: false,
      visible: [DRAWER_NAVIGATION_OPTIONS.explore],
    },
  ];

  return overview;
};

const getApiCollectionOverview = (apiCollection: APICollection) => {
  if (isNil(apiCollection) || isEmpty(apiCollection)) {
    return [];
  }

  const { service, domains } = apiCollection;

  const overview: BasicEntityOverviewInfo[] = [
    ...getCommonOverview({ domains }, false),
    {
      name: i18n.t('label.endpoint-url'),
      value: apiCollection.endpointURL || NO_DATA,
      url: apiCollection.endpointURL,
      isLink: true,
      isExternal: true,
      visible: [DRAWER_NAVIGATION_OPTIONS.explore],
    },
    {
      name: i18n.t('label.service'),
      value: service?.fullyQualifiedName ?? NO_DATA,
      url: getServiceDetailsPath(
        service?.fullyQualifiedName ?? '',
        ServiceCategory.API_SERVICES
      ),
      isLink: true,
      visible: [DRAWER_NAVIGATION_OPTIONS.explore],
    },
  ];

  return overview;
};
const getApiEndpointOverview = (apiEndpoint: APIEndpoint) => {
  if (isNil(apiEndpoint) || isEmpty(apiEndpoint)) {
    return [];
  }
  const { service, apiCollection, domains } = apiEndpoint;

  const overview: BasicEntityOverviewInfo[] = [
    ...getCommonOverview({ domains }, false),
    {
      name: i18n.t('label.endpoint-url'),
      value: apiEndpoint.endpointURL || NO_DATA,
      url: apiEndpoint.endpointURL,
      isLink: true,
      isExternal: true,
      visible: [
        DRAWER_NAVIGATION_OPTIONS.explore,
        DRAWER_NAVIGATION_OPTIONS.lineage,
      ],
    },
    {
      name: i18n.t('label.api-collection'),
      value: apiEndpoint.apiCollection?.fullyQualifiedName ?? '',
      url: getEntityDetailsPath(
        EntityType.API_COLLECTION,
        apiCollection?.fullyQualifiedName ?? ''
      ),
      isLink: true,
      visible: [
        DRAWER_NAVIGATION_OPTIONS.explore,
        DRAWER_NAVIGATION_OPTIONS.lineage,
      ],
    },
    {
      name: i18n.t('label.service'),
      value: service?.fullyQualifiedName ?? '',
      url: getServiceDetailsPath(
        service?.fullyQualifiedName ?? '',
        ServiceCategory.API_SERVICES
      ),
      isLink: true,
      visible: [
        DRAWER_NAVIGATION_OPTIONS.explore,
        DRAWER_NAVIGATION_OPTIONS.lineage,
      ],
    },
    {
      name: i18n.t('label.request-method'),
      value: apiEndpoint.requestMethod || NO_DATA,
      isLink: false,
      visible: [
        DRAWER_NAVIGATION_OPTIONS.explore,
        DRAWER_NAVIGATION_OPTIONS.lineage,
      ],
    },
  ];

  return overview;
};
const getMetricOverview = (metric: Metric) => {
  if (isNil(metric) || isEmpty(metric)) {
    return [];
  }

  const overview: BasicEntityOverviewInfo[] = [
    ...getCommonOverview({ domains: metric.domains }, false),
    {
      name: i18n.t('label.metric-type'),
      value: metric.metricType || NO_DATA,
      isLink: false,
      visible: [
        DRAWER_NAVIGATION_OPTIONS.explore,
        DRAWER_NAVIGATION_OPTIONS.lineage,
      ],
    },
    {
      name: i18n.t('label.unit-of-measurement'),
      value: metric.unitOfMeasurement || NO_DATA,
      isLink: false,
      visible: [
        DRAWER_NAVIGATION_OPTIONS.explore,
        DRAWER_NAVIGATION_OPTIONS.lineage,
      ],
    },
    {
      name: i18n.t('label.granularity'),
      value: metric.granularity || NO_DATA,
      isLink: false,
      visible: [
        DRAWER_NAVIGATION_OPTIONS.explore,
        DRAWER_NAVIGATION_OPTIONS.lineage,
      ],
    },
  ];

  return overview;
};

const getDirectoryOverview = (directoryDetails: Directory) => {
  const {
    numberOfSubDirectories,
    numberOfFiles,
    serviceType,
    owners,
    domains,
  } = directoryDetails;

  const visible = [
    DRAWER_NAVIGATION_OPTIONS.lineage,
    DRAWER_NAVIGATION_OPTIONS.explore,
  ];

  const overview: BasicEntityOverviewInfo[] = [
    ...getCommonOverview({ owners, domains }),
    {
      name: i18n.t('label.directory-plural'),
      value: numberOfSubDirectories ?? NO_DATA,
      isLink: false,
      visible,
    },
    {
      name: i18n.t('label.file-plural'),
      value: numberOfFiles ?? NO_DATA,
      isLink: false,
      visible,
    },
    {
      name: i18n.t('label.service-type'),
      value: serviceType,
      isLink: false,
      visible,
    },
  ];

  return overview;
};

const getFileOverview = (fileDetails: File) => {
  const { fileExtension, fileType, fileVersion, serviceType, owners, domains } =
    fileDetails;

  const visible = [
    DRAWER_NAVIGATION_OPTIONS.lineage,
    DRAWER_NAVIGATION_OPTIONS.explore,
  ];

  const overview: BasicEntityOverviewInfo[] = [
    ...getCommonOverview({ owners, domains }),
    {
      name: i18n.t('label.file-extension'),
      value: fileExtension ?? NO_DATA,
      isLink: false,
      visible,
    },
    {
      name: i18n.t('label.file-type'),
      value: fileType ?? NO_DATA,
      isLink: false,
      visible,
    },
    {
      name: i18n.t('label.file-version'),
      value: fileVersion ?? NO_DATA,
      isLink: false,
      visible,
    },
    {
      name: i18n.t('label.service-type'),
      value: serviceType,
      isLink: false,
      visible,
    },
  ];

  return overview;
};

const getSpreadsheetOverview = (spreadsheetDetails: Spreadsheet) => {
  const { fileVersion, serviceType, owners, domains } = spreadsheetDetails;

  const visible = [
    DRAWER_NAVIGATION_OPTIONS.lineage,
    DRAWER_NAVIGATION_OPTIONS.explore,
  ];

  const overview: BasicEntityOverviewInfo[] = [
    ...getCommonOverview({ owners, domains }),
    {
      name: i18n.t('label.file-version'),
      value: fileVersion ?? NO_DATA,
      isLink: false,
      visible,
    },
    {
      name: i18n.t('label.service-type'),
      value: serviceType,
      isLink: false,
      visible,
    },
  ];

  return overview;
};

const getWorksheetOverview = (worksheetDetails: Worksheet) => {
  const { columnCount, rowCount, serviceType, owners, domains } =
    worksheetDetails;

  const visible = [
    DRAWER_NAVIGATION_OPTIONS.lineage,
    DRAWER_NAVIGATION_OPTIONS.explore,
  ];

  const overview: BasicEntityOverviewInfo[] = [
    ...getCommonOverview({ owners, domains }),
    {
      name: i18n.t('label.column-plural'),
      value: columnCount ?? NO_DATA,
      isLink: false,
      visible,
    },
    {
      name: i18n.t('label.row-plural'),
      value: rowCount ?? NO_DATA,
      isLink: false,
      visible,
    },
    {
      name: i18n.t('label.service-type'),
      value: serviceType,
      isLink: false,
      visible,
    },
  ];

  return overview;
};

const getColumnOverview = (
  columnDetails: ColumnSearchResult
): BasicEntityOverviewInfo[] => {
  const {
    dataType,
    dataTypeDisplay,
    constraint,
    table,
    service,
    database,
    databaseSchema,
    owners,
    domains,
  } = columnDetails;

  const overview: BasicEntityOverviewInfo[] = [
    ...getCommonOverview({ owners, domains }),
    {
      name: i18n.t('label.data-type'),
      value: dataTypeDisplay || dataType || '--',
      isLink: false,
      visible: [
        DRAWER_NAVIGATION_OPTIONS.lineage,
        DRAWER_NAVIGATION_OPTIONS.explore,
      ],
    },
    {
      name: i18n.t('label.table'),
      value: table?.displayName || table?.name || '--',
      url: table?.fullyQualifiedName
        ? getEntityDetailsPath(EntityType.TABLE, table.fullyQualifiedName)
        : undefined,
      isLink: !!table?.fullyQualifiedName,
      visible: [
        DRAWER_NAVIGATION_OPTIONS.lineage,
        DRAWER_NAVIGATION_OPTIONS.explore,
      ],
    },
    {
      name: i18n.t('label.service'),
      value: service?.displayName || service?.name || '--',
      url: service?.fullyQualifiedName
        ? getServiceDetailsPath(service.fullyQualifiedName, service.type || '')
        : undefined,
      isLink: !!service?.fullyQualifiedName,
      visible: [
        DRAWER_NAVIGATION_OPTIONS.lineage,
        DRAWER_NAVIGATION_OPTIONS.explore,
      ],
    },
    {
      name: i18n.t('label.database'),
      value: database?.displayName || database?.name || '--',
      url: database?.fullyQualifiedName
        ? getEntityDetailsPath(EntityType.DATABASE, database.fullyQualifiedName)
        : undefined,
      isLink: !!database?.fullyQualifiedName,
      visible: [
        DRAWER_NAVIGATION_OPTIONS.lineage,
        DRAWER_NAVIGATION_OPTIONS.explore,
      ],
    },
    {
      name: i18n.t('label.schema'),
      value: databaseSchema?.displayName || databaseSchema?.name || '--',
      url: databaseSchema?.fullyQualifiedName
        ? getEntityDetailsPath(
            EntityType.DATABASE_SCHEMA,
            databaseSchema.fullyQualifiedName
          )
        : undefined,
      isLink: !!databaseSchema?.fullyQualifiedName,
      visible: [
        DRAWER_NAVIGATION_OPTIONS.lineage,
        DRAWER_NAVIGATION_OPTIONS.explore,
      ],
    },
  ];

  if (constraint) {
    overview.push({
      name: i18n.t('label.constraint'),
      value: constraint,
      isLink: false,
      visible: [
        DRAWER_NAVIGATION_OPTIONS.lineage,
        DRAWER_NAVIGATION_OPTIONS.explore,
      ],
    });
  }

  return overview;
};

export const getEntityOverview = (
  type: string,
  entityDetail: DataAssetSummaryPanelProps['dataAsset'],
  additionalInfo?: Record<string, number | string>
): Array<BasicEntityOverviewInfo> => {
  switch (type) {
    case ExplorePageTabs.TABLES:
    case EntityType.TABLE: {
      return getTableOverview(entityDetail as Table, additionalInfo);
    }

    case ExplorePageTabs.COLUMNS:
    case EntityType.TABLE_COLUMN: {
      return getColumnOverview(entityDetail as unknown as ColumnSearchResult);
    }

    case ExplorePageTabs.TOPICS:
    case EntityType.TOPIC: {
      return getTopicOverview(entityDetail as Topic);
    }

    case ExplorePageTabs.PIPELINES:
    case EntityType.PIPELINE: {
      return getPipelineOverview(entityDetail as Pipeline);
    }

    case ExplorePageTabs.DASHBOARDS:
    case EntityType.DASHBOARD: {
      return getDashboardOverview(entityDetail as Dashboard);
    }

    case ExplorePageTabs.SEARCH_INDEX:
    case EntityType.SEARCH_INDEX: {
      return getSearchIndexOverview(entityDetail as SearchIndex);
    }

    case ExplorePageTabs.MLMODELS:
    case EntityType.MLMODEL: {
      return getMlModelOverview(entityDetail as Mlmodel);
    }
    case ExplorePageTabs.CONTAINERS:
    case EntityType.CONTAINER: {
      return getContainerOverview(entityDetail as Container);
    }
    case ExplorePageTabs.CHARTS:
    case EntityType.CHART: {
      return getChartOverview(entityDetail as Chart);
    }

    case ExplorePageTabs.DASHBOARD_DATA_MODEL:
    case EntityType.DASHBOARD_DATA_MODEL: {
      return getDataModelOverview(entityDetail as DashboardDataModel);
    }

    case ExplorePageTabs.STORED_PROCEDURE:
    case EntityType.STORED_PROCEDURE: {
      return getStoredProcedureOverview(entityDetail as StoredProcedure);
    }

    case ExplorePageTabs.DATABASE:
    case EntityType.DATABASE: {
      return getDatabaseOverview(entityDetail as Database);
    }

    case ExplorePageTabs.DATABASE_SCHEMA:
    case EntityType.DATABASE_SCHEMA: {
      return getDatabaseSchemaOverview(entityDetail as DatabaseSchema);
    }

    case ExplorePageTabs.API_COLLECTION:
    case EntityType.API_COLLECTION: {
      return getApiCollectionOverview(entityDetail as APICollection);
    }

    case ExplorePageTabs.API_ENDPOINT:
    case EntityType.API_ENDPOINT: {
      return getApiEndpointOverview(entityDetail as APIEndpoint);
    }

    case ExplorePageTabs.METRIC:
    case EntityType.METRIC: {
      return getMetricOverview(entityDetail as Metric);
    }

    case ExplorePageTabs.DIRECTORIES:
    case EntityType.DIRECTORY: {
      return getDirectoryOverview(entityDetail as Directory);
    }

    case ExplorePageTabs.FILES:
    case EntityType.FILE: {
      return getFileOverview(entityDetail as unknown as File);
    }

    case ExplorePageTabs.SPREADSHEETS:
    case EntityType.SPREADSHEET: {
      return getSpreadsheetOverview(entityDetail as Spreadsheet);
    }

    case ExplorePageTabs.WORKSHEETS:
    case EntityType.WORKSHEET: {
      return getWorksheetOverview(entityDetail as Worksheet);
    }

    case ExplorePageTabs.DATABASE_SERVICE:
    case ExplorePageTabs.MESSAGING_SERVICE:
    case ExplorePageTabs.DASHBOARD_SERVICE:
    case ExplorePageTabs.ML_MODEL_SERVICE:
    case ExplorePageTabs.PIPELINE_SERVICE:
    case ExplorePageTabs.SEARCH_INDEX_SERVICE:
    case ExplorePageTabs.API_SERVICE:
    case EntityType.DATABASE_SERVICE:
    case EntityType.MESSAGING_SERVICE:
    case EntityType.DASHBOARD_SERVICE:
    case EntityType.MLMODEL_SERVICE:
    case EntityType.PIPELINE_SERVICE:
    case EntityType.SEARCH_SERVICE:
    case EntityType.API_SERVICE: {
      return getEntityServiceOverview(entityDetail as EntityServiceUnion);
    }

    default:
      return [];
  }
};
