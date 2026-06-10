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
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useState,
  type FunctionComponent,
} from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import ErrorPlaceHolder from '../../components/common/ErrorWithPlaceholder/ErrorPlaceHolder';
import Loader from '../../components/common/Loader/Loader';
import PageLayoutV1 from '../../components/PageLayoutV1/PageLayoutV1';
import { usePermissionProvider } from '../../context/PermissionProvider/PermissionProvider';
import type {
  OperationPermission,
  ResourceEntity,
} from '../../context/PermissionProvider/PermissionProvider.interface';
import { ERROR_PLACEHOLDER_TYPE } from '../../enums/common.enum';
import { EntityTabs, EntityType } from '../../enums/entity.enum';
import type { APIEndpoint } from '../../generated/entity/data/apiEndpoint';
import type { Chart } from '../../generated/entity/data/chart';
import type { Container } from '../../generated/entity/data/container';
import type { Dashboard } from '../../generated/entity/data/dashboard';
import type { DashboardDataModel } from '../../generated/entity/data/dashboardDataModel';
import type { Directory } from '../../generated/entity/data/directory';
import type { File } from '../../generated/entity/data/file';
import type { Metric } from '../../generated/entity/data/metric';
import type { Mlmodel } from '../../generated/entity/data/mlmodel';
import type { Pipeline } from '../../generated/entity/data/pipeline';
import type { SearchIndex } from '../../generated/entity/data/searchIndex';
import type { Spreadsheet } from '../../generated/entity/data/spreadsheet';
import type { StoredProcedure } from '../../generated/entity/data/storedProcedure';
import type { Table } from '../../generated/entity/data/table';
import type { Topic } from '../../generated/entity/data/topic';
import type { Worksheet } from '../../generated/entity/data/worksheet';
import type { EntityHistory } from '../../generated/type/entityHistory';
import { Include } from '../../generated/type/include';
import type { TagLabel } from '../../generated/type/tagLabel';
import { useFqn } from '../../hooks/useFqn';
import {
  getApiEndPointByFQN,
  getApiEndPointVersion,
  getApiEndPointVersions,
} from '../../rest/apiEndpointsAPI';
import {
  getChartByFqn,
  getChartVersion,
  getChartVersions,
} from '../../rest/chartsAPI';
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
  getDriveAssetByFqn,
  getDriveAssetsVersion,
  getDriveAssetsVersions,
} from '../../rest/driveAPI';
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
import { getEntityBreadcrumbs } from '../../utils/EntityBreadcrumbPureUtils';
import { getEntityName } from '../../utils/EntityNameUtils';
import entityUtilClassBase from '../../utils/EntityUtilClassBase';
import entityVersionClassBase from '../../utils/EntityVersionClassBase';
import { DEFAULT_ENTITY_PERMISSION } from '../../utils/PermissionsUtils';
import { getEntityDetailsPath, getVersionPath } from '../../utils/RouterUtils';
import { getTierTags } from '../../utils/TablePureUtils';
import { useRequiredParams } from '../../utils/useRequiredParams';
import './EntityVersionPage.less';

export type VersionData =
  | Table
  | Topic
  | Dashboard
  | Chart
  | Pipeline
  | Mlmodel
  | Container
  | SearchIndex
  | StoredProcedure
  | DashboardDataModel
  | APIEndpoint
  | Metric
  | Directory
  | File
  | Spreadsheet
  | Worksheet;

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
        case EntityType.CHART: {
          const { id } = await getChartByFqn(decodedEntityFQN, {
            include: Include.All,
          });

          setEntityId(id ?? '');

          const versions = await getChartVersions(id ?? '');

          setVersionList(versions);

          break;
        }
        case EntityType.DIRECTORY:
        case EntityType.FILE:
        case EntityType.SPREADSHEET:
        case EntityType.WORKSHEET: {
          const { id } = await getDriveAssetByFqn(decodedEntityFQN, entityType);
          setEntityId(id ?? '');

          const versions = await getDriveAssetsVersions(id ?? '', entityType);

          setVersionList(versions as unknown as EntityHistory);

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
            case EntityType.CHART: {
              const currentVersion = await getChartVersion(id, version);

              setCurrentVersionData(currentVersion);

              break;
            }
            case EntityType.DIRECTORY: {
              const currentVersion = await getDriveAssetsVersion<Directory>(
                id,
                entityType,
                version
              );

              setCurrentVersionData(currentVersion);

              break;
            }
            case EntityType.FILE: {
              const currentVersion = await getDriveAssetsVersion<File>(
                id,
                entityType,
                version
              );

              setCurrentVersionData(currentVersion);

              break;
            }
            case EntityType.SPREADSHEET: {
              const currentVersion = await getDriveAssetsVersion<Spreadsheet>(
                id,
                entityType,
                version
              );

              setCurrentVersionData(currentVersion);

              break;
            }
            case EntityType.WORKSHEET: {
              const currentVersion = await getDriveAssetsVersion<Worksheet>(
                id,
                entityType,
                version
              );

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

  const { owners, domains, tier, slashedEntityName } = useMemo(() => {
    return {
      owners: currentVersionData.owners,
      tier: getTierTags(currentVersionData.tags ?? []),
      domains: currentVersionData.domains,
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

    const TableVersion = entityVersionClassBase.getEntityVersionComponent(
      EntityType.TABLE
    );
    const TopicVersion = entityVersionClassBase.getEntityVersionComponent(
      EntityType.TOPIC
    );
    const DashboardVersion = entityVersionClassBase.getEntityVersionComponent(
      EntityType.DASHBOARD
    );
    const PipelineVersion = entityVersionClassBase.getEntityVersionComponent(
      EntityType.PIPELINE
    );
    const MlModelVersion = entityVersionClassBase.getEntityVersionComponent(
      EntityType.MLMODEL
    );
    const ContainerVersion = entityVersionClassBase.getEntityVersionComponent(
      EntityType.CONTAINER
    );
    const SearchIndexVersion = entityVersionClassBase.getEntityVersionComponent(
      EntityType.SEARCH_INDEX
    );
    const DataModelVersion = entityVersionClassBase.getEntityVersionComponent(
      EntityType.DASHBOARD_DATA_MODEL
    );
    const StoredProcedureVersion =
      entityVersionClassBase.getEntityVersionComponent(
        EntityType.STORED_PROCEDURE
      );
    const APIEndpointVersion = entityVersionClassBase.getEntityVersionComponent(
      EntityType.API_ENDPOINT
    );
    const MetricVersion = entityVersionClassBase.getEntityVersionComponent(
      EntityType.METRIC
    );
    const ChartVersion = entityVersionClassBase.getEntityVersionComponent(
      EntityType.CHART
    );
    const DirectoryVersion = entityVersionClassBase.getEntityVersionComponent(
      EntityType.DIRECTORY
    );
    const FileVersion = entityVersionClassBase.getEntityVersionComponent(
      EntityType.FILE
    );
    const SpreadsheetVersion = entityVersionClassBase.getEntityVersionComponent(
      EntityType.SPREADSHEET
    );
    const WorksheetVersion = entityVersionClassBase.getEntityVersionComponent(
      EntityType.WORKSHEET
    );
    const DatabaseVersionPage =
      entityVersionClassBase.getEntityVersionComponent(EntityType.DATABASE);
    const DatabaseSchemaVersionPage =
      entityVersionClassBase.getEntityVersionComponent(
        EntityType.DATABASE_SCHEMA
      );
    const DataProductsPage = entityVersionClassBase.getEntityVersionComponent(
      EntityType.DATA_PRODUCT
    );
    const APICollectionVersionPage =
      entityVersionClassBase.getEntityVersionComponent(
        EntityType.API_COLLECTION
      );

    const wrapSuspense = (node: JSX.Element) => (
      <Suspense fallback={<Loader />}>{node}</Suspense>
    );

    switch (entityType) {
      case EntityType.TABLE: {
        return TableVersion
          ? wrapSuspense(
              <TableVersion
                backHandler={backHandler}
                currentVersionData={currentVersionData as Table}
                dataProducts={currentVersionData.dataProducts}
                deleted={currentVersionData.deleted}
                domains={domains}
                entityPermissions={entityPermissions}
                isVersionLoading={isVersionLoading}
                owners={owners}
                slashedTableName={slashedEntityName}
                tier={tier as TagLabel}
                version={version}
                versionHandler={versionHandler}
                versionList={versionList}
              />
            )
          : null;
      }
      case EntityType.TOPIC: {
        return TopicVersion
          ? wrapSuspense(
              <TopicVersion
                backHandler={backHandler}
                currentVersionData={currentVersionData as Topic}
                dataProducts={currentVersionData.dataProducts}
                deleted={currentVersionData.deleted}
                domains={domains}
                entityPermissions={entityPermissions}
                isVersionLoading={isVersionLoading}
                owners={owners}
                slashedTopicName={slashedEntityName}
                tier={tier as TagLabel}
                version={version}
                versionHandler={versionHandler}
                versionList={versionList}
              />
            )
          : null;
      }

      case EntityType.DASHBOARD: {
        return DashboardVersion
          ? wrapSuspense(
              <DashboardVersion
                backHandler={backHandler}
                currentVersionData={currentVersionData as Dashboard}
                dataProducts={currentVersionData.dataProducts}
                deleted={currentVersionData.deleted}
                domains={domains}
                entityPermissions={entityPermissions}
                isVersionLoading={isVersionLoading}
                owners={owners}
                slashedDashboardName={slashedEntityName}
                tier={tier as TagLabel}
                version={version}
                versionHandler={versionHandler}
                versionList={versionList}
              />
            )
          : null;
      }

      case EntityType.PIPELINE: {
        return PipelineVersion
          ? wrapSuspense(
              <PipelineVersion
                backHandler={backHandler}
                currentVersionData={currentVersionData as Pipeline}
                dataProducts={currentVersionData.dataProducts}
                deleted={currentVersionData.deleted}
                domains={domains}
                entityPermissions={entityPermissions}
                isVersionLoading={isVersionLoading}
                owners={owners}
                slashedPipelineName={slashedEntityName}
                tier={tier as TagLabel}
                version={version}
                versionHandler={versionHandler}
                versionList={versionList}
              />
            )
          : null;
      }

      case EntityType.MLMODEL: {
        return MlModelVersion
          ? wrapSuspense(
              <MlModelVersion
                backHandler={backHandler}
                currentVersionData={currentVersionData as Mlmodel}
                dataProducts={currentVersionData.dataProducts}
                deleted={currentVersionData.deleted}
                domains={domains}
                entityPermissions={entityPermissions}
                isVersionLoading={isVersionLoading}
                owners={owners}
                slashedMlModelName={slashedEntityName}
                tier={tier as TagLabel}
                version={version}
                versionHandler={versionHandler}
                versionList={versionList}
              />
            )
          : null;
      }
      case EntityType.CONTAINER: {
        return ContainerVersion
          ? wrapSuspense(
              <ContainerVersion
                backHandler={backHandler}
                breadCrumbList={slashedEntityName}
                currentVersionData={currentVersionData as Container}
                dataProducts={currentVersionData.dataProducts}
                deleted={currentVersionData.deleted}
                domains={domains}
                entityPermissions={entityPermissions}
                isVersionLoading={isVersionLoading}
                owners={owners}
                tier={tier as TagLabel}
                version={version}
                versionHandler={versionHandler}
                versionList={versionList}
              />
            )
          : null;
      }
      case EntityType.SEARCH_INDEX: {
        return SearchIndexVersion
          ? wrapSuspense(
              <SearchIndexVersion
                backHandler={backHandler}
                breadCrumbList={slashedEntityName}
                currentVersionData={currentVersionData as SearchIndex}
                dataProducts={currentVersionData.dataProducts}
                deleted={currentVersionData.deleted}
                domains={domains}
                entityPermissions={entityPermissions}
                isVersionLoading={isVersionLoading}
                owners={owners}
                tier={tier as TagLabel}
                version={version}
                versionHandler={versionHandler}
                versionList={versionList}
              />
            )
          : null;
      }

      case EntityType.DASHBOARD_DATA_MODEL: {
        return DataModelVersion
          ? wrapSuspense(
              <DataModelVersion
                backHandler={backHandler}
                currentVersionData={currentVersionData as DashboardDataModel}
                dataProducts={currentVersionData.dataProducts}
                deleted={currentVersionData.deleted}
                domains={domains}
                entityPermissions={entityPermissions}
                isVersionLoading={isVersionLoading}
                owners={owners}
                slashedDataModelName={slashedEntityName}
                tier={tier as TagLabel}
                version={version}
                versionHandler={versionHandler}
                versionList={versionList}
              />
            )
          : null;
      }

      case EntityType.STORED_PROCEDURE: {
        return StoredProcedureVersion
          ? wrapSuspense(
              <StoredProcedureVersion
                backHandler={backHandler}
                currentVersionData={currentVersionData as StoredProcedure}
                dataProducts={currentVersionData.dataProducts}
                deleted={currentVersionData.deleted}
                domains={domains}
                entityPermissions={entityPermissions}
                isVersionLoading={isVersionLoading}
                owners={owners}
                slashedTableName={slashedEntityName}
                tier={tier as TagLabel}
                version={version}
                versionHandler={versionHandler}
                versionList={versionList}
              />
            )
          : null;
      }

      case EntityType.API_ENDPOINT: {
        return APIEndpointVersion
          ? wrapSuspense(
              <APIEndpointVersion
                backHandler={backHandler}
                currentVersionData={currentVersionData as APIEndpoint}
                domains={domains}
                entityPermissions={entityPermissions}
                isVersionLoading={isVersionLoading}
                owners={owners}
                slashedApiEndpointName={slashedEntityName}
                tier={tier as TagLabel}
                version={version}
                versionHandler={versionHandler}
                versionList={versionList}
              />
            )
          : null;
      }
      case EntityType.METRIC: {
        return MetricVersion
          ? wrapSuspense(
              <MetricVersion
                backHandler={backHandler}
                currentVersionData={currentVersionData as Metric}
                domains={domains}
                entityPermissions={entityPermissions}
                isVersionLoading={isVersionLoading}
                owners={owners}
                slashedMetricName={slashedEntityName}
                tier={tier as TagLabel}
                version={version}
                versionHandler={versionHandler}
                versionList={versionList}
              />
            )
          : null;
      }
      case EntityType.CHART: {
        return ChartVersion
          ? wrapSuspense(
              <ChartVersion
                backHandler={backHandler}
                currentVersionData={currentVersionData as Chart}
                dataProducts={currentVersionData.dataProducts}
                deleted={currentVersionData.deleted}
                domains={domains}
                entityPermissions={entityPermissions}
                isVersionLoading={isVersionLoading}
                owners={owners}
                slashedChartName={slashedEntityName as unknown as string[]}
                tier={tier as TagLabel}
                version={version}
                versionHandler={versionHandler}
                versionList={versionList}
              />
            )
          : null;
      }
      case EntityType.DIRECTORY: {
        return DirectoryVersion
          ? wrapSuspense(
              <DirectoryVersion
                backHandler={backHandler}
                breadCrumbList={slashedEntityName}
                currentVersionData={currentVersionData as Directory}
                dataProducts={currentVersionData.dataProducts}
                deleted={currentVersionData.deleted}
                domains={domains}
                entityPermissions={entityPermissions}
                isVersionLoading={isVersionLoading}
                owners={owners}
                tier={tier as TagLabel}
                version={version}
                versionHandler={versionHandler}
                versionList={versionList}
              />
            )
          : null;
      }
      case EntityType.FILE: {
        return FileVersion
          ? wrapSuspense(
              <FileVersion
                backHandler={backHandler}
                breadCrumbList={slashedEntityName}
                currentVersionData={currentVersionData as File}
                dataProducts={currentVersionData.dataProducts}
                deleted={currentVersionData.deleted}
                domains={domains}
                entityPermissions={entityPermissions}
                isVersionLoading={isVersionLoading}
                owners={owners}
                tier={tier as TagLabel}
                version={version}
                versionHandler={versionHandler}
                versionList={versionList}
              />
            )
          : null;
      }
      case EntityType.SPREADSHEET: {
        return SpreadsheetVersion
          ? wrapSuspense(
              <SpreadsheetVersion
                backHandler={backHandler}
                breadCrumbList={slashedEntityName}
                currentVersionData={currentVersionData as Spreadsheet}
                dataProducts={currentVersionData.dataProducts}
                deleted={currentVersionData.deleted}
                domains={domains}
                entityPermissions={entityPermissions}
                isVersionLoading={isVersionLoading}
                owners={owners}
                tier={tier as TagLabel}
                version={version}
                versionHandler={versionHandler}
                versionList={versionList}
              />
            )
          : null;
      }
      case EntityType.WORKSHEET: {
        return WorksheetVersion
          ? wrapSuspense(
              <WorksheetVersion
                backHandler={backHandler}
                breadCrumbList={slashedEntityName}
                currentVersionData={currentVersionData as Worksheet}
                dataProducts={currentVersionData.dataProducts}
                deleted={currentVersionData.deleted}
                domains={domains}
                entityPermissions={entityPermissions}
                isVersionLoading={isVersionLoading}
                owners={owners}
                tier={tier as TagLabel}
                version={version}
                versionHandler={versionHandler}
                versionList={versionList}
              />
            )
          : null;
      }

      case EntityType.DATABASE: {
        return DatabaseVersionPage
          ? wrapSuspense(<DatabaseVersionPage />)
          : null;
      }

      case EntityType.DATABASE_SCHEMA: {
        return DatabaseSchemaVersionPage
          ? wrapSuspense(<DatabaseSchemaVersionPage />)
          : null;
      }

      case EntityType.DATA_PRODUCT: {
        return DataProductsPage ? wrapSuspense(<DataProductsPage />) : null;
      }

      case EntityType.API_COLLECTION: {
        return APICollectionVersionPage
          ? wrapSuspense(<APICollectionVersionPage />)
          : null;
      }

      default: {
        const VersionPage =
          entityVersionClassBase.getEntityDetailComponent(entityType);

        return VersionPage ? <VersionPage /> : null;
      }
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
