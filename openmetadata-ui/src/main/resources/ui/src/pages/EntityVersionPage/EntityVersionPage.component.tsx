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
  type ReactNode,
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
import { DriveAssetEntityTypes } from '../../rest/driveAPI.interface';
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
import { getOwnHandler } from '../../utils/RecordUtils';
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
    () => navigate(getEntityDetailsPath(entityType, decodedEntityFQN)),
    [entityType, decodedEntityFQN]
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

    const fetchDriveAssetVersions = async () => {
      const driveEntityType = entityType as DriveAssetEntityTypes;
      const { id } = await getDriveAssetByFqn(
        decodedEntityFQN,
        driveEntityType
      );
      setEntityId(id ?? '');
      const versions = await getDriveAssetsVersions(id ?? '', driveEntityType);
      setVersionList(versions as unknown as EntityHistory);
    };

    const versionFetchers: Partial<Record<EntityType, () => Promise<void>>> = {
      [EntityType.TABLE]: async () => {
        const { id } = await getTableDetailsByFQN(decodedEntityFQN, {
          include: Include.All,
        });
        setEntityId(id);
        setVersionList(await getTableVersions(id));
      },
      [EntityType.TOPIC]: async () => {
        const { id } = await getTopicByFqn(decodedEntityFQN, {
          include: Include.All,
        });
        setEntityId(id);
        setVersionList(await getTopicVersions(id));
      },
      [EntityType.DASHBOARD]: async () => {
        const { id } = await getDashboardByFqn(decodedEntityFQN, {
          include: Include.All,
        });
        setEntityId(id);
        setVersionList(await getDashboardVersions(id));
      },
      [EntityType.PIPELINE]: async () => {
        const { id } = await getPipelineByFqn(decodedEntityFQN, {
          include: Include.All,
        });
        setEntityId(id);
        setVersionList(await getPipelineVersions(id));
      },
      [EntityType.MLMODEL]: async () => {
        const { id } = await getMlModelByFQN(decodedEntityFQN, {
          include: Include.All,
        });
        setEntityId(id);
        setVersionList(await getMlModelVersions(id));
      },
      [EntityType.CONTAINER]: async () => {
        const { id } = await getContainerByName(decodedEntityFQN, {
          include: Include.All,
        });
        setEntityId(id);
        setVersionList(await getContainerVersions(id));
      },
      [EntityType.SEARCH_INDEX]: async () => {
        const { id } = await getSearchIndexDetailsByFQN(decodedEntityFQN, {
          include: Include.All,
        });
        setEntityId(id);
        setVersionList(await getSearchIndexVersions(id));
      },
      [EntityType.DASHBOARD_DATA_MODEL]: async () => {
        const { id } = await getDataModelByFqn(decodedEntityFQN, {
          include: Include.All,
        });
        setEntityId(id ?? '');
        setVersionList(await getDataModelVersionsList(id ?? ''));
      },
      [EntityType.STORED_PROCEDURE]: async () => {
        const { id } = await getStoredProceduresByFqn(decodedEntityFQN, {
          include: Include.All,
        });
        setEntityId(id ?? '');
        setVersionList(await getStoredProceduresVersionsList(id ?? ''));
      },
      [EntityType.API_ENDPOINT]: async () => {
        const { id } = await getApiEndPointByFQN(decodedEntityFQN, {
          include: Include.All,
        });
        setEntityId(id ?? '');
        setVersionList(await getApiEndPointVersions(id ?? ''));
      },
      [EntityType.METRIC]: async () => {
        const { id } = await getMetricByFqn(decodedEntityFQN, {
          include: Include.All,
        });
        setEntityId(id ?? '');
        setVersionList(await getMetricVersions(id ?? ''));
      },
      [EntityType.CHART]: async () => {
        const { id } = await getChartByFqn(decodedEntityFQN, {
          include: Include.All,
        });
        setEntityId(id ?? '');
        setVersionList(await getChartVersions(id ?? ''));
      },
      [EntityType.DIRECTORY]: fetchDriveAssetVersions,
      [EntityType.FILE]: fetchDriveAssetVersions,
      [EntityType.SPREADSHEET]: fetchDriveAssetVersions,
      [EntityType.WORKSHEET]: fetchDriveAssetVersions,
    };

    try {
      await getOwnHandler(versionFetchers, entityType)?.();
    } finally {
      setIsLoading(false);
    }
  }, [entityType, decodedEntityFQN, viewVersionPermission]);

  const fetchCurrentVersion = useCallback(
    async (id: string) => {
      setIsVersionLoading(true);

      const currentVersionFetchers: Partial<
        Record<EntityType, () => Promise<void>>
      > = {
        [EntityType.TABLE]: async () => {
          setCurrentVersionData(await getTableVersion(id, version));
        },
        [EntityType.TOPIC]: async () => {
          setCurrentVersionData(await getTopicVersion(id, version));
        },
        [EntityType.DASHBOARD]: async () => {
          setCurrentVersionData(await getDashboardVersion(id, version));
        },
        [EntityType.PIPELINE]: async () => {
          setCurrentVersionData(await getPipelineVersion(id, version));
        },
        [EntityType.MLMODEL]: async () => {
          setCurrentVersionData(await getMlModelVersion(id, version));
        },
        [EntityType.CONTAINER]: async () => {
          setCurrentVersionData(await getContainerVersion(id, version));
        },
        [EntityType.SEARCH_INDEX]: async () => {
          setCurrentVersionData(await getSearchIndexVersion(id, version));
        },
        [EntityType.DASHBOARD_DATA_MODEL]: async () => {
          setCurrentVersionData(await getDataModelVersion(id, version));
        },
        [EntityType.STORED_PROCEDURE]: async () => {
          setCurrentVersionData(await getStoredProceduresVersion(id, version));
        },
        [EntityType.API_ENDPOINT]: async () => {
          setCurrentVersionData(await getApiEndPointVersion(id, version));
        },
        [EntityType.METRIC]: async () => {
          setCurrentVersionData(await getMetricVersion(id, version));
        },
        [EntityType.CHART]: async () => {
          setCurrentVersionData(await getChartVersion(id, version));
        },
        [EntityType.DIRECTORY]: async () => {
          setCurrentVersionData(
            await getDriveAssetsVersion<Directory>(
              id,
              entityType as DriveAssetEntityTypes,
              version
            )
          );
        },
        [EntityType.FILE]: async () => {
          setCurrentVersionData(
            await getDriveAssetsVersion<File>(
              id,
              entityType as DriveAssetEntityTypes,
              version
            )
          );
        },
        [EntityType.SPREADSHEET]: async () => {
          setCurrentVersionData(
            await getDriveAssetsVersion<Spreadsheet>(
              id,
              entityType as DriveAssetEntityTypes,
              version
            )
          );
        },
        [EntityType.WORKSHEET]: async () => {
          setCurrentVersionData(
            await getDriveAssetsVersion<Worksheet>(
              id,
              entityType as DriveAssetEntityTypes,
              version
            )
          );
        },
      };

      try {
        if (viewVersionPermission) {
          await getOwnHandler(currentVersionFetchers, entityType)?.();
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

    const versionRenderers: Partial<Record<EntityType, () => ReactNode>> = {
      [EntityType.TABLE]: () =>
        TableVersion
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
          : null,
      [EntityType.TOPIC]: () =>
        TopicVersion
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
          : null,
      [EntityType.DASHBOARD]: () =>
        DashboardVersion
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
          : null,
      [EntityType.PIPELINE]: () =>
        PipelineVersion
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
          : null,
      [EntityType.MLMODEL]: () =>
        MlModelVersion
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
          : null,
      [EntityType.CONTAINER]: () =>
        ContainerVersion
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
          : null,
      [EntityType.SEARCH_INDEX]: () =>
        SearchIndexVersion
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
          : null,
      [EntityType.DASHBOARD_DATA_MODEL]: () =>
        DataModelVersion
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
          : null,
      [EntityType.STORED_PROCEDURE]: () =>
        StoredProcedureVersion
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
          : null,
      [EntityType.API_ENDPOINT]: () =>
        APIEndpointVersion
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
          : null,
      [EntityType.METRIC]: () =>
        MetricVersion
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
          : null,
      [EntityType.CHART]: () =>
        ChartVersion
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
          : null,
      [EntityType.DIRECTORY]: () =>
        DirectoryVersion
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
          : null,
      [EntityType.FILE]: () =>
        FileVersion
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
          : null,
      [EntityType.SPREADSHEET]: () =>
        SpreadsheetVersion
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
          : null,
      [EntityType.WORKSHEET]: () =>
        WorksheetVersion
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
          : null,
      [EntityType.DATABASE]: () =>
        DatabaseVersionPage ? wrapSuspense(<DatabaseVersionPage />) : null,
      [EntityType.DATABASE_SCHEMA]: () =>
        DatabaseSchemaVersionPage
          ? wrapSuspense(<DatabaseSchemaVersionPage />)
          : null,
      [EntityType.DATA_PRODUCT]: () =>
        DataProductsPage ? wrapSuspense(<DataProductsPage />) : null,
      [EntityType.API_COLLECTION]: () =>
        APICollectionVersionPage
          ? wrapSuspense(<APICollectionVersionPage />)
          : null,
    };

    const renderer = getOwnHandler(versionRenderers, entityType);
    if (renderer) {
      return renderer();
    }

    const VersionPage =
      entityVersionClassBase.getEntityDetailComponent(entityType);

    return VersionPage ? <VersionPage /> : null;
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
