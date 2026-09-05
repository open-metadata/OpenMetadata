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
import { lazy } from 'react';
import withSuspenseFallback from '../components/AppRouter/withSuspenseFallback';
import { DomainLabel } from '../components/common/DomainLabel/DomainLabel.component';
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
import {
  ColumnSearchResult,
  getTableFieldsFromTableDetails,
  getUsageData,
} from './DataAssetSummaryPanelPureUtils';
import { getEntityName } from './EntityNameUtils';
import { DRAWER_NAVIGATION_OPTIONS } from './EntityPureUtils';
import { BasicEntityOverviewInfo } from './EntityUtils.interface';
import { getPartialNameFromTableFQN } from './FqnUtils';
import i18n from './i18next/LocalUtil';
import { formatNumberWithComma } from './NumberUtils';
import { getEntityDetailsPath, getServiceDetailsPath } from './RouterUtils';
import { bytesToSize, stringToHTML } from './StringUtils';
import { getTierTags } from './TablePureUtils';

const OwnerLabel = withSuspenseFallback(
  lazy(() =>
    import('../components/common/OwnerLabel/OwnerLabel.component').then(
      (m) => ({ default: m.OwnerLabel })
    )
  )
);

const entityTierRenderer = (tier?: TagLabel) => {
  return tier ? (
    <TagsV1 startWith={TAG_START_WITH.SOURCE_ICON} tag={tier} />
  ) : (
    NO_DATA
  );
};

const orNoData = (value?: string | number) => value || NO_DATA;

const displayNameOrDash = (entity?: { displayName?: string; name?: string }) =>
  entity?.displayName || entity?.name || '--';

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

  const fqn = fullyQualifiedName ?? '';
  const tableId = tableDetails.id || '';

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
      value: orNoData(service),
      url: getServiceDetailsPath(service, ServiceCategory.DATABASE_SERVICES),
      isLink: true,
      visible: [DRAWER_NAVIGATION_OPTIONS.lineage],
    },
    {
      name: i18n.t('label.database'),
      value: orNoData(database),
      url: getEntityDetailsPath(
        EntityType.DATABASE,
        getPartialNameFromTableFQN(
          fqn,
          [FqnPart.Service, FqnPart.Database],
          FQN_SEPARATOR_CHAR
        )
      ),
      isLink: true,
      visible: [DRAWER_NAVIGATION_OPTIONS.lineage],
    },
    {
      name: i18n.t('label.schema'),
      value: orNoData(schema),
      url: getEntityDetailsPath(
        EntityType.DATABASE_SCHEMA,
        getPartialNameFromTableFQN(
          fqn,
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
      value: orNoData(usage),
      isLink: false,
      visible: [DRAWER_NAVIGATION_OPTIONS.lineage],
    },
    {
      name: i18n.t('label.query-plural'),
      value: <QueryCount tableId={tableId} />,
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
          fqn,
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
      value: displayNameOrDash(table),
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
      value: displayNameOrDash(service),
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
      value: displayNameOrDash(database),
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
      value: displayNameOrDash(databaseSchema),
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

type OverviewBuilder = (
  entityDetail: DataAssetSummaryPanelProps['dataAsset'],
  additionalInfo?: Record<string, number | string>
) => BasicEntityOverviewInfo[];

// Each entry maps the set of type identifiers (Explore tab + entity type) that
// share an overview builder — mirrors the fall-through cases of the original
// switch. Built via fromEntries so overlapping enum string values (e.g. an
// Explore tab equal to its entity type) collapse to a single key rather than
// erroring as duplicate object-literal properties.
const OVERVIEW_BUILDER_ENTRIES: Array<[string[], OverviewBuilder]> = [
  [
    [ExplorePageTabs.TABLES, EntityType.TABLE],
    (detail, additionalInfo) =>
      getTableOverview(detail as Table, additionalInfo),
  ],
  [
    [ExplorePageTabs.COLUMNS, EntityType.TABLE_COLUMN],
    (detail) => getColumnOverview(detail as unknown as ColumnSearchResult),
  ],
  [
    [ExplorePageTabs.TOPICS, EntityType.TOPIC],
    (detail) => getTopicOverview(detail as Topic),
  ],
  [
    [ExplorePageTabs.PIPELINES, EntityType.PIPELINE],
    (detail) => getPipelineOverview(detail as Pipeline),
  ],
  [
    [ExplorePageTabs.DASHBOARDS, EntityType.DASHBOARD],
    (detail) => getDashboardOverview(detail as Dashboard),
  ],
  [
    [ExplorePageTabs.SEARCH_INDEX, EntityType.SEARCH_INDEX],
    (detail) => getSearchIndexOverview(detail as SearchIndex),
  ],
  [
    [ExplorePageTabs.MLMODELS, EntityType.MLMODEL],
    (detail) => getMlModelOverview(detail as Mlmodel),
  ],
  [
    [ExplorePageTabs.CONTAINERS, EntityType.CONTAINER],
    (detail) => getContainerOverview(detail as Container),
  ],
  [
    [ExplorePageTabs.CHARTS, EntityType.CHART],
    (detail) => getChartOverview(detail as Chart),
  ],
  [
    [ExplorePageTabs.DASHBOARD_DATA_MODEL, EntityType.DASHBOARD_DATA_MODEL],
    (detail) => getDataModelOverview(detail as DashboardDataModel),
  ],
  [
    [ExplorePageTabs.STORED_PROCEDURE, EntityType.STORED_PROCEDURE],
    (detail) => getStoredProcedureOverview(detail as StoredProcedure),
  ],
  [
    [ExplorePageTabs.DATABASE, EntityType.DATABASE],
    (detail) => getDatabaseOverview(detail as Database),
  ],
  [
    [ExplorePageTabs.DATABASE_SCHEMA, EntityType.DATABASE_SCHEMA],
    (detail) => getDatabaseSchemaOverview(detail as DatabaseSchema),
  ],
  [
    [ExplorePageTabs.API_COLLECTION, EntityType.API_COLLECTION],
    (detail) => getApiCollectionOverview(detail as APICollection),
  ],
  [
    [ExplorePageTabs.API_ENDPOINT, EntityType.API_ENDPOINT],
    (detail) => getApiEndpointOverview(detail as APIEndpoint),
  ],
  [
    [ExplorePageTabs.METRIC, EntityType.METRIC],
    (detail) => getMetricOverview(detail as Metric),
  ],
  [
    [ExplorePageTabs.DIRECTORIES, EntityType.DIRECTORY],
    (detail) => getDirectoryOverview(detail as Directory),
  ],
  [
    [ExplorePageTabs.FILES, EntityType.FILE],
    (detail) => getFileOverview(detail as unknown as File),
  ],
  [
    [ExplorePageTabs.SPREADSHEETS, EntityType.SPREADSHEET],
    (detail) => getSpreadsheetOverview(detail as Spreadsheet),
  ],
  [
    [ExplorePageTabs.WORKSHEETS, EntityType.WORKSHEET],
    (detail) => getWorksheetOverview(detail as Worksheet),
  ],
  [
    [
      ExplorePageTabs.DATABASE_SERVICE,
      ExplorePageTabs.MESSAGING_SERVICE,
      ExplorePageTabs.DASHBOARD_SERVICE,
      ExplorePageTabs.ML_MODEL_SERVICE,
      ExplorePageTabs.PIPELINE_SERVICE,
      ExplorePageTabs.SEARCH_INDEX_SERVICE,
      ExplorePageTabs.API_SERVICE,
      EntityType.DATABASE_SERVICE,
      EntityType.MESSAGING_SERVICE,
      EntityType.DASHBOARD_SERVICE,
      EntityType.MLMODEL_SERVICE,
      EntityType.PIPELINE_SERVICE,
      EntityType.SEARCH_SERVICE,
      EntityType.API_SERVICE,
    ],
    (detail) => getEntityServiceOverview(detail as EntityServiceUnion),
  ],
];

const ENTITY_OVERVIEW_BUILDERS: Record<string, OverviewBuilder> =
  Object.fromEntries(
    OVERVIEW_BUILDER_ENTRIES.flatMap(([types, builder]) =>
      types.map((type) => [type, builder] as const)
    )
  );

export const getEntityOverview = (
  type: string,
  entityDetail: DataAssetSummaryPanelProps['dataAsset'],
  additionalInfo?: Record<string, number | string>
): Array<BasicEntityOverviewInfo> => {
  const builder = ENTITY_OVERVIEW_BUILDERS[type];

  return builder ? builder(entityDetail, additionalInfo) : [];
};
