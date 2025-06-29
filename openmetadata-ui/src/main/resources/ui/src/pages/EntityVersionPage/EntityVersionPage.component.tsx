/*
 *  Copyright 2022 Collate.
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

import { isEmpty } from 'lodash';
import {
  FunctionComponent,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import APIEndpointVersion from '../../components/APIEndpoint/APIEndpointVersion/APIEndpointVersion';
import ErrorPlaceHolder from '../../components/common/ErrorWithPlaceholder/ErrorPlaceHolder';
import Loader from '../../components/common/Loader/Loader';
import ContainerVersion from '../../components/Container/ContainerVersion/ContainerVersion.component';
import DashboardVersion from '../../components/Dashboard/DashboardVersion/DashboardVersion.component';
import DataModelVersion from '../../components/Dashboard/DataModel/DataModelVersion/DataModelVersion.component';
import StoredProcedureVersion from '../../components/Database/StoredProcedureVersion/StoredProcedureVersion.component';
import TableVersion from '../../components/Database/TableVersion/TableVersion.component';
import DataProductsPage from '../../components/DataProducts/DataProductsPage/DataProductsPage.component';
import MetricVersion from '../../components/Metric/MetricVersion/MetricVersion';
import MlModelVersion from '../../components/MlModel/MlModelVersion/MlModelVersion.component';
import PageLayoutV1 from '../../components/PageLayoutV1/PageLayoutV1';
import PipelineVersion from '../../components/Pipeline/PipelineVersion/PipelineVersion.component';
import SearchIndexVersion from '../../components/SearchIndexVersion/SearchIndexVersion';
import TopicVersion from '../../components/Topic/TopicVersion/TopicVersion.component';
import { usePermissionProvider } from '../../context/PermissionProvider/PermissionProvider';
import {
  OperationPermission,
  ResourceEntity,
} from '../../context/PermissionProvider/PermissionProvider.interface';
import { ERROR_PLACEHOLDER_TYPE } from '../../enums/common.enum';
import { EntityTabs, EntityType } from '../../enums/entity.enum';
import { APIEndpoint } from '../../generated/entity/data/apiEndpoint';
import { Container } from '../../generated/entity/data/container';
import { Dashboard } from '../../generated/entity/data/dashboard';
import { DashboardDataModel } from '../../generated/entity/data/dashboardDataModel';
import { Metric } from '../../generated/entity/data/metric';
import { Mlmodel } from '../../generated/entity/data/mlmodel';
import { Pipeline } from '../../generated/entity/data/pipeline';
import { SearchIndex } from '../../generated/entity/data/searchIndex';
import { StoredProcedure } from '../../generated/entity/data/storedProcedure';
import { Table } from '../../generated/entity/data/table';
import { Topic } from '../../generated/entity/data/topic';
import { EntityHistory } from '../../generated/type/entityHistory';
import { Include } from '../../generated/type/include';
import { TagLabel } from '../../generated/type/tagLabel';
import { useFqn } from '../../hooks/useFqn';
import {
  getApiEndPointByFQN,
  getApiEndPointVersion,
  getApiEndPointVersions,
} from '../../rest/apiEndpointsAPI';
import {
  getDashboardByFqn,
  getDashboardVersion,
  getDashboardVersions,
} from '../../rest/dashboardAPI';
import {
  getDataModelByFqn,
  getDataModelVersion,
  getDataModelVersionsList,
} from '../../rest/dataModelsAPI';
import {
  getMetricByFqn,
  getMetricVersion,
  getMetricVersions,
} from '../../rest/metricsAPI';
import {
  getMlModelByFQN,
  getMlModelVersion,
  getMlModelVersions,
} from '../../rest/mlModelAPI';
import {
  getPipelineByFqn,
  getPipelineVersion,
  getPipelineVersions,
} from '../../rest/pipelineAPI';
import {
  getSearchIndexDetailsByFQN,
  getSearchIndexVersion,
  getSearchIndexVersions,
} from '../../rest/SearchIndexAPI';
import {
  getContainerByName,
  getContainerVersion,
  getContainerVersions,
} from '../../rest/storageAPI';
import {
  getStoredProceduresByFqn,
  getStoredProceduresVersion,
  getStoredProceduresVersionsList,
} from '../../rest/storedProceduresAPI';
import {
  getTableDetailsByFQN,
  getTableVersion,
  getTableVersions,
} from '../../rest/tableAPI';
import {
  getTopicByFqn,
  getTopicVersion,
  getTopicVersions,
} from '../../rest/topicsAPI';
import entityUtilClassBase from '../../utils/EntityUtilClassBase';
import { getEntityBreadcrumbs, getEntityName } from '../../utils/EntityUtils';
import { DEFAULT_ENTITY_PERMISSION } from '../../utils/PermissionsUtils';
import { getEntityDetailsPath, getVersionPath } from '../../utils/RouterUtils';
import { getTierTags } from '../../utils/TableUtils';
import { useRequiredParams } from '../../utils/useRequiredParams';
import APICollectionVersionPage from '../APICollectionPage/APICollectionVersionPage';
import DatabaseSchemaVersionPage from '../DatabaseSchemaVersionPage/DatabaseSchemaVersionPage';
import DatabaseVersionPage from '../DatabaseVersionPage/DatabaseVersionPage';
import './EntityVersionPage.less';

export type VersionData =
  | Table
  | Topic
  | Dashboard
  | Pipeline
  | Mlmodel
  | Container
  | SearchIndex
  | StoredProcedure
  | DashboardDataModel
  | APIEndpoint
  | Metric;

const EntityVersionPage: FunctionComponent = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [entityId, setEntityId] = useState<string>('');
  const [currentVersionData, setCurrentVersionData] = useState<VersionData>(
    {} as VersionData
  );

  const { entityType, version, tab } = useRequiredParams<{
    entityType: EntityType;
    version: string;
    tab: EntityTabs;
  }>();

  const { fqn: decodedEntityFQN } = useFqn();

  const { getEntityPermissionByFqn } = usePermissionProvider();
  const [entityPermissions, setEntityPermissions] =
    useState<OperationPermission>(DEFAULT_ENTITY_PERMISSION);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [versionList, setVersionList] = useState<EntityHistory>(
    {} as EntityHistory
  );
  const [isVersionLoading, setIsVersionLoading] = useState<boolean>(true);

  const backHandler = useCallback(
    () => navigate(getEntityDetailsPath(entityType, decodedEntityFQN, tab)),
    [entityType, decodedEntityFQN, tab]
  );

  const versionHandler = useCallback(
    (newVersion = version) => {
      if (tab) {
        navigate(getVersionPath(entityType, decodedEntityFQN, newVersion, tab));
      } else {
        navigate(getVersionPath(entityType, decodedEntityFQN, newVersion));
      }
    },
    [entityType, decodedEntityFQN, tab]
  );

  const fetchResourcePermission = useCallback(
    async (resourceEntity: ResourceEntity) => {
      if (!isEmpty(decodedEntityFQN)) {
        try {
          const permission = await getEntityPermissionByFqn(
            resourceEntity,
            decodedEntityFQN
          );

          setEntityPermissions(permission);
        } catch {
          //
        }
      }
    },
    [decodedEntityFQN, getEntityPermissionByFqn, setEntityPermissions]
  );

  const fetchEntityPermissions = useCallback(async () => {
    setIsLoading(true);
    try {
      await fetchResourcePermission(
        entityUtilClassBase.getResourceEntityFromEntityType(
          entityType
        ) as ResourceEntity
      );
    } finally {
      setIsLoading(false);
    }
  }, [entityType, fetchResourcePermission]);

  const viewVersionPermission = useMemo(
    () => entityPermissions.ViewAll || entityPermissions.ViewBasic,
    [entityPermissions]
  );

  const fetchEntityVersions = useCallback(async () => {
    setIsLoading(true);
    try {
      switch (entityType) {
        case EntityType.TABLE: {
          const { id } = await getTableDetailsByFQN(decodedEntityFQN, {
            include: Include.All,
          });

          setEntityId(id);

          const versions = await getTableVersions(id);

          setVersionList(versions);

          break;
        }

        case EntityType.TOPIC: {
          const { id } = await getTopicByFqn(decodedEntityFQN, {
            include: Include.All,
          });

          setEntityId(id);

          const versions = await getTopicVersions(id);

          setVersionList(versions);

          break;
        }

        case EntityType.DASHBOARD: {
          const { id } = await getDashboardByFqn(decodedEntityFQN, {
            include: Include.All,
          });

          setEntityId(id);

          const versions = await getDashboardVersions(id);

          setVersionList(versions);

          break;
        }

        case EntityType.PIPELINE: {
          const { id } = await getPipelineByFqn(decodedEntityFQN, {
            include: Include.All,
          });

          setEntityId(id);

          const versions = await getPipelineVersions(id);

          setVersionList(versions);

          break;
        }

        case EntityType.MLMODEL: {
          const { id } = await getMlModelByFQN(decodedEntityFQN, {
            include: Include.All,
          });

          setEntityId(id);

          const versions = await getMlModelVersions(id);

          setVersionList(versions);

          break;
        }

        case EntityType.CONTAINER: {
          const { id } = await getContainerByName(decodedEntityFQN, {
            include: Include.All,
          });

          setEntityId(id);

          const versions = await getContainerVersions(id);

          setVersionList(versions);

          break;
        }

        case EntityType.SEARCH_INDEX: {
          const { id } = await getSearchIndexDetailsByFQN(decodedEntityFQN, {
            include: Include.All,
          });

          setEntityId(id);

          const versions = await getSearchIndexVersions(id);

          setVersionList(versions);

          break;
        }

        case EntityType.DASHBOARD_DATA_MODEL: {
          const { id } = await getDataModelByFqn(decodedEntityFQN, {
            include: Include.All,
          });

          setEntityId(id ?? '');

          const versions = await getDataModelVersionsList(id ?? '');

          setVersionList(versions);

          break;
        }

        case EntityType.STORED_PROCEDURE: {
          const { id } = await getStoredProceduresByFqn(decodedEntityFQN, {
            include: Include.All,
          });

          setEntityId(id ?? '');

          const versions = await getStoredProceduresVersionsList(id ?? '');

          setVersionList(versions);

          break;
        }
        case EntityType.API_ENDPOINT: {
          const { id } = await getApiEndPointByFQN(decodedEntityFQN, {
            include: Include.All,
          });

          setEntityId(id ?? '');

          const versions = await getApiEndPointVersions(id ?? '');

          setVersionList(versions);

          break;
        }
        case EntityType.METRIC: {
          const { id } = await getMetricByFqn(decodedEntityFQN, {
            include: Include.All,
          });

          setEntityId(id ?? '');

          const versions = await getMetricVersions(id ?? '');

          setVersionList(versions);

          break;
        }

        default:
          break;
      }
    } finally {
      setIsLoading(false);
    }
  }, [entityType, decodedEntityFQN, viewVersionPermission]);

  const fetchCurrentVersion = useCallback(
    async (id: string) => {
      setIsVersionLoading(true);
      try {
        if (viewVersionPermission) {
          switch (entityType) {
            case EntityType.TABLE: {
              const currentVersion = await getTableVersion(id, version);

              setCurrentVersionData(currentVersion);

              break;
            }

            case EntityType.TOPIC: {
              const currentVersion = await getTopicVersion(id, version);

              setCurrentVersionData(currentVersion);

              break;
            }
            case EntityType.DASHBOARD: {
              const currentVersion = await getDashboardVersion(id, version);

              setCurrentVersionData(currentVersion);

              break;
            }
            case EntityType.PIPELINE: {
              const currentVersion = await getPipelineVersion(id, version);

              setCurrentVersionData(currentVersion);

              break;
            }

            case EntityType.MLMODEL: {
              const currentVersion = await getMlModelVersion(id, version);

              setCurrentVersionData(currentVersion);

              break;
            }
            case EntityType.CONTAINER: {
              const currentVersion = await getContainerVersion(id, version);

              setCurrentVersionData(currentVersion);

              break;
            }
            case EntityType.SEARCH_INDEX: {
              const currentVersion = await getSearchIndexVersion(id, version);

              setCurrentVersionData(currentVersion);

              break;
            }

            case EntityType.DASHBOARD_DATA_MODEL: {
              const currentVersion = await getDataModelVersion(id, version);

              setCurrentVersionData(currentVersion);

              break;
            }

            case EntityType.STORED_PROCEDURE: {
              const currentVersion = await getStoredProceduresVersion(
                id,
                version
              );

              setCurrentVersionData(currentVersion);

              break;
            }
            case EntityType.API_ENDPOINT: {
              const currentVersion = await getApiEndPointVersion(id, version);

              setCurrentVersionData(currentVersion);

              break;
            }
            case EntityType.METRIC: {
              const currentVersion = await getMetricVersion(id, version);

              setCurrentVersionData(currentVersion);

              break;
            }

            default:
              break;
          }
        }
      } finally {
        setIsVersionLoading(false);
      }
    },
    [entityType, version, viewVersionPermission]
  );

  const { owners, domain, tier, slashedEntityName } = useMemo(() => {
    return {
      owners: currentVersionData.owners,
      tier: getTierTags(currentVersionData.tags ?? []),
      domain: currentVersionData.domain,
      slashedEntityName: getEntityBreadcrumbs(currentVersionData, entityType),
    };
  }, [currentVersionData, entityType]);

  const versionComponent = () => {
    if (isLoading) {
      return <Loader />;
    }

    if (!viewVersionPermission) {
      return (
        <ErrorPlaceHolder
          className="border-none"
          permissionValue={t('label.view-entity', {
            entity: `${getEntityName(currentVersionData)} ${t(
              'label.version'
            )}`,
          })}
          type={ERROR_PLACEHOLDER_TYPE.PERMISSION}
        />
      );
    }

    let VersionPage = null;

    switch (entityType) {
      case EntityType.TABLE: {
        return (
          <TableVersion
            backHandler={backHandler}
            currentVersionData={currentVersionData as Table}
            dataProducts={currentVersionData.dataProducts}
            deleted={currentVersionData.deleted}
            domain={domain}
            entityPermissions={entityPermissions}
            isVersionLoading={isVersionLoading}
            owners={owners}
            slashedTableName={slashedEntityName}
            tier={tier as TagLabel}
            version={version}
            versionHandler={versionHandler}
            versionList={versionList}
          />
        );
      }
      case EntityType.TOPIC: {
        return (
          <TopicVersion
            backHandler={backHandler}
            currentVersionData={currentVersionData as Topic}
            dataProducts={currentVersionData.dataProducts}
            deleted={currentVersionData.deleted}
            domain={domain}
            entityPermissions={entityPermissions}
            isVersionLoading={isVersionLoading}
            owners={owners}
            slashedTopicName={slashedEntityName}
            tier={tier as TagLabel}
            version={version}
            versionHandler={versionHandler}
            versionList={versionList}
          />
        );
      }

      case EntityType.DASHBOARD: {
        return (
          <DashboardVersion
            backHandler={backHandler}
            currentVersionData={currentVersionData as Dashboard}
            dataProducts={currentVersionData.dataProducts}
            deleted={currentVersionData.deleted}
            domain={domain}
            entityPermissions={entityPermissions}
            isVersionLoading={isVersionLoading}
            owners={owners}
            slashedDashboardName={slashedEntityName}
            tier={tier as TagLabel}
            version={version}
            versionHandler={versionHandler}
            versionList={versionList}
          />
        );
      }

      case EntityType.PIPELINE: {
        return (
          <PipelineVersion
            backHandler={backHandler}
            currentVersionData={currentVersionData as Pipeline}
            dataProducts={currentVersionData.dataProducts}
            deleted={currentVersionData.deleted}
            domain={domain}
            entityPermissions={entityPermissions}
            isVersionLoading={isVersionLoading}
            owners={owners}
            slashedPipelineName={slashedEntityName}
            tier={tier as TagLabel}
            version={version}
            versionHandler={versionHandler}
            versionList={versionList}
          />
        );
      }

      case EntityType.MLMODEL: {
        return (
          <MlModelVersion
            backHandler={backHandler}
            currentVersionData={currentVersionData as Mlmodel}
            dataProducts={currentVersionData.dataProducts}
            deleted={currentVersionData.deleted}
            domain={domain}
            entityPermissions={entityPermissions}
            isVersionLoading={isVersionLoading}
            owners={owners}
            slashedMlModelName={slashedEntityName}
            tier={tier as TagLabel}
            version={version}
            versionHandler={versionHandler}
            versionList={versionList}
          />
        );
      }
      case EntityType.CONTAINER: {
        return (
          <ContainerVersion
            backHandler={backHandler}
            breadCrumbList={slashedEntityName}
            currentVersionData={currentVersionData as Container}
            dataProducts={currentVersionData.dataProducts}
            deleted={currentVersionData.deleted}
            domain={domain}
            entityPermissions={entityPermissions}
            isVersionLoading={isVersionLoading}
            owners={owners}
            tier={tier as TagLabel}
            version={version}
            versionHandler={versionHandler}
            versionList={versionList}
          />
        );
      }
      case EntityType.SEARCH_INDEX: {
        return (
          <SearchIndexVersion
            backHandler={backHandler}
            breadCrumbList={slashedEntityName}
            currentVersionData={currentVersionData as SearchIndex}
            dataProducts={currentVersionData.dataProducts}
            deleted={currentVersionData.deleted}
            domain={domain}
            entityPermissions={entityPermissions}
            isVersionLoading={isVersionLoading}
            owners={owners}
            tier={tier as TagLabel}
            version={version}
            versionHandler={versionHandler}
            versionList={versionList}
          />
        );
      }

      case EntityType.DASHBOARD_DATA_MODEL: {
        return (
          <DataModelVersion
            backHandler={backHandler}
            currentVersionData={currentVersionData as DashboardDataModel}
            dataProducts={currentVersionData.dataProducts}
            deleted={currentVersionData.deleted}
            domain={domain}
            entityPermissions={entityPermissions}
            isVersionLoading={isVersionLoading}
            owners={owners}
            slashedDataModelName={slashedEntityName}
            tier={tier as TagLabel}
            version={version}
            versionHandler={versionHandler}
            versionList={versionList}
          />
        );
      }

      case EntityType.STORED_PROCEDURE: {
        return (
          <StoredProcedureVersion
            backHandler={backHandler}
            currentVersionData={currentVersionData as StoredProcedure}
            dataProducts={currentVersionData.dataProducts}
            deleted={currentVersionData.deleted}
            domain={domain}
            entityPermissions={entityPermissions}
            isVersionLoading={isVersionLoading}
            owners={owners}
            slashedTableName={slashedEntityName}
            tier={tier as TagLabel}
            version={version}
            versionHandler={versionHandler}
            versionList={versionList}
          />
        );
      }

      case EntityType.API_ENDPOINT: {
        return (
          <APIEndpointVersion
            backHandler={backHandler}
            currentVersionData={currentVersionData as APIEndpoint}
            domain={domain}
            entityPermissions={entityPermissions}
            isVersionLoading={isVersionLoading}
            owners={owners}
            slashedApiEndpointName={slashedEntityName}
            tier={tier as TagLabel}
            version={version}
            versionHandler={versionHandler}
            versionList={versionList}
          />
        );
      }
      case EntityType.METRIC: {
        return (
          <MetricVersion
            backHandler={backHandler}
            currentVersionData={currentVersionData as Metric}
            domain={domain}
            entityPermissions={entityPermissions}
            isVersionLoading={isVersionLoading}
            owners={owners}
            slashedMetricName={slashedEntityName}
            tier={tier as TagLabel}
            version={version}
            versionHandler={versionHandler}
            versionList={versionList}
          />
        );
      }

      case EntityType.DATABASE: {
        return <DatabaseVersionPage />;
      }

      case EntityType.DATABASE_SCHEMA: {
        return <DatabaseSchemaVersionPage />;
      }

      case EntityType.DATA_PRODUCT: {
        return <DataProductsPage />;
      }

      case EntityType.API_COLLECTION: {
        return <APICollectionVersionPage />;
      }

      default:
        VersionPage = entityUtilClassBase.getEntityDetailComponent(entityType);

        return VersionPage && <VersionPage />;
    }
  };

  useEffect(() => {
    fetchEntityPermissions();
  }, [decodedEntityFQN]);

  useEffect(() => {
    if (viewVersionPermission) {
      fetchEntityVersions();
    }
  }, [decodedEntityFQN, viewVersionPermission]);

  useEffect(() => {
    if (entityId) {
      fetchCurrentVersion(entityId);
    }
  }, [version, entityId]);

  return (
    <PageLayoutV1
      className="version-page-container"
      pageTitle={t('label.entity-detail-plural', {
        entity: getEntityName(currentVersionData),
      })}>
      {versionComponent()}
    </PageLayoutV1>
  );
};

export default EntityVersionPage;
